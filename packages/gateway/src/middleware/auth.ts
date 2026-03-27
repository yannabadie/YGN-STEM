import { createHmac } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export interface AuthOptions {
  jwtSecret?: string;
  apiKeys?: Set<string>;
  /** Header name used for API key auth. Default: "X-API-Key" */
  apiKeyHeader?: string;
  /** Paths that bypass auth entirely, e.g. ["/health", "/.well-known/agent.json"] */
  publicPaths?: string[];
}

// ---------------------------------------------------------------------------
// JWT helpers (HS256 only, synchronous)
// ---------------------------------------------------------------------------
interface JwtPayload {
  sub?: string;
  exp?: number;
  [key: string]: unknown;
}

function decodeJwt(token: string, secret: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  // Verify header alg
  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8")) as { alg?: string };
  if (header.alg && header.alg !== "HS256") {
    throw new Error(`Unsupported JWT algorithm: ${header.alg}`);
  }

  // Verify signature
  const expectedSig = createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  if (expectedSig !== signatureB64) throw new Error("Invalid JWT signature");

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as JwtPayload;

  // Check expiry
  if (payload.exp !== undefined && Date.now() / 1000 > payload.exp) {
    throw new Error("JWT token expired");
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------
export function createAuthMiddleware(options: AuthOptions) {
  const apiKeyHeader = options.apiKeyHeader ?? "X-API-Key";
  const headerLower = apiKeyHeader.toLowerCase();

  return (req: Request, res: Response, next: NextFunction): void => {
    // 1. Skip auth for public paths
    if (options.publicPaths?.some((p) => req.path.startsWith(p))) {
      next();
      return;
    }

    // 2. Try API Key first
    const apiKey = req.headers[headerLower] as string | undefined;
    if (apiKey && options.apiKeys?.has(apiKey)) {
      (req as Request & { callerId?: string }).callerId = `apikey:${apiKey.slice(0, 8)}`;
      next();
      return;
    }

    // 3. Try JWT Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ") && options.jwtSecret) {
      const token = authHeader.slice(7);
      try {
        const payload = decodeJwt(token, options.jwtSecret);
        (req as Request & { callerId?: string }).callerId = payload.sub ?? "jwt-user";
        next();
        return;
      } catch {
        res.status(401).json({ error: "Invalid JWT token" });
        return;
      }
    }

    // 4. No auth configured at all — allow as anonymous
    const hasAuthConfig =
      !!options.jwtSecret ||
      (options.apiKeys !== undefined && options.apiKeys.size > 0);

    if (!hasAuthConfig) {
      (req as Request & { callerId?: string }).callerId = "anonymous";
      next();
      return;
    }

    // 5. Auth is configured but no valid credentials were provided
    res.status(401).json({ error: "Authentication required" });
  };
}
