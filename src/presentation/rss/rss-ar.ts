import { Request, Response } from "express";
import { pool } from "../../db/db-config";

// ============================================
// CONFIGURACIÓN RSS ÁRABE
// ============================================

const SITE = "https://lobitoisaias.com";
const LOCALE = "ar";
const MAX_ARTICULOS = 30;

// Conservamos la ruta anterior como fallback.
// Los artículos con categoría usarán su URL nueva.
const BLOG_AR = "/ar/blog";

// ============================================
// TIPOS
// ============================================

interface ArticuloRssAr {
  ar_slug: string | null;
  ar_title: unknown;
  ar_description: unknown;
  ar_content: unknown;
  categoria_ar_slug: string | null;
  categoria_ar_nombre: string | null;
  images: string | null;
  updated_at: string | Date | null;
  created_at: string | Date | null;
}

// ============================================
// ESCAPAR CARACTERES XML
// COMPATIBLE CON TEXTO ÁRABE
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
// ELIMINAR HTML DE TÍTULOS Y DESCRIPCIONES
// ============================================

function stripHtml(value: unknown): string {
  return toPlainText(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================
// CODIFICAR SLUGS UNICODE
// SOPORTA CARACTERES ÁRABES
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
// IDENTIFICAR FORMATO DE IMAGEN
// ============================================

function obtenerMimeImagen(url: string): string | null {
  const pathname = url.split("?")[0].toLowerCase();

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
): string {
  const valor = updatedAt || createdAt;

  if (valor) {
    const fecha = new Date(valor);

    if (!Number.isNaN(fecha.getTime())) {
      return fecha.toUTCString();
    }
  }

  return new Date().toUTCString();
}

// ============================================
// CONTROLADOR RSS ÁRABE
// ============================================

export class RssARXmlControlador {
  async getRssArXml(_req: Request, res: Response) {
    try {
      // ======================================
      // 1. ARTÍCULOS ACTIVOS EN ÁRABE
      // CON SU CATEGORÍA TRADUCIDA
      // ======================================

      const { rows: articulos } = await pool.query<ArticuloRssAr>(
        `
          SELECT
            b.images,
            b."updatedAt" AS updated_at,
            b."createdAt" AS created_at,

            t.slug AS ar_slug,
            t.titulo AS ar_title,
            t.descripcion AS ar_description,
            t.contenido AS ar_content,

            cat.slug AS categoria_ar_slug,
            cat.nombre AS categoria_ar_nombre

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

          ORDER BY b."updatedAt" DESC NULLS LAST,
                   b."createdAt" DESC

          LIMIT $2
          `,
        [LOCALE, MAX_ARTICULOS],
      );

      // ======================================
      // 2. CONSTRUIR DOCUMENTO RSS 2.0
      // ======================================

      const rss: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">',
        "  <channel>",
        "    <title>Lobito Isaias Arabic</title>",
        `    <link>${SITE}/ar</link>`,
        "    <description>أحدث المقالات والأخبار والأدلة من Lobito Isaias</description>",
        "    <language>ar</language>",
        `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
      ];

      // ======================================
      // 3. RECORRER ARTÍCULOS TRADUCIDOS
      // ======================================

      for (const articulo of articulos) {
        const slug =
          typeof articulo.ar_slug === "string" ? articulo.ar_slug.trim() : "";

        if (!slug) continue;

        const categoriaSlug = articulo.categoria_ar_slug?.trim() || "";

        // ====================================
        // 4. URL PÚBLICA DEL ARTÍCULO
        //
        // CON CATEGORÍA:
        // /ar/تسويق/slug-arabe
        //
        // SIN CATEGORÍA:
        // /ar/blog/slug-arabe
        // ====================================

        const link = categoriaSlug
          ? `${SITE}/${LOCALE}/` +
            `${encodeSlug(categoriaSlug)}/` +
            `${encodeSlug(slug)}`
          : `${SITE}${BLOG_AR}/` + encodeSlug(slug);

        // ====================================
        // 5. GUID ESTABLE
        //
        // CONSERVAR EL GUID ANTERIOR
        // PARA NO DUPLICAR PUBLICACIONES
        // EN LOS LECTORES RSS
        // ====================================

        const guid = `${SITE}${BLOG_AR}/${encodeSlug(slug)}`;

        // ====================================
        // 6. TÍTULO TRADUCIDO AL ÁRABE
        // ====================================

        const titulo = stripHtml(articulo.ar_title) || "مقال بدون عنوان";

        // ====================================
        // 7. DESCRIPCIÓN TRADUCIDA
        // ====================================

        const descripcion = stripHtml(articulo.ar_description);

        const contenido = stripHtml(articulo.ar_content);

        const textoDescripcion =
          descripcion ||
          contenido.slice(0, 220) ||
          "اقرأ هذا المقال في Lobito Isaias";

        // ====================================
        // 8. FECHA DE PUBLICACIÓN
        // ====================================

        const pubDate = formatRssDate(articulo.updated_at, articulo.created_at);

        // ====================================
        // 9. GENERAR ITEM RSS
        // ====================================

        rss.push("    <item>");

        rss.push(`      <title>${xmlEscape(titulo)}</title>`);

        rss.push(`      <link>${xmlEscape(link)}</link>`);

        rss.push(`      <guid isPermaLink="false">${xmlEscape(guid)}</guid>`);

        rss.push(`      <pubDate>${xmlEscape(pubDate)}</pubDate>`);

        rss.push(
          `      <description>${xmlEscape(textoDescripcion)}</description>`,
        );

        // ====================================
        // 10. CATEGORÍA TRADUCIDA
        // ====================================

        const nombreCategoria = articulo.categoria_ar_nombre?.trim();

        if (categoriaSlug && nombreCategoria) {
          rss.push(`      <category>${xmlEscape(nombreCategoria)}</category>`);
        }

        // ====================================
        // 11. IMAGEN DEL ARTÍCULO
        // ====================================

        const imagen = buildImageUrl(articulo.images);

        if (imagen) {
          const mime = obtenerMimeImagen(imagen);

          rss.push(
            `      <media:content url="${xmlEscape(imagen)}" medium="image"${mime ? ` type="${mime}"` : ""} />`,
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
      // 13. ENVIAR RESPUESTA
      // ======================================

      res.setHeader("Content-Type", "application/rss+xml; charset=UTF-8");

      res.status(200).send(xml);
    } catch (error) {
      console.error("Error generando RSS AR:", error);

      res.status(500).send("Error generando RSS AR");
    }
  }
}

export default new RssARXmlControlador();
