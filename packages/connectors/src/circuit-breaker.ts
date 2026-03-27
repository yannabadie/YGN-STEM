export enum CircuitState {
  Closed = "closed",
  Open = "open",
  HalfOpen = "half_open",
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
}

export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  private _state: CircuitState = CircuitState.Closed;
  private failureCount = 0;
  private openedAt: number | null = null;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
  }

  get state(): CircuitState {
    // Auto-transition Open → HalfOpen after timeout
    if (
      this._state === CircuitState.Open &&
      this.openedAt !== null &&
      Date.now() - this.openedAt >= this.resetTimeoutMs
    ) {
      this._state = CircuitState.HalfOpen;
      this.openedAt = null;
    }
    return this._state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.Open) {
      throw new Error("Circuit breaker is open");
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this._state = CircuitState.Closed;
    this.openedAt = null;
  }

  private onFailure(): void {
    if (this._state === CircuitState.HalfOpen) {
      // Any failure in half-open immediately re-opens
      this._state = CircuitState.Open;
      this.openedAt = Date.now();
      return;
    }

    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold) {
      this._state = CircuitState.Open;
      this.openedAt = Date.now();
    }
  }
}
