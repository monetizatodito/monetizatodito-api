// src/config/generarSlug.ts
import { toSlug } from "../util/slugify";
import { pool } from "../db/db-config";

export async function generarSlugUnicoPreguntaPorIdioma(
  baseTitle: string,
  locale: string
) {
  const base = toSlug(baseTitle);
  let slug = base;
  let n = 2;

  const exists = async (s: string) => {
    const sql = `
      SELECT (EXISTS(
        SELECT 1 FROM diagnostic_question q WHERE q.slug = $1
      ) OR EXISTS(
        SELECT 1 FROM diagnostic_question_translation t
        WHERE t.locale = $2 AND t.slug = $1
      )) AS exists
    `;
    const { rows } = await pool.query<{ exists: boolean }>(sql, [s, locale]);
    return rows[0]?.exists === true;
  };

  while (await exists(slug)) slug = `${base}-${n++}`;
  return slug;
}
