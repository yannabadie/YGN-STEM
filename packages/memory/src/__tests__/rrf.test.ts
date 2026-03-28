import { describe, it, expect } from "vitest";
import { reciprocalRankFusion, type RankedItem } from "../retrieval/rrf.js";

describe("reciprocalRankFusion", () => {
  it("single list preserves rank order", () => {
    const list: RankedItem[] = [
      { id: "a", source: "episodes", rank: 1, originalScore: 0.9, item: { name: "a" } },
      { id: "b", source: "episodes", rank: 2, originalScore: 0.7, item: { name: "b" } },
      { id: "c", source: "episodes", rank: 3, originalScore: 0.5, item: { name: "c" } },
    ];

    const result = reciprocalRankFusion([list]);
    expect(result).toHaveLength(3);
    expect(result[0]!.id).toBe("a");
    expect(result[1]!.id).toBe("b");
    expect(result[2]!.id).toBe("c");
  });

  it("two lists with same item at different ranks fuses correctly", () => {
    const list1: RankedItem[] = [
      { id: "a", source: "episodes", rank: 1, originalScore: 0.9, item: { name: "a" } },
      { id: "b", source: "episodes", rank: 2, originalScore: 0.8, item: { name: "b" } },
    ];
    const list2: RankedItem[] = [
      { id: "b", source: "facts", rank: 1, originalScore: 0.95, item: { name: "b" } },
      { id: "c", source: "facts", rank: 2, originalScore: 0.6, item: { name: "c" } },
    ];

    const result = reciprocalRankFusion([list1, list2]);

    // "b" appears in both lists at rank 2 and rank 1, so it gets:
    // 1/(60+2) + 1/(60+1) = 1/62 + 1/61
    // "a" only in list1 at rank 1: 1/(60+1) = 1/61
    // "c" only in list2 at rank 2: 1/(60+2) = 1/62
    // b > a > c
    expect(result[0]!.id).toBe("b");
    expect(result[1]!.id).toBe("a");
    expect(result[2]!.id).toBe("c");
  });

  it("items appearing in multiple sources score higher", () => {
    const list1: RankedItem[] = [
      { id: "x", source: "episodes", rank: 1, originalScore: 0.9, item: { v: 1 } },
    ];
    const list2: RankedItem[] = [
      { id: "x", source: "facts", rank: 1, originalScore: 0.8, item: { v: 1 } },
    ];
    const list3: RankedItem[] = [
      { id: "y", source: "summaries", rank: 1, originalScore: 0.99, item: { v: 2 } },
    ];

    const result = reciprocalRankFusion([list1, list2, list3]);

    // "x" gets 1/(60+1) * 2 = 2/61
    // "y" gets 1/(60+1) * 1 = 1/61
    expect(result[0]!.id).toBe("x");
    expect(result[0]!.sources).toContain("episodes");
    expect(result[0]!.sources).toContain("facts");
    expect(result[0]!.score).toBeGreaterThan(result[1]!.score);
  });

  it("k parameter affects fusion scores", () => {
    const list: RankedItem[] = [
      { id: "a", source: "episodes", rank: 1, originalScore: 0.9, item: null },
      { id: "b", source: "episodes", rank: 2, originalScore: 0.5, item: null },
    ];

    const resultK60 = reciprocalRankFusion([list], 60);
    const resultK10 = reciprocalRankFusion([list], 10);

    // With k=10, scores are 1/11 and 1/12
    // With k=60, scores are 1/61 and 1/62
    // k=10 produces higher absolute scores
    expect(resultK10[0]!.score).toBeGreaterThan(resultK60[0]!.score);
    expect(resultK10[1]!.score).toBeGreaterThan(resultK60[1]!.score);
  });

  it("empty lists produce empty results", () => {
    const result = reciprocalRankFusion([]);
    expect(result).toHaveLength(0);
  });

  it("preserves sources information", () => {
    const list1: RankedItem[] = [
      { id: "a", source: "episodes", rank: 1, originalScore: 0.9, item: "ep" },
    ];
    const list2: RankedItem[] = [
      { id: "a", source: "facts", rank: 1, originalScore: 0.8, item: "ep" },
    ];

    const result = reciprocalRankFusion([list1, list2]);
    expect(result).toHaveLength(1);
    expect(result[0]!.sources.sort()).toEqual(["episodes", "facts"]);
  });
});
