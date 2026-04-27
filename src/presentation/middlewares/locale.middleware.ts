// src/presentation/middlewares/locale.middleware.ts
import type { Request, Response, NextFunction } from "express";

const ALLOWED = ["es", "en", "pt", "fr", "de", "ar", "zh"] as const;
export type Locale = (typeof ALLOWED)[number];

declare global {
  namespace Express {
    interface Request {
      locale?: Locale;
    }
  }
}

export function parseLocale(req: Request, _res: Response, next: NextFunction) {
  const q = String(
    req.query.locale || req.headers["x-locale"] || "es"
  ).toLowerCase();
  req.locale = (ALLOWED as readonly string[]).includes(q)
    ? (q as Locale)
    : "es";
  next();
}
