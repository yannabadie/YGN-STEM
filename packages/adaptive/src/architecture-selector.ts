import type { OrganRouting } from "@ygn-stem/shared";

// ---------------------------------------------------------------------------
// TaskDescriptor — structured task properties for routing decisions
// (inspired by Google Scaling Science task-property routing)
// ---------------------------------------------------------------------------

export interface TaskDescriptor {
  /** Task requires formal (SMT / theorem-prover) verification. */
  requiresFormalVerification?: boolean;
  /** Task is high-criticality and needs adversarial oversight. */
  highCriticality?: boolean;
  /** Task requires specialised knowledge retrieval. */
  requiresKnowledge?: boolean;
  /** Task is decomposable into parallel sub-tasks. */
  isParallelizable?: boolean;
  /** Number of distinct knowledge domains involved. */
  domainCount?: number;
  /** Task is straightforward with no complex reasoning required. */
  simple?: boolean;
  /** Number of tools required (0 = pure LLM, >0 = tool-augmented). */
  toolDensity?: number;
}

// ---------------------------------------------------------------------------
// SelectionHints — optional caller / session overrides
// ---------------------------------------------------------------------------

export interface SelectionHints {
  /** Force a specific pipeline name. */
  forcePipeline?: string;
  /** Preferred organ IDs to prefer in routing. */
  preferredOrgans?: string[];
}

// ---------------------------------------------------------------------------
// Pipeline descriptors — returned as OrganRouting[]
// ---------------------------------------------------------------------------

type PipelineName =
  | "smt-pipeline"
  | "adversarial-redblue"
  | "knowledge-pipeline"
  | "centralized-multi-agent"
  | "direct-llm"
  | "single-agent";

interface PipelineConfig {
  name: PipelineName;
  organs: string[];
  oversight: boolean;
  evidence: boolean;
}

const PIPELINES: Record<PipelineName, PipelineConfig> = {
  "smt-pipeline": {
    name: "smt-pipeline",
    organs: ["sage", "vm"],
    oversight: true,
    evidence: true,
  },
  "adversarial-redblue": {
    name: "adversarial-redblue",
    organs: ["ygn", "metacog"],
    oversight: true,
    evidence: true,
  },
  "knowledge-pipeline": {
    name: "knowledge-pipeline",
    organs: ["sage", "finance"],
    oversight: false,
    evidence: false,
  },
  "centralized-multi-agent": {
    name: "centralized-multi-agent",
    organs: ["sage", "ygn"],
    oversight: false,
    evidence: false,
  },
  "direct-llm": {
    name: "direct-llm",
    organs: ["ygn"],
    oversight: false,
    evidence: false,
  },
  "single-agent": {
    name: "single-agent",
    organs: ["ygn"],
    oversight: false,
    evidence: false,
  },
};

// ---------------------------------------------------------------------------
// ArchitectureSelector
// ---------------------------------------------------------------------------

/**
 * Routes a task to the appropriate organ pipeline using the Google Scaling
 * Science decision matrix.
 *
 * Priority (highest first):
 *  1. requiresFormalVerification → smt-pipeline
 *  2. highCriticality           → adversarial-redblue
 *  3. requiresKnowledge         → knowledge-pipeline
 *  4. isParallelizable && domainCount > 1 → centralized-multi-agent
 *  5. simple && toolDensity === 0 → direct-llm
 *  6. default                   → single-agent
 */
export class ArchitectureSelector {
  select(task: TaskDescriptor, _hints?: SelectionHints): OrganRouting[] {
    const pipeline = this.resolvePipeline(task);
    return this.buildRouting(pipeline);
  }

  private resolvePipeline(task: TaskDescriptor): PipelineConfig {
    if (task.requiresFormalVerification === true) {
      return PIPELINES["smt-pipeline"];
    }
    if (task.highCriticality === true) {
      return PIPELINES["adversarial-redblue"];
    }
    if (task.requiresKnowledge === true) {
      return PIPELINES["knowledge-pipeline"];
    }
    if (task.isParallelizable === true && (task.domainCount ?? 0) > 1) {
      return PIPELINES["centralized-multi-agent"];
    }
    if (task.simple === true && task.toolDensity === 0) {
      return PIPELINES["direct-llm"];
    }
    return PIPELINES["single-agent"];
  }

  private buildRouting(pipeline: PipelineConfig): OrganRouting[] {
    return pipeline.organs.map((organId, idx) => {
      const conditions: string[] = [pipeline.name];
      if (pipeline.oversight) conditions.push("oversight");
      if (pipeline.evidence) conditions.push("evidence");

      return {
        organId,
        priority: idx,
        fallback: idx > 0,
        conditions,
      };
    });
  }
}
