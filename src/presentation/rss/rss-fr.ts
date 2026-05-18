import { Request, Response } from "express";
import { pool } from "../../db/db-config";

const SITE = "https://monetizatodito.com";

export class RssFRXmlControlador {
  async getRssFrXml(_req: Request, res: Response) {
    try {
      const { rows } = await pool.query<{
        images: string | null;
        updated_at: string | Date | null;
        created_at: string | Date | null;
        fr_slug: string | null;
        fr_title: unknown;
        fr_description: unknown;
        fr_content: unknown;
      }>(`
        SELECT
          b.images,
          b."updatedAt" AS updated_at,
          b."createdAt" AS created_at,
          t.slug AS fr_slug,
          t.titulo AS fr_title,
          t.descripcion AS fr_description,
          t.contenido AS fr_content
        FROM blog b
        JOIN blog_translation t
          ON t.blog_id = b.id
         AND t.locale = 'fr'
        WHERE b.activo = TRUE
          AND t.slug IS NOT NULL
          AND t.slug <> ''
        ORDER BY b."updatedAt" DESC
        LIMIT 30
      `);

      const xmlEscape = (value: unknown): string => {
        const s =
          typeof value === "string"
            ? value
            : value == null
              ? ""
              : String(value);

        return s
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");
      };

      const toPlainText = (value: unknown): string => {
        if (value == null) return "";

        if (typeof value === "string") return value;

        if (typeof value === "number" || typeof value === "boolean") {
          return String(value);
        }

        if (Array.isArray(value)) {
          return value
            .map((item) => {
              if (typeof item === "string") return item;
              if (item == null) return "";
              if (typeof item === "object") {
                try {
                  return JSON.stringify(item);
                } catch {
                  return "";
                }
              }
              return String(item);
            })
            .join(" ");
        }

        if (typeof value === "object") {
          try {
            return JSON.stringify(value);
          } catch {
            return "";
          }
        }

        return String(value);
      };

      const stripHtml = (value: unknown): string => {
        return toPlainText(value)
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      };

      const buildImageUrl = (value: string): string => {
        const img = value.trim();

        if (!img) return "";

        if (img.startsWith("http://") || img.startsWith("https://")) {
          return img;
        }

        return `${SITE}/cargar-archivo/blog/${encodeURIComponent(img)}`;
      };

      let rss = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      rss += `<rss version="2.0">\n`;
      rss += `  <channel>\n`;
      rss += `    <title>Monetiza Todito Français</title>\n`;
      rss += `    <link>${SITE}/fr</link>\n`;
      rss += `    <description>Derniers articles et actualités de Monetiza Todito</description>\n`;
      rss += `    <language>fr-FR</language>\n`;
      rss += `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;

      for (const row of rows) {
        const slug = typeof row.fr_slug === "string" ? row.fr_slug.trim() : "";
        if (!slug) continue;

        const link = `${SITE}/fr/blog/${encodeURIComponent(slug)}`;

        const titleText = stripHtml(row.fr_title) || "Sans titre";
        const title = xmlEscape(titleText);

        const descriptionText =
          typeof row.fr_description === "string"
            ? row.fr_description.trim()
            : stripHtml(row.fr_description);

        const contentText = stripHtml(row.fr_content);

        const rawDescription =
          descriptionText ||
          contentText.slice(0, 220) ||
          "Lisez cet article sur Monetiza Todito";

        const description = xmlEscape(rawDescription);

        const pubDate = new Date(
          row.updated_at || row.created_at || Date.now(),
        ).toUTCString();

        rss += `    <item>\n`;
        rss += `      <title>${title}</title>\n`;
        rss += `      <link>${xmlEscape(link)}</link>\n`;
        rss += `      <guid isPermaLink="true">${xmlEscape(link)}</guid>\n`;
        rss += `      <pubDate>${pubDate}</pubDate>\n`;
        rss += `      <description>${description}</description>\n`;

        if (row.images && typeof row.images === "string" && row.images.trim()) {
          const imageUrl = buildImageUrl(row.images);

          if (imageUrl) {
            rss += `      <enclosure url="${xmlEscape(imageUrl)}" type="image/jpeg" />\n`;
          }
        }

        rss += `    </item>\n`;
      }

      rss += `  </channel>\n`;
      rss += `</rss>`;

      res.setHeader("Content-Type", "application/rss+xml; charset=UTF-8");
      res.status(200).send(rss);
    } catch (error) {
      console.error("Error generando RSS FR:", error);
      res.status(500).send("Error generando RSS FR");
    }
  }
}

export default new RssFRXmlControlador();
