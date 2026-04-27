import { Request, Response } from "express";
import { pool } from "../../db/db-config";

const SITE = "https://mosanmultiverso.com";

export class RssXmlControlador {
  async getRssXml(_req: Request, res: Response) {
    try {
      const { rows } = await pool.query<{
        slug: string | null;
        titulo: unknown;
        descripcion: unknown;
        contenido: unknown;
        images: string | null;
        updated_at: string | Date | null;
        created_at: string | Date | null;
      }>(`
        SELECT
          slug,
          titulo,
          descripcion,
          contenido,
          images,
          "updatedAt" AS updated_at,
          "createdAt" AS created_at
        FROM blog
        WHERE activo = TRUE
          AND slug IS NOT NULL
          AND slug <> ''
        ORDER BY "updatedAt" DESC
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

        if (typeof value === "string") {
          return value;
        }

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
      rss += `    <title>Mosan Multiverso</title>\n`;
      rss += `    <link>${SITE}</link>\n`;
      rss += `    <description>Últimos artículos y noticias de Mosan Multiverso</description>\n`;
      rss += `    <language>es-EC</language>\n`;
      rss += `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;

      for (const row of rows) {
        const slug = typeof row.slug === "string" ? row.slug.trim() : "";
        if (!slug) continue;

        const link = `${SITE}/blog/${encodeURIComponent(slug)}`;

        const titleText = stripHtml(row.titulo) || "Sin título";
        const title = xmlEscape(titleText);

        const descripcionText =
          typeof row.descripcion === "string"
            ? row.descripcion.trim()
            : stripHtml(row.descripcion);

        const contenidoText = stripHtml(row.contenido);

        const rawDescription =
          descripcionText ||
          contenidoText.slice(0, 220) ||
          "Lee este artículo en Mosan Multiverso";

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
      console.error("Error generando RSS XML:", error);
      res.status(500).send("Error generando RSS XML");
    }
  }
}

export default new RssXmlControlador();
