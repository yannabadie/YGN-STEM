// ---------------------------------------------------------------------------
// UCP — Universal Commerce Protocol
// Manages checkout session lifecycles with idempotency.
// ---------------------------------------------------------------------------

export interface UcpItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface UcpSession {
  id: string;
  status: "created" | "completed" | "expired";
  items: UcpItem[];
  total: number;
  currency: string;
  createdAt: string;
  completedAt?: string;
  idempotencyKey: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _counter = 0;

function generateId(prefix: string): string {
  _counter += 1;
  return `${prefix}-${Date.now()}-${_counter}`;
}

function computeTotal(items: UcpItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

// ---------------------------------------------------------------------------
// UcpSessionStore
// ---------------------------------------------------------------------------

export class UcpSessionStore {
  private readonly sessions = new Map<string, UcpSession>();
  /** idempotencyKey → sessionId */
  private readonly idempotencyCache = new Map<string, string>();

  // -------------------------------------------------------------------------
  // createSession — idempotent session creation
  // -------------------------------------------------------------------------

  createSession(input: {
    items: UcpItem[];
    currency: string;
    idempotencyKey: string;
  }): UcpSession {
    // Return existing session if the idempotency key was already used.
    const existingId = this.idempotencyCache.get(input.idempotencyKey);
    if (existingId !== undefined) {
      const existing = this.sessions.get(existingId);
      if (existing !== undefined) return existing;
    }

    const id = generateId("session");
    const session: UcpSession = {
      id,
      status: "created",
      items: input.items,
      total: computeTotal(input.items),
      currency: input.currency,
      createdAt: new Date().toISOString(),
      idempotencyKey: input.idempotencyKey,
    };

    this.sessions.set(id, session);
    this.idempotencyCache.set(input.idempotencyKey, id);

    return session;
  }

  // -------------------------------------------------------------------------
  // getSession — lookup by session id
  // -------------------------------------------------------------------------

  getSession(id: string): UcpSession | undefined {
    return this.sessions.get(id);
  }

  // -------------------------------------------------------------------------
  // completeSession — mark as completed
  // -------------------------------------------------------------------------

  completeSession(id: string): UcpSession {
    const session = this.sessions.get(id);
    if (session === undefined) {
      throw new Error(`Session not found: ${id}`);
    }
    if (session.status === "completed") {
      throw new Error(`Session already completed: ${id}`);
    }

    const updated: UcpSession = {
      ...session,
      status: "completed",
      completedAt: new Date().toISOString(),
    };

    this.sessions.set(id, updated);
    return updated;
  }

  // -------------------------------------------------------------------------
  // listSessions — return all sessions
  // -------------------------------------------------------------------------

  listSessions(): UcpSession[] {
    return [...this.sessions.values()];
  }
}
