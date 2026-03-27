import type { OrganRegistry } from "@ygn-stem/connectors";
import type { HindsightMemory } from "@ygn-stem/memory";
import { CallerProfiler } from "@ygn-stem/adaptive";
import { ArchitectureSelector, type SelectionHints } from "@ygn-stem/adaptive";
import { SkillsEngine } from "@ygn-stem/adaptive";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Pipeline types
// ---------------------------------------------------------------------------

export interface PipelineOptions {
  registry: OrganRegistry;
  memory: HindsightMemory;
  profiler: CallerProfiler;
  selector: ArchitectureSelector;
  skills: SkillsEngine;
}

export interface PipelineRequest {
  callerId: string;
  message: string;
  toolName?: string;       // if direct tool call
  toolArgs?: Record<string, unknown>;
}

export interface PipelineResponse {
  result: unknown;
  routing: { architecture: string; primaryOrgan: string };
  memoryRetained: boolean;
  skillMatched: string | null;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// StemPipeline — cross-layer request processing
// ---------------------------------------------------------------------------

/**
 * The StemPipeline is the heart of YGN-STEM.  It wires all 4 layers together:
 *
 *  Layer 2A: CallerProfiler   — load/create/update caller profile
 *  Layer 2B: ArchitectureSelector — choose routing pipeline
 *  Layer 2C: SkillsEngine     — check for matching skills
 *  Layer 3:  HindsightMemory  — recall context, retain episode
 *  Layer 4:  OrganConnectors  — execute via organ registry
 */
export class StemPipeline {
  constructor(private readonly options: PipelineOptions) {}

  async process(request: PipelineRequest): Promise<PipelineResponse> {
    const start = Date.now();
    const requestId = randomUUID();

    // Layer 2A: Caller Profiler -- load/create profile
    const _profile = await this.options.profiler.getOrCreateProfile(request.callerId);

    // Layer 2C: Skills Engine -- check for matching skill
    const skillMatches = this.options.skills.match(request.message);
    const topSkill = skillMatches[0];
    let skillMatched: string | null = null;

    // If a committed/mature skill matches, record it for short-circuit
    if (topSkill && this.options.skills.canShortCircuit(topSkill.skillId)) {
      skillMatched = topSkill.skillId;
    }

    // Layer 3: Hindsight Memory -- RECALL
    const recalled = await this.options.memory.recall({
      query: request.message,
      callerId: request.callerId,
      limit: 10,
      networks: ["facts", "episodes", "summaries", "beliefs"],
    });

    // Layer 2B: Architecture Selector -- choose routing
    const taskProps = this.analyzeTask(request);
    const routings = this.options.selector.select(taskProps);

    // Extract primary organ and architecture from the routing result
    const primaryOrgan = routings[0]?.organId ?? "ygn";
    const architecture = routings[0]?.conditions?.[0] ?? "single-agent";

    // Layer 4: Organ Connectors -- EXECUTE
    let result: unknown;
    if (request.toolName) {
      // Direct tool call
      result = await this.options.registry.callTool(request.toolName, request.toolArgs ?? {});
    } else {
      // Route to primary organ
      const organTools = this.options.registry.allTools()
        .filter(t => t.name.startsWith(`${primaryOrgan}.`));

      if (organTools.length > 0) {
        // Find an "orchestrate" or "run_task" tool on the primary organ
        const orchestrateTool = organTools.find(t =>
          t.name.includes("orchestrate") || t.name.includes("run_task"),
        );
        if (orchestrateTool) {
          result = await this.options.registry.callTool(orchestrateTool.name, {
            task: request.message,
            context: {
              recalledFacts: recalled.facts.length,
              recalledEpisodes: recalled.episodes.length,
            },
          });
        } else {
          result = {
            message: "No orchestration tool available",
            availableTools: organTools.map(t => t.name),
          };
        }
      } else {
        result = {
          message: `No tools available for organ "${primaryOrgan}"`,
          standalone: true,
        };
      }
    }

    // Layer 3: Hindsight Memory -- RETAIN episode
    const episode = {
      id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      callerId: request.callerId,
      requestId,
      summary: request.message.slice(0, 200),
      importance: 0.5,
      timestamp: new Date().toISOString(),
      tags: request.toolName ? [request.toolName] : [],
    };
    await this.options.memory.retain({ episode });

    // Layer 2A: Update caller profile with signals from this interaction
    const signals = CallerProfiler.generateSignals({
      messageLength: request.message.length,
      technicalTerms: [],
      requestedDepth: 0.5,
      timeOfDay: new Date().getHours(),
    });
    await this.options.profiler.curate(request.callerId, signals);

    // Record skill outcome if matched
    if (skillMatched) {
      this.options.skills.recordOutcome({
        skillId: skillMatched,
        requestId,
        outcome: "success",
        durationMs: Date.now() - start,
      });
    }

    return {
      result,
      routing: { architecture, primaryOrgan },
      memoryRetained: true,
      skillMatched,
      durationMs: Date.now() - start,
    };
  }

  private analyzeTask(request: PipelineRequest) {
    const message = request.message.toLowerCase();
    const hasMultipleDomains = (message.match(/\b(and|plus|also|additionally)\b/g) || []).length > 0;
    const hasToolMention = message.includes("tool") || message.includes("run") || message.includes("execute");
    const isSimple = request.message.length < 50 && !hasToolMention;

    return {
      requiresFormalVerification: false,
      highCriticality: false,
      requiresKnowledge: message.includes("knowledge") || message.includes("search") || message.includes("find"),
      isParallelizable: hasMultipleDomains,
      domainCount: hasMultipleDomains ? 2 : 1,
      simple: isSimple,
      toolDensity: hasToolMention ? 2 : 0,
    };
  }
}
