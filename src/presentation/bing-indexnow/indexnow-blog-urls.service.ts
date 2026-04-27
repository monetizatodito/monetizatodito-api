import { pool } from "../../db/db-config";

const SITE = "https://mosanmultiverso.com";

// Ajusta si algún idioma usa otro segmento distinto a "blog"
const BLOG_SEGMENT_BY_LOCALE: Record<string, string> = {
  es: "blog",
  en: "blog",
  pt: "blog",
  fr: "blog",
  de: "blog",
  ar: "blog",
};

const LOCALE_PREFIX: Record<string, string> = {
  es: "",
  en: "/en",
  pt: "/pt",
  fr: "/fr",
  de: "/de",
  ar: "/ar",
};

export class IndexNowBlogUrlsService {
  async getPostUrlsByBlogId(blogId: string): Promise<string[]> {
    const result = await pool.query<{
      es_slug: string | null;
      locale: string | null;
      translated_slug: string | null;
    }>(
      `
      SELECT
        b.slug AS es_slug,
        t.locale,
        t.slug AS translated_slug
      FROM blog b
      LEFT JOIN blog_translation t
        ON t.blog_id = b.id
      WHERE b.id = $1
      `,
      [blogId],
    );

    if (!result.rows.length) return [];

    const urls: string[] = [];

    // Español base
    const esSlug = result.rows[0].es_slug;
    if (esSlug) {
      urls.push(`${SITE}/blog/${encodeURIComponent(esSlug)}`);
    }

    // Traducciones
    for (const row of result.rows) {
      const locale = (row.locale || "").trim().toLowerCase();
      const tSlug = row.translated_slug?.trim();

      if (!locale || !tSlug) continue;
      if (!LOCALE_PREFIX.hasOwnProperty(locale)) continue;

      const prefix = LOCALE_PREFIX[locale];
      const blogSegment = BLOG_SEGMENT_BY_LOCALE[locale] || "blog";

      urls.push(`${SITE}${prefix}/${blogSegment}/${encodeURIComponent(tSlug)}`);
    }

    // Opcional: también avisar listados de blog (cambian al crear/eliminar)
    urls.push(`${SITE}/blog`);
    urls.push(`${SITE}/en/blog`);
    urls.push(`${SITE}/pt/blog`);
    urls.push(`${SITE}/fr/blog`);
    urls.push(`${SITE}/de/blog`);
    urls.push(`${SITE}/ar/blog`);

    return Array.from(new Set(urls));
  }
}
