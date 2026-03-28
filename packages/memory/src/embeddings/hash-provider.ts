import type { EmbeddingProvider } from "./types.js";

export class HashEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  readonly modelName = "hash-tf";

  constructor(dimensions = 768) {
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.hashEmbed(t));
  }

  async embedSingle(text: string): Promise<number[]> {
    return this.hashEmbed(text);
  }

  private hashEmbed(text: string): number[] {
    const vec = new Float64Array(this.dimensions);
    const words = text
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 1);
    for (const word of words) {
      // Hash each word to a dimension bucket
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
      }
      const bucket =
        ((hash % this.dimensions) + this.dimensions) % this.dimensions;
      vec[bucket]! += 1;
    }
    // L2 normalize
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return Array.from(vec).map((v) => v / norm);
  }
}
