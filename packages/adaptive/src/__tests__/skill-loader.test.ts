import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { SkillsEngine } from "../skills-engine.js";
import { SkillLoader } from "../skill-loader.js";

// ---------------------------------------------------------------------------
// Fixture markdown strings
// ---------------------------------------------------------------------------

const ECHO_MD = `---
name: echo
description: Echo back the input for testing
triggers:
  - echo
  - test
  - ping
maturity: mature
organs:
  - ygn
---

# Instructions

1. Take the user's input message
2. Call \`ygn.orchestrate\` with the message
3. Return the result directly
`;

const MINIMAL_MD = `---
name: minimal
description: Minimal skill with no optional fields
---

Do the minimal thing.
`;

const WITH_STATS_MD = `---
name: stats-skill
description: Skill with pre-set stats
triggers:
  - stats
maturity: committed
activations: 7
successRate: 0.85
---

Run the stats pipeline.
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SkillLoader", () => {
  let engine: SkillsEngine;
  let loader: SkillLoader;

  beforeEach(() => {
    engine = new SkillsEngine();
    loader = new SkillLoader(engine);
  });

  // ---- parseMarkdown -------------------------------------------------------

  it("parses name and description from frontmatter", () => {
    const loaded = loader.parseMarkdown(ECHO_MD);
    expect(loaded.skill.name).toBe("echo");
    expect(loaded.skill.description).toBe("Echo back the input for testing");
  });

  it("maps triggers to tags", () => {
    const loaded = loader.parseMarkdown(ECHO_MD);
    expect(loaded.skill.tags).toContain("echo");
    expect(loaded.skill.tags).toContain("test");
    expect(loaded.skill.tags).toContain("ping");
  });

  it("maps organs into tags and sets organId to first organ", () => {
    const loaded = loader.parseMarkdown(ECHO_MD);
    expect(loaded.skill.tags).toContain("ygn");
    expect(loaded.skill.organId).toBe("ygn");
  });

  it("maps frontmatter maturity 'mature' to shared 'proficient'", () => {
    const loaded = loader.parseMarkdown(ECHO_MD);
    expect(loaded.skill.maturity).toBe("proficient");
  });

  it("extracts instructions from the markdown body", () => {
    const loaded = loader.parseMarkdown(ECHO_MD);
    expect(loaded.instructions).toContain("Take the user's input message");
    expect(loaded.instructions).toContain("ygn.orchestrate");
  });

  it("sets default maturity to 'nascent' when not specified", () => {
    const loaded = loader.parseMarkdown(MINIMAL_MD);
    expect(loaded.skill.maturity).toBe("nascent");
  });

  it("sets default activations (usageCount) to 0 when not specified", () => {
    const loaded = loader.parseMarkdown(MINIMAL_MD);
    expect(loaded.skill.usageCount).toBe(0);
  });

  it("sets default successRate to 0 when not specified", () => {
    const loaded = loader.parseMarkdown(MINIMAL_MD);
    expect(loaded.skill.successRate).toBe(0);
  });

  it("preserves activations (usageCount) from frontmatter", () => {
    const loaded = loader.parseMarkdown(WITH_STATS_MD);
    expect(loaded.skill.usageCount).toBe(7);
  });

  it("preserves successRate from frontmatter", () => {
    const loaded = loader.parseMarkdown(WITH_STATS_MD);
    expect(loaded.skill.successRate).toBe(0.85);
  });

  it("maps frontmatter maturity 'committed' to shared 'developing'", () => {
    const loaded = loader.parseMarkdown(WITH_STATS_MD);
    expect(loaded.skill.maturity).toBe("developing");
  });

  it("generates a slugified id from the skill name", () => {
    const loaded = loader.parseMarkdown(ECHO_MD);
    expect(loaded.skill.id).toBe("echo");
  });

  // ---- register after parse ------------------------------------------------

  it("registers loaded skill in the engine so match works", () => {
    const loaded = loader.parseMarkdown(ECHO_MD);
    engine.register(loaded.skill);

    const results = engine.match("echo test");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.skillId).toBe("echo");
  });

  // ---- loadFile ------------------------------------------------------------

  it("loadFile reads the real echo.md fixture and registers the skill", async () => {
    const fixturePath = join(
      // resolve from the repo root (four levels up from __tests__)
      import.meta.dirname,
      "../../../../skills/echo.md",
    );
    const loaded = await loader.loadFile(fixturePath);

    expect(loaded.skill.name).toBe("echo");
    expect(loaded.skill.tags).toContain("echo");
    expect(loaded.instructions).toBeTruthy();

    // Engine should now be able to match it
    const results = engine.match("ping test");
    expect(results.some((r) => r.skillId === "echo")).toBe(true);
  });

  // ---- loadDirectory -------------------------------------------------------

  it("loads all .md files from a directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-loader-test-"));
    try {
      await writeFile(join(dir, "alpha.md"), ECHO_MD);
      await writeFile(join(dir, "beta.md"), MINIMAL_MD);
      await writeFile(join(dir, "ignore.txt"), "not a skill");
      await writeFile(join(dir, "also-ignore.json"), "{}");

      const results = await loader.loadDirectory(dir);
      expect(results).toHaveLength(2);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("skips non-markdown files in loadDirectory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-loader-test-"));
    try {
      await writeFile(join(dir, "only.txt"), "plain text file");
      const results = await loader.loadDirectory(dir);
      expect(results).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("registers all skills from a directory in the engine", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-loader-test-"));
    try {
      await writeFile(join(dir, "echo.md"), ECHO_MD);
      await writeFile(join(dir, "stats.md"), WITH_STATS_MD);

      await loader.loadDirectory(dir);
      expect(engine.listAll()).toHaveLength(2);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
