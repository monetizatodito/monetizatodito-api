// src/libros/repositorio.ts
import { QueryResult } from "pg";
import { LibroEntity, TipoLibro } from "../../entity/libros/libro.entity";
import { generarIdUnico } from "../../config/generar-id";
import { pool } from "../../db/db-config";
import { CustomError } from "../../error/custom.error";

// util simple para slug
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export class LibrosRepository {
  async assertSubcategoriaEnCategoria(
    subcategoriaId: string,
    categoriaId: string
  ) {
    const q = `SELECT 1 FROM subcategorias_libros WHERE id = $1 AND categoria_id = $2 LIMIT 1`;
    const r = await pool.query(q, [subcategoriaId, categoriaId]);
    if (r.rowCount === 0) {
      throw CustomError.badRequest(
        "La subcategoría no pertenece a la categoría indicada"
      );
    }
  }

  /** Crear libro */
  create(
    input: Omit<LibroEntity, "id" | "slug" | "createdAt" | "updatedAt"> & {
      title: string;
    }
  ): Promise<LibroEntity> {
    const id = generarIdUnico();
    const slugBase = slugify(input.title);
    const now = new Date();

    const buildInsert = (slug: string): Promise<LibroEntity> => {
      const q = `
        INSERT INTO libros(
          id, slug, title, description, price_usd, pages, language, preview_pages,
          tipo, is_free, pdf_url, portada_url, "createdAt", "updatedAt",
          categoria_id, subcategoria_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
        ) RETURNING *;
      `;
      const v = [
        id,
        slug,
        input.title,
        input.description,
        input.price_usd,
        input.pages,
        input.language,
        input.preview_pages ?? "",
        input.tipo as TipoLibro,
        !!input.is_free,
        input.pdf_url,
        input.portada_url,
        now,
        now,
        input.categoria_id ?? null, // 🆕
        input.subcategoria_id ?? null, // 🆕
      ];

      return pool
        .query(q, v)
        .then((r) => r.rows[0] as LibroEntity)
        .catch((err) => {
          if (
            String(err?.message || "").includes("duplicate key") &&
            String(err?.detail || "").includes("slug")
          ) {
            const rand = Math.floor(Math.random() * 10000);
            return buildInsert(`${slugBase}-${rand}`);
          }
          throw CustomError.internalServerError(
            `No se pudo crear el libro: ${err}`
          );
        });
    };

    return buildInsert(slugBase);
  }

  /** Listar con filtros opcionales */
  list(params?: {
    categoriaId?: string;
    subcategoriaId?: string;
  }): Promise<LibroEntity[]> {
    const where: string[] = [];
    const vals: any[] = [];
    let i = 1;

    if (params?.categoriaId) {
      where.push(`categoria_id = $${i++}`);
      vals.push(params.categoriaId);
    }
    if (params?.subcategoriaId) {
      where.push(`subcategoria_id = $${i++}`);
      vals.push(params.subcategoriaId);
    }

    const q = `
    SELECT * FROM libros
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY "createdAt" DESC
  `;

    return pool
      .query(q, vals)
      .then((res) => res.rows as LibroEntity[])
      .catch((err) => {
        throw CustomError.internalServerError(
          `No se pudo listar los libros: ${err}`
        );
      });
  }

  getById(id: string): Promise<LibroEntity> {
    return pool
      .query(`SELECT * FROM libros WHERE id = $1`, [id])
      .then((res) => res.rows[0])
      .catch((err) => {
        throw CustomError.internalServerError(
          `No se pudo obtener el libro: ${err}`
        );
      });
  }

  getBySlug(slug: string): Promise<LibroEntity> {
    return pool
      .query(`SELECT * FROM libros WHERE slug = $1`, [slug])
      .then((res) => res.rows[0])
      .catch((err) => {
        throw CustomError.internalServerError(
          `No se pudo obtener el libro: ${err}`
        );
      });
  }

  async update(id: string, patch: Partial<LibroEntity>): Promise<LibroEntity> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    const set = (k: string, v: any) => {
      fields.push(`${k} = $${idx++}`);
      values.push(v);
    };

    if (patch.title !== undefined) set("title", patch.title);
    if (patch.description !== undefined) set("description", patch.description);
    if (patch.price_usd !== undefined) set("price_usd", patch.price_usd);
    if (patch.pages !== undefined) set("pages", patch.pages);
    if (patch.language !== undefined) set("language", patch.language);
    if (patch.preview_pages !== undefined)
      set("preview_pages", patch.preview_pages);
    if (patch.tipo !== undefined) set("tipo", patch.tipo);
    if (patch.is_free !== undefined) set("is_free", patch.is_free);
    if (patch.pdf_url !== undefined) set("pdf_url", patch.pdf_url);
    if (patch.portada_url !== undefined) set("portada_url", patch.portada_url);

    // 🆕 categoría/subcategoría
    if (patch.categoria_id !== undefined)
      set("categoria_id", patch.categoria_id);
    if (patch.subcategoria_id !== undefined)
      set("subcategoria_id", patch.subcategoria_id);

    if (patch.title) {
      const newSlug = slugify(patch.title);
      set("slug", newSlug);
    }
    set('"updatedAt"', new Date());

    if (fields.length === 0)
      throw CustomError.notModified("No hay campos para actualizar");

    const q = `
      UPDATE libros SET ${fields.join(", ")}
      WHERE id = $${idx}
      RETURNING *;
    `;
    values.push(id);

    try {
      const res = await pool.query(q, values);
      if (res.rowCount === 0)
        throw CustomError.notModified("No se actualizó el libro");
      return res.rows[0];
    } catch (err) {
      throw CustomError.internalServerError(
        `Error actualizando el libro: ${err}`
      );
    }
  }

  delete(id: string): Promise<boolean> {
    return pool
      .query(`DELETE FROM libros WHERE id = $1`, [id])
      .then((r: QueryResult) => !!r.rowCount && r.rowCount > 0)
      .catch((err) => {
        throw CustomError.internalServerError(
          `No se pudo eliminar el libro: ${err}`
        );
      });
  }

  /** ✅ Registrar descarga (insert + contador) en una transacción */
  async registrarDescarga(params: {
    libroId: string;
    ip?: string | null;
    userId?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    const id = generarIdUnico();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO libro_downloads (id, libro_id, ip, user_id, user_agent)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          id,
          params.libroId,
          params.ip ?? null,
          params.userId ?? null,
          params.userAgent ?? null,
        ]
      );

      await client.query(
        `UPDATE libros
           SET downloads_count = COALESCE(downloads_count, 0) + 1,
               "updatedAt" = NOW()
         WHERE id = $1`,
        [params.libroId]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw CustomError.internalServerError(
        `No se pudo registrar la descarga: ${err}`
      );
    } finally {
      client.release();
    }
  }
}
