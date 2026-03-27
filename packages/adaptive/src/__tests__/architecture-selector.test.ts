import { describe, it, expect, beforeEach } from "vitest";
import { ArchitectureSelector } from "../architecture-selector.js";
import type { TaskDescriptor } from "../architecture-selector.js";

describe("ArchitectureSelector", () => {
  let selector: ArchitectureSelector;

  beforeEach(() => {
    selector = new ArchitectureSelector();
  });

  // ---- single-agent (default) --------------------------------------------

  it("routes a simple sequential task to single-agent", () => {
    const task: TaskDescriptor = {};
    const routing = selector.select(task);

    expect(routing.length).toBeGreaterThan(0);
    expect(routing[0]?.organId).toBe("ygn");
    expect(routing[0]?.conditions).toContain("single-agent");
  });

  it("routes a task with some flags but not parallelizable to single-agent", () => {
    const task: TaskDescriptor = { simple: false, isParallelizable: false };
    const routing = selector.select(task);
    expect(routing[0]?.conditions).toContain("single-agent");
  });

  // ---- direct-llm --------------------------------------------------------

  it("routes a simple Q&A with no tools to direct-llm", () => {
    const task: TaskDescriptor = { simple: true, toolDensity: 0 };
    const routing = selector.select(task);

    expect(routing.length).toBe(1);
    expect(routing[0]?.organId).toBe("ygn");
    expect(routing[0]?.conditions).toContain("direct-llm");
  });

  it("does not route to direct-llm when toolDensity > 0", () => {
    const task: TaskDescriptor = { simple: true, toolDensity: 3 };
    const routing = selector.select(task);
    expect(routing[0]?.conditions).not.toContain("direct-llm");
  });

  // ---- centralized-multi-agent -------------------------------------------

  it("routes a parallelizable multi-domain task to centralized multi-agent", () => {
    const task: TaskDescriptor = { isParallelizable: true, domainCount: 3 };
    const routing = selector.select(task);

    const organIds = routing.map((r) => r.organId);
    expect(organIds).toContain("sage");
    expect(organIds).toContain("ygn");
    expect(routing[0]?.conditions).toContain("centralized-multi-agent");
  });

  it("does not route to centralized-multi-agent when domainCount <= 1", () => {
    const task: TaskDescriptor = { isParallelizable: true, domainCount: 1 };
    const routing = selector.select(task);
    expect(routing[0]?.conditions).not.toContain("centralized-multi-agent");
  });

  // ---- adversarial-redblue -----------------------------------------------

  it("routes a high-criticality task to adversarial with oversight", () => {
    const task: TaskDescriptor = { highCriticality: true };
    const routing = selector.select(task);

    const organIds = routing.map((r) => r.organId);
    expect(organIds).toContain("ygn");
    expect(organIds).toContain("metacog");
    expect(routing[0]?.conditions).toContain("adversarial-redblue");
    expect(routing[0]?.conditions).toContain("oversight");
    expect(routing[0]?.conditions).toContain("evidence");
  });

  // ---- smt-pipeline ------------------------------------------------------

  it("routes formal verification tasks to SMT pipeline", () => {
    const task: TaskDescriptor = { requiresFormalVerification: true };
    const routing = selector.select(task);

    const organIds = routing.map((r) => r.organId);
    expect(organIds).toContain("sage");
    expect(organIds).toContain("vm");
    expect(routing[0]?.conditions).toContain("smt-pipeline");
    expect(routing[0]?.conditions).toContain("oversight");
    expect(routing[0]?.conditions).toContain("evidence");
  });

  it("SMT pipeline takes priority over highCriticality", () => {
    const task: TaskDescriptor = {
      requiresFormalVerification: true,
      highCriticality: true,
    };
    const routing = selector.select(task);
    expect(routing[0]?.conditions).toContain("smt-pipeline");
  });

  // ---- knowledge-pipeline ------------------------------------------------

  it("routes knowledge-requiring tasks to knowledge-pipeline", () => {
    const task: TaskDescriptor = { requiresKnowledge: true };
    const routing = selector.select(task);

    const organIds = routing.map((r) => r.organId);
    expect(organIds).toContain("sage");
    expect(organIds).toContain("finance");
    expect(routing[0]?.conditions).toContain("knowledge-pipeline");
  });

  // ---- OrganRouting shape ------------------------------------------------

  it("returns valid OrganRouting objects", () => {
    const routing = selector.select({ highCriticality: true });

    for (const r of routing) {
      expect(typeof r.organId).toBe("string");
      expect(r.organId.length).toBeGreaterThan(0);
      expect(typeof r.priority).toBe("number");
      expect(r.priority).toBeGreaterThanOrEqual(0);
      expect(typeof r.fallback).toBe("boolean");
    }
  });

  it("first organ in multi-organ pipeline has fallback=false", () => {
    const routing = selector.select({ requiresFormalVerification: true });
    expect(routing[0]?.fallback).toBe(false);
    expect(routing[1]?.fallback).toBe(true);
  });
});
