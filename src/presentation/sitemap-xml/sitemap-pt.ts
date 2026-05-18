import { Request, Response } from "express";
import { pool } from "../../db/db-config";

const SITE = "https://monetizatodito.com";

export class SitemapPTXmlControlador {
  async getSitemapPtXml(_req: Request, res: Response) {
    try {
      const today = new Date().toISOString().slice(0, 10);

      // 1) Rutas estáticas PT (sin duplicados)
      const staticRoutesPt = [
        `${SITE}/pt`,
        `${SITE}/pt/blog`,
        `${SITE}/pt/contato`,
        `${SITE}/pt/pdf/pdf-para-word`,
        `${SITE}/pt/pdf/word-para-pdf`,
        `${SITE}/pt/jpg-para-webp`,
        `${SITE}/pt/calculadora-materiais-drywall`,
        `${SITE}/pt/sobre-nos`,
        `${SITE}/pt/ferramentas`,
        `${SITE}/pt/bing-homepage-quiz`,
      ];

      // 2) Posts con traducción PT
      const { rows } = await pool.query<{
        images: string | null;
        updated_at: string | Date | null;
        pt_slug: string | null;
      }>(`
        SELECT
          b.images,
          b."updatedAt" AS updated_at,
          t.slug        AS pt_slug
        FROM blog b
        JOIN blog_translation t
          ON t.blog_id = b.id
         AND t.locale  = 'pt'
        WHERE b.activo = TRUE AND t.slug IS NOT NULL AND t.slug <> ''
        ORDER BY b."updatedAt" DESC
      `);

      const xmlEscape = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
      xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

      for (const loc of staticRoutesPt) {
        xml += `  <url>\n`;
        xml += `    <loc>${xmlEscape(loc)}</loc>\n`;
        xml += `    <lastmod>${today}</lastmod>\n`;
        xml += `  </url>\n`;
      }

      for (const row of rows) {
        const slug = row.pt_slug;
        if (!slug) continue;

        const url = `${SITE}/pt/blog/${encodeURIComponent(slug)}`;
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
      res.status(200).send(xml);
    } catch (err) {
      console.error("Error generando sitemap PT:", err);
      res.status(500).send("Error generando sitemap PT");
    }
  }
}

export default new SitemapPTXmlControlador();
