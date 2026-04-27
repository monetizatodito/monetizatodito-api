// src/utils/slug.ts (o donde definiste LANG)
export const LANG = {
  es: "spa_Latn",
  en: "eng_Latn",
  pt: "por_Latn",
  fr: "fra_Latn",
  de: "deu_Latn",
  ar: "arb_Arab",
} as const;

// Todos los idiomas soportados (incluye español)
export type Locale = keyof typeof LANG;

// Solo los traducibles (excluye "es")
export type TranslatableLocale = Exclude<Locale, "es">;
