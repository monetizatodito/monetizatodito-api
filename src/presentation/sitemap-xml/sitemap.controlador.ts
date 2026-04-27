import { Request, Response } from "express";
import { pool } from "../../db/db-config";

const SITE = "https://mosanmultiverso.com";

export class SitemapXmlControlador {
  async getSitemapXml(_req: Request, res: Response) {
    try {
      const today = new Date().toISOString().slice(0, 10);

      // 1) Blog ES
      const { rows } = await pool.query<{
        slug: string;
        updated_at: string | Date | null;
        images: string | null;
      }>(`
        SELECT slug, "updatedAt" AS updated_at, images
        FROM blog
        WHERE activo = TRUE
        ORDER BY "updatedAt" DESC
      `);

      // 2) Rutas estáticas ES (sin duplicados)
      const staticLocs = [
        "/",
        "/blog",
        "/contacto",
        "/pregunta",
        "/politica-privacidad",
        "/politica-cookies",
        "/terminos-condiciones",
        "/sobre-nosotros",
        "/tecnologias",
        // "/diamantes-gratis",
        // "/ganador-diamantes-gratis",
        "/tutoriales",
        // herramientas
        "/contador-palabras",
        "/certificado-laboral-online",
        "/firmar-pdf-online",
        "/png-a-webp",
        "/jpg-a-webp",
        "/cortador-url",
        "/pdf-a-word",
        "/generar-password-segura",
        "/generar-citas",
        "/unir-pdf",
        "/comprimir-pdf",
        "/pdf-a-texto",
        "/formatear-codigo",
        "/resolver-ecuaciones",
        "/calcular-promedio",
        "/convertir-unidades",
        "/calcular-ley-ohm-potencia",
        "/calcular-materiales-para-gypsum",
        "/bing-homepage-quiz",
      ];
      const staticRoutes = Array.from(new Set(staticLocs)) // dedupe
        .map((loc) => `${SITE}${loc}`);

      // helpers
      const xmlEscape = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      sitemap += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
      sitemap += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

      // 3) Estáticas con lastmod
      for (const loc of staticRoutes) {
        sitemap += `  <url>\n`;
        sitemap += `    <loc>${xmlEscape(loc)}</loc>\n`;
        sitemap += `    <lastmod>${today}</lastmod>\n`;
        sitemap += `  </url>\n`;
      }

      // 4) Dinámicas (posts)
      for (const row of rows) {
        const slug = row.slug?.toString() ?? "";
        if (!slug) continue;

        const url = `${SITE}/blog/${encodeURIComponent(slug)}`;
        const lastmod = row.updated_at
          ? new Date(row.updated_at).toISOString().slice(0, 10)
          : today;

        sitemap += `  <url>\n`;
        sitemap += `    <loc>${xmlEscape(url)}</loc>\n`;
        sitemap += `    <lastmod>${lastmod}</lastmod>\n`;
        sitemap += `  </url>\n`;

        if (row.images) {
          const img = `${SITE}/cargar-archivo/blog/${encodeURIComponent(row.images)}`;
          // si quieres la imagen dentro del <url>:
          sitemap = sitemap.replace(
            /<\/url>\n$/,
            `    <image:image>\n      <image:loc>${xmlEscape(img)}</image:loc>\n    </image:image>\n  </url>\n`,
          );
        }
      }

      sitemap += `</urlset>`;

      res.setHeader("Content-Type", "application/xml; charset=UTF-8");
      // res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600"); // opcional
      res.status(200).send(sitemap);
    } catch (error) {
      console.error("Error generando sitemap ES:", error);
      res.status(500).send("Error generando sitemap ES");
    }
  }
}

export default new SitemapXmlControlador();
