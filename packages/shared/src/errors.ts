export class StemError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = "StemError";
    // Maintain proper stack trace in V8 environments
    const captureStackTrace = (Error as unknown as { captureStackTrace?: (target: object, ctor: Function) => void }).captureStackTrace;
    if (captureStackTrace) {
      captureStackTrace(this, this.constructor);
    }
  }
}

export class OrganUnavailableError extends StemError {
  readonly organId: string;

  constructor(organId: string, message?: string) {
    super(message ?? `Organ '${organId}' is unavailable`, "ORGAN_UNAVAILABLE");
    this.organId = organId;
    this.name = "OrganUnavailableError";
  }
}

export class CircuitOpenError extends StemError {
  readonly organId: string;

  constructor(organId: string, message?: string) {
    super(
      message ?? `Circuit breaker is open for organ '${organId}'`,
      "CIRCUIT_OPEN",
    );
    this.organId = organId;
    this.name = "CircuitOpenError";
  }
}

export class CallerNotFoundError extends StemError {
  readonly callerId: string;

  constructor(callerId: string, message?: string) {
    super(message ?? `Caller '${callerId}' not found`, "CALLER_NOT_FOUND");
    this.callerId = callerId;
    this.name = "CallerNotFoundError";
  }
}

export class SkillNotFoundError extends StemError {
  readonly skillId: string;

  constructor(skillId: string, message?: string) {
    super(message ?? `Skill '${skillId}' not found`, "SKILL_NOT_FOUND");
    this.skillId = skillId;
    this.name = "SkillNotFoundError";
  }
}
