import { describe, it, expect, beforeEach } from "vitest";
import { SkillsEngine } from "../skills-engine.js";
import type { Skill, SkillOutcome } from "@ygn-stem/shared";

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-ts",
    name: "TypeScript Plugin",
    description: "Handles TypeScript code generation and refactoring",
    maturity: "nascent",
    tags: ["typescript", "codegen", "plugin"],
    version: "1.0.0",
    ...overrides,
  };
}

function makeOutcome(
  skillId: string,
  outcome: "success" | "failure" | "partial",
  requestId = "req-1",
): SkillOutcome {
  return {
    skillId,
    requestId,
    outcome,
    durationMs: 50,
  };
}

describe("SkillsEngine", () => {
  let engine: SkillsEngine;

  beforeEach(() => {
    engine = new SkillsEngine();
  });

  // ---- register ----------------------------------------------------------

  it("registers a plugin skill", () => {
    const skill = makeSkill();
    engine.register(skill);

    const record = engine.getByName("TypeScript Plugin");
    expect(record).toBeDefined();
    expect(record?.skill.id).toBe("skill-ts");
    expect(record?.stage).toBe("progenitor");
  });

  it("registers multiple skills independently", () => {
    engine.register(makeSkill({ id: "s1", name: "Skill One", tags: ["one"] }));
    engine.register(makeSkill({ id: "s2", name: "Skill Two", tags: ["two"] }));

    expect(engine.listAll()).toHaveLength(2);
  });

  // ---- getByName ---------------------------------------------------------

  it("returns undefined for an unknown skill name", () => {
    expect(engine.getByName("NonExistent")).toBeUndefined();
  });

  it("getByName is case-insensitive", () => {
    engine.register(makeSkill());
    expect(engine.getByName("typescript plugin")).toBeDefined();
    expect(engine.getByName("TYPESCRIPT PLUGIN")).toBeDefined();
  });

  // ---- match -------------------------------------------------------------

  it("matches by trigger keywords", () => {
    engine.register(makeSkill());

    const results = engine.match("typescript refactoring help");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.skillId).toBe("skill-ts");
    expect(results[0]?.score).toBeGreaterThan(0);
  });

  it("returns empty array when no skills match", () => {
    engine.register(makeSkill());
    const results = engine.match("completely unrelated query xyz");
    expect(results).toHaveLength(0);
  });

  it("returns results sorted by score descending", () => {
    // Skill A: many matching tags
    engine.register(
      makeSkill({
        id: "s-a",
        name: "TypeScript Refactor",
        description: "TypeScript refactoring plugin",
        tags: ["typescript", "refactor"],
      }),
    );
    // Skill B: fewer matching tags
    engine.register(
      makeSkill({
        id: "s-b",
        name: "Refactor Helper",
        description: "Basic refactoring",
        tags: ["refactor"],
      }),
    );

    const results = engine.match("typescript refactor");
    expect(results[0]?.score).toBeGreaterThanOrEqual(results[1]?.score ?? 0);
  });

  // ---- canShortCircuit ---------------------------------------------------

  it("committed skills can short-circuit", () => {
    engine.register(makeSkill());
    // Promote to committed: 3 successes
    for (let i = 0; i < 3; i++) {
      engine.recordOutcome(makeOutcome("skill-ts", "success", `req-${i}`));
    }
    expect(engine.canShortCircuit("skill-ts")).toBe(true);
    expect(engine.getByName("TypeScript Plugin")?.stage).toBe("committed");
  });

  it("progenitor skills cannot short-circuit", () => {
    engine.register(makeSkill());
    // Only 1 success — still progenitor
    engine.recordOutcome(makeOutcome("skill-ts", "success"));
    expect(engine.canShortCircuit("skill-ts")).toBe(false);
    expect(engine.getByName("TypeScript Plugin")?.stage).toBe("progenitor");
  });

  // ---- lifecycle: progenitor → committed ---------------------------------

  it("promotes progenitor → committed after 3 successes with ≥60% success rate", () => {
    engine.register(makeSkill());

    // 3 successes → 100% success rate, 3 activations
    for (let i = 0; i < 3; i++) {
      engine.recordOutcome(makeOutcome("skill-ts", "success", `req-${i}`));
    }

    const record = engine.getByName("TypeScript Plugin");
    expect(record?.stage).toBe("committed");
    expect(record?.skill.maturity).toBe("developing");
  });

  it("does not promote when success rate is below 60%", () => {
    engine.register(makeSkill());

    // 2 failures + 1 success = 33% success rate at 3 activations
    engine.recordOutcome(makeOutcome("skill-ts", "failure", "req-0"));
    engine.recordOutcome(makeOutcome("skill-ts", "failure", "req-1"));
    engine.recordOutcome(makeOutcome("skill-ts", "success", "req-2"));

    const record = engine.getByName("TypeScript Plugin");
    expect(record?.stage).toBe("progenitor");
  });

  // ---- lifecycle: committed → mature -------------------------------------

  it("promotes committed → mature after 10 activations with ≥60% success", () => {
    engine.register(makeSkill());

    // 10 successes → committed after 3, mature after 10
    for (let i = 0; i < 10; i++) {
      engine.recordOutcome(makeOutcome("skill-ts", "success", `req-${i}`));
    }

    const record = engine.getByName("TypeScript Plugin");
    expect(record?.stage).toBe("mature");
    expect(record?.skill.maturity).toBe("proficient");
  });

  it("mature skills can short-circuit", () => {
    engine.register(makeSkill());
    for (let i = 0; i < 10; i++) {
      engine.recordOutcome(makeOutcome("skill-ts", "success", `req-${i}`));
    }
    expect(engine.canShortCircuit("skill-ts")).toBe(true);
  });

  // ---- lifecycle: apoptosis ----------------------------------------------

  it("triggers apoptosis at ≥10 activations with <30% success rate", () => {
    engine.register(makeSkill());

    // 10 failures → 0% success rate
    for (let i = 0; i < 10; i++) {
      engine.recordOutcome(makeOutcome("skill-ts", "failure", `req-${i}`));
    }

    // Skill should be deleted
    expect(engine.getByName("TypeScript Plugin")).toBeUndefined();
    expect(engine.listAll()).toHaveLength(0);
  });

  it("does not trigger apoptosis before 10 activations even with 0% success", () => {
    engine.register(makeSkill());

    // 9 failures
    for (let i = 0; i < 9; i++) {
      engine.recordOutcome(makeOutcome("skill-ts", "failure", `req-${i}`));
    }

    expect(engine.getByName("TypeScript Plugin")).toBeDefined();
  });

  it("does not trigger apoptosis when success rate is at or above 30%", () => {
    engine.register(makeSkill());

    // 7 successes + 3 failures = 70% success rate at 10 activations
    for (let i = 0; i < 7; i++) {
      engine.recordOutcome(makeOutcome("skill-ts", "success", `req-s${i}`));
    }
    for (let i = 0; i < 3; i++) {
      engine.recordOutcome(makeOutcome("skill-ts", "failure", `req-f${i}`));
    }

    expect(engine.getByName("TypeScript Plugin")).toBeDefined();
  });

  // ---- listAll -----------------------------------------------------------

  it("listAll returns all registered skills", () => {
    engine.register(makeSkill({ id: "s1", name: "Skill One", tags: [] }));
    engine.register(makeSkill({ id: "s2", name: "Skill Two", tags: [] }));
    expect(engine.listAll()).toHaveLength(2);
  });

  it("listAll excludes apoptosed skills", () => {
    engine.register(makeSkill({ id: "s1", name: "Dying Skill", tags: [] }));
    engine.register(makeSkill({ id: "s2", name: "Healthy Skill", tags: ["healthy"] }));

    for (let i = 0; i < 10; i++) {
      engine.recordOutcome(makeOutcome("s1", "failure", `req-${i}`));
    }

    const all = engine.listAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe("s2");
  });

  // ---- match with maturity bonus -----------------------------------------

  it("committed skills score higher than progenitor for the same match", () => {
    engine.register(makeSkill({ id: "committed-skill", name: "Committed Plugin", description: "plugin helper", tags: ["plugin"] }));
    engine.register(makeSkill({ id: "progenitor-skill", name: "New Plugin", description: "plugin starter", tags: ["plugin"] }));

    // Promote committed-skill to committed
    for (let i = 0; i < 3; i++) {
      engine.recordOutcome(makeOutcome("committed-skill", "success", `req-${i}`));
    }

    const results = engine.match("plugin");
    const committedResult = results.find((r) => r.skillId === "committed-skill");
    const progenitorResult = results.find((r) => r.skillId === "progenitor-skill");

    expect(committedResult?.score).toBeGreaterThan(progenitorResult?.score ?? 0);
  });
});
