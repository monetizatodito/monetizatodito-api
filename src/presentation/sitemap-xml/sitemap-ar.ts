import { Request, Response } from "express";
import { pool } from "../../db/db-config";

const SITE = "https://mosanmultiverso.com";

export class SitemapARXmlControlador {
  async getSitemapArXml(_req: Request, res: Response) {
    try {
      const today = new Date().toISOString().slice(0, 10);

      const staticRoutesAr = [
        `${SITE}/ar`,
        `${SITE}/ar/blog`,
        `${SITE}/ar/contact`,
        `${SITE}/ar/الأسئلة-الشائعة`, //contacto
        `${SITE}/ar/privacy-policy`,
        `${SITE}/ar/terms-and-conditions`,
        `${SITE}/ar/أدوات`, // herramisntas
        `${SITE}/ar/تحويل-pdf-الى-word`, //pdf a word
        `${SITE}/ar/من-نحن`, //nosotros
        `${SITE}/ar/تحويل-jpg-الى-webp`, //jpg a webp
        `${SITE}/ar/تحويل-word-الى-pdf`, //pdf a work
        `${SITE}/ar/حاسبة-مواد-الجبس-بورد`, // calculadora de gypsum
        `${SITE}/ar/bing-homepage-quiz`,
      ];

      const { rows } = await pool.query<{
        images: string | null;
        updated_at: string | Date | null;
        ar_slug: string | null;
      }>(`
        SELECT
          b.images,
          b."updatedAt" AS updated_at,
          t.slug        AS ar_slug
        FROM blog b
        JOIN blog_translation t
          ON t.blog_id = b.id
         AND t.locale  = 'ar'
        WHERE b.activo = TRUE AND t.slug IS NOT NULL AND t.slug <> ''
        ORDER BY b."updatedAt" DESC
      `);

      const xmlEscape = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
      xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

      for (const loc of staticRoutesAr) {
        xml += `  <url>\n`;
        xml += `    <loc>${xmlEscape(loc)}</loc>\n`;
        xml += `    <lastmod>${today}</lastmod>\n`;
        xml += `  </url>\n`;
      }

      for (const row of rows) {
        const slug = row.ar_slug;
        if (!slug) continue;

        const url = `${SITE}/ar/blog/${encodeURIComponent(slug)}`;
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
      console.error("Error generando sitemap AR:", err);
      res.status(500).send("Error generando sitemap AR");
    }
  }
}

export default new SitemapARXmlControlador();
