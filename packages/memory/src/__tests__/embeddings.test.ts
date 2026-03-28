import { describe, it, expect } from "vitest";
import { HashEmbeddingProvider } from "../embeddings/hash-provider.js";

describe("HashEmbeddingProvider", () => {
  const provider = new HashEmbeddingProvider(768);

  it("returns correct dimensions", async () => {
    const vec = await provider.embedSingle("hello world");
    expect(vec).toHaveLength(768);
  });

  it("uses default dimensions of 768", () => {
    const p = new HashEmbeddingProvider();
    expect(p.dimensions).toBe(768);
  });

  it("respects custom dimensions", async () => {
    const p = new HashEmbeddingProvider(128);
    expect(p.dimensions).toBe(128);
    const vec = await p.embedSingle("test input");
    expect(vec).toHaveLength(128);
  });

  it("has modelName 'hash-tf'", () => {
    expect(provider.modelName).toBe("hash-tf");
  });

  it("same text produces same embedding (deterministic)", async () => {
    const text = "TypeScript is a programming language";
    const vec1 = await provider.embedSingle(text);
    const vec2 = await provider.embedSingle(text);
    expect(vec1).toEqual(vec2);
  });

  it("different texts produce different embeddings", async () => {
    const vec1 = await provider.embedSingle("Alice likes cats");
    const vec2 = await provider.embedSingle("Bob enjoys quantum physics");
    expect(vec1).not.toEqual(vec2);
  });

  it("embeddings are L2 normalized", async () => {
    const vec = await provider.embedSingle("normalize this vector please");
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 10);
  });

  it("empty text produces zero vector with norm handled gracefully", async () => {
    const vec = await provider.embedSingle("");
    // All zeros, since no words pass the filter
    expect(vec.every((v) => v === 0)).toBe(true);
  });

  it("batch embed matches individual embeds", async () => {
    const texts = [
      "first document about machine learning",
      "second document about databases",
      "third document about TypeScript",
    ];
    const batch = await provider.embed(texts);
    expect(batch).toHaveLength(3);

    for (let i = 0; i < texts.length; i++) {
      const single = await provider.embedSingle(texts[i]!);
      expect(batch[i]).toEqual(single);
    }
  });

  it("single-character words are filtered out", async () => {
    // "I" and "a" should be filtered since length <= 1
    const vec1 = await provider.embedSingle("I am a developer");
    const vec2 = await provider.embedSingle("am developer");
    expect(vec1).toEqual(vec2);
  });
});
