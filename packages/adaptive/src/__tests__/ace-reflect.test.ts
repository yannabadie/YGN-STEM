import { describe, it, expect, beforeEach } from "vitest";
import { AceReflector } from "../ace-reflect.js";
import { CallerProfiler } from "../caller-profiler.js";
import { InMemoryBeliefsStore } from "@ygn-stem/memory";

// ---------------------------------------------------------------------------
// AceReflector unit tests
// ---------------------------------------------------------------------------

describe("AceReflector", () => {
  let reflector: AceReflector;

  beforeEach(() => {
    reflector = new AceReflector();
  });

  it("reports no drift when signals match profile values", () => {
    const profileValues = { verbosity_preference: 0.6, technical_depth: 0.7 };
    const recentSignals = [
      { verbosity_preference: 0.6, technical_depth: 0.7 },
      { verbosity_preference: 0.62, technical_depth: 0.68 },
    ];

    const report = reflector.detect(profileValues, recentSignals);

    expect(report.hasDrift).toBe(false);
    expect(report.driftingDimensions).toHaveLength(0);
    expect(report.signalCount).toBe(2);
  });

  it("detects drift when signals consistently diverge by more than 0.3", () => {
    const profileValues = { verbosity_preference: 0.2 };
    const recentSignals = [
      { verbosity_preference: 0.8 },
      { verbosity_preference: 0.75 },
      { verbosity_preference: 0.85 },
    ];

    const report = reflector.detect(profileValues, recentSignals);

    expect(report.hasDrift).toBe(true);
    expect(report.driftingDimensions).toContain("verbosity_preference");
  });

  it("reports drift magnitude per dimension", () => {
    const profileValues = { verbosity_preference: 0.1, technical_depth: 0.5 };
    const recentSignals = [
      { verbosity_preference: 0.9, technical_depth: 0.55 },
      { verbosity_preference: 0.9, technical_depth: 0.45 },
    ];

    const report = reflector.detect(profileValues, recentSignals);

    // verbosity drifts: |0.1 - 0.9| = 0.8
    expect(report.magnitudes["verbosity_preference"]).toBeCloseTo(0.8, 5);

    // technical_depth does not drift (|0.5 - 0.5| = 0 < 0.3)
    expect(report.magnitudes["technical_depth"]).toBeUndefined();
  });

  it("suggests corrections as the average of recent signals for drifting dimensions", () => {
    const profileValues = { verbosity_preference: 0.0 };
    const recentSignals = [
      { verbosity_preference: 0.8 },
      { verbosity_preference: 0.6 },
    ];

    const report = reflector.detect(profileValues, recentSignals);

    // Correction should be avg of [0.8, 0.6] = 0.7
    expect(report.corrections["verbosity_preference"]).toBeCloseTo(0.7, 5);
  });

  it("ignores single-signal outliers (requires at least 2 signals per dimension)", () => {
    const profileValues = { verbosity_preference: 0.1 };
    // Only one signal — not enough to trigger drift
    const recentSignals = [{ verbosity_preference: 0.9 }];

    const report = reflector.detect(profileValues, recentSignals);

    expect(report.hasDrift).toBe(false);
    expect(report.driftingDimensions).toHaveLength(0);
  });

  it("returns correct signalCount", () => {
    const profileValues = { verbosity_preference: 0.5 };
    const recentSignals = [
      { verbosity_preference: 0.5 },
      { verbosity_preference: 0.5 },
      { verbosity_preference: 0.5 },
    ];

    const report = reflector.detect(profileValues, recentSignals);
    expect(report.signalCount).toBe(3);
  });

  it("handles empty signals list — no drift", () => {
    const profileValues = { verbosity_preference: 0.5 };
    const report = reflector.detect(profileValues, []);

    expect(report.hasDrift).toBe(false);
    expect(report.signalCount).toBe(0);
  });

  it("does not flag a dimension below the 0.3 threshold as drifting", () => {
    // Difference well below 0.3 should NOT trigger drift
    const profileValues = { verbosity_preference: 0.5 };
    const recentSignals = [
      { verbosity_preference: 0.6 }, // diff = 0.1, not > 0.3
      { verbosity_preference: 0.6 },
    ];

    const report = reflector.detect(profileValues, recentSignals);
    expect(report.hasDrift).toBe(false);
  });

  it("detects drift on multiple dimensions independently", () => {
    const profileValues = {
      verbosity_preference: 0.1,
      technical_depth: 0.9,
      formality_level: 0.5,
    };
    const recentSignals = [
      { verbosity_preference: 0.8, technical_depth: 0.1, formality_level: 0.55 },
      { verbosity_preference: 0.75, technical_depth: 0.15, formality_level: 0.45 },
    ];

    const report = reflector.detect(profileValues, recentSignals);

    expect(report.driftingDimensions).toContain("verbosity_preference");
    expect(report.driftingDimensions).toContain("technical_depth");
    expect(report.driftingDimensions).not.toContain("formality_level");
  });
});

// ---------------------------------------------------------------------------
// CallerProfiler.reflect() integration tests
// ---------------------------------------------------------------------------

describe("CallerProfiler.reflect()", () => {
  let store: InMemoryBeliefsStore;
  let profiler: CallerProfiler;

  beforeEach(() => {
    store = new InMemoryBeliefsStore();
    profiler = new CallerProfiler(store);
  });

  it("returns no-drift report when no signals have been recorded", async () => {
    const report = await profiler.reflect("alice");
    expect(report.hasDrift).toBe(false);
    expect(report.signalCount).toBe(0);
  });

  it("returns no-drift when signals match profile values", async () => {
    // Curate twice with signals that align with defaults (≈0.5)
    await profiler.curate("bob", { verbosity_preference: 0.5 });
    await profiler.curate("bob", { verbosity_preference: 0.5 });

    const report = await profiler.reflect("bob");
    expect(report.hasDrift).toBe(false);
  });

  it("detects drift and applies corrections when signals consistently diverge", async () => {
    // Strategy:
    // 1. Stabilize a profile near 0.0 by curating many times with 0.0 using profiler1
    // 2. Create profiler2 sharing the same store (loads stabilised profile) but
    //    with fresh signal history, then curate 2x with 0.9 — triggers drift
    //    because stored value ≈ 0 but recent avg ≈ 0.9 (diff > 0.3).

    // Step 1: stabilise profile for "dana" to near 0.0
    const store2 = new InMemoryBeliefsStore();
    const profiler1 = new CallerProfiler(store2);
    for (let i = 0; i < 30; i++) {
      await profiler1.curate("dana", { verbosity_preference: 0.0 });
    }
    // After 30 iterations with 0.0: gate≈30/40=0.75, value ≈ 0.25*0.0 + 0.75*prev
    // iterating converges to near 0.0; let's verify it's well below 0.5

    // Step 2: fresh profiler2, same store → loads stabilised profile (~0.0ish value)
    // then curate 2x with 0.9 → history = [0.9, 0.9], profile stays near 0.0
    const profiler2 = new CallerProfiler(store2);
    await profiler2.curate("dana", { verbosity_preference: 0.9 });
    await profiler2.curate("dana", { verbosity_preference: 0.9 });

    const report = await profiler2.reflect("dana");

    // Profile value for verbosity_preference is near 0 (from 30 curates of 0.0);
    // recent signals average to 0.9; diff > 0.3 → drift
    expect(report.hasDrift).toBe(true);
    expect(report.driftingDimensions).toContain("verbosity_preference");
    expect(report.corrections["verbosity_preference"]).toBeCloseTo(0.9, 5);
  });

  it("does not trigger drift from a single signal (requires 2+)", async () => {
    // Only one curate call → only 1 signal in history
    await profiler.curate("eve", { verbosity_preference: 0.9 });

    const report = await profiler.reflect("eve");
    expect(report.hasDrift).toBe(false);
  });
});
