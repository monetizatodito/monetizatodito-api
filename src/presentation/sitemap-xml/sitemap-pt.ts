import { Request, Response } from "express";
import { pool } from "../../db/db-config";

// ============================================
// CONFIGURACIÓN
// ============================================

const SITE = "https://lobitoisaias.com";
const LOCALE = "pt";
const BLOG_PT = "/pt/blog";

// ============================================
// INTERFACES
// ============================================

interface ArticuloPtSitemap {
  pt_slug: string;
  categoria_pt_slug: string | null;
  images: string | null;
  updated_at: string | Date | null;
}

interface CategoriaPtSitemap {
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

  const fecha = new Date(value);

  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  return fecha.toISOString().slice(0, 10);
}

// ============================================
// CODIFICAR SLUGS UNICODE
// SOPORTA ã, õ, á, é, í, ó, ú, ç
// ============================================

function encodeSlug(slug: string): string {
  return encodeURIComponent(slug.trim().normalize("NFC"));
}

// ============================================
// CONTROLADOR SITEMAP PORTUGUÉS
// ============================================

export class SitemapPTXmlControlador {
  async getSitemapPtXml(_req: Request, res: Response) {
    try {
      // ========================================
      // 1. RUTAS ESTÁTICAS PORTUGUESAS
      // CONSERVAMOS LAS EXISTENTES
      // ========================================

      const staticRoutesPt = [
        `${SITE}/pt`,
        `${SITE}${BLOG_PT}`,
        `${SITE}/pt/contato`,
        `${SITE}/pt/pdf/pdf-para-word`,
        `${SITE}/pt/pdf/word-para-pdf`,
        `${SITE}/pt/jpg-para-webp`,
        `${SITE}/pt/calculadora-materiais-drywall`,
        `${SITE}/pt/sobre-nos`,
        `${SITE}/pt/ferramentas`,
        `${SITE}/pt/bing-homepage-quiz`,
      ];

      // ========================================
      // 2. CATEGORÍAS DINÁMICAS EN PORTUGUÉS
      //
      // categoria
      // categoria_translation
      // blog_categoria
      // ========================================

      const { rows: categorias } = await pool.query<CategoriaPtSitemap>(
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
      // 3. ARTÍCULOS ACTIVOS EN PORTUGUÉS
      // CON SU CATEGORÍA TRADUCIDA
      //
      // blog
      // blog_translation
      // blog_categoria
      // categoria_translation
      // ========================================

      const { rows: articulos } = await pool.query<ArticuloPtSitemap>(
        `
          SELECT
            t.slug AS pt_slug,
            b.images,
            b."updatedAt" AS updated_at,
            cat.slug AS categoria_pt_slug

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
      // 4. CONSTRUIR DOCUMENTO XML
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

      for (const url of staticRoutesPt) {
        agregarUrl(url);
      }

      // ========================================
      // 7. AGREGAR CATEGORÍAS PORTUGUESAS
      //
      // /pt/marketing
      // /pt/financiar
      //
      // NO SE UTILIZAN SLUGS HARDCODEADOS.
      // SE OBTIENEN DESDE POSTGRESQL.
      // ========================================

      for (const categoria of categorias) {
        const slug = categoria.slug?.trim();

        if (!slug) continue;

        const url = `${SITE}/${LOCALE}/${encodeSlug(slug)}`;

        agregarUrl(url, categoria.updated_at);
      }

      // ========================================
      // 8. AGREGAR ARTÍCULOS PORTUGUESES
      //
      // CON CATEGORÍA:
      // /pt/marketing/slug-portugues
      //
      // SIN CATEGORÍA TRADUCIDA:
      // /pt/blog/slug-portugues
      // ========================================

      for (const articulo of articulos) {
        const slug = articulo.pt_slug?.trim();

        if (!slug) continue;

        const categoriaSlug = articulo.categoria_pt_slug?.trim();

        let url: string;

        if (categoriaSlug) {
          url =
            `${SITE}/${LOCALE}` +
            `/${encodeSlug(categoriaSlug)}` +
            `/${encodeSlug(slug)}`;
        } else {
          url = `${SITE}${BLOG_PT}` + `/${encodeSlug(slug)}`;
        }

        // ======================================
        // 9. IMAGEN ORIGINAL DEL ARTÍCULO
        // ======================================

        const nombreImagen = articulo.images?.trim();

        const imagen = nombreImagen
          ? `${SITE}/cargar-archivo/blog/${encodeURIComponent(nombreImagen)}`
          : null;

        agregarUrl(url, articulo.updated_at, imagen);
      }

      // ========================================
      // 10. CERRAR DOCUMENTO XML
      // ========================================

      xml.push("</urlset>");

      const sitemap = xml.join("\n");

      // ========================================
      // 11. RESPONDER AL NAVEGADOR
      // ========================================

      res.setHeader("Content-Type", "application/xml; charset=UTF-8");

      res.status(200).send(sitemap);
    } catch (error) {
      console.error("Error generando sitemap PT:", error);

      res.status(500).send("Error generando sitemap PT");
    }
  }
}

export default new SitemapPTXmlControlador();
