import { BaseConnector } from "../base-connector.js";
import { spawn, type ChildProcess } from "node:child_process";
import type { OrganConfig, OrganInfo, OrganStatus, ToolDescriptor } from "@ygn-stem/shared";

/**
 * Connects to YGN-VM (the verifiable memory organ).
 *
 * Unlike the MCP HTTP connectors, VmConnector spawns the `aletheia` CLI as
 * a subprocess and pipes JSONL commands to its stdin.  Each tool call is a
 * one-shot CLI invocation (stateless per call).
 */
export class VmConnector extends BaseConnector {
  private proc: ChildProcess | null = null;

  constructor(cliPath = "aletheia") {
    super({
      organId: "vm",
      transport: "stdio",
      endpoint: cliPath,
      timeoutMs: 30_000,
    });
  }

  protected async doConnect(): Promise<void> {
    // VM connector is stateless -- connects on-demand per tool call
  }

  protected async doDisconnect(): Promise<void> {
    this.proc?.kill();
    this.proc = null;
  }

  protected async doCallTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const cliPath = this.config.endpoint;

    if (name === "vm.capture" || name === "capture") {
      return this.runCli(cliPath, [
        "capture",
        "--session", args.session as string,
        "--source", (args.source as string) ?? "stem",
      ], args.events as string | undefined);
    }
    if (name === "vm.seal" || name === "seal") {
      return this.runCli(cliPath, [
        "seal",
        "--session", args.session as string,
        "--output", args.output as string,
      ]);
    }
    if (name === "vm.verify" || name === "verify") {
      return this.runCli(cliPath, ["verify", args.packPath as string]);
    }
    if (name === "vm.export" || name === "export") {
      return this.runCli(cliPath, [
        "export",
        "--session", args.session as string,
        "--format", (args.format as string) ?? "json",
      ]);
    }
    throw new Error(`Unknown VM tool: ${name}`);
  }

  private runCli(cmd: string, cliArgs: string[], stdin?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, cliArgs, { stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (d: Buffer) => { stdout += d; });
      proc.stderr?.on("data", (d: Buffer) => { stderr += d; });
      proc.on("close", (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`${cmd} exited ${code}: ${stderr}`));
      });
      proc.on("error", reject);
      if (stdin) {
        proc.stdin?.write(stdin);
        proc.stdin?.end();
      } else {
        proc.stdin?.end();
      }
    });
  }

  protected async doHealth(): Promise<OrganStatus> {
    try {
      await this.runCli(this.config.endpoint, ["--version"]);
      return "healthy";
    } catch {
      return "unavailable";
    }
  }

  protected async doListTools(): Promise<ToolDescriptor[]> {
    return [
      { name: "vm.capture", description: "Capture events into hash chain", inputSchema: {} },
      { name: "vm.seal", description: "Seal session into signed evidence pack", inputSchema: {} },
      { name: "vm.verify", description: "Verify evidence pack integrity", inputSchema: {} },
      { name: "vm.export", description: "Export evidence pack as report", inputSchema: {} },
    ];
  }

  protected async doInfo(): Promise<OrganInfo> {
    return {
      organId: this.config.organId,
      name: "YGN-VM",
      status: this.status,
      transport: this.config.transport,
      version: "0.1.0",
      capabilities: ["evidence-capture", "hash-chain", "verification", "cli"],
    };
  }
}
