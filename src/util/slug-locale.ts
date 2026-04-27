// src/utils/slug-locale.ts

import { makeSlugFromTitle } from "../presentation/traductor/translator.service";
import { BlogRepository } from "../repositorio/blog.repositorio";

export async function generarSlugUnicoPorIdioma(
  repo: BlogRepository,
  titulo: string,
  locale: "en" | "pt" | "fr" | "de" | "ar"
): Promise<string> {
  const base = makeSlugFromTitle(titulo, locale);
  let candidate = base;
  let i = 2;
  while (await repo.existsTranslationSlug(locale, candidate)) {
    candidate = `${base}-${i++}`;
  }
  return candidate;
}
