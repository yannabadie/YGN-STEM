import type {
  OrganConfig,
  OrganInfo,
  OrganStatus,
  ToolDescriptor,
} from "@ygn-stem/shared";
import { CircuitBreaker, type CircuitBreakerOptions } from "./circuit-breaker.js";

export abstract class BaseConnector {
  protected readonly config: OrganConfig;
  private readonly circuitBreaker: CircuitBreaker;

  private _status: OrganStatus = "unknown";
  private _tools: ToolDescriptor[] = [];

  constructor(config: OrganConfig, circuitBreakerOptions?: CircuitBreakerOptions) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker(circuitBreakerOptions);
  }

  get status(): OrganStatus {
    return this._status;
  }

  get tools(): readonly ToolDescriptor[] {
    return this._tools;
  }

  async connect(): Promise<void> {
    await this.doConnect();
    this._tools = await this.doListTools();
    this._status = "healthy";
  }

  async disconnect(): Promise<void> {
    await this.doDisconnect();
    this._status = "unavailable";
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.circuitBreaker.execute(() => this.doCallTool(name, args));
  }

  async health(): Promise<OrganStatus> {
    const status = await this.doHealth();
    this._status = status;
    return status;
  }

  async info(): Promise<OrganInfo> {
    return this.doInfo();
  }

  // ---------------------------------------------------------------------------
  // Abstract methods — concrete connectors must implement these
  // ---------------------------------------------------------------------------

  protected abstract doConnect(): Promise<void>;
  protected abstract doDisconnect(): Promise<void>;
  protected abstract doCallTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown>;
  protected abstract doHealth(): Promise<OrganStatus>;
  protected abstract doListTools(): Promise<ToolDescriptor[]>;
  protected abstract doInfo(): Promise<OrganInfo>;
}
