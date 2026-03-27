import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CircuitBreaker, CircuitState } from "../circuit-breaker.js";

describe("CircuitBreaker", () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in the closed state", () => {
    expect(cb.state).toBe(CircuitState.Closed);
  });

  it("stays closed on success", async () => {
    await cb.execute(() => Promise.resolve("ok"));
    expect(cb.state).toBe(CircuitState.Closed);
  });

  it("opens after failureThreshold consecutive failures", async () => {
    const failing = () => Promise.reject(new Error("fail"));
    await expect(cb.execute(failing)).rejects.toThrow("fail");
    await expect(cb.execute(failing)).rejects.toThrow("fail");
    expect(cb.state).toBe(CircuitState.Closed);
    await expect(cb.execute(failing)).rejects.toThrow("fail");
    expect(cb.state).toBe(CircuitState.Open);
  });

  it("rejects immediately when open with 'Circuit breaker is open'", async () => {
    const failing = () => Promise.reject(new Error("fail"));
    // trip the breaker
    for (let i = 0; i < 3; i++) {
      await cb.execute(failing).catch(() => {});
    }
    expect(cb.state).toBe(CircuitState.Open);

    await expect(cb.execute(() => Promise.resolve("ok"))).rejects.toThrow(
      "Circuit breaker is open",
    );
  });

  it("transitions to HalfOpen after resetTimeoutMs", async () => {
    const failing = () => Promise.reject(new Error("fail"));
    for (let i = 0; i < 3; i++) {
      await cb.execute(failing).catch(() => {});
    }
    expect(cb.state).toBe(CircuitState.Open);

    vi.advanceTimersByTime(1001);
    expect(cb.state).toBe(CircuitState.HalfOpen);
  });

  it("closes on success in HalfOpen", async () => {
    const failing = () => Promise.reject(new Error("fail"));
    for (let i = 0; i < 3; i++) {
      await cb.execute(failing).catch(() => {});
    }
    vi.advanceTimersByTime(1001);
    expect(cb.state).toBe(CircuitState.HalfOpen);

    await cb.execute(() => Promise.resolve("ok"));
    expect(cb.state).toBe(CircuitState.Closed);
  });

  it("re-opens on failure in HalfOpen", async () => {
    const failing = () => Promise.reject(new Error("fail"));
    for (let i = 0; i < 3; i++) {
      await cb.execute(failing).catch(() => {});
    }
    vi.advanceTimersByTime(1001);
    expect(cb.state).toBe(CircuitState.HalfOpen);

    await cb.execute(failing).catch(() => {});
    expect(cb.state).toBe(CircuitState.Open);
  });

  it("resets failure count on success", async () => {
    const failing = () => Promise.reject(new Error("fail"));
    // Two failures - not yet tripped
    await cb.execute(failing).catch(() => {});
    await cb.execute(failing).catch(() => {});
    expect(cb.state).toBe(CircuitState.Closed);

    // One success resets the counter
    await cb.execute(() => Promise.resolve("ok"));

    // Two more failures should not open it (threshold is 3)
    await cb.execute(failing).catch(() => {});
    await cb.execute(failing).catch(() => {});
    expect(cb.state).toBe(CircuitState.Closed);

    // Third failure after reset trips it
    await cb.execute(failing).catch(() => {});
    expect(cb.state).toBe(CircuitState.Open);
  });
});
