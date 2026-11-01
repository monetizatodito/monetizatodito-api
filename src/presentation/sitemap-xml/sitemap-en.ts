import { Request, Response } from "express";
import { pool } from "../../db/db-config";

const SITE = "https://lobitoisaias.com";
const LOCALE = "en";

// ============================================
// TIPOS DE DATOS
// ============================================

interface ArticuloEnSitemap {
  en_slug: string;
  categoria_en_slug: string | null;
  images: string | null;
  updated_at: string | Date | null;
}

interface CategoriaEnSitemap {
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
// FORMATEAR FECHAS REALES
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
// CODIFICAR SLUGS CORRECTAMENTE
// ============================================

function encodeSlug(slug: string): string {
  return encodeURIComponent(slug.trim().normalize("NFC"));
}

// ============================================
// CONTROLADOR SITEMAP INGLÉS
// ============================================

export class SitemapENXmlControlador {
  async getSitemapEnXml(_req: Request, res: Response) {
    try {
      // ========================================
      // 1. RUTAS ESTÁTICAS INGLESAS
      // CONSERVAMOS TODAS LAS ORIGINALES
      // SIN DUPLICAR /en/faq
      // ========================================

      const staticRoutesEn = [
        `${SITE}/en`,
        `${SITE}/en/blog`,
        `${SITE}/en/contact`,
        `${SITE}/en/faq`,
        `${SITE}/en/privacy-policy`,
        `${SITE}/en/terms-and-conditions`,
        `${SITE}/en/tools`,
        `${SITE}/en/pdf/pdf-to-word`,
        `${SITE}/en/pdf/word-to-pdf`,
        `${SITE}/en/about`,
        `${SITE}/en/gypsum-materials-calculator`,
        `${SITE}/en/jpg-to-webp`,
        `${SITE}/en/bing-homepage-quiz`,

        // Mantener desactivada hasta confirmar
        // que existe su ruta pública:
        // `${SITE}/en/png-to-webp`,
      ];

      // ========================================
      // 2. CATEGORÍAS TRADUCIDAS AL INGLÉS
      //
      // categoria
      // categoria_translation
      // blog_categoria
      // ========================================

      const { rows: categorias } = await pool.query<CategoriaEnSitemap>(
        `
          SELECT
            ct.slug,
            MAX(b."updatedAt") AS updated_at

          FROM categoria c

          INNER JOIN categoria_translation ct
            ON ct."categoriaId" = c.id
           AND ct.locale = $1

          LEFT JOIN blog_categoria bc
            ON bc."categoriaId" = c.id

          LEFT JOIN blog b
            ON b.id = bc."blogId"
           AND b.activo = TRUE

          WHERE NULLIF(TRIM(ct.slug), '') IS NOT NULL

          GROUP BY c.id, ct.slug

          ORDER BY ct.slug ASC
        `,
        [LOCALE],
      );

      // ========================================
      // 3. ARTÍCULOS ACTIVOS EN INGLÉS
      // CON SUS CATEGORÍAS TRADUCIDAS
      //
      // blog
      // blog_translation
      // blog_categoria
      // categoria_translation
      // ========================================

      const { rows: articulos } = await pool.query<ArticuloEnSitemap>(
        `
          SELECT
            t.slug AS en_slug,
            b.images,
            b."updatedAt" AS updated_at,
            cat.slug AS categoria_en_slug

          FROM blog b

          INNER JOIN blog_translation t
            ON t.blog_id = b.id
           AND t.locale = $1

          LEFT JOIN LATERAL (
            SELECT
              ct.slug

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

          ORDER BY b."updatedAt" DESC
        `,
        [LOCALE],
      );

      // ========================================
      // 4. CONSTRUCTOR XML
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

      for (const url of staticRoutesEn) {
        agregarUrl(url);
      }

      // ========================================
      // 7. AGREGAR CATEGORÍAS INGLESAS
      //
      // /en/marketing
      // /en/finance
      // ========================================

      for (const categoria of categorias) {
        const slug = categoria.slug?.trim();

        if (!slug) continue;

        const url = `${SITE}/${LOCALE}/${encodeSlug(slug)}`;

        agregarUrl(url, categoria.updated_at);
      }

      // ========================================
      // 8. AGREGAR ARTÍCULOS EN INGLÉS
      //
      // CON CATEGORÍA:
      // /en/marketing/english-article-slug
      //
      // SIN CATEGORÍA TRADUCIDA:
      // /en/blog/english-article-slug
      // ========================================

      for (const articulo of articulos) {
        const slug = articulo.en_slug?.trim();

        if (!slug) continue;

        const categoriaSlug = articulo.categoria_en_slug?.trim();

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
      // 10. ENVIAR RESPUESTA XML
      // ========================================

      res.setHeader("Content-Type", "application/xml; charset=UTF-8");

      res.status(200).send(sitemap);
    } catch (error) {
      console.error("Error generando sitemap EN:", error);

      res.status(500).send("Error generando sitemap EN");
    }
  }
}
