import { Request, Response, NextFunction } from "express";
import { AxiosError } from "axios";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AxiosError) {
    const status = err.response?.status ?? 500;
    const data = err.response?.data ?? { errors: [{ reason: err.message }] };
    return res.status(status).json(data);
  }
  if (err instanceof Error) {
    return res.status(400).json({ errors: [{ reason: err.message }] });
  }
  res.status(500).json({ errors: [{ reason: "Unknown error" }] });
}
