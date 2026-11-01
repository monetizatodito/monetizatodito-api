import { QueryResult } from "pg";
import { pool } from "../db/db-config";
import { generarIdUnico } from "../config/generar-id";

import { CustomError } from "../error/custom.error";

import { BlogEntity } from "../entity/blog/blog.entity";

export interface BlogRow {
  id: string;
  titulo: string;
  slug: string;
  descripcion: string | null;
  palabras_claves: string[] | null;
  contenido: any; // JSONB
  images: string | null;
  images_alt: string | null; // ✅ NUEVO
  autor: string | null;
  usuarioId: string;
  createdAt: string;
  updatedAt: string;
  type: "post" | "bio"; // 👈 NUEVO
  // ✅ NUEVO
  youtube_urls: string[] | null;
}

export interface BlogTranslationRow {
  id: number;
  blog_id: string;
  locale: string; // 'en' | 'pt' | ...
  titulo: string;
  slug: string;
  descripcion: string | null;
  palabras_claves: string[] | null;
  contenido: any; // JSONB
  images_alt: string | null; // ✅ NUEVO
  meta_title: string | null;
  meta_description: string | null;
}

export class BlogRepository {
  async create(
    id: string,
    blog: BlogEntity,
    autor: any,
    usuarioId: string,
  ): Promise<BlogEntity> {
    // Asegúrate de que esta función esté definida en otro lugar
    // normalizar type (por si viene undefined)
    const type: "post" | "bio" = (blog as any).type === "bio" ? "bio" : "post";

    const query = `
        INSERT INTO blog(
            id, titulo,slug,contenido, descripcion, palabras_claves, images, images_alt, type,
             youtube_urls,
            "createdAt", "updatedAt", autor, "usuarioId"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,$11, $12, $13, $14)
        RETURNING *;
    `;

    const values = [
      id,
      blog.titulo,
      blog.slug,
      JSON.stringify(blog.contenido), // Asegúrate de que `contenido` se almacene como JSONB
      blog.descripcion,
      blog.palabras_claves || [], // Default a un array vacío si no se pasa palabras_claves
      blog.images,
      (blog as any).imagesAlt ?? null, // ✅ NUEVO
      type,
      // ✅ NUEVO (en BlogEntity lo guardas como youtubeUrls)
      (blog as any).youtubeUrls ?? null,
      blog.createdAt ?? new Date(), // Usamos new Date() para obtener un valor de tipo Date
      blog.updatedAt ?? new Date(), // Lo mismo para updatedAt
      autor, // Usamos el valor por defecto de 'administrador' si no se pasa
      usuarioId,
      // Ahora en la posición correcta
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0]; // Devolvemos la primera fila (el blog creado)
    } catch (err) {
      throw CustomError.internalServerError(`No se pudo crear el blog: ${err}`);
    }
  }

  async crearCategoria(nombre: string, descripcion?: string) {
    const nombreLimpio = nombre.trim();

    const slug = nombreLimpio
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100)
      .replace(/-$/g, "");

    if (!nombreLimpio || !slug || nombreLimpio.length > 50) {
      throw CustomError.badRequest("El nombre de la categoría no es válido.");
    }

    const id = generarIdUnico();

    const query = `
    INSERT INTO categoria (
      id, nombre, slug, descripcion
    )
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;

    try {
      const result = await pool.query(query, [
        id,
        nombreLimpio,
        slug,
        descripcion?.trim() || null,
      ]);

      return result.rows[0];
    } catch (err: any) {
      if (err?.code === "23505") {
        throw CustomError.badRequest(
          "Ya existe una categoría con ese nombre o slug.",
        );
      }

      throw CustomError.internalServerError("No se pudo crear la categoría.");
    }
  }

  async asignarCategoriasABlog(
    blogId: string,
    categoriaIds: string[],
  ): Promise<void> {
    const query = `
    INSERT INTO blog_categoria("blogId", "categoriaId")
    VALUES ${categoriaIds.map((_, i) => `($1, $${i + 2})`).join(", ")}
    ON CONFLICT DO NOTHING
  `;

    const values = [blogId, ...categoriaIds];

    try {
      await pool.query(query, values);
    } catch (err) {
      throw CustomError.internalServerError(
        `No se pudieron asignar las categorías: ${err}`,
      );
    }
  }

  async getCategoriasDeBlog(blogId: string): Promise<any[]> {
    const query = `
    SELECT c.*
    FROM categoria c
    INNER JOIN blog_categoria bc ON bc."categoriaId" = c.id
    WHERE bc."blogId" = $1
  `;

    try {
      const result = await pool.query(query, [blogId]);
      return result.rows;
    } catch (err) {
      throw CustomError.internalServerError(
        `Error al obtener las categorías del blog: ${err}`,
      );
    }
  }

  async eliminarCategoriasDeBlog(blogId: string): Promise<void> {
    const query = `DELETE FROM blog_categoria WHERE "blogId" = $1`;

    try {
      await pool.query(query, [blogId]);
    } catch (err) {
      throw CustomError.internalServerError(
        `No se pudieron eliminar las categorías del blog: ${err}`,
      );
    }
  }

  async actualizarCategoriasDeBlog(
    blogId: string,
    nuevasCategorias: string[],
  ): Promise<void> {
    await this.eliminarCategoriasDeBlog(blogId);
    await this.asignarCategoriasABlog(blogId, nuevasCategorias);
  }

  /** ¿Existe ya una traducción para (blog_id, locale)? */
  async existsTranslationByBlogAndLocale(
    blogId: string,
    locale: string,
  ): Promise<boolean> {
    const sql = `SELECT 1 FROM blog_translation WHERE blog_id = $1 AND locale = $2 LIMIT 1`;
    const { rows } = await pool.query(sql, [blogId, locale]);
    return rows.length > 0;
  }

  getBlog(limit: number, offset: number) {
    const query = `
  SELECT
    b.*,

    (
      SELECT c.slug
      FROM blog_categoria bc
      INNER JOIN categoria c
        ON c.id = bc."categoriaId"
      WHERE bc."blogId" = b.id
      ORDER BY c.id
      LIMIT 1
    ) AS categoria_slug

  FROM blog b

  WHERE b.type = 'post'
    AND b.activo = TRUE

  ORDER BY b."createdAt" DESC

  LIMIT $1 OFFSET $2
`;

    return pool
      .query(query, [limit, offset])
      .then((result) => result.rows)
      .catch((err) => {
        console.error("[DB:getBlog] Error al listar blogs:", err);
        throw CustomError.internalServerError(
          `no se pudo listar las caja: ${err}`,
        );
      });
  }

  getBlogByAutor(nombre: string, limit: number, offset: number) {
    const query = `
    SELECT * FROM blog
    WHERE autor = $1
    AND type = 'post'
    AND activo = TRUE
    ORDER BY "createdAt" DESC
    LIMIT $2 OFFSET $3
  `;

    return pool
      .query(query, [nombre, limit, offset])
      .then((result) => result.rows)
      .catch((err) => {
        console.error(
          "[DB:getBlogByAutor] Error al listar blogs por autor:",
          err,
        );
        throw CustomError.internalServerError(
          `No se pudo obtener los blogs del autor: ${err}`,
        );
      });
  }

  countByAutor(nombre: string) {
    const query = `SELECT COUNT(*) FROM blog WHERE autor = $1   AND type = 'post'
      AND activo = TRUE`;

    return pool
      .query(query, [nombre])
      .then((res) => parseInt(res.rows[0].count, 10))
      .catch((err) => {
        console.error(
          "[DB:countByAutor] Error al contar blogs por autor:",
          err,
        );
        throw CustomError.internalServerError(
          "Error al contar blogs del autor",
        );
      });
  }

  countAll() {
    const sql = `SELECT COUNT(*) AS count FROM blog  WHERE type = 'post' AND activo = TRUE`;

    return pool
      .query(sql)
      .then((result) => parseInt(result.rows[0].count, 10))
      .catch((err) => {
        console.error("[DB:countAll] Error al contar blogs:", err);
        throw CustomError.internalServerError("No se pudo contar los blogs");
      });
  }

  getBlogId(id: string) {
    const query = `SELECT * FROM blog WHERE id = $1`;
    return pool
      .query(query, [id])
      .then((result) => result.rows[0])
      .catch((err) => {
        throw CustomError.internalServerError(
          `no se ecuentre la apertura: ${err}`,
        );
      });
  }

  getBlogSlug(slug: string) {
    const query = `SELECT * FROM blog WHERE slug = $1`;
    return pool
      .query(query, [slug])
      .then((result) => result.rows[0])
      .catch((err) => {
        throw CustomError.internalServerError(
          `no se ecuentre la apertura: ${err}`,
        );
      });
  }

  async putBlog(id: string, blog: Partial<BlogEntity>): Promise<BlogEntity> {
    // Paso 1: Construir la consulta de actualización dinámica
    const fields = [];
    const values = [];
    let index = 1;

    // Verificar si "montoA" está presente
    if (blog.titulo !== undefined) {
      fields.push(`titulo = $${index++}`);
      values.push(blog.titulo);
    }

    // Verificar si "abrirCaja" está presente, incluso si es "false"
    //if (blog.contenido !== undefined) {
    // fields.push(`contenido = $${index++}`);
    //values.push(blog.contenido);
    //}
    if (blog.contenido !== undefined) {
      fields.push(`contenido = $${index++}`);
      values.push(
        typeof (blog as any).contenido === "string"
          ? (blog as any).contenido
          : JSON.stringify((blog as any).contenido),
      );
    }

    if (blog.images !== undefined) {
      fields.push(`images = $${index++}`);
      values.push(blog.images);
    }

    if ((blog as any).imagesAlt !== undefined) {
      fields.push(`images_alt = $${index++}`);
      values.push((blog as any).imagesAlt);
    }

    // ✅ NUEVO: actualizar youtube_urls (si viene)
    if ((blog as any).youtubeUrls !== undefined) {
      fields.push(`youtube_urls = $${index++}`);
      values.push((blog as any).youtubeUrls);
    }

    // Actualizar "updatedAt"
    fields.push(`"updatedAt" = $${index++}`);
    values.push(new Date());

    // Agregar el ID al final de los valores
    values.push(id);

    // Verificar si hay campos para actualizar
    if (fields.length === 0) {
      throw CustomError.notModified("No hay campos para actualizar");
    }

    // Construir la consulta SQL
    const query = `
    UPDATE blog
    SET ${fields.join(", ")}
    WHERE id = $${index}
    RETURNING *;
  `;

    try {
      // Ejecutar la consulta SQL
      const result = await pool.query(query, values);

      // Verificar si se actualizó algún registro
      if (result.rowCount === 0) {
        throw CustomError.notModified("No se actualizó LA CAJA");
      }

      // Retornar la caja actualizada
      return result.rows[0];
    } catch (err) {
      console.error("Error al actualizar LA CAJA:", err);
      throw CustomError.internalServerError("Error interno del servidor");
    }
  }

  getBlogById(id: string): Promise<any> {
    const query = "SELECT * FROM blog WHERE id = $1";
    return pool
      .query(query, [id])
      .then((result: QueryResult) => {
        if (result.rows.length === 0) return null;
        return result.rows[0];
      })
      .catch((err) => {
        console.error("Error fetching blog", err);
        throw CustomError.internalServerError("No se pudo obtener el blog");
      });
  }

  deleteBlog(id: string): Promise<boolean> {
    const query = "DELETE FROM blog WHERE id = $1";
    return pool
      .query(query, [id])
      .then((result: QueryResult) => {
        return result.rowCount! > 0; // true si se eliminó algo
      })
      .catch((err) => {
        console.error("Error deleting blog", err);
        throw CustomError.internalServerError("No se pudo eliminar el blog");
      });
  }

  /** Comprueba si existe un slug en un locale concreto. */
  async existsTranslationSlug(locale: string, slug: string): Promise<boolean> {
    const sql = `SELECT 1 FROM blog_translation WHERE locale = $1 AND slug = $2 LIMIT 1`;
    const { rows } = await pool.query(sql, [locale, slug]);
    return rows.length > 0;
  }

  /** Upsert de traducción por (blog_id, locale). Devuelve la fila resultante. */
  async upsertTranslation(data: {
    blog_id: string;
    locale: string; // 'en', 'pt', ...
    titulo: string;
    slug: string;
    descripcion?: string | null;
    palabras_claves?: string[] | null;
    contenido: any; // JSONB

    meta_title?: string | null;
    meta_description?: string | null;
    images_alt?: string | null;
  }): Promise<BlogTranslationRow> {
    const sql = `
      INSERT INTO blog_translation (
        blog_id, locale, titulo, slug, descripcion, palabras_claves, contenido, meta_title, meta_description, images_alt
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, $10)
      ON CONFLICT (blog_id, locale) DO UPDATE SET
        titulo = EXCLUDED.titulo,
        slug = EXCLUDED.slug,
        descripcion = EXCLUDED.descripcion,
        palabras_claves = EXCLUDED.palabras_claves,
        contenido = EXCLUDED.contenido,
        meta_title = EXCLUDED.meta_title,
        meta_description = EXCLUDED.meta_description,
        images_alt = EXCLUDED.images_alt
      RETURNING id, blog_id, locale, titulo, slug, descripcion, palabras_claves, contenido, meta_title, meta_description, images_alt
    `;
    const params = [
      data.blog_id,
      data.locale,
      data.titulo,
      data.slug,
      data.descripcion ?? null,
      data.palabras_claves ?? null,
      JSON.stringify(data.contenido),
      data.meta_title ?? null,
      data.meta_description ?? null,
      data.images_alt ?? null, // ✅
    ];
    const { rows } = await pool.query(sql, params);
    return rows[0];
  }

  /** Lectura por slug + locale. Si locale='es', lee la base; si no, lee traducción y hace join a lo necesario. */
  async getBySlugAndLocale(slug: string, locale: string) {
    if (locale === "es") {
      const sql = `
        SELECT b.*
        FROM blog b
        WHERE b.slug = $1
        LIMIT 1
      `;
      const { rows } = await pool.query(sql, [slug]);
      return rows[0] || null;
    } else {
      const sql = `
        SELECT
          b.id,
          COALESCE(t.titulo, b.titulo) AS titulo,
          COALESCE(t.descripcion, b.descripcion) AS descripcion,
          COALESCE(t.contenido, b.contenido) AS contenido,
          b.images,
          COALESCE(t.images_alt, b.images_alt) AS images_alt,

          b.autor,
          b."usuarioId",
          b."createdAt",
          b."updatedAt",
             -- ✅ NUEVO
          b.youtube_urls,
          t.slug AS t_slug,  -- slug por idioma (para URLs del cliente)
          b.slug AS base_slug -- slug en ES (por referencia)
        FROM blog_translation t
        JOIN blog b ON b.id = t.blog_id
        WHERE t.locale = $2 AND t.slug = $1
        LIMIT 1
      `;
      const { rows } = await pool.query(sql, [slug, locale]);
      return rows[0] || null;
    }
  }

  /** Si prefieres buscar por id + locale (útil para admin o API interna) */
  async getByIdAndLocale(id: string, locale: string) {
    if (locale === "es") {
      const sql = `SELECT * FROM blog WHERE id = $1 LIMIT 1`;
      const { rows } = await pool.query(sql, [id]);
      return rows[0] || null;
    } else {
      const sql = `
        SELECT
          b.id,
          COALESCE(t.titulo, b.titulo) AS titulo,
          COALESCE(t.descripcion, b.descripcion) AS descripcion,
          COALESCE(t.contenido, b.contenido) AS contenido,
          b.images,
          COALESCE(t.images_alt, b.images_alt) AS images_alt,

          b.autor,
          b."usuarioId",
          b."createdAt",
          b."updatedAt",
             -- ✅ NUEVO
          b.youtube_urls,
          t.slug AS t_slug,
          b.slug AS base_slug
        FROM blog b
        LEFT JOIN blog_translation t
          ON t.blog_id = b.id AND t.locale = $2
        WHERE b.id = $1
        LIMIT 1
      `;
      const { rows } = await pool.query(sql, [id, locale]);
      return rows[0] || null;
    }
  }

  // NUEVO: listado localizado
  async getBlogLocalized(limit: number, offset: number, locale: string) {
    const sql = `
    SELECT
      b.id,
      COALESCE(t.slug, b.slug)              AS slug,        -- slug por idioma si existe
      COALESCE(t.titulo, b.titulo)          AS titulo,
      COALESCE(t.descripcion, b.descripcion) AS descripcion,
      COALESCE(t.contenido, b.contenido)   AS contenido,
      b.images,
      COALESCE(t.images_alt, b.images_alt) AS images_alt,

      b.autor,
      b."usuarioId",
      b."createdAt",
      b."updatedAt",
     b.youtube_urls,

CASE
  WHEN t.id IS NOT NULL THEN (
    SELECT ct.slug
    FROM blog_categoria bc

    INNER JOIN categoria_translation ct
      ON ct."categoriaId" = bc."categoriaId"
      AND ct.locale = $3

    WHERE bc."blogId" = b.id

    ORDER BY bc."categoriaId"
    LIMIT 1
  )
  ELSE NULL
END AS categoria_slug
    FROM blog b
    LEFT JOIN blog_translation t
      ON t.blog_id = b.id
     AND t.locale = $3
    WHERE b.activo = TRUE
      AND b.type = 'post'
    ORDER BY b."createdAt" DESC
    LIMIT $1 OFFSET $2
  `;

    const { rows } = await pool.query(sql, [limit, offset, locale]);
    return rows;
  }

  async listUntranslated(
    locale: string,
    limit: number,
    offset: number,
    search?: string,
  ) {
    const params: any[] = [locale];
    let i = 2;
    let whereSearch = "";
    if (search) {
      params.push(`%${search}%`);
      whereSearch = `AND (b.slug ILIKE $${i} OR b.titulo ILIKE $${i})`;
    }

    const sql = `
    SELECT b.id, b.slug, b.titulo, b."createdAt"
    FROM blog b
    WHERE b.activo = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM blog_translation t
        WHERE t.blog_id = b.id AND t.locale = $1
      )
      ${whereSearch}
    ORDER BY b."createdAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
    const { rows } = await pool.query(sql, params);
    return rows;
  }

  async countUntranslated(locale: string, search?: string) {
    const params: any[] = [locale];
    let whereSearch = "";
    if (search) {
      params.push(`%${search}%`);
      whereSearch = `AND (b.slug ILIKE $2 OR b.titulo ILIKE $2)`;
    }

    const sql = `
    SELECT COUNT(*)::int AS count
    FROM blog b
    WHERE b.activo = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM blog_translation t
        WHERE t.blog_id = b.id AND t.locale = $1
      )
      ${whereSearch}
  `;
    const { rows } = await pool.query(sql, params);
    return rows[0]?.count ?? 0;
  }

  async getBioByAutor(nombre: string): Promise<any | null> {
    const sql = `
    SELECT *
    FROM blog
    WHERE autor = $1
      AND type = 'bio'
      AND activo = TRUE
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
    const { rows } = await pool.query(sql, [nombre]);
    return rows[0] || null;
  }

  async getBioByAutorAndLocale(
    nombre: string,
    locale: string,
  ): Promise<any | null> {
    if (locale === "es") {
      // Igual que tu getBioByAutor original
      const sql = `
      SELECT *
      FROM blog
      WHERE autor = $1
        AND type = 'bio'
        AND activo = TRUE
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
      const { rows } = await pool.query(sql, [nombre]);
      return rows[0] || null;
    }

    // Para otros idiomas, intentamos leer la traducción
    const sql = `
    SELECT
      b.id,
      COALESCE(t.titulo, b.titulo)            AS titulo,
      COALESCE(t.descripcion, b.descripcion)  AS descripcion,
      COALESCE(t.contenido, b.contenido)     AS contenido,
      b.images,
      COALESCE(t.images_alt, b.images_alt) AS images_alt,

      b.autor,
      b."usuarioId",
      b."createdAt",
      b."updatedAt",
      t.slug        AS t_slug,     -- slug localizado (para URLs en el cliente)
      b.slug        AS base_slug,  -- slug en español
      b.type
    FROM blog b
    LEFT JOIN blog_translation t
      ON t.blog_id = b.id
     AND t.locale = $2
    WHERE b.autor = $1
      AND b.type = 'bio'
      AND b.activo = TRUE
    ORDER BY b."createdAt" DESC
    LIMIT 1
  `;
    const { rows } = await pool.query(sql, [nombre, locale]);
    return rows[0] || null;
  }

  async listarCategorias() {
    const query = `
    SELECT
      id,
      nombre,
      slug,
      descripcion,
      "createdAt"
    FROM categoria
    ORDER BY nombre ASC;
  `;

    const { rows } = await pool.query(query);

    return rows;
  }

  async getCategoriaTranslation(categoriaId: string, locale: string) {
    const { rows } = await pool.query(
      `
    SELECT *
    FROM categoria_translation
    WHERE "categoriaId" = $1
      AND locale = $2
    LIMIT 1
    `,
      [categoriaId, locale],
    );

    return rows[0] ?? null;
  }

  async guardarCategoriaTranslation(data: {
    categoriaId: string;
    locale: string;
    nombre: string;
    slug: string;
    descripcion: string | null;
  }) {
    const { rows } = await pool.query(
      `
    INSERT INTO categoria_translation (
      "categoriaId",
      locale,
      nombre,
      slug,
      descripcion
    )
    VALUES ($1, $2, $3, $4, $5)

    ON CONFLICT ("categoriaId", locale)
    DO NOTHING

    RETURNING *;
    `,
      [data.categoriaId, data.locale, data.nombre, data.slug, data.descripcion],
    );

    return (
      rows[0] ?? this.getCategoriaTranslation(data.categoriaId, data.locale)
    );
  }

  async getPostPorCategoriaYLocale(
    categoriaSlug: string,
    postSlug: string,
    locale: string,
  ) {
    const sql = `
    SELECT
      b.id,

      COALESCE(bt.slug, b.slug) AS slug,
      COALESCE(bt.titulo, b.titulo) AS titulo,
      COALESCE(bt.descripcion, b.descripcion) AS descripcion,
      COALESCE(bt.contenido, b.contenido) AS contenido,

      b.images,
      COALESCE(bt.images_alt, b.images_alt) AS images_alt,
      b.autor,
      b."createdAt",
      b.youtube_urls,

      c.id AS categoria_id,

      CASE
        WHEN $3 = 'es' THEN c.nombre
        ELSE ct.nombre
      END AS categoria_nombre,

      CASE
        WHEN $3 = 'es' THEN c.slug
        ELSE ct.slug
      END AS categoria_slug

    FROM blog b

    INNER JOIN blog_categoria bc
      ON bc."blogId" = b.id

    INNER JOIN categoria c
      ON c.id = bc."categoriaId"

    LEFT JOIN categoria_translation ct
      ON ct."categoriaId" = c.id
      AND ct.locale = $3

    LEFT JOIN blog_translation bt
      ON bt.blog_id = b.id
      AND bt.locale = $3

    WHERE b.activo = TRUE
      AND b.type = 'post'

      AND (
        CASE
          WHEN $3 = 'es' THEN c.slug
          ELSE ct.slug
        END
      ) = $1

      AND (
        CASE
          WHEN $3 = 'es' THEN b.slug
          ELSE bt.slug
        END
      ) = $2

    LIMIT 1;
  `;

    const { rows } = await pool.query(sql, [categoriaSlug, postSlug, locale]);

    return rows[0] ?? null;
  }

  async getCategoriaSlugsDeBlog(blogId: string) {
    const sql = `
    SELECT
      c.id,
      c.slug AS slug_es,

      COALESCE(
        jsonb_object_agg(ct.locale, ct.slug)
        FILTER (
          WHERE ct.locale IS NOT NULL
            AND ct.slug IS NOT NULL
        ),
        '{}'::jsonb
      ) AS traducciones

    FROM categoria c

    INNER JOIN blog_categoria bc
      ON bc."categoriaId" = c.id

    LEFT JOIN categoria_translation ct
      ON ct."categoriaId" = c.id

    WHERE bc."blogId" = $1

    GROUP BY c.id, c.slug

    ORDER BY c.id ASC

    LIMIT 1
  `;

    const { rows } = await pool.query(sql, [blogId]);

    if (!rows.length) return null;

    const categoria = rows[0];

    return {
      es: categoria.slug_es,
      ...categoria.traducciones,
    };
  }

  public async listarCategoriaPublica(
    categoriaSlug: string,
    locale: string,
    page: number,
    limit: number,
  ) {
    const categoriaSql = `
  SELECT
    c.id,

    CASE
      WHEN $2 = 'es' THEN c.nombre
      ELSE COALESCE(NULLIF(ct.nombre, ''), c.nombre)
    END AS nombre,

    CASE
      WHEN $2 = 'es' THEN c.slug
      ELSE COALESCE(NULLIF(ct.slug, ''), c.slug)
    END AS slug,

    CASE
      WHEN $2 = 'es' THEN c.descripcion
      ELSE COALESCE(NULLIF(ct.descripcion, ''), c.descripcion)
    END AS descripcion

  FROM categoria c

  LEFT JOIN categoria_translation ct
    ON ct."categoriaId" = c.id
    AND ct.locale = $2

  WHERE (
    CASE
      WHEN $2 = 'es' THEN c.slug
      ELSE COALESCE(NULLIF(ct.slug, ''), c.slug)
    END
  ) = $1

  LIMIT 1
`;

    const categoriaRes = await pool.query(categoriaSql, [
      categoriaSlug,
      locale,
    ]);

    const categoria = categoriaRes.rows[0];

    if (!categoria) return null;

    const filtro = `
    FROM blog b
    INNER JOIN blog_categoria bc
      ON bc."blogId" = b.id
    LEFT JOIN blog_translation t
      ON t.blog_id = b.id
      AND t.locale = $2
    WHERE bc."categoriaId" = $1
      AND b.type = 'post'
      AND b.activo = TRUE
      AND (
        $2 = 'es'
        OR (
          t.blog_id IS NOT NULL
          AND t.slug IS NOT NULL
        )
      )
  `;

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total ${filtro}`,
      [categoria.id, locale],
    );

    const totalItems = Number(countRes.rows[0]?.total || 0);

    const offset = (page - 1) * limit;

    const articulosSql = `
    SELECT
      b.id,
      CASE WHEN $2 = 'es' THEN b.titulo ELSE t.titulo END AS titulo,
      CASE WHEN $2 = 'es' THEN b.slug ELSE t.slug END AS slug,
      CASE WHEN $2 = 'es' THEN b.descripcion ELSE t.descripcion END AS descripcion,
      b.images,
      b.images_alt AS "imagesAlt"

    ${filtro}

    ORDER BY b."createdAt" DESC
    LIMIT $3 OFFSET $4
  `;

    const articulosRes = await pool.query(articulosSql, [
      categoria.id,
      locale,
      limit,
      offset,
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return {
      categoria,
      blog: articulosRes.rows,
      meta: {
        totalItems,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  public async obtenerArticuloCategoriaPublica(
    categoriaSlug: string,
    postSlug: string,
    locale: string,
  ) {
    const sql = `
    SELECT
      b.id,
      CASE WHEN $3 = 'es' THEN b.titulo ELSE t.titulo END AS titulo,
      CASE WHEN $3 = 'es' THEN b.slug ELSE t.slug END AS slug,
      CASE WHEN $3 = 'es' THEN b.descripcion ELSE t.descripcion END AS descripcion,
      b.images

    FROM blog b

    INNER JOIN blog_categoria bc
      ON bc."blogId" = b.id

    INNER JOIN categoria c
      ON c.id = bc."categoriaId"

    LEFT JOIN categoria_translation ct
      ON ct."categoriaId" = c.id
      AND ct.locale = $3

    LEFT JOIN blog_translation t
      ON t.blog_id = b.id
      AND t.locale = $3

    WHERE b.type = 'post'
      AND b.activo = TRUE

     AND (
  CASE
    WHEN $3 = 'es' THEN c.slug
    ELSE COALESCE(NULLIF(ct.slug, ''), c.slug)
  END
) = $1

      AND (
        ($3 = 'es' AND b.slug = $2)
        OR ($3 <> 'es' AND t.slug = $2)
      )

    LIMIT 1
  `;

    const { rows } = await pool.query(sql, [categoriaSlug, postSlug, locale]);

    return rows[0] ?? null;
  }

  public async listarCategoriasNavegacion(locale: string) {
    const sql = `
  SELECT
    c.id,

    CASE
      WHEN $1 = 'es' THEN c.nombre
      ELSE COALESCE(NULLIF(ct.nombre, ''), c.nombre)
    END AS nombre,

    CASE
      WHEN $1 = 'es' THEN c.slug
      ELSE COALESCE(NULLIF(ct.slug, ''), c.slug)
    END AS slug,

    CASE
      WHEN $1 = 'es' THEN c.descripcion
      ELSE COALESCE(NULLIF(ct.descripcion, ''), c.descripcion)
    END AS descripcion

  FROM categoria c

  LEFT JOIN categoria_translation ct
    ON ct."categoriaId" = c.id
    AND ct.locale = $1

  WHERE NULLIF(
    TRIM(
      CASE
        WHEN $1 = 'es' THEN c.slug
        ELSE COALESCE(NULLIF(ct.slug, ''), c.slug)
      END
    ),
    ''
  ) IS NOT NULL

  ORDER BY nombre ASC;
`;

    const { rows } = await pool.query(sql, [locale]);

    return rows;
  }
}
