export interface RankedItem {
  id: string;
  source: string; // e.g. "facts", "episodes", "sage.memory", "ygn.memory"
  rank: number;
  originalScore: number;
  item: unknown;
}

export function reciprocalRankFusion(
  rankedLists: RankedItem[][],
  k = 60,
): { id: string; score: number; sources: string[]; item: unknown }[] {
  const scores = new Map<
    string,
    { score: number; sources: Set<string>; item: unknown }
  >();

  for (const list of rankedLists) {
    for (const entry of list) {
      const existing = scores.get(entry.id);
      const rrfScore = 1 / (k + entry.rank);
      if (existing) {
        existing.score += rrfScore;
        existing.sources.add(entry.source);
      } else {
        scores.set(entry.id, {
          score: rrfScore,
          sources: new Set([entry.source]),
          item: entry.item,
        });
      }
    }
  }

  return Array.from(scores.entries())
    .map(([id, { score, sources, item }]) => ({
      id,
      score,
      sources: Array.from(sources),
      item,
    }))
    .sort((a, b) => b.score - a.score);
}
