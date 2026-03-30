import { describe, it, expect, beforeAll } from "vitest";
import { OnnxEmbeddingProvider } from "../embeddings/onnx-provider.js";

const FAKE_PATH = "/nonexistent/model.onnx";
const MODEL_PATH = process.env["ONNX_MODEL_PATH"];

// ── Tests that don't need a real model ────────────────────────────────────────

describe("OnnxEmbeddingProvider (no model)", () => {
  it("throws on load if model path does not exist", async () => {
    const provider = new OnnxEmbeddingProvider({ modelPath: FAKE_PATH });
    await expect(provider.load()).rejects.toThrow();
  });

  it("throws on embed if not loaded (message contains 'not loaded')", async () => {
    const provider = new OnnxEmbeddingProvider({ modelPath: FAKE_PATH });
    await expect(provider.embed(["hello"])).rejects.toThrow(/not loaded/i);
  });

  it("throws on embedSingle if not loaded (message contains 'not loaded')", async () => {
    const provider = new OnnxEmbeddingProvider({ modelPath: FAKE_PATH });
    await expect(provider.embedSingle("hello")).rejects.toThrow(/not loaded/i);
  });

  it("reports correct dimensions from constructor (default 768)", () => {
    const provider = new OnnxEmbeddingProvider({ modelPath: FAKE_PATH });
    expect(provider.dimensions).toBe(768);
  });

  it("reports correct custom dimensions from constructor", () => {
    const provider = new OnnxEmbeddingProvider({
      modelPath: FAKE_PATH,
      dimensions: 384,
    });
    expect(provider.dimensions).toBe(384);
  });

  it("modelName contains the file name", () => {
    const provider = new OnnxEmbeddingProvider({
      modelPath: "/some/path/model.onnx",
    });
    expect(provider.modelName).toContain("model.onnx");
  });
});

// ── Tests that require a real ONNX model ─────────────────────────────────────

describe.skipIf(!MODEL_PATH)(
  "OnnxEmbeddingProvider (requires ONNX_MODEL_PATH)",
  () => {
    let provider: OnnxEmbeddingProvider;

    beforeAll(async () => {
      provider = new OnnxEmbeddingProvider({ modelPath: MODEL_PATH! });
      await provider.load();
    });

    it("embeds to correct dimensions", async () => {
      const vec = await provider.embedSingle("hello world");
      expect(vec).toHaveLength(provider.dimensions);
    });

    it("produces L2-normalized vectors (single)", async () => {
      const vec = await provider.embedSingle("test normalization");
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 5);
    });

    it("produces L2-normalized vectors (batch)", async () => {
      const vecs = await provider.embed(["first text", "second text"]);
      for (const vec of vecs) {
        const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
        expect(norm).toBeCloseTo(1.0, 5);
      }
    });

    it("similar texts have higher cosine similarity than dissimilar texts", async () => {
      const [cat1, cat2, car] = await provider.embed([
        "The cat sat on the mat",
        "A cat resting on a rug",
        "Formula one racing car engine",
      ]);

      const simCats =
        cat1!.reduce((s, v, i) => s + v * cat2![i]!, 0);
      const simDiff =
        cat1!.reduce((s, v, i) => s + v * car![i]!, 0);

      expect(simCats).toBeGreaterThan(simDiff);
    });

    it("batch matches individual embeds", async () => {
      const texts = [
        "machine learning in production",
        "database indexing strategies",
        "TypeScript type system",
      ];
      const batch = await provider.embed(texts);
      expect(batch).toHaveLength(3);

      for (let i = 0; i < texts.length; i++) {
        const single = await provider.embedSingle(texts[i]!);
        expect(batch[i]).toHaveLength(single.length);
        for (let j = 0; j < single.length; j++) {
          expect(batch[i]![j]).toBeCloseTo(single[j]!, 5);
        }
      }
    });
  },
);
