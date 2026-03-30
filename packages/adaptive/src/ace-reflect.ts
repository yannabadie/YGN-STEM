// ---------------------------------------------------------------------------
// ACE Reflect — Drift detector
// ---------------------------------------------------------------------------

const DRIFT_THRESHOLD = 0.3;
const MIN_SIGNALS = 2;

export interface DriftReport {
  hasDrift: boolean;
  driftingDimensions: string[];
  magnitudes: Record<string, number>;  // per-dimension drift magnitude
  corrections: Record<string, number>; // suggested new values
  signalCount: number;
}

export class AceReflector {
  /**
   * Compare stored profile values against recent behavioral signals.
   *
   * A dimension is considered drifting when:
   *   - At least MIN_SIGNALS (2) of the recent signals exist for that dimension
   *   - The absolute difference between the stored value and the average recent
   *     signal exceeds DRIFT_THRESHOLD (0.3)
   *
   * Corrections are set to the average of recent signals for drifting dimensions.
   */
  detect(
    profileValues: Record<string, number>,
    recentSignals: Record<string, number>[],
  ): DriftReport {
    const signalCount = recentSignals.length;

    // Aggregate signals per dimension
    const sumByDim = new Map<string, number>();
    const cntByDim = new Map<string, number>();

    for (const signal of recentSignals) {
      for (const [dim, val] of Object.entries(signal)) {
        sumByDim.set(dim, (sumByDim.get(dim) ?? 0) + val);
        cntByDim.set(dim, (cntByDim.get(dim) ?? 0) + 1);
      }
    }

    const driftingDimensions: string[] = [];
    const magnitudes: Record<string, number> = {};
    const corrections: Record<string, number> = {};

    for (const [dim, profileVal] of Object.entries(profileValues)) {
      const count = cntByDim.get(dim) ?? 0;
      if (count < MIN_SIGNALS) continue;

      const avg = (sumByDim.get(dim) ?? 0) / count;
      const magnitude = Math.abs(profileVal - avg);

      if (magnitude > DRIFT_THRESHOLD) {
        driftingDimensions.push(dim);
        magnitudes[dim] = magnitude;
        corrections[dim] = avg;
      }
    }

    return {
      hasDrift: driftingDimensions.length > 0,
      driftingDimensions,
      magnitudes,
      corrections,
      signalCount,
    };
  }
}
