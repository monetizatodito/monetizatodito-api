// src/presentation/sitemap/sitemap.controller.ts
import { Request, Response } from "express";
import { pool } from "../../db/db-config";

const SITE = "https://monetizatodito.com";

export class SitemapENXmlControlador {
  async getSitemapEnXml(_req: Request, res: Response) {
    try {
      const today = new Date().toISOString().slice(0, 10);

      // 1) Rutas estáticas EN (sin duplicados)
      const staticRoutesEn = [
        `${SITE}/en`,
        `${SITE}/en/blog`,
        `${SITE}/en/contact`,
        `${SITE}/en/faq`,
        `${SITE}/en/privacy-policy`,
        `${SITE}/en/terms-and-conditions`,
        `${SITE}/en/tools`,
        `${SITE}/en/pdf/pdf-to-word`,
        `${SITE}/en/pdf/word-to-pdf`,
        `${SITE}/en/about`,
        `${SITE}/en/faq`,
        `${SITE}/en/gypsum-materials-calculator`,
        `${SITE}/en/jpg-to-webp`,
        `${SITE}/en/bing-homepage-quiz`,
        // `${SITE}/en/png-to-webp`,
      ];

      // 2) Posts con traducción EN
      const { rows } = await pool.query<{
        images: string | null;
        updated_at: string | Date | null;
        en_slug: string | null;
      }>(`
        SELECT
          b.images,
          b."updatedAt" AS updated_at,
          t.slug        AS en_slug
        FROM blog b
        JOIN blog_translation t
          ON t.blog_id = b.id
         AND t.locale  = 'en'
        WHERE b.activo = TRUE AND t.slug IS NOT NULL AND t.slug <> ''
        ORDER BY b."updatedAt" DESC
      `);

      // helpers
      const xmlEscape = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
      xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

      // Estáticas con lastmod
      for (const loc of staticRoutesEn) {
        xml += `  <url>\n`;
        xml += `    <loc>${xmlEscape(loc)}</loc>\n`;
        xml += `    <lastmod>${today}</lastmod>\n`;
        xml += `  </url>\n`;
      }

      // Dinámicas EN
      for (const row of rows) {
        const slug = row.en_slug;
        if (!slug) continue;

        const url = `${SITE}/en/blog/${encodeURIComponent(slug)}`;
        const lastmod = row.updated_at
          ? new Date(row.updated_at).toISOString().slice(0, 10)
          : today;

        xml += `  <url>\n`;
        xml += `    <loc>${xmlEscape(url)}</loc>\n`;
        xml += `    <lastmod>${lastmod}</lastmod>\n`;

        if (row.images) {
          const img = `${SITE}/cargar-archivo/blog/${encodeURIComponent(row.images)}`;
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${xmlEscape(img)}</image:loc>\n`;
          xml += `    </image:image>\n`;
        }

        xml += `  </url>\n`;
      }

      xml += `</urlset>\n`;

      res.setHeader("Content-Type", "application/xml; charset=UTF-8");
      // res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600"); // opcional
      res.status(200).send(xml);
    } catch (err) {
      console.error("Error generando sitemap EN:", err);
      res.status(500).send("Error generando sitemap EN");
    }
  }
}
