import { describe, it, expect } from "vitest";
import { ucbScore, rankByUCB, type UCBEntry } from "../retrieval/ucb.js";

describe("ucbScore", () => {
  it("high similarity + never retrieved gives high score (exploration bonus)", () => {
    const entry: UCBEntry = {
      id: "a",
      similarity: 0.9,
      hitCount: 0,
      rewardSum: 0,
      totalQueries: 10,
    };
    const score = ucbScore(entry);
    // 0.7 * 0.9 + 0.3 * (0 + Infinity) = Infinity
    expect(score).toBe(Infinity);
  });

  it("high similarity + high reward gives high score", () => {
    const entry: UCBEntry = {
      id: "b",
      similarity: 0.9,
      hitCount: 10,
      rewardSum: 8,
      totalQueries: 100,
    };
    const score = ucbScore(entry);
    // 0.7 * 0.9 + 0.3 * (8/10 + sqrt(2 * ln(100) / 10))
    const expectedMeanReward = 8 / 10;
    const expectedExploration = Math.sqrt((2 * Math.log(100)) / 10);
    const expected =
      0.7 * 0.9 + 0.3 * (expectedMeanReward + expectedExploration);
    expect(score).toBeCloseTo(expected, 10);
  });

  it("low similarity + no reward gives low score", () => {
    const entry: UCBEntry = {
      id: "c",
      similarity: 0.1,
      hitCount: 20,
      rewardSum: 0,
      totalQueries: 100,
    };
    const score = ucbScore(entry);
    // 0.7 * 0.1 + 0.3 * (0 + sqrt(2 * ln(100) / 20))
    const expectedExploration = Math.sqrt((2 * Math.log(100)) / 20);
    const expected = 0.7 * 0.1 + 0.3 * (0 + expectedExploration);
    expect(score).toBeCloseTo(expected, 10);
    // Should be significantly lower than high-similarity high-reward
    expect(score).toBeLessThan(1);
  });

  it("UCB prefers unexplored entries over explored ones (exploration-exploitation)", () => {
    const explored: UCBEntry = {
      id: "explored",
      similarity: 0.95,
      hitCount: 50,
      rewardSum: 40,
      totalQueries: 100,
    };
    const unexplored: UCBEntry = {
      id: "unexplored",
      similarity: 0.6,
      hitCount: 0,
      rewardSum: 0,
      totalQueries: 100,
    };

    const exploredScore = ucbScore(explored);
    const unexploredScore = ucbScore(unexplored);

    // Unexplored gets Infinity from exploration bonus
    expect(unexploredScore).toBeGreaterThan(exploredScore);
  });

  it("exploration bonus decreases as hitCount increases", () => {
    const fewHits: UCBEntry = {
      id: "few",
      similarity: 0.5,
      hitCount: 2,
      rewardSum: 1,
      totalQueries: 100,
    };
    const manyHits: UCBEntry = {
      id: "many",
      similarity: 0.5,
      hitCount: 50,
      rewardSum: 25,
      totalQueries: 100,
    };

    // Same mean reward (0.5), same similarity, but different exploration
    const fewScore = ucbScore(fewHits);
    const manyScore = ucbScore(manyHits);
    expect(fewScore).toBeGreaterThan(manyScore);
  });
});

describe("rankByUCB", () => {
  it("ranks entries by descending UCB score", () => {
    const entries: UCBEntry[] = [
      { id: "low", similarity: 0.1, hitCount: 50, rewardSum: 0, totalQueries: 100 },
      { id: "high", similarity: 0.9, hitCount: 5, rewardSum: 4, totalQueries: 100 },
      { id: "mid", similarity: 0.5, hitCount: 10, rewardSum: 5, totalQueries: 100 },
    ];

    const ranked = rankByUCB(entries);
    for (let i = 0; i < ranked.length - 1; i++) {
      expect(ucbScore(ranked[i]!)).toBeGreaterThanOrEqual(
        ucbScore(ranked[i + 1]!),
      );
    }
  });

  it("never-retrieved entries appear first", () => {
    const entries: UCBEntry[] = [
      { id: "seen", similarity: 0.99, hitCount: 10, rewardSum: 9, totalQueries: 50 },
      { id: "unseen", similarity: 0.3, hitCount: 0, rewardSum: 0, totalQueries: 50 },
    ];

    const ranked = rankByUCB(entries);
    expect(ranked[0]!.id).toBe("unseen");
  });
});
