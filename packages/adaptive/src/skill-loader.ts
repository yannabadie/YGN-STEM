import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import matter from "gray-matter";
import type { Skill, SkillMaturity } from "@ygn-stem/shared";
import type { SkillsEngine } from "./skills-engine.js";

// ---------------------------------------------------------------------------
// LoadedSkill — parsed SKILL.md representation
// ---------------------------------------------------------------------------

export interface LoadedSkill {
  /** The Skill object that was registered in the engine. */
  skill: Skill;
  /** Raw markdown body (everything after the frontmatter). */
  instructions: string;
}

// ---------------------------------------------------------------------------
// Frontmatter shape expected in SKILL.md files
// ---------------------------------------------------------------------------

interface SkillFrontmatter {
  name?: string;
  description?: string;
  triggers?: string[];
  /** Lifecycle maturity label used in SKILL.md files. */
  maturity?: string;
  activations?: number;
  successRate?: number;
  organs?: string[];
  version?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a SKILL.md maturity string to the shared SkillMaturity enum value.
 *
 * SKILL.md maturity  → shared SkillMaturity
 * ─────────────────    ────────────────────
 * "progenitor"       → "nascent"   (default / not yet specified)
 * "committed"        → "developing"
 * "mature"           → "proficient"
 * "expert"           → "expert"
 * "deprecated"       → "deprecated"
 * (anything else)    → "nascent"
 */
function mapMaturity(raw: string | undefined): SkillMaturity {
  switch (raw) {
    case "committed":   return "developing";
    case "mature":      return "proficient";
    case "expert":      return "expert";
    case "deprecated":  return "deprecated";
    case "progenitor":
    default:            return "nascent";
  }
}

/** Slugify a skill name to produce a stable, URL-safe id. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// SkillLoader
// ---------------------------------------------------------------------------

export class SkillLoader {
  constructor(private readonly engine: SkillsEngine) {}

  // -------------------------------------------------------------------------
  // parseMarkdown — parse a SKILL.md string into a LoadedSkill object
  // -------------------------------------------------------------------------

  parseMarkdown(content: string): LoadedSkill {
    const parsed = matter(content);
    const fm = parsed.data as SkillFrontmatter;

    const name        = fm.name        ?? "unnamed";
    const description = fm.description ?? "";
    const triggers    = fm.triggers    ?? [];
    const organs      = fm.organs      ?? [];
    const version     = fm.version     ?? "1.0.0";
    const maturity    = mapMaturity(fm.maturity);
    const successRate = fm.successRate ?? 0;
    const usageCount  = fm.activations ?? 0;

    // Tags = triggers + organs (so engine keyword matching covers both)
    const tags = [...new Set([...triggers, ...organs])];

    const skill: Skill = {
      id:          slugify(name),
      name,
      description,
      maturity,
      tags,
      version,
      // Only set organId when at least one organ is declared
      ...(organs.length > 0 ? { organId: organs[0] } : {}),
      successRate,
      usageCount,
    };

    return {
      skill,
      instructions: parsed.content.trim(),
    };
  }

  // -------------------------------------------------------------------------
  // loadFile — read a single .md file and register its skill
  // -------------------------------------------------------------------------

  async loadFile(filePath: string): Promise<LoadedSkill> {
    const content = await readFile(filePath, "utf-8");
    const loaded  = this.parseMarkdown(content);
    this.engine.register(loaded.skill);
    return loaded;
  }

  // -------------------------------------------------------------------------
  // loadDirectory — load all .md files from a directory (non-recursive)
  // -------------------------------------------------------------------------

  async loadDirectory(dirPath: string): Promise<LoadedSkill[]> {
    const entries = await readdir(dirPath);
    const results: LoadedSkill[] = [];

    for (const entry of entries) {
      if (extname(entry).toLowerCase() !== ".md") continue;
      const loaded = await this.loadFile(join(dirPath, entry));
      results.push(loaded);
    }

    return results;
  }
}
