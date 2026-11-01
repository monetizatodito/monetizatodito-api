import { Request, Response } from "express";
import { pool } from "../../db/db-config";

// ============================================
// CONFIGURACIÓN RSS INGLÉS
// ============================================

const SITE = "https://lobitoisaias.com";
const LOCALE = "en";
const BLOG_EN = "/en/blog";
const MAX_ARTICULOS = 30;

// ============================================
// TIPOS
// ============================================

interface ArticuloRssEn {
  en_slug: string | null;
  en_title: unknown;
  en_description: unknown;
  en_content: unknown;
  categoria_en_slug: string | null;
  categoria_en_nombre: string | null;
  images: string | null;
  updated_at: string | Date | null;
  created_at: string | Date | null;
}

// ============================================
// ESCAPAR CARACTERES XML
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
// CONVERTIR CONTENIDO A TEXTO PLANO
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
// LIMPIAR HTML
// ============================================

function stripHtml(value: unknown): string {
  return toPlainText(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================
// CODIFICAR SLUGS UNICODE
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

  // Conservar imágenes externas.
  if (/^https?:\/\//i.test(imagen)) {
    return imagen;
  }

  // Conservar la ruta de imágenes original.
  return `${SITE}/cargar-archivo/blog/` + encodeURIComponent(imagen);
}

// ============================================
// IDENTIFICAR FORMATO DE IMAGEN
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
// FORMATEAR FECHA RSS
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
// CONTROLADOR RSS INGLÉS
// ============================================

export class RssENXmlControlador {
  async getRssEnXml(_req: Request, res: Response) {
    try {
      // ======================================
      // 1. OBTENER ARTÍCULOS EN INGLÉS
      // Y SUS CATEGORÍAS TRADUCIDAS
      // ======================================

      const { rows: articulos } = await pool.query<ArticuloRssEn>(
        `
          SELECT
            b.images,
            b."updatedAt" AS updated_at,
            b."createdAt" AS created_at,

            t.slug AS en_slug,
            t.titulo AS en_title,
            t.descripcion AS en_description,
            t.contenido AS en_content,

            cat.slug AS categoria_en_slug,
            cat.nombre AS categoria_en_nombre

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
        "    <title>Lobito Isaias English</title>",
        `    <link>${SITE}/en</link>`,
        "    <description>Latest articles, news, tutorials and guides from Lobito Isaias</description>",
        "    <language>en-US</language>",
        `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
      ];

      // ======================================
      // 3. RECORRER ARTÍCULOS TRADUCIDOS
      // ======================================

      for (const articulo of articulos) {
        const slug =
          typeof articulo.en_slug === "string" ? articulo.en_slug.trim() : "";

        if (!slug) continue;

        const categoriaSlug = articulo.categoria_en_slug?.trim() || "";

        // ====================================
        // 4. URL PÚBLICA DEL ARTÍCULO
        //
        // CON CATEGORÍA:
        // /en/marketing/english-article-slug
        //
        // SIN CATEGORÍA:
        // /en/blog/english-article-slug
        // ====================================

        const link = categoriaSlug
          ? `${SITE}/${LOCALE}/` +
            `${encodeSlug(categoriaSlug)}/` +
            encodeSlug(slug)
          : `${SITE}${BLOG_EN}/` + encodeSlug(slug);

        // ====================================
        // 5. GUID HISTÓRICO ESTABLE
        //
        // CONSERVAMOS EL GUID ANTERIOR
        // AUNQUE CAMBIE LA CATEGORÍA.
        // ====================================

        const guid = `${SITE}${BLOG_EN}/${encodeSlug(slug)}`;

        // ====================================
        // 6. TÍTULO TRADUCIDO AL INGLÉS
        // ====================================

        const titulo = stripHtml(articulo.en_title) || "Untitled";

        // ====================================
        // 7. DESCRIPCIÓN TRADUCIDA
        // ====================================

        const descripcion = stripHtml(articulo.en_description);

        const contenido = stripHtml(articulo.en_content);

        const textoDescripcion =
          descripcion ||
          contenido.slice(0, 220) ||
          "Read this article on Lobito Isaias";

        // ====================================
        // 8. FECHA DEL ARTÍCULO
        // ====================================

        const pubDate = formatRssDate(articulo.updated_at, articulo.created_at);

        // ====================================
        // 9. CONSTRUIR ITEM RSS
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
        // 10. CATEGORÍA EN INGLÉS
        //
        // Marketing
        // Finance
        // ====================================

        const nombreCategoria = articulo.categoria_en_nombre?.trim();

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
      // 12. CERRAR DOCUMENTO RSS
      // ======================================

      rss.push("  </channel>");
      rss.push("</rss>");

      const xml = rss.join("\n");

      // ======================================
      // 13. RESPONDER AL NAVEGADOR
      // ======================================

      res.setHeader("Content-Type", "application/rss+xml; charset=UTF-8");

      res.status(200).send(xml);
    } catch (error) {
      console.error("Error generando RSS EN:", error);

      res.status(500).send("Error generando RSS EN");
    }
  }
}

export default new RssENXmlControlador();
