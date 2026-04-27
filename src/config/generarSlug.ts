// src/config/generar-slug.ts
import { pool } from "../db/db-config";
import { makeSlugFromTitle } from "../presentation/traductor/translator.service";
import { BlogRepository } from "../repositorio/blog.repositorio";

/* =========================
   Helpers de normalización
   ========================= */

/** Slug latino (ASCII) — ideal para ES */
export function slugLatino(input: string): string {
  return (input ?? "")
    .normalize("NFD") // separa diacríticos
    .replace(/[\u0300-\u036f]/g, "") // quita diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, "") // sólo a-z0-9, espacio y guión
    .trim()
    .replace(/[\s-]+/g, "-") // espacios y grupos de - a un solo -
    .replace(/^-|-$/g, ""); // sin - al inicio/fin
}

/** Slug nativo (Unicode) — conserva scripts como Han/Arabic */
export function slugNativo(input: string): string {
  // Requiere Node 16+ (Unicode Property Escapes)
  return (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\p{Z}]+/gu, "-") // espacios Unicode -> guión
    .replace(/[^-\p{L}\p{N}]+/gu, "") // permite letras/números de cualquier idioma + '-'
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ==========================================
   Unicidad con sufijos -2, -3, ... (máx 200)
   ========================================== */

async function bumpUniqSimple(
  sql: string,
  paramsBuilder: (slug: string) => any[],
  base: string,
  maxLen = 200
): Promise<string> {
  let slug = base || "entrada";
  let i = 1;

  // corta si el base supera el máximo
  slug = slug.slice(0, maxLen);

  // intenta hasta que no exista
  // usa sufijo -2, -3 ... truncando cabeza si es necesario
  while (true) {
    const { rowCount } = await pool.query(sql, paramsBuilder(slug));
    if (rowCount === 0) break;

    i += 1;
    const suffix = `-${i}`;
    const head = base.slice(0, Math.max(1, maxLen - suffix.length));
    slug = `${head}${suffix}`;
  }
  return slug;
}

/* ==========================================
   ES (tabla blog) — slug latino único
   ========================================== */

/** Genera slug latino y asegura que sea único en tabla `blog`. */
export async function generarSlugUnico(slugUrl: string): Promise<string> {
  const base = slugLatino(slugUrl || "entrada");
  return bumpUniqSimple(
    "SELECT 1 FROM blog WHERE slug = $1",
    (s) => [s],
    base,
    200
  );
}

/* =====================================================
   I18N (tabla blog_translation) — slug nativo por idioma
   ===================================================== */

/**
 * Genera slug **nativo** para traducciones y asegura unicidad por (locale, slug)
 * en la tabla `blog_translation`.
 *
 * @param locale ej. 'en' | 'pt' | 'fr' | 'de' | 'ar' | 'zh'
 * @param textOrSlug texto de origen (título traducido o slug deseado)
 */
export async function generarSlugI18nUnico(
  locale: string,
  textOrSlug: string
): Promise<string> {
  const base = slugNativo(textOrSlug || "entrada").slice(0, 200);
  return bumpUniqSimple(
    "SELECT 1 FROM blog_translation WHERE locale = $1 AND slug = $2",
    (s) => [locale, s],
    base,
    200
  );
}

// src/utils/slug-locale.ts

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
