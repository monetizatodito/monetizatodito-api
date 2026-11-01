import { Request, Response } from "express";
import { pool } from "../../db/db-config";

// ============================================
// CONFIGURACIÓN RSS ALEMÁN
// ============================================

const SITE = "https://lobitoisaias.com";
const LOCALE = "de";
const BLOG_DE = "/de/blog";
const MAX_ARTICULOS = 30;

// ============================================
// TIPOS
// ============================================

interface ArticuloRssDe {
  de_slug: string | null;
  de_title: unknown;
  de_description: unknown;
  de_content: unknown;
  categoria_de_slug: string | null;
  categoria_de_nombre: string | null;
  images: string | null;
  updated_at: string | Date | null;
  created_at: string | Date | null;
}

// ============================================
// PROTECCIÓN XML
// ============================================

function xmlEscape(value: unknown): string {
  const texto =
    typeof value === "string" ? value : value == null ? "" : String(value);

  return texto
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================
// CONVERTIR CONTENIDO A TEXTO
// ============================================

function toPlainText(value: unknown): string {
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
        if (item == null) return "";

        if (typeof item === "string") {
          return item;
        }

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
}

// ============================================
// LIMPIAR ETIQUETAS HTML
// ============================================

function stripHtml(value: unknown): string {
  return toPlainText(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================
// CODIFICAR SLUGS UNICODE
// SOPORTA ä, ö, ü Y ß
// ============================================

function encodeSlug(value: string): string {
  return encodeURIComponent(value.trim().normalize("NFC"));
}

// ============================================
// CONSTRUIR URL DE IMAGEN
// ============================================

function buildImageUrl(value: string | null): string | null {
  if (!value?.trim()) return null;

  const imagen = value.trim();

  if (/^https?:\/\//i.test(imagen)) {
    return imagen;
  }

  return `${SITE}/cargar-archivo/blog/` + encodeURIComponent(imagen);
}

// ============================================
// IDENTIFICAR TIPO DE IMAGEN
// ============================================

function obtenerMimeImagen(url: string): string | null {
  let pathname: string;

  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    pathname = url.split("?")[0].toLowerCase();
  }

  if (pathname.endsWith(".jpg")) return "image/jpeg";
  if (pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".avif")) return "image/avif";
  if (pathname.endsWith(".gif")) return "image/gif";

  return null;
}

// ============================================
// FORMATEAR FECHAS RSS
// ============================================

function formatRssDate(
  updatedAt: string | Date | null,
  createdAt: string | Date | null,
): string | null {
  for (const valor of [updatedAt, createdAt]) {
    if (!valor) continue;

    const fecha = new Date(valor);

    if (!Number.isNaN(fecha.getTime())) {
      return fecha.toUTCString();
    }
  }

  return null;
}

// ============================================
// CONTROLADOR RSS ALEMÁN
// ============================================

export class RssDEXmlControlador {
  async getRssDeXml(_req: Request, res: Response) {
    try {
      // ======================================
      // 1. ARTÍCULOS ACTIVOS EN ALEMÁN
      // CON SUS CATEGORÍAS TRADUCIDAS
      // ======================================

      const { rows: articulos } = await pool.query<ArticuloRssDe>(
        `
          SELECT
            b.images,
            b."updatedAt" AS updated_at,
            b."createdAt" AS created_at,

            t.slug AS de_slug,
            t.titulo AS de_title,
            t.descripcion AS de_description,
            t.contenido AS de_content,

            cat.slug AS categoria_de_slug,
            cat.nombre AS categoria_de_nombre

          FROM blog b

          INNER JOIN blog_translation t
            ON t.blog_id = b.id
           AND t.locale = $1

          LEFT JOIN LATERAL (
            SELECT
              ct.slug,
              ct.nombre

            FROM blog_categoria bc

            INNER JOIN categoria c
              ON c.id = bc."categoriaId"

            INNER JOIN categoria_translation ct
              ON ct."categoriaId" = c.id
             AND ct.locale = $1

            WHERE bc."blogId" = b.id
              AND NULLIF(TRIM(ct.slug), '') IS NOT NULL

            ORDER BY c.slug ASC

            LIMIT 1
          ) cat ON TRUE

          WHERE b.activo = TRUE
            AND NULLIF(TRIM(t.slug), '') IS NOT NULL

          ORDER BY
            b."updatedAt" DESC NULLS LAST,
            b."createdAt" DESC NULLS LAST

          LIMIT $2
          `,
        [LOCALE, MAX_ARTICULOS],
      );

      // ======================================
      // 2. CONSTRUIR RSS 2.0
      // ======================================

      const rss: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">',
        "  <channel>",
        "    <title>Lobito Isaias Deutsch</title>",
        `    <link>${SITE}/de</link>`,
        "    <description>Neueste Artikel, Nachrichten, Anleitungen und Tipps von Lobito Isaias</description>",
        "    <language>de-DE</language>",
        `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
      ];

      // ======================================
      // 3. RECORRER ARTÍCULOS EN ALEMÁN
      // ======================================

      for (const articulo of articulos) {
        const slug =
          typeof articulo.de_slug === "string" ? articulo.de_slug.trim() : "";

        if (!slug) continue;

        const categoriaSlug = articulo.categoria_de_slug?.trim() || "";

        // ====================================
        // 4. URL PÚBLICA
        //
        // CON CATEGORÍA:
        // /de/marketing/slug-aleman
        //
        // SIN CATEGORÍA:
        // /de/blog/slug-aleman
        // ====================================

        const link = categoriaSlug
          ? `${SITE}/${LOCALE}/` +
            `${encodeSlug(categoriaSlug)}/` +
            encodeSlug(slug)
          : `${SITE}${BLOG_DE}/` + encodeSlug(slug);

        // ====================================
        // 5. GUID HISTÓRICO ESTABLE
        //
        // NO CAMBIA SI EL ARTÍCULO PASA
        // A OTRA CATEGORÍA.
        // ====================================

        const guid = `${SITE}${BLOG_DE}/${encodeSlug(slug)}`;

        // ====================================
        // 6. TÍTULO EN ALEMÁN
        // ====================================

        const titulo = stripHtml(articulo.de_title) || "Ohne Titel";

        // ====================================
        // 7. DESCRIPCIÓN EN ALEMÁN
        // ====================================

        const descripcion = stripHtml(articulo.de_description);

        const contenido = stripHtml(articulo.de_content);

        const textoDescripcion =
          descripcion ||
          contenido.slice(0, 220) ||
          "Lies diesen Artikel auf Lobito Isaias";

        // ====================================
        // 8. FECHA DEL ARTÍCULO
        // ====================================

        const pubDate = formatRssDate(articulo.updated_at, articulo.created_at);

        // ====================================
        // 9. CONSTRUIR ITEM
        // ====================================

        rss.push("    <item>");

        rss.push(`      <title>${xmlEscape(titulo)}</title>`);

        rss.push(`      <link>${xmlEscape(link)}</link>`);

        rss.push(`      <guid isPermaLink="false">${xmlEscape(guid)}</guid>`);

        if (pubDate) {
          rss.push(`      <pubDate>${xmlEscape(pubDate)}</pubDate>`);
        }

        rss.push(
          `      <description>${xmlEscape(textoDescripcion)}</description>`,
        );

        // ====================================
        // 10. CATEGORÍA TRADUCIDA
        // ====================================

        const nombreCategoria = articulo.categoria_de_nombre?.trim();

        if (categoriaSlug && nombreCategoria) {
          rss.push(`      <category>${xmlEscape(nombreCategoria)}</category>`);
        }

        // ====================================
        // 11. IMAGEN DEL ARTÍCULO
        // ====================================

        const imagen = buildImageUrl(articulo.images);

        if (imagen) {
          const mime = obtenerMimeImagen(imagen);

          const atributoMime = mime ? ` type="${mime}"` : "";

          rss.push(
            `      <media:content url="${xmlEscape(imagen)}" medium="image"${atributoMime} />`,
          );
        }

        rss.push("    </item>");
      }

      // ======================================
      // 12. CERRAR RSS
      // ======================================

      rss.push("  </channel>");
      rss.push("</rss>");

      const xml = rss.join("\n");

      // ======================================
      // 13. ENVIAR RESPUESTA XML
      // ======================================

      res.setHeader("Content-Type", "application/rss+xml; charset=UTF-8");

      res.status(200).send(xml);
    } catch (error) {
      console.error("Error generando RSS DE:", error);

      res.status(500).send("Error generando RSS DE");
    }
  }
}

export default new RssDEXmlControlador();
