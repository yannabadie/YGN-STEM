import type { Request, Response, NextFunction } from "express";

export interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  code?: string | number;
}

export function errorHandler(
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status =
    typeof err.status === "number" ? err.status :
    typeof err.statusCode === "number" ? err.statusCode :
    500;

  const code = err.code ?? "INTERNAL_ERROR";
  const message = err.message ?? "An unexpected error occurred";

  res.status(status).json({ error: { message, code } });
}
