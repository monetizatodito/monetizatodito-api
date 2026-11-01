import { Request, Response } from "express";
import { pool } from "../../db/db-config";

// ============================================
// CONFIGURACIÓN RSS FRANCÉS
// ============================================

const SITE = "https://lobitoisaias.com";
const LOCALE = "fr";
const BLOG_FR = "/fr/blog";
const MAX_ARTICULOS = 30;

// ============================================
// TIPOS
// ============================================

interface ArticuloRssFr {
  fr_slug: string | null;
  fr_title: unknown;
  fr_description: unknown;
  fr_content: unknown;
  categoria_fr_slug: string | null;
  categoria_fr_nombre: string | null;
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
// ELIMINAR ETIQUETAS HTML
// ============================================

function stripHtml(value: unknown): string {
  return toPlainText(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================
// CODIFICACIÓN UNICODE
// SOPORTA é, è, ê, à, ù, ç, ETC.
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

  // Conservar URL externas.
  if (/^https?:\/\//i.test(imagen)) {
    return imagen;
  }

  // Conservar ruta original de imágenes.
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
// FECHAS RSS VÁLIDAS
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
// CONTROLADOR RSS FRANCÉS
// ============================================

export class RssFRXmlControlador {
  async getRssFrXml(_req: Request, res: Response) {
    try {
      // ======================================
      // 1. CONSULTAR ARTÍCULOS FRANCESES
      // CON SUS CATEGORÍAS TRADUCIDAS
      // ======================================

      const { rows: articulos } = await pool.query<ArticuloRssFr>(
        `
          SELECT
            b.images,
            b."updatedAt" AS updated_at,
            b."createdAt" AS created_at,

            t.slug AS fr_slug,
            t.titulo AS fr_title,
            t.descripcion AS fr_description,
            t.contenido AS fr_content,

            cat.slug AS categoria_fr_slug,
            cat.nombre AS categoria_fr_nombre

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
        "    <title>Lobito Isaias Français</title>",
        `    <link>${SITE}/fr</link>`,
        "    <description>Derniers articles, actualités, tutoriels et guides de Lobito Isaias</description>",
        "    <language>fr-FR</language>",
        `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
      ];

      // ======================================
      // 3. RECORRER ARTÍCULOS TRADUCIDOS
      // ======================================

      for (const articulo of articulos) {
        const slug =
          typeof articulo.fr_slug === "string" ? articulo.fr_slug.trim() : "";

        if (!slug) continue;

        const categoriaSlug = articulo.categoria_fr_slug?.trim() || "";

        // ====================================
        // 4. URL PÚBLICA DEL ARTÍCULO
        //
        // CON CATEGORÍA:
        // /fr/commercialisation/slug
        //
        // SIN CATEGORÍA:
        // /fr/blog/slug
        // ====================================

        const link = categoriaSlug
          ? `${SITE}/${LOCALE}/` +
            `${encodeSlug(categoriaSlug)}/` +
            encodeSlug(slug)
          : `${SITE}${BLOG_FR}/` + encodeSlug(slug);

        // ====================================
        // 5. GUID HISTÓRICO
        //
        // CONSERVAR EL IDENTIFICADOR
        // QUE USABA EL RSS ANTERIOR
        // PARA EVITAR DUPLICADOS
        // AL CAMBIAR LA CATEGORÍA.
        // ====================================

        const guid = `${SITE}${BLOG_FR}/${encodeSlug(slug)}`;

        // ====================================
        // 6. TÍTULO EN FRANCÉS
        // ====================================

        const titulo = stripHtml(articulo.fr_title) || "Sans titre";

        // ====================================
        // 7. DESCRIPCIÓN FRANCESA
        // ====================================

        const descripcion = stripHtml(articulo.fr_description);

        const contenido = stripHtml(articulo.fr_content);

        const textoDescripcion =
          descripcion ||
          contenido.slice(0, 220) ||
          "Lisez cet article sur Lobito Isaias";

        // ====================================
        // 8. FECHA DEL ARTÍCULO
        // ====================================

        const pubDate = formatRssDate(articulo.updated_at, articulo.created_at);

        // ====================================
        // 9. GENERAR ITEM RSS
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
        // 10. CATEGORÍA EN FRANCÉS
        //
        // Commercialisation
        // Finance
        //
        // NOMBRES REALES DE POSTGRESQL
        // ====================================

        const nombreCategoria = articulo.categoria_fr_nombre?.trim();

        if (categoriaSlug && nombreCategoria) {
          rss.push(`      <category>${xmlEscape(nombreCategoria)}</category>`);
        }

        // ====================================
        // 11. IMAGEN ORIGINAL DEL ARTÍCULO
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
      console.error("Error generando RSS FR:", error);

      res.status(500).send("Error generando RSS FR");
    }
  }
}

export default new RssFRXmlControlador();
