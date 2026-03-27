import { describe, it, expect, beforeEach } from "vitest";
import { CallerProfiler } from "../caller-profiler.js";
import { InMemoryBeliefsStore } from "@ygn-stem/memory";

describe("CallerProfiler", () => {
  let store: InMemoryBeliefsStore;
  let profiler: CallerProfiler;

  beforeEach(() => {
    store = new InMemoryBeliefsStore();
    profiler = new CallerProfiler(store);
  });

  // ---- getOrCreateProfile ------------------------------------------------

  it("creates a default profile for an unknown caller", async () => {
    const profile = await profiler.getOrCreateProfile("alice");

    expect(profile.callerId).toBe("alice");
    expect(profile.dimensions.size).toBe(21);

    // All dimensions default to 0.5
    for (const dim of profile.dimensions.values()) {
      expect(dim.value).toBe(0.5);
      expect(dim.confidence).toBe(0);
      expect(dim.count).toBe(0);
    }
  });

  it("returns the same profile on repeated calls for the same caller", async () => {
    const first = await profiler.getOrCreateProfile("bob");
    const second = await profiler.getOrCreateProfile("bob");
    expect(first).toBe(second);
  });

  it("persists the default profile to the beliefs store", async () => {
    await profiler.getOrCreateProfile("carol");
    const stored = await store.getById("carol");
    expect(stored).toBeDefined();
    expect(stored?.callerId).toBe("carol");
  });

  // ---- generateSignals ---------------------------------------------------

  it("GENERATE: extracts signals from interaction context", () => {
    const signals = CallerProfiler.generateSignals({
      messageLength: 1000,
      technicalTerms: ["typescript", "generics", "infer"],
      requestedDepth: 0.8,
      timeOfDay: 14,
    });

    expect(typeof signals).toBe("object");
    expect(Object.keys(signals).length).toBeGreaterThan(0);

    // verbosity should reflect message length (1000/2000 = 0.5)
    expect(signals["verbosity_preference"]).toBeCloseTo(0.5, 5);

    // technical_depth: 3 terms / 10 = 0.3
    expect(signals["technical_depth"]).toBeCloseTo(0.3, 5);

    // detail_focus maps directly from requestedDepth
    expect(signals["detail_focus_vs_big_picture"]).toBeCloseTo(0.8, 5);
  });

  it("GENERATE: all signal values are in [0, 1]", () => {
    const signals = CallerProfiler.generateSignals({
      messageLength: 99999,
      technicalTerms: Array.from({ length: 50 }, (_, i) => `term${i}`),
      requestedDepth: 1,
      timeOfDay: 23,
    });

    for (const [key, value] of Object.entries(signals)) {
      expect(value, `${key} out of range`).toBeGreaterThanOrEqual(0);
      expect(value, `${key} out of range`).toBeLessThanOrEqual(1);
    }
  });

  // ---- curate ------------------------------------------------------------

  it("CURATE: updates profile without context collapse", async () => {
    const signals = CallerProfiler.generateSignals({
      messageLength: 2000,
      technicalTerms: ["typescript"],
      requestedDepth: 0.9,
      timeOfDay: 10,
    });

    const updated = await profiler.curate("dave", signals);

    // Dimensions that received signals should be updated (not still exactly 0.5)
    for (const key of Object.keys(signals)) {
      const dim = updated.dimensions.get(key);
      if (dim !== undefined) {
        // After first update with κ=10, gate = 1/(1+10) ≈ 0.0909
        // So value = 0.9091 * signal + 0.0909 * 0.5 — won't be 0.5 exactly
        // unless signal === 0.5
        const gate = 1 / (1 + 10);
        const expectedValue = (1 - gate) * (signals[key] ?? 0.5) + gate * 0.5;
        expect(dim.value).toBeCloseTo(expectedValue, 5);
      }
    }
  });

  it("CURATE: dimensions not in signals remain at default", async () => {
    const signals = { verbosity_preference: 0.9 };
    const updated = await profiler.curate("eve", signals);

    const untouched = updated.dimensions.get("risk_tolerance");
    expect(untouched?.value).toBe(0.5);
    expect(untouched?.count).toBe(0);
  });

  // ---- Confidence gate ---------------------------------------------------

  it("confidence gate increases with interactions", async () => {
    let confidence0 = 0;
    let confidence1 = 0;

    // First interaction
    const sig = { verbosity_preference: 0.8 };
    const after1 = await profiler.curate("frank", sig);
    const dim1 = after1.dimensions.get("verbosity_preference");
    confidence1 = dim1?.confidence ?? 0;

    // Before any interaction the confidence should have been 0
    expect(confidence0).toBe(0);
    // After 1 interaction: gate = 1/(1+10) ≈ 0.0909
    expect(confidence1).toBeCloseTo(1 / 11, 5);

    // Second interaction
    const after2 = await profiler.curate("frank", sig);
    const dim2 = after2.dimensions.get("verbosity_preference");
    const confidence2 = dim2?.confidence ?? 0;

    // After 2 interactions: gate = 2/(2+10) ≈ 0.1667
    expect(confidence2).toBeCloseTo(2 / 12, 5);

    // Confidence should grow monotonically
    expect(confidence2).toBeGreaterThan(confidence1);
  });

  it("confidence gate approaches 1 with many interactions", async () => {
    const sig = { verbosity_preference: 0.9 };
    for (let i = 0; i < 100; i++) {
      await profiler.curate("grace", sig);
    }
    const profile = await profiler.getOrCreateProfile("grace");
    const dim = profile.dimensions.get("verbosity_preference");
    // After 100 interactions: gate = 100/110 ≈ 0.909
    expect(dim?.confidence).toBeGreaterThan(0.9);
  });
});
