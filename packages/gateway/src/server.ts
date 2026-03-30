import { createGateway } from "./gateway.js";
import { AutoGenAdapter, CrewAIAdapter, LangGraphAdapter, OpenAIAdapter } from "./adapters/index.js";
import { OrganRegistry } from "@ygn-stem/connectors";
import { SageConnector, YgnConnector, MetaConnector } from "@ygn-stem/connectors";
import {
  HindsightMemory,
  InMemoryFactsStore,
  InMemoryEpisodesStore,
  InMemorySummariesStore,
  InMemoryBeliefsStore,
  PgFactsStore,
  PgEpisodesStore,
  PgSummariesStore,
  PgBeliefsStore,
  createDb,
} from "@ygn-stem/memory";
import { CallerProfiler, ArchitectureSelector, SkillsEngine } from "@ygn-stem/adaptive";
import { UcpSessionStore, Ap2Store } from "@ygn-stem/commerce";

async function main() {
  const port = parseInt(process.env.PORT ?? "3000", 10);

  // If DATABASE_URL is set, use PostgreSQL stores
  // Otherwise fall back to in-memory stores
  const usePostgres = !!process.env.DATABASE_URL;
  let memory: HindsightMemory;
  let beliefsStore: InMemoryBeliefsStore | PgBeliefsStore;

  if (usePostgres) {
    console.log("[STEM] Using PostgreSQL stores");
    const db = createDb(process.env.DATABASE_URL!);
    beliefsStore = new PgBeliefsStore(db);
    memory = new HindsightMemory({
      facts: new PgFactsStore(db),
      episodes: new PgEpisodesStore(db),
      summaries: new PgSummariesStore(db),
      beliefs: beliefsStore,
    });
  } else {
    console.log("[STEM] Using in-memory stores (no DATABASE_URL)");
    beliefsStore = new InMemoryBeliefsStore();
    memory = new HindsightMemory({
      facts: new InMemoryFactsStore(),
      episodes: new InMemoryEpisodesStore(),
      summaries: new InMemorySummariesStore(),
      beliefs: beliefsStore,
    });
  }

  // Initialize adaptive intelligence
  const profiler = new CallerProfiler(beliefsStore);
  const selector = new ArchitectureSelector();
  const skills = new SkillsEngine();

  // Initialize organ registry
  const registry = new OrganRegistry();

  // Try to connect to available organs (graceful -- failures are OK)
  const organConfigs = [
    { Connector: SageConnector, env: "SAGE_MCP", name: "SAGE" },
    { Connector: YgnConnector, env: "YGN_BRAIN_MCP", name: "Y-GN" },
    { Connector: MetaConnector, env: "META_YGN_HTTP", name: "Meta-YGN" },
  ] as const;

  for (const { Connector, env, name } of organConfigs) {
    const uri = process.env[env];
    if (uri) {
      try {
        const connector = new Connector({ endpoint: uri });
        await registry.register(connector);
        console.log(`[STEM] Connected to ${name} at ${uri}`);
      } catch (err) {
        console.log(`[STEM] ${name} unavailable at ${uri}: ${(err as Error).message}`);
      }
    }
  }

  // Auth configuration (JWT + API Key)
  const auth = {
    jwtSecret: process.env.JWT_SECRET || undefined,
    apiKeys: process.env.API_KEYS
      ? new Set(process.env.API_KEYS.split(","))
      : undefined,
    apiKeyHeader: process.env.API_KEY_HEADER || "X-API-Key",
    publicPaths: ["/health", "/.well-known/agent.json"],
  };

  // Initialize commerce stores
  const ucpStore = new UcpSessionStore();
  const ap2Store = new Ap2Store();

  // Create and start gateway
  const app = createGateway({
    registry,
    memory,
    profiler,
    selector,
    skills,
    auth,
    rateLimiter: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000"),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX ?? "100"),
    },
    ucpStore,
    ap2Store,
    adapters: [
      new AutoGenAdapter(),
      new CrewAIAdapter(),
      new LangGraphAdapter(),
      new OpenAIAdapter(),
    ],
  });

  app.listen(port, () => {
    const organCount = registry.list().length;
    const toolCount = registry.allTools().length;
    const pad = (s: string | number, len: number) => String(s).padEnd(len);
    console.log(`
+==================================================+
|           YGN-STEM - Adaptive Agent Fabric        |
+==================================================+
|  Gateway:    http://localhost:${pad(port, 21)}|
|  Organs:     ${pad(organCount + " connected", 36)}|
|  Tools:      ${pad(toolCount + " available", 36)}|
|  Memory:     Hindsight 4-network (in-memory)      |
|  Protocols:  MCP - A2A - Health                   |
+==================================================+
    `);
  });
}

main().catch(console.error);
