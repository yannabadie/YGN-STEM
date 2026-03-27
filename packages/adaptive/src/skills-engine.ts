import type { Skill, SkillMatchResult, SkillOutcome } from "@ygn-stem/shared";

// ---------------------------------------------------------------------------
// SKILL.md maturity lifecycle constants
// ---------------------------------------------------------------------------

export const COMMITTED_THRESHOLD = 3;
export const COMMITTED_SUCCESS_RATE = 0.6;
export const MATURE_THRESHOLD = 10;
export const MATURE_SUCCESS_RATE = 0.6;
export const APOPTOSIS_THRESHOLD = 10;
export const APOPTOSIS_RATE = 0.3;

// ---------------------------------------------------------------------------
// Internal lifecycle stage (distinct from SkillMaturity in shared schema)
// ---------------------------------------------------------------------------

export type LifecycleStage = "progenitor" | "committed" | "mature";

// ---------------------------------------------------------------------------
// Internal skill record — augments shared Skill with lifecycle metadata
// ---------------------------------------------------------------------------

export interface SkillRecord {
  skill: Skill;
  stage: LifecycleStage;
  activationCount: number;
  successCount: number;
  /** Trigger words extracted from skill name, description, and tags. */
  triggerWords: Set<string>;
}

// ---------------------------------------------------------------------------
// SkillsEngine
// ---------------------------------------------------------------------------

export class SkillsEngine {
  private readonly registry = new Map<string, SkillRecord>();

  // -------------------------------------------------------------------------
  // register — store skill and compute trigger words
  // -------------------------------------------------------------------------

  register(skill: Skill): void {
    const triggerWords = new Set<string>();

    // Extract words from name, description, and tags
    for (const word of [...skill.name.toLowerCase().split(/\W+/),
                         ...skill.description.toLowerCase().split(/\W+/),
                         ...skill.tags.map((t) => t.toLowerCase())]) {
      if (word.length > 1) triggerWords.add(word);
    }

    const record: SkillRecord = {
      skill: {
        ...skill,
        successRate: skill.successRate ?? 0,
        usageCount: skill.usageCount ?? 0,
      },
      stage: "progenitor",
      activationCount: 0,
      successCount: 0,
      triggerWords,
    };

    this.registry.set(skill.id, record);
  }

  // -------------------------------------------------------------------------
  // getByName — lookup by skill name (exact match, case-insensitive)
  // -------------------------------------------------------------------------

  getByName(name: string): SkillRecord | undefined {
    const lower = name.toLowerCase();
    for (const record of this.registry.values()) {
      if (record.skill.name.toLowerCase() === lower) return record;
    }
    return undefined;
  }

  // -------------------------------------------------------------------------
  // match — score skills against an input string
  // -------------------------------------------------------------------------

  match(input: string): SkillMatchResult[] {
    const words = input.toLowerCase().split(/\W+/).filter((w) => w.length > 1);
    const results: SkillMatchResult[] = [];

    for (const record of this.registry.values()) {
      let matchCount = 0;
      const reasons: string[] = [];

      for (const word of words) {
        if (record.triggerWords.has(word)) {
          matchCount++;
          reasons.push(`matched keyword: ${word}`);
        }
      }

      if (matchCount === 0) continue;

      // Maturity bonus
      let maturityBonus = 0;
      if (record.stage === "mature") {
        maturityBonus = 2;
        reasons.push("maturity bonus: mature (+2)");
      } else if (record.stage === "committed") {
        maturityBonus = 1;
        reasons.push("maturity bonus: committed (+1)");
      }

      const rawScore = matchCount + maturityBonus;
      // Normalise score to [0, 1] — cap at 10 for normalisation
      const score = Math.min(1, rawScore / 10);

      const canShortCircuit = record.stage === "committed" || record.stage === "mature";

      results.push({
        skillId: record.skill.id,
        score,
        reasons: [...reasons, `canShortCircuit: ${canShortCircuit}`],
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  // -------------------------------------------------------------------------
  // recordOutcome — update skill stats and handle lifecycle transitions
  // -------------------------------------------------------------------------

  recordOutcome(outcome: SkillOutcome): void {
    const record = this.registry.get(outcome.skillId);
    if (record === undefined) return;

    record.activationCount += 1;
    if (outcome.outcome === "success") record.successCount += 1;

    const successRate = record.activationCount > 0
      ? record.successCount / record.activationCount
      : 0;

    // Update shared skill metadata
    record.skill = {
      ...record.skill,
      successRate,
      usageCount: record.activationCount,
    };

    // ---- Lifecycle transitions ----

    // Apoptosis check (highest priority — regardless of current stage)
    if (
      record.activationCount >= APOPTOSIS_THRESHOLD &&
      successRate < APOPTOSIS_RATE
    ) {
      this.registry.delete(outcome.skillId);
      return;
    }

    // Progenitor → Committed
    if (
      record.stage === "progenitor" &&
      record.activationCount >= COMMITTED_THRESHOLD &&
      successRate >= COMMITTED_SUCCESS_RATE
    ) {
      record.stage = "committed";
      record.skill = { ...record.skill, maturity: "developing" };
      return;
    }

    // Committed → Mature
    if (
      record.stage === "committed" &&
      record.activationCount >= MATURE_THRESHOLD &&
      successRate >= MATURE_SUCCESS_RATE
    ) {
      record.stage = "mature";
      record.skill = { ...record.skill, maturity: "proficient" };
      return;
    }
  }

  // -------------------------------------------------------------------------
  // listAll — return all registered skills
  // -------------------------------------------------------------------------

  listAll(): Skill[] {
    return [...this.registry.values()].map((r) => r.skill);
  }

  // -------------------------------------------------------------------------
  // canShortCircuit — check if a skill can short-circuit
  // -------------------------------------------------------------------------

  canShortCircuit(skillId: string): boolean {
    const record = this.registry.get(skillId);
    if (record === undefined) return false;
    return record.stage === "committed" || record.stage === "mature";
  }
}
