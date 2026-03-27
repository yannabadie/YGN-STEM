import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export const REQUEST_ID_HEADER = "X-Request-Id";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const existing = req.headers[REQUEST_ID_HEADER.toLowerCase()];
  const id = typeof existing === "string" && existing.length > 0
    ? existing
    : randomUUID();
  req.headers[REQUEST_ID_HEADER.toLowerCase()] = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
