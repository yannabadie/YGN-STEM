export interface UCBEntry {
  id: string;
  similarity: number; // cosine similarity
  hitCount: number; // times this entry was retrieved
  rewardSum: number; // cumulative usefulness score
  totalQueries: number; // total queries seen
}

export function ucbScore(entry: UCBEntry): number {
  // score = 0.7 * cosine + 0.3 * (mean_reward + sqrt(2 * ln(N) / hits))
  const meanReward =
    entry.hitCount > 0 ? entry.rewardSum / entry.hitCount : 0;
  const exploration =
    entry.hitCount > 0
      ? Math.sqrt((2 * Math.log(entry.totalQueries)) / entry.hitCount)
      : Infinity; // Never-retrieved entries get max exploration bonus
  return 0.7 * entry.similarity + 0.3 * (meanReward + exploration);
}

export function rankByUCB(entries: UCBEntry[]): UCBEntry[] {
  return entries.sort((a, b) => ucbScore(b) - ucbScore(a));
}
