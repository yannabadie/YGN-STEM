import type { SkillsEngine } from "./skills-engine.js";

export interface EvolutionEvent {
  type: "skill_shared" | "skill_validated" | "skill_mutated" | "skill_rejected";
  skillName: string;
  sourceAgent: string;
  targetAgent?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export class GeaEvolver {
  private readonly agents = new Map<string, SkillsEngine>();
  private readonly history: EvolutionEvent[] = [];

  // Register an agent's skill engine for group evolution
  registerAgent(agentId: string, engine: SkillsEngine): void {
    this.agents.set(agentId, engine);
  }

  // Share a successful skill from one agent to all others
  async shareSkill(sourceAgentId: string, skillName: string): Promise<EvolutionEvent[]> {
    const source = this.agents.get(sourceAgentId);
    if (!source) throw new Error(`Agent "${sourceAgentId}" not registered`);

    const record = source.getByName(skillName);
    if (!record) throw new Error(`Skill "${skillName}" not found on agent "${sourceAgentId}"`);

    const events: EvolutionEvent[] = [];
    const now = new Date().toISOString();

    for (const [targetId, targetEngine] of this.agents) {
      if (targetId === sourceAgentId) continue;

      // Check if target already has this skill
      const existing = targetEngine.getByName(skillName);
      if (existing) continue;

      // Share as progenitor — target must validate through its own usage.
      // Register a fresh copy: reset usage stats, start at nascent maturity.
      targetEngine.register({
        ...record.skill,
        usageCount: 0,
        successRate: 0,
        maturity: "nascent",
      });

      const event: EvolutionEvent = {
        type: "skill_shared",
        skillName,
        sourceAgent: sourceAgentId,
        targetAgent: targetId,
        timestamp: now,
        details: {
          originalMaturity: record.skill.maturity,
          originalSuccessRate: record.skill.successRate ?? 0,
        },
      };
      events.push(event);
      this.history.push(event);
    }

    return events;
  }

  // Get evolution history, optionally filtered by skill name
  getHistory(skillName?: string): EvolutionEvent[] {
    if (skillName) return this.history.filter(e => e.skillName === skillName);
    return [...this.history];
  }

  // Get all registered agent IDs
  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }
}
