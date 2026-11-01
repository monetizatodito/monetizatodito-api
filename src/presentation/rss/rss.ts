import { Request, Response } from "express";
import { pool } from "../../db/db-config";

// ============================================
// CONFIGURACIÓN RSS ESPAÑOL
// ============================================

const SITE = "https://lobitoisaias.com";
const MAX_ARTICULOS = 30;

// ============================================
// TIPOS
// ============================================

interface ArticuloRss {
  slug: string | null;
  categoria_slug: string | null;
  titulo: unknown;
  descripcion: unknown;
  contenido: unknown;
  images: string | null;
  updated_at: string | Date | null;
  created_at: string | Date | null;
}

// ============================================
// PROTEGER EL XML
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
// CODIFICAR SLUGS
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
// TIPO MIME REAL DE LA IMAGEN
// ============================================

function obtenerMimeImagen(url: string): string | null {
  const pathname = url.split("?")[0].toLowerCase();

  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".avif")) return "image/avif";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".jpg")) return "image/jpeg";
  if (pathname.endsWith(".jpeg")) return "image/jpeg";

  return null;
}

// ============================================
// FORMATEAR FECHA RSS
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
// CONTROLADOR RSS ESPAÑOL
// ============================================

export class RssXmlControlador {
  async getRssXml(_req: Request, res: Response) {
    try {
      // ======================================
      // 1. CONSULTAR ÚLTIMOS ARTÍCULOS
      // ACTIVOS Y SU CATEGORÍA ORIGINAL
      // ======================================

      const { rows: articulos } = await pool.query<ArticuloRss>(`
          SELECT
            b.slug,
            b.titulo,
            b.descripcion,
            b.contenido,
            b.images,
            b."updatedAt" AS updated_at,
            b."createdAt" AS created_at,
            cat.slug AS categoria_slug

          FROM blog b

          LEFT JOIN LATERAL (
            SELECT
              c.slug

            FROM blog_categoria bc

            INNER JOIN categoria c
              ON c.id = bc."categoriaId"

            WHERE bc."blogId" = b.id
              AND NULLIF(TRIM(c.slug), '') IS NOT NULL

            ORDER BY c.slug ASC

            LIMIT 1
          ) cat ON TRUE

          WHERE b.activo = TRUE
            AND NULLIF(TRIM(b.slug), '') IS NOT NULL

          ORDER BY b."updatedAt" DESC NULLS LAST

          LIMIT ${MAX_ARTICULOS}
        `);

      // ======================================
      // 2. CONSTRUIR RSS 2.0
      // ======================================

      const rss: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">',
        "  <channel>",
        "    <title>Lobito Isaías</title>",
        `    <link>${SITE}</link>`,
        "    <description>Últimos artículos, noticias, tutoriales y guías de Lobito Isaías</description>",
        "    <language>es-EC</language>",
        `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
      ];

      // ======================================
      // 3. GENERAR ENTRADAS DEL RSS
      // ======================================

      for (const articulo of articulos) {
        const slug =
          typeof articulo.slug === "string" ? articulo.slug.trim() : "";

        if (!slug) continue;

        const categoriaSlug = articulo.categoria_slug?.trim() || "";

        // ====================================
        // 4. URL PÚBLICA DEL ARTÍCULO
        //
        // Con categoría:
        // /marketing/slug
        //
        // Sin categoría:
        // /blog/slug
        // ====================================

        const link = categoriaSlug
          ? `${SITE}/${encodeSlug(categoriaSlug)}/${encodeSlug(slug)}`
          : `${SITE}/blog/${encodeSlug(slug)}`;

        // ====================================
        // 5. GUID ESTABLE
        //
        // Conservamos el identificador
        // histórico basado en /blog/slug
        // para evitar duplicados en lectores
        // RSS cuando cambie la categoría.
        // ====================================

        const guid = `${SITE}/blog/${encodeSlug(slug)}`;

        // ====================================
        // 6. TÍTULO
        // ====================================

        const titulo = stripHtml(articulo.titulo) || "Sin título";

        // ====================================
        // 7. DESCRIPCIÓN
        // ====================================

        const descripcion = stripHtml(articulo.descripcion);

        const contenido = stripHtml(articulo.contenido);

        const textoDescripcion =
          descripcion ||
          contenido.slice(0, 220) ||
          "Lee este artículo en Lobito Isaías";

        // ====================================
        // 8. FECHA DE PUBLICACIÓN
        // ====================================

        const pubDate = formatRssDate(articulo.updated_at, articulo.created_at);

        // ====================================
        // 9. GENERAR ITEM
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
        // 10. IMAGEN DEL ARTÍCULO
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
      // 11. CERRAR DOCUMENTO
      // ======================================

      rss.push("  </channel>");
      rss.push("</rss>");

      // ======================================
      // 12. ENVIAR RSS
      // ======================================

      const xml = rss.join("\n");

      res.setHeader("Content-Type", "application/rss+xml; charset=UTF-8");

      res.status(200).send(xml);
    } catch (error) {
      console.error("Error generando RSS XML ES:", error);

      res.status(500).send("Error generando RSS XML ES");
    }
  }
}

export default new RssXmlControlador();
