import { existsSync } from "node:fs";
import { basename } from "node:path";
import type { EmbeddingProvider } from "./types.js";

export interface OnnxProviderOptions {
  /** Absolute path to the .onnx model file. */
  modelPath: string;
  /** Output embedding dimensions. Default: 768 (Arctic Embed M). */
  dimensions?: number;
  /** Maximum token sequence length. Default: 512. */
  maxLength?: number;
}

/**
 * ONNX Runtime embedding provider.
 *
 * Designed for Snowflake Arctic Embed M (768d) — the same model used by SAGE —
 * so vectors live in the same embedding space and federated recall produces
 * meaningful cosine similarities.
 *
 * Usage:
 *   const provider = new OnnxEmbeddingProvider({ modelPath: "/path/to/model.onnx" });
 *   await provider.load();
 *   const vec = await provider.embedSingle("hello world");
 */
export class OnnxEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  readonly modelName: string;

  private readonly modelPath: string;
  private readonly maxLength: number;
  // Typed as `any` to avoid requiring onnxruntime-node types at the call site
  // when the optional model tests are skipped.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private session: any | null = null;

  constructor(options: OnnxProviderOptions) {
    this.modelPath = options.modelPath;
    this.dimensions = options.dimensions ?? 768;
    this.maxLength = options.maxLength ?? 512;
    this.modelName = `onnx:${basename(this.modelPath)}`;
  }

  /**
   * Load the ONNX model from disk. Must be called before embed() / embedSingle().
   * Throws if the file does not exist or if onnxruntime-node fails to create a
   * session (e.g. corrupt model, unsupported opset).
   */
  async load(): Promise<void> {
    if (!existsSync(this.modelPath)) {
      throw new Error(
        `OnnxEmbeddingProvider: model file not found at "${this.modelPath}"`,
      );
    }

    // Dynamic import keeps the module loadable even when onnxruntime-node is
    // not installed — only tests that call load() actually need the binary.
    const ort = await import("onnxruntime-node");
    this.session = await ort.InferenceSession.create(this.modelPath, {
      executionProviders: ["cpu"],
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    this.assertLoaded();
    return Promise.all(texts.map((t) => this.runInference(t)));
  }

  async embedSingle(text: string): Promise<number[]> {
    this.assertLoaded();
    return this.runInference(text);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private assertLoaded(): void {
    if (this.session === null) {
      throw new Error(
        `OnnxEmbeddingProvider: model is not loaded. Call load() before embedding.`,
      );
    }
  }

  /**
   * Tokenize → run ONNX session → mean-pool → L2-normalize.
   */
  private async runInference(text: string): Promise<number[]> {
    const ort = await import("onnxruntime-node");

    const { inputIds, attentionMask } = this.tokenize(text);
    const seqLen = inputIds.length;

    // Build ONNX tensors. The model expects [batchSize=1, seqLen].
    const inputIdsTensor = new ort.Tensor(
      "int64",
      BigInt64Array.from(inputIds.map(BigInt)),
      [1, seqLen],
    );
    const attentionMaskTensor = new ort.Tensor(
      "int64",
      BigInt64Array.from(attentionMask.map(BigInt)),
      [1, seqLen],
    );
    const tokenTypeIdsTensor = new ort.Tensor(
      "int64",
      new BigInt64Array(seqLen), // all zeros
      [1, seqLen],
    );

    // Feed all three standard BERT inputs; some models only use a subset.
    const feeds: Record<string, unknown> = {
      input_ids: inputIdsTensor,
      attention_mask: attentionMaskTensor,
      token_type_ids: tokenTypeIdsTensor,
    };

    // Remove inputs the model doesn't actually declare.
    const validNames = new Set(
      this.session.inputNames as string[],
    );
    for (const key of Object.keys(feeds)) {
      if (!validNames.has(key)) {
        delete feeds[key];
      }
    }

    const results = await this.session.run(feeds);

    // The first output is typically last_hidden_state: [1, seqLen, hiddenSize]
    const outputKey = (this.session.outputNames as string[])[0]!;
    const outputTensor = results[outputKey] as {
      data: Float32Array;
      dims: number[];
    };
    const [, outSeqLen, hiddenSize] = outputTensor.dims as [
      number,
      number,
      number,
    ];

    // Mean pooling over tokens weighted by attention mask.
    const pooled = new Float64Array(hiddenSize);
    let maskSum = 0;
    for (let t = 0; t < outSeqLen; t++) {
      const weight = Number(attentionMask[t] ?? 1);
      maskSum += weight;
      for (let h = 0; h < hiddenSize; h++) {
        pooled[h]! += outputTensor.data[t * hiddenSize + h]! * weight;
      }
    }
    if (maskSum > 0) {
      for (let h = 0; h < hiddenSize; h++) {
        pooled[h]! /= maskSum;
      }
    }

    return l2Normalize(Array.from(pooled));
  }

  /**
   * Minimal whitespace tokenizer with hash-based vocabulary IDs.
   *
   * Production usage should swap this out for a HuggingFace fast tokenizer
   * (e.g. @xenova/transformers or tokenizers-node) to match the exact
   * vocabulary of Arctic Embed M. This simple tokenizer is sufficient for
   * unit-testing the provider's ONNX session mechanics.
   */
  private tokenize(text: string): {
    inputIds: number[];
    attentionMask: number[];
  } {
    // [CLS] = 101, [SEP] = 102 (BERT convention)
    const CLS = 101;
    const SEP = 102;

    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    const wordIds = words.map((w) => wordToId(w));
    const truncated = wordIds.slice(0, this.maxLength - 2); // reserve CLS + SEP

    const inputIds = [CLS, ...truncated, SEP];
    const attentionMask = new Array<number>(inputIds.length).fill(1);

    return { inputIds, attentionMask };
  }
}

// ── Module-level pure helpers ─────────────────────────────────────────────────

/** Deterministic hash → vocabulary ID (range 1000–30521 to stay in BERT vocab). */
function wordToId(word: string): number {
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
  }
  // Map into [1000, 30521] — avoids special token IDs
  return (((hash >>> 0) % 29522) + 1000);
}

/** In-place L2 normalisation; returns a plain number[]. */
function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}
