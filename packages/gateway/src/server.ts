import { createGateway } from "./gateway.js";
import { OrganRegistry } from "@ygn-stem/connectors";
import { SageConnector, YgnConnector, MetaConnector } from "@ygn-stem/connectors";
import {
  HindsightMemory,
  InMemoryFactsStore,
  InMemoryEpisodesStore,
  InMemorySummariesStore,
  InMemoryBeliefsStore,
} from "@ygn-stem/memory";
import { CallerProfiler, ArchitectureSelector, SkillsEngine } from "@ygn-stem/adaptive";

async function main() {
  const port = parseInt(process.env.PORT ?? "3000", 10);

  // Initialize memory (in-memory for now, PostgreSQL later)
  const memory = new HindsightMemory({
    facts: new InMemoryFactsStore(),
    episodes: new InMemoryEpisodesStore(),
    summaries: new InMemorySummariesStore(),
    beliefs: new InMemoryBeliefsStore(),
  });

  // Initialize adaptive intelligence
  const beliefsStore = new InMemoryBeliefsStore();
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

  // Create and start gateway
  const app = createGateway({
    registry,
    memory,
    profiler,
    selector,
    skills,
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
