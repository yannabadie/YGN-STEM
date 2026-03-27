import { describe, it, expect, beforeEach } from "vitest";
import { OrganRegistry, BaseConnector } from "@ygn-stem/connectors";
import {
  HindsightMemory,
  InMemoryFactsStore,
  InMemoryEpisodesStore,
  InMemorySummariesStore,
  InMemoryBeliefsStore,
} from "@ygn-stem/memory";
import { CallerProfiler, ArchitectureSelector, SkillsEngine } from "@ygn-stem/adaptive";
import type {
  OrganConfig,
  OrganInfo,
  OrganStatus,
  ToolDescriptor,
} from "@ygn-stem/shared";
import { StemPipeline, type PipelineOptions } from "../pipeline.js";

// ---------------------------------------------------------------------------
// MockConnector — reused from gateway tests
// ---------------------------------------------------------------------------
class MockConnector extends BaseConnector {
  private readonly _mockTools: ToolDescriptor[];
  private readonly _mockInfo: OrganInfo;
  public lastCallArgs: { name: string; args: Record<string, unknown> } | null = null;

  constructor(config: OrganConfig, mockTools: ToolDescriptor[] = []) {
    super(config);
    this._mockTools = mockTools;
    this._mockInfo = {
      organId: config.organId,
      name: config.organId,
      status: "healthy" as OrganStatus,
      transport: config.transport,
      version: "0.1.0",
    };
  }

  protected async doConnect(): Promise<void> {}
  protected async doDisconnect(): Promise<void> {}
  protected async doCallTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    this.lastCallArgs = { name, args };
    return { result: "mock-result" };
  }
  protected async doHealth(): Promise<OrganStatus> {
    return "healthy";
  }
  protected async doListTools(): Promise<ToolDescriptor[]> {
    return this._mockTools;
  }
  protected async doInfo(): Promise<OrganInfo> {
    return this._mockInfo;
  }
}

const makeConfig = (id: string): OrganConfig => ({
  organId: id,
  transport: "http",
  endpoint: `http://localhost/${id}`,
  timeoutMs: 5000,
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createPipelineFixtures() {
  const beliefsStore = new InMemoryBeliefsStore();
  const episodesStore = new InMemoryEpisodesStore();
  const memory = new HindsightMemory({
    facts: new InMemoryFactsStore(),
    episodes: episodesStore,
    summaries: new InMemorySummariesStore(),
    beliefs: beliefsStore,
  });
  const profiler = new CallerProfiler(beliefsStore);
  const selector = new ArchitectureSelector();
  const skills = new SkillsEngine();
  const registry = new OrganRegistry();

  const options: PipelineOptions = {
    registry,
    memory,
    profiler,
    selector,
    skills,
  };

  return { options, memory, profiler, selector, skills, registry, beliefsStore, episodesStore };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("StemPipeline", () => {
  let fixtures: ReturnType<typeof createPipelineFixtures>;

  beforeEach(() => {
    fixtures = createPipelineFixtures();
  });

  it("processes a message through all layers and returns a response", async () => {
    const pipeline = new StemPipeline(fixtures.options);
    const response = await pipeline.process({
      callerId: "user-1",
      message: "Hello world",
    });

    expect(response).toHaveProperty("result");
    expect(response).toHaveProperty("routing");
    expect(response.routing).toHaveProperty("architecture");
    expect(response.routing).toHaveProperty("primaryOrgan");
    expect(response.memoryRetained).toBe(true);
    expect(typeof response.durationMs).toBe("number");
    expect(response.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("creates a caller profile on first request", async () => {
    const pipeline = new StemPipeline(fixtures.options);
    await pipeline.process({
      callerId: "new-caller",
      message: "First interaction",
    });

    // Profile should now exist in the beliefs store
    const profile = await fixtures.beliefsStore.getById("new-caller");
    expect(profile).toBeDefined();
    expect(profile!.callerId).toBe("new-caller");
    // interactionCount should be at least 1 (the curate call increments)
    expect(profile!.interactionCount).toBeGreaterThanOrEqual(1);
  });

  it("updates caller profile on subsequent requests", async () => {
    const pipeline = new StemPipeline(fixtures.options);
    await pipeline.process({ callerId: "user-x", message: "First" });
    const first = await fixtures.beliefsStore.getById("user-x");

    await pipeline.process({ callerId: "user-x", message: "Second" });
    const second = await fixtures.beliefsStore.getById("user-x");

    expect(second!.interactionCount).toBeGreaterThan(first!.interactionCount);
  });

  it("stores an episode in memory after processing", async () => {
    const pipeline = new StemPipeline(fixtures.options);
    await pipeline.process({
      callerId: "user-ep",
      message: "Something memorable",
    });

    const count = await fixtures.episodesStore.count();
    expect(count).toBeGreaterThanOrEqual(1);

    const episodes = await fixtures.episodesStore.searchByCaller("user-ep");
    expect(episodes.length).toBeGreaterThanOrEqual(1);
    expect(episodes[0].summary).toContain("Something memorable");
  });

  it("routes direct tool call to the registry", async () => {
    const tool: ToolDescriptor = {
      name: "echo",
      description: "Echo tool",
      inputSchema: { type: "object" },
    };
    const connector = new MockConnector(makeConfig("organ-test"), [tool]);
    await fixtures.registry.register(connector);

    const pipeline = new StemPipeline(fixtures.options);
    const response = await pipeline.process({
      callerId: "user-tool",
      message: "Call the echo tool",
      toolName: "echo",
      toolArgs: { text: "hello" },
    });

    expect(response.result).toEqual({ result: "mock-result" });
    expect(connector.lastCallArgs?.name).toBe("echo");
    expect(connector.lastCallArgs?.args).toEqual({ text: "hello" });
  });

  it("returns graceful response when no organs are registered (standalone mode)", async () => {
    const pipeline = new StemPipeline(fixtures.options);
    const response = await pipeline.process({
      callerId: "user-standalone",
      message: "Do something for me",
    });

    // With no organs registered, should indicate standalone mode
    const result = response.result as { standalone?: boolean; message?: string };
    expect(result.standalone).toBe(true);
    expect(result.message).toBeDefined();
  });

  it("uses architecture selector to determine routing", async () => {
    const pipeline = new StemPipeline(fixtures.options);

    // Simple, short message with no tool mentions should route to direct-llm
    const response = await pipeline.process({
      callerId: "user-route",
      message: "Hi",
    });

    expect(response.routing.architecture).toBe("direct-llm");
    expect(response.routing.primaryOrgan).toBe("ygn");
  });

  it("matches skills when registered and records outcome", async () => {
    // Register a skill
    fixtures.skills.register({
      id: "skill-greet",
      name: "greeting",
      description: "Handle greeting messages",
      maturity: "developing",
      tags: ["hello", "greeting", "hi"],
      version: "1.0.0",
    });

    // Force to committed stage by recording enough successful outcomes
    for (let i = 0; i < 5; i++) {
      fixtures.skills.recordOutcome({
        skillId: "skill-greet",
        requestId: `req-${i}`,
        outcome: "success",
        durationMs: 100,
      });
    }

    const pipeline = new StemPipeline(fixtures.options);
    const response = await pipeline.process({
      callerId: "user-skill",
      message: "Hello, send me a greeting please",
    });

    expect(response.skillMatched).toBe("skill-greet");
  });

  it("returns null skillMatched when no skill matches", async () => {
    const pipeline = new StemPipeline(fixtures.options);
    const response = await pipeline.process({
      callerId: "user-noskill",
      message: "Something completely unrelated",
    });

    expect(response.skillMatched).toBeNull();
  });
});
