import { describe, it, expect, beforeEach } from "vitest";
import { GeaEvolver } from "../gea-evolution.js";
import { SkillsEngine } from "../skills-engine.js";
import type { Skill } from "@ygn-stem/shared";

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-ts",
    name: "TypeScript Plugin",
    description: "Handles TypeScript code generation and refactoring",
    maturity: "proficient",
    tags: ["typescript", "codegen"],
    version: "1.0.0",
    successRate: 0.9,
    usageCount: 15,
    ...overrides,
  };
}

describe("GeaEvolver", () => {
  let evolver: GeaEvolver;
  let engineA: SkillsEngine;
  let engineB: SkillsEngine;
  let engineC: SkillsEngine;

  beforeEach(() => {
    evolver = new GeaEvolver();
    engineA = new SkillsEngine();
    engineB = new SkillsEngine();
    engineC = new SkillsEngine();
  });

  // ---- registerAgent -------------------------------------------------------

  it("registers multiple agents", () => {
    evolver.registerAgent("agent-a", engineA);
    evolver.registerAgent("agent-b", engineB);
    evolver.registerAgent("agent-c", engineC);

    expect(evolver.getAgentIds()).toHaveLength(3);
    expect(evolver.getAgentIds()).toContain("agent-a");
    expect(evolver.getAgentIds()).toContain("agent-b");
    expect(evolver.getAgentIds()).toContain("agent-c");
  });

  // ---- shareSkill ----------------------------------------------------------

  it("shares a skill from source to targets", async () => {
    evolver.registerAgent("agent-a", engineA);
    evolver.registerAgent("agent-b", engineB);
    evolver.registerAgent("agent-c", engineC);

    engineA.register(makeSkill());

    const events = await evolver.shareSkill("agent-a", "TypeScript Plugin");

    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe("skill_shared");
    expect(events[0]?.sourceAgent).toBe("agent-a");
    expect(events[1]?.sourceAgent).toBe("agent-a");
  });

  it("shared skill starts as progenitor/nascent on target", async () => {
    evolver.registerAgent("agent-a", engineA);
    evolver.registerAgent("agent-b", engineB);

    engineA.register(makeSkill());

    await evolver.shareSkill("agent-a", "TypeScript Plugin");

    const record = engineB.getByName("TypeScript Plugin");
    expect(record).toBeDefined();
    expect(record?.stage).toBe("progenitor");
    expect(record?.skill.maturity).toBe("nascent");
  });

  it("shared skill resets usage stats to zero on target", async () => {
    evolver.registerAgent("agent-a", engineA);
    evolver.registerAgent("agent-b", engineB);

    // Source skill has high usage
    engineA.register(makeSkill({ usageCount: 15, successRate: 0.9 }));

    await evolver.shareSkill("agent-a", "TypeScript Plugin");

    const record = engineB.getByName("TypeScript Plugin");
    expect(record?.activationCount).toBe(0);
    expect(record?.successCount).toBe(0);
  });

  it("does not duplicate if target already has the skill", async () => {
    evolver.registerAgent("agent-a", engineA);
    evolver.registerAgent("agent-b", engineB);

    engineA.register(makeSkill());
    engineB.register(makeSkill({ usageCount: 0, successRate: 0, maturity: "nascent" }));

    const events = await evolver.shareSkill("agent-a", "TypeScript Plugin");

    // agent-b already has the skill — should produce no events
    expect(events).toHaveLength(0);
    // Still only one skill registered on agent-b
    expect(engineB.listAll()).toHaveLength(1);
  });

  it("does not share skill to source agent itself", async () => {
    evolver.registerAgent("agent-a", engineA);
    evolver.registerAgent("agent-b", engineB);

    engineA.register(makeSkill());

    const events = await evolver.shareSkill("agent-a", "TypeScript Plugin");

    // Only agent-b should receive it, not agent-a
    const targetIds = events.map(e => e.targetAgent);
    expect(targetIds).not.toContain("agent-a");
    expect(targetIds).toContain("agent-b");
  });

  // ---- evolution events ----------------------------------------------------

  it("records evolution events in history", async () => {
    evolver.registerAgent("agent-a", engineA);
    evolver.registerAgent("agent-b", engineB);

    engineA.register(makeSkill());

    await evolver.shareSkill("agent-a", "TypeScript Plugin");

    const history = evolver.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.type).toBe("skill_shared");
    expect(history[0]?.skillName).toBe("TypeScript Plugin");
    expect(history[0]?.targetAgent).toBe("agent-b");
  });

  it("accumulates history across multiple shares", async () => {
    evolver.registerAgent("agent-a", engineA);
    evolver.registerAgent("agent-b", engineB);
    evolver.registerAgent("agent-c", engineC);

    engineA.register(makeSkill());

    await evolver.shareSkill("agent-a", "TypeScript Plugin");

    // Register a second skill and share it
    engineA.register(makeSkill({ id: "skill-py", name: "Python Plugin", tags: ["python"] }));
    await evolver.shareSkill("agent-a", "Python Plugin");

    expect(evolver.getHistory()).toHaveLength(4); // 2 targets x 2 skills
  });

  // ---- history filtering ---------------------------------------------------

  it("history is filterable by skill name", async () => {
    evolver.registerAgent("agent-a", engineA);
    evolver.registerAgent("agent-b", engineB);

    engineA.register(makeSkill());
    engineA.register(makeSkill({ id: "skill-py", name: "Python Plugin", tags: ["python"] }));

    await evolver.shareSkill("agent-a", "TypeScript Plugin");
    await evolver.shareSkill("agent-a", "Python Plugin");

    const tsHistory = evolver.getHistory("TypeScript Plugin");
    expect(tsHistory).toHaveLength(1);
    expect(tsHistory[0]?.skillName).toBe("TypeScript Plugin");

    const pyHistory = evolver.getHistory("Python Plugin");
    expect(pyHistory).toHaveLength(1);
    expect(pyHistory[0]?.skillName).toBe("Python Plugin");
  });

  it("getHistory with no filter returns all events", async () => {
    evolver.registerAgent("agent-a", engineA);
    evolver.registerAgent("agent-b", engineB);

    engineA.register(makeSkill());
    engineA.register(makeSkill({ id: "skill-py", name: "Python Plugin", tags: ["python"] }));

    await evolver.shareSkill("agent-a", "TypeScript Plugin");
    await evolver.shareSkill("agent-a", "Python Plugin");

    expect(evolver.getHistory()).toHaveLength(2);
  });

  it("getHistory returns a copy (immutable)", async () => {
    evolver.registerAgent("agent-a", engineA);
    evolver.registerAgent("agent-b", engineB);

    engineA.register(makeSkill());
    await evolver.shareSkill("agent-a", "TypeScript Plugin");

    const history = evolver.getHistory();
    history.push({} as any);

    // Internal history should not be modified
    expect(evolver.getHistory()).toHaveLength(1);
  });

  // ---- error cases ---------------------------------------------------------

  it("throws on unknown agent", async () => {
    await expect(
      evolver.shareSkill("ghost-agent", "TypeScript Plugin"),
    ).rejects.toThrow('Agent "ghost-agent" not registered');
  });

  it("throws on unknown skill", async () => {
    evolver.registerAgent("agent-a", engineA);

    await expect(
      evolver.shareSkill("agent-a", "NonExistent Skill"),
    ).rejects.toThrow('Skill "NonExistent Skill" not found on agent "agent-a"');
  });

  // ---- event details -------------------------------------------------------

  it("event details include original maturity and success rate", async () => {
    evolver.registerAgent("agent-a", engineA);
    evolver.registerAgent("agent-b", engineB);

    engineA.register(makeSkill({ maturity: "proficient", successRate: 0.85 }));

    const events = await evolver.shareSkill("agent-a", "TypeScript Plugin");

    expect(events[0]?.details?.originalMaturity).toBe("proficient");
    expect(events[0]?.details?.originalSuccessRate).toBe(0.85);
  });

  it("event has a valid ISO timestamp", async () => {
    evolver.registerAgent("agent-a", engineA);
    evolver.registerAgent("agent-b", engineB);

    engineA.register(makeSkill());

    const events = await evolver.shareSkill("agent-a", "TypeScript Plugin");

    expect(typeof events[0]?.timestamp).toBe("string");
    expect(() => new Date(events[0]!.timestamp)).not.toThrow();
    expect(new Date(events[0]!.timestamp).toISOString()).toBe(events[0]!.timestamp);
  });
});
