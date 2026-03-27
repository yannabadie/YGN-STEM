import type { CallerProfile } from "@ygn-stem/shared";

// ---------------------------------------------------------------------------
// Stored profile — CallerProfile with a mutable interaction counter
// ---------------------------------------------------------------------------
export interface StoredCallerProfile extends CallerProfile {
  interactionCount: number;
}

// ---------------------------------------------------------------------------
// IBeliefsStore contract
// ---------------------------------------------------------------------------
export interface IBeliefsStore {
  /**
   * Insert or update a caller profile.
   * Each call increments interactionCount by 1.
   */
  upsert(profile: CallerProfile): Promise<StoredCallerProfile>;

  /** Look up a caller profile by callerId.  Returns undefined when not found. */
  getById(callerId: string): Promise<StoredCallerProfile | undefined>;

  /**
   * GDPR purge: permanently delete all data associated with the caller.
   * No-ops silently when the callerId does not exist.
   */
  forgetCaller(callerId: string): Promise<void>;

  /** Return every callerId currently stored. */
  listCallerIds(): Promise<string[]>;

  /** Total number of caller profiles currently stored. */
  count(): Promise<number>;
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------
export class InMemoryBeliefsStore implements IBeliefsStore {
  private readonly byId = new Map<string, StoredCallerProfile>();

  /**
   * Confidence gate: n / (n + κ) where κ = 10.
   *
   * Gives 0 for n=0, approaches 1 asymptotically as interactions grow.
   */
  static confidenceGate(interactionCount: number): number {
    const kappa = 10;
    return interactionCount / (interactionCount + kappa);
  }

  async upsert(profile: CallerProfile): Promise<StoredCallerProfile> {
    const existing = this.byId.get(profile.callerId);
    const interactionCount = existing !== undefined
      ? existing.interactionCount + 1
      : 1;
    const stored: StoredCallerProfile = { ...profile, interactionCount };
    this.byId.set(profile.callerId, stored);
    return stored;
  }

  async getById(callerId: string): Promise<StoredCallerProfile | undefined> {
    return this.byId.get(callerId);
  }

  async forgetCaller(callerId: string): Promise<void> {
    this.byId.delete(callerId);
  }

  async listCallerIds(): Promise<string[]> {
    return [...this.byId.keys()];
  }

  async count(): Promise<number> {
    return this.byId.size;
  }
}
