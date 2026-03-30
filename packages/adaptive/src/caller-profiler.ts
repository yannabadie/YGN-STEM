import type { CallerProfile, ProfileDimension } from "@ygn-stem/shared";
import type { IBeliefsStore } from "@ygn-stem/memory";
import { AceReflector, type DriftReport } from "./ace-reflect.js";

// ---------------------------------------------------------------------------
// ACE Context Engineering — 21 dimensions across 4 categories
// ---------------------------------------------------------------------------

const DIMENSION_KEYS: readonly string[] = [
  // philosophy (8)
  "pragmatism_vs_idealism",
  "risk_tolerance",
  "innovation_orientation",
  "detail_focus_vs_big_picture",
  "speed_vs_thoroughness",
  "collaboration_vs_autonomy",
  "consistency_vs_experimentation",
  "simplicity_vs_completeness",
  // principles (4)
  "correctness_over_speed",
  "testing_emphasis",
  "security_mindedness",
  "code_quality_priority",
  // style (5)
  "formality_level",
  "verbosity_preference",
  "technical_depth",
  "structure_preference",
  "communication_pattern",
  // habits (4)
  "session_length_pattern",
  "iteration_tendency",
  "peak_activity_hours",
  "preferred_interaction_mode",
] as const;

/** κ constant for the confidence gate formula. */
const KAPPA = 10;

// ---------------------------------------------------------------------------
// Internal numeric profile — separate from the shared CallerProfile type
// ---------------------------------------------------------------------------

export interface NumericDimension {
  key: string;
  value: number;    // [0, 1]
  confidence: number; // [0, 1]
  count: number;    // raw interaction count
}

export interface NumericProfile {
  callerId: string;
  dimensions: Map<string, NumericDimension>;
  createdAt: string;
  updatedAt: string;
  interactionCount: number;
}

/** Signals extracted from an interaction context. */
export interface InteractionContext {
  messageLength: number;
  technicalTerms: string[];
  requestedDepth: number; // 0–1 normalised
  timeOfDay: number;      // 0–23 hour
}

// ---------------------------------------------------------------------------
// CallerProfiler
// ---------------------------------------------------------------------------

/** Sliding window size for per-caller signal history. */
const SIGNAL_HISTORY_WINDOW = 20;

export class CallerProfiler {
  private readonly store: IBeliefsStore;
  /** In-process cache of the richer numeric profiles. */
  private readonly cache = new Map<string, NumericProfile>();
  /** Sliding window of recent signals per caller (used by AceReflector). */
  private readonly signalHistory = new Map<string, Record<string, number>[]>();

  constructor(store: IBeliefsStore) {
    this.store = store;
  }

  // -------------------------------------------------------------------------
  // INTERNAL: build a default numeric profile
  // -------------------------------------------------------------------------

  private static makeDefaultNumericProfile(callerId: string): NumericProfile {
    const now = new Date().toISOString();
    const dimensions = new Map<string, NumericDimension>();
    for (const key of DIMENSION_KEYS) {
      dimensions.set(key, { key, value: 0.5, confidence: 0, count: 0 });
    }
    return { callerId, dimensions, createdAt: now, updatedAt: now, interactionCount: 0 };
  }

  // -------------------------------------------------------------------------
  // INTERNAL: confidence gate  gate = n / (n + κ)
  // -------------------------------------------------------------------------

  private static confidenceGate(n: number): number {
    return n / (n + KAPPA);
  }

  // -------------------------------------------------------------------------
  // INTERNAL: convert NumericProfile → CallerProfile (shared schema)
  // -------------------------------------------------------------------------

  private static toCallerProfile(np: NumericProfile): CallerProfile {
    const dimensions: ProfileDimension[] = [];
    for (const dim of np.dimensions.values()) {
      dimensions.push({
        key: dim.key,
        value: String(dim.value),
        confidence: dim.confidence,
      });
    }
    return {
      callerId: np.callerId,
      dimensions,
      createdAt: np.createdAt,
      updatedAt: np.updatedAt,
    };
  }

  // -------------------------------------------------------------------------
  // INTERNAL: hydrate NumericProfile from stored CallerProfile
  // -------------------------------------------------------------------------

  private static fromCallerProfile(
    cp: CallerProfile,
    interactionCount: number,
  ): NumericProfile {
    const dimensions = new Map<string, NumericDimension>();

    // Start with defaults to ensure all 21 keys are present
    for (const key of DIMENSION_KEYS) {
      dimensions.set(key, { key, value: 0.5, confidence: 0, count: 0 });
    }

    for (const dim of cp.dimensions) {
      const value = parseFloat(dim.value);
      const n = Math.round(
        (dim.confidence * KAPPA) / (1 - dim.confidence + Number.EPSILON),
      );
      dimensions.set(dim.key, {
        key: dim.key,
        value: isNaN(value) ? 0.5 : value,
        confidence: dim.confidence,
        count: n,
      });
    }

    return {
      callerId: cp.callerId,
      dimensions,
      createdAt: cp.createdAt,
      updatedAt: cp.updatedAt,
      interactionCount,
    };
  }

  // -------------------------------------------------------------------------
  // PUBLIC: getOrCreateProfile
  // -------------------------------------------------------------------------

  async getOrCreateProfile(callerId: string): Promise<NumericProfile> {
    // Check in-process cache first
    const cached = this.cache.get(callerId);
    if (cached !== undefined) return cached;

    // Check the beliefs store
    const stored = await this.store.getById(callerId);
    if (stored !== undefined) {
      const np = CallerProfiler.fromCallerProfile(stored, stored.interactionCount);
      this.cache.set(callerId, np);
      return np;
    }

    // Create a new default profile
    const np = CallerProfiler.makeDefaultNumericProfile(callerId);
    this.cache.set(callerId, np);

    // Persist skeleton to beliefs store
    await this.store.upsert(CallerProfiler.toCallerProfile(np));
    return np;
  }

  // -------------------------------------------------------------------------
  // STATIC: generateSignals — extract behavioral signals from interaction
  // -------------------------------------------------------------------------

  static generateSignals(context: InteractionContext): Record<string, number> {
    const signals: Record<string, number> = {};

    // verbosity_preference: longer messages → higher verbosity
    signals["verbosity_preference"] = Math.min(1, context.messageLength / 2000);

    // technical_depth: more technical terms → deeper technical preference
    signals["technical_depth"] = Math.min(1, context.technicalTerms.length / 10);

    // requestedDepth maps to detail_focus_vs_big_picture (high depth = detail focus)
    signals["detail_focus_vs_big_picture"] = context.requestedDepth;

    // speed_vs_thoroughness: low requested depth → speed preference
    signals["speed_vs_thoroughness"] = 1 - context.requestedDepth;

    // formality_level: technical terms correlate with formal communication
    signals["formality_level"] = Math.min(
      1,
      context.technicalTerms.length > 0 ? 0.5 + context.technicalTerms.length / 20 : 0.3,
    );

    // peak_activity_hours: normalise hour to [0,1] (0=midnight, 0.5=noon, 1=midnight)
    signals["peak_activity_hours"] = context.timeOfDay / 23;

    // correctness_over_speed: longer, deeper requests suggest correctness focus
    signals["correctness_over_speed"] = context.requestedDepth;

    // communication_pattern: structured if many technical terms
    signals["communication_pattern"] = Math.min(1, context.technicalTerms.length / 5);

    return signals;
  }

  // -------------------------------------------------------------------------
  // PUBLIC: curate — update profile with confidence-gated blending
  // -------------------------------------------------------------------------

  async curate(
    callerId: string,
    signals: Record<string, number>,
  ): Promise<NumericProfile> {
    const np = await this.getOrCreateProfile(callerId);

    // Append to signal history (sliding window)
    const history = this.signalHistory.get(callerId) ?? [];
    history.push(signals);
    if (history.length > SIGNAL_HISTORY_WINDOW) {
      history.splice(0, history.length - SIGNAL_HISTORY_WINDOW);
    }
    this.signalHistory.set(callerId, history);

    for (const [key, signal] of Object.entries(signals)) {
      const existing = np.dimensions.get(key);
      if (existing === undefined) continue;

      const n = existing.count + 1;
      const gate = CallerProfiler.confidenceGate(n);
      const newValue = (1 - gate) * signal + gate * existing.value;
      const newConfidence = gate;

      np.dimensions.set(key, {
        key,
        value: newValue,
        confidence: newConfidence,
        count: n,
      });
    }

    np.updatedAt = new Date().toISOString();
    np.interactionCount += 1;

    // Persist back to store
    const stored = await this.store.upsert(CallerProfiler.toCallerProfile(np));
    np.interactionCount = stored.interactionCount;

    this.cache.set(callerId, np);
    return np;
  }

  // -------------------------------------------------------------------------
  // PUBLIC: reflect — detect drift and recalibrate if needed
  // -------------------------------------------------------------------------

  async reflect(callerId: string): Promise<DriftReport> {
    // 1. Load the profile
    const np = await this.getOrCreateProfile(callerId);

    // 2. Flatten profile dimensions to {key: value} map
    const profileValues: Record<string, number> = {};
    for (const [key, dim] of np.dimensions.entries()) {
      profileValues[key] = dim.value;
    }

    // 3. Get recent signal history for this caller
    const history = this.signalHistory.get(callerId) ?? [];

    // 4. Run AceReflector.detect()
    const reflector = new AceReflector();
    const report = reflector.detect(profileValues, history);

    // 5. If drift found, apply corrections via curate()
    if (report.hasDrift && Object.keys(report.corrections).length > 0) {
      await this.curate(callerId, report.corrections);
    }

    return report;
  }
}
