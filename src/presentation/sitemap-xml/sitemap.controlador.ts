import { Request, Response } from "express";
import { pool } from "../../db/db-config";

const SITE = "https://lobitoisaias.com";

interface BlogSitemapRow {
  slug: string;
  updated_at: string | Date | null;
  images: string | null;
  categoria_slug: string | null;
}

interface CategoriaSitemapRow {
  slug: string;
  updated_at: string | Date | null;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatLastmod(value: string | Date | null | undefined): string | null {
  if (!value) return null;

  const fecha = new Date(value);

  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  return fecha.toISOString().slice(0, 10);
}

export class SitemapXmlControlador {
  async getSitemapXml(_req: Request, res: Response) {
    try {
      // =========================================
      // 1. ARTÍCULOS ACTIVOS CON SU CATEGORÍA
      // =========================================

      const { rows: articulos } = await pool.query<BlogSitemapRow>(`
          SELECT
            b.slug,
            b."updatedAt" AS updated_at,
            b.images,
            cat.slug AS categoria_slug
          FROM blog b
          LEFT JOIN LATERAL (
            SELECT c.slug
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
          ORDER BY b."updatedAt" DESC
        `);

      // =========================================
      // 2. CATEGORÍAS DINÁMICAS DE POSTGRESQL
      // =========================================

      const { rows: categorias } = await pool.query<CategoriaSitemapRow>(`
          SELECT
            c.slug,
            MAX(b."updatedAt") AS updated_at
          FROM categoria c
          LEFT JOIN blog_categoria bc
            ON bc."categoriaId" = c.id
          LEFT JOIN blog b
            ON b.id = bc."blogId"
            AND b.activo = TRUE
          WHERE NULLIF(TRIM(c.slug), '') IS NOT NULL
          GROUP BY c.id, c.slug
          ORDER BY c.slug ASC
        `);

      // =========================================
      // 3. RUTAS ESTÁTICAS ESPAÑOL
      // CONSERVAMOS TODAS LAS ORIGINALES
      // =========================================

      const staticLocs = [
        "/",
        "/blog",
        "/contacto",
        "/pregunta",
        "/politica-privacidad",
        "/politica-cookies",
        "/terminos-condiciones",
        "/sobre-nosotros",
        "/tecnologias",
        "/tutoriales",

        // Herramientas
        "/contador-palabras",
        "/certificado-laboral-online",
        "/pdf/firmar-pdf",
        "/png-a-webp",
        "/jpg-a-webp",
        "/cortador-url",
        "/pdf/pdf-a-word",
        "/generar-password-segura",
        "/generar-citas",
        "/pdf/unir-pdf",
        "/pdf/comprimir-pdf",
        "/pdf/pdf-a-texto",
        "/formatear-codigo",
        "/resolver-ecuaciones",
        "/calcular-promedio",
        "/convertir-unidades",
        "/calcular-ley-ohm-potencia",
        "/calcular-materiales-para-gypsum",
        "/bing-homepage-quiz",
      ];

      // =========================================
      // 4. CONSTRUCTOR XML SIN DUPLICADOS
      // =========================================

      const urlsAgregadas = new Set<string>();

      const partesXml: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
      ];

      function agregarUrl(
        pathname: string,
        fecha?: string | Date | null,
        imagen?: string | null,
      ) {
        const url = `${SITE}${pathname}`;

        if (urlsAgregadas.has(url)) {
          return;
        }

        urlsAgregadas.add(url);

        partesXml.push("  <url>");
        partesXml.push(`    <loc>${xmlEscape(url)}</loc>`);

        const lastmod = formatLastmod(fecha);

        if (lastmod) {
          partesXml.push(`    <lastmod>${lastmod}</lastmod>`);
        }

        if (imagen) {
          partesXml.push("    <image:image>");
          partesXml.push(`      <image:loc>${xmlEscape(imagen)}</image:loc>`);
          partesXml.push("    </image:image>");
        }

        partesXml.push("  </url>");
      }

      // =========================================
      // 5. AGREGAR PÁGINAS ESTÁTICAS
      // =========================================

      for (const ruta of new Set(staticLocs)) {
        agregarUrl(ruta);
      }

      // =========================================
      // 6. AGREGAR CATEGORÍAS PÚBLICAS
      //
      // /marketing
      // /finanzas
      // =========================================

      for (const categoria of categorias) {
        const slug = categoria.slug?.trim();

        if (!slug) continue;

        agregarUrl(`/${encodeURIComponent(slug)}`, categoria.updated_at);
      }

      // =========================================
      // 7. AGREGAR ARTÍCULOS ACTIVOS
      //
      // Con categoría:
      // /marketing/slug-del-articulo
      //
      // Sin categoría:
      // /blog/slug-del-articulo
      // =========================================

      for (const articulo of articulos) {
        const slug = articulo.slug?.trim();

        if (!slug) continue;

        const categoriaSlug = articulo.categoria_slug?.trim();

        let pathname: string;

        if (categoriaSlug) {
          pathname =
            `/${encodeURIComponent(categoriaSlug)}` +
            `/${encodeURIComponent(slug)}`;
        } else {
          pathname = `/blog/${encodeURIComponent(slug)}`;
        }

        // Mantener la estructura de imágenes
        // utilizada por el sitemap original.
        const nombreImagen = articulo.images?.trim();

        const imagen = nombreImagen
          ? `${SITE}/cargar-archivo/blog/${encodeURIComponent(nombreImagen)}`
          : null;

        agregarUrl(pathname, articulo.updated_at, imagen);
      }

      // =========================================
      // 8. CERRAR XML
      // =========================================

      partesXml.push("</urlset>");

      const sitemap = partesXml.join("\n");

      // =========================================
      // 9. ENVIAR RESPUESTA
      // =========================================

      res.setHeader("Content-Type", "application/xml; charset=UTF-8");

      res.status(200).send(sitemap);
    } catch (error) {
      console.error("Error generando sitemap ES:", error);

      res.status(500).send("Error generando sitemap ES");
    }
  }
}

export default new SitemapXmlControlador();
