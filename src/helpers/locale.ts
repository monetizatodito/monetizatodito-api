// helpers/locale.ts
import type { Request } from "express";

export const ALLOWED_LOCALES = ["es", "en", "pt", "fr", "de", "ar"] as const;
export type Locale = (typeof ALLOWED_LOCALES)[number];

const LOCALE_SET = new Set<string>(ALLOWED_LOCALES as unknown as string[]);

// alias y subtags → tu Locale
const ALIAS: Record<string, Locale> = {
  "es-es": "es",
  es: "es",
  "en-us": "en",
  "en-gb": "en",
  en: "en",
  "pt-br": "pt",
  "pt-pt": "pt",
  pt: "pt",
  "fr-fr": "fr",
  fr: "fr",
  "de-de": "de",
  de: "de",
  "ar-sa": "ar",
  ar: "ar",
};

function norm(v: unknown): string {
  if (Array.isArray(v)) v = v[0];
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function mapToLocale(s: string): Locale | undefined {
  if (!s) return;
  if (LOCALE_SET.has(s)) return s as Locale;
  return ALIAS[s] ?? ALIAS[s.split("-")[0]];
}

function fromAcceptLanguage(h: unknown): Locale | undefined {
  const s = norm(h);
  if (!s) return;
  const items = s
    .split(",")
    .map((item) => {
      const [tag, ...rest] = item.split(";").map((x) => x.trim());
      const q =
        Number(rest.find((p) => p.startsWith("q="))?.slice(2) ?? "1") || 0;
      return { tag: tag.toLowerCase(), q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of items) {
    const m = mapToLocale(tag);
    if (m) return m;
  }
}

export function pickLocale(req: Request): Locale {
  const candidates = [
    norm(req.query.locale),
    norm(req.query.lang),
    norm(req.headers["x-locale"]),
    norm(req.headers["x-lang"]),
  ];
  for (const c of candidates) {
    const m = mapToLocale(c);
    if (m) return m;
  }
  return fromAcceptLanguage(req.headers["accept-language"]) ?? "es";
}
