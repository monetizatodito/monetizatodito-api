import { Request, Response } from "express";
import { pool } from "../../db/db-config";

const SITE = "https://lobitoisaias.com";
const LOCALE = "de";

// ============================================
// TIPOS DE DATOS
// ============================================

interface ArticuloDeSitemap {
  de_slug: string;
  categoria_de_slug: string | null;
  images: string | null;
  updated_at: string | Date | null;
}

interface CategoriaDeSitemap {
  slug: string;
  updated_at: string | Date | null;
}

// ============================================
// ESCAPAR CARACTERES XML
// ============================================

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================
// FECHAS REALES DE MODIFICACIÓN
// ============================================

function formatLastmod(value: string | Date | null | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

// ============================================
// CODIFICACIÓN SEGURA DE SLUGS
// ADMITE ä, ö, ü, ß Y OTROS CARACTERES
// ============================================

function encodeSlug(slug: string): string {
  return encodeURIComponent(slug.trim().normalize("NFC"));
}

// ============================================
// CONTROLADOR SITEMAP ALEMÁN
// ============================================

export class SitemapDEXmlControlador {
  async getSitemapDeXml(_req: Request, res: Response) {
    try {
      // ========================================
      // 1. RUTAS ESTÁTICAS ALEMANAS
      // CONSERVAR LAS EXISTENTES
      // ========================================

      const staticRoutesDe = [
        `${SITE}/de`,
        `${SITE}/de/blog`,
        `${SITE}/de/kontakt`,
        `${SITE}/de/faq`,
        `${SITE}/de/ueber-uns`,
        `${SITE}/de/werkzeuge`,
        `${SITE}/de/pdf/pdf-zu-word`,
        `${SITE}/de/pdf/word-zu-pdf`,
        `${SITE}/de/jpg-zu-webp`,
        `${SITE}/de/trockenbau-material-berechnen`,
        `${SITE}/de/bing-homepage-quiz`,
      ];

      // ========================================
      // 2. CATEGORÍAS DINÁMICAS ALEMANAS
      //
      // categoria
      // categoria_translation
      // ========================================

      const { rows: categorias } = await pool.query<CategoriaDeSitemap>(`
          SELECT
            ct.slug,
            MAX(b."updatedAt") AS updated_at

          FROM categoria c

          INNER JOIN categoria_translation ct
            ON ct."categoriaId" = c.id
           AND ct.locale = 'de'

          LEFT JOIN blog_categoria bc
            ON bc."categoriaId" = c.id

          LEFT JOIN blog b
            ON b.id = bc."blogId"
           AND b.activo = TRUE

          WHERE NULLIF(TRIM(ct.slug), '') IS NOT NULL

          GROUP BY c.id, ct.slug

          ORDER BY ct.slug ASC
        `);

      // ========================================
      // 3. ARTÍCULOS ACTIVOS EN ALEMÁN
      //
      // blog
      // blog_translation
      // blog_categoria
      // categoria_translation
      // ========================================

      const { rows: articulos } = await pool.query<ArticuloDeSitemap>(`
          SELECT
            t.slug AS de_slug,
            b.images,
            b."updatedAt" AS updated_at,
            cat.slug AS categoria_de_slug

          FROM blog b

          INNER JOIN blog_translation t
            ON t.blog_id = b.id
           AND t.locale = 'de'

          LEFT JOIN LATERAL (
            SELECT
              ct.slug

            FROM blog_categoria bc

            INNER JOIN categoria c
              ON c.id = bc."categoriaId"

            INNER JOIN categoria_translation ct
              ON ct."categoriaId" = c.id
             AND ct.locale = 'de'

            WHERE bc."blogId" = b.id
              AND NULLIF(TRIM(ct.slug), '') IS NOT NULL

            ORDER BY c.slug ASC

            LIMIT 1
          ) cat ON TRUE

          WHERE b.activo = TRUE
            AND NULLIF(TRIM(t.slug), '') IS NOT NULL

          ORDER BY b."updatedAt" DESC
        `);

      // ========================================
      // 4. CONSTRUIR XML
      // ========================================

      const urlsAgregadas = new Set<string>();

      const xml: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
      ];

      // ========================================
      // 5. AGREGAR URL SIN DUPLICADOS
      // ========================================

      function agregarUrl(
        url: string,
        fecha?: string | Date | null,
        imagen?: string | null,
      ): void {
        if (urlsAgregadas.has(url)) {
          return;
        }

        urlsAgregadas.add(url);

        xml.push("  <url>");

        xml.push(`    <loc>${xmlEscape(url)}</loc>`);

        const lastmod = formatLastmod(fecha);

        if (lastmod) {
          xml.push(`    <lastmod>${lastmod}</lastmod>`);
        }

        if (imagen) {
          xml.push("    <image:image>");

          xml.push(`      <image:loc>${xmlEscape(imagen)}</image:loc>`);

          xml.push("    </image:image>");
        }

        xml.push("  </url>");
      }

      // ========================================
      // 6. AGREGAR RUTAS ESTÁTICAS
      // ========================================

      for (const url of staticRoutesDe) {
        agregarUrl(url);
      }

      // ========================================
      // 7. AGREGAR CATEGORÍAS ALEMANAS
      //
      // /de/marketing
      // /de/finanzen
      // ========================================

      for (const categoria of categorias) {
        const slug = categoria.slug?.trim();

        if (!slug) continue;

        const url = `${SITE}/${LOCALE}/${encodeSlug(slug)}`;

        agregarUrl(url, categoria.updated_at);
      }

      // ========================================
      // 8. AGREGAR ARTÍCULOS ALEMANES
      //
      // CON CATEGORÍA:
      // /de/marketing/slug-aleman
      //
      // SIN CATEGORÍA TRADUCIDA:
      // /de/blog/slug-aleman
      // ========================================

      for (const articulo of articulos) {
        const slug = articulo.de_slug?.trim();

        if (!slug) continue;

        const categoriaSlug = articulo.categoria_de_slug?.trim();

        let url: string;

        if (categoriaSlug) {
          url =
            `${SITE}/${LOCALE}` +
            `/${encodeSlug(categoriaSlug)}` +
            `/${encodeSlug(slug)}`;
        } else {
          url = `${SITE}/${LOCALE}/blog` + `/${encodeSlug(slug)}`;
        }

        // ======================================
        // IMAGEN ORIGINAL DEL ARTÍCULO
        // ======================================

        const nombreImagen = articulo.images?.trim();

        const imagen = nombreImagen
          ? `${SITE}/cargar-archivo/blog/${encodeURIComponent(nombreImagen)}`
          : null;

        agregarUrl(url, articulo.updated_at, imagen);
      }

      // ========================================
      // 9. CERRAR XML
      // ========================================

      xml.push("</urlset>");

      const sitemap = xml.join("\n");

      // ========================================
      // 10. RESPONDER A LA SOLICITUD
      // ========================================

      res.setHeader("Content-Type", "application/xml; charset=UTF-8");

      res.status(200).send(sitemap);
    } catch (error) {
      console.error("Error generando sitemap DE:", error);

      res.status(500).send("Error generando sitemap DE");
    }
  }
}

export default new SitemapDEXmlControlador();
