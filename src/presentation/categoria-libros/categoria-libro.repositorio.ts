// src/presentation/categorias-libros/categorias-libros.repository.ts
import { pool } from "../../db/db-config";
import { generarIdUnico } from "../../config/generar-id";
import { CustomError } from "../../error/custom.error";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export type CategoriaRow = {
  id: string;
  nombre: string;
  slug: string;
  descripcion?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SubcategoriaRow = {
  id: string;
  categoria_id: string;
  nombre: string;
  slug: string;
  descripcion?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class CategoriasLibrosRepository {
  // ------- Categorías -------
  async createCategoria(input: {
    nombre: string;
    descripcion?: string | null;
  }) {
    const id = generarIdUnico();
    const slug = slugify(input.nombre);

    const q = `
      INSERT INTO categorias_libros (id, nombre, slug, descripcion)
      VALUES ($1,$2,$3,$4)
      RETURNING *;
    `;
    return pool
      .query(q, [id, input.nombre, slug, input.descripcion ?? null])
      .then((r) => r.rows[0] as CategoriaRow)
      .catch((err) => {
        if (String(err?.message || "").includes("duplicate key"))
          throw CustomError.badRequest(
            "Ya existe una categoría con ese slug/nombre"
          );
        throw CustomError.internalServerError(
          `No se pudo crear la categoría: ${err}`
        );
      });
  }

  listCategorias() {
    const q = `SELECT * FROM categorias_libros ORDER BY nombre ASC`;
    return pool
      .query(q)
      .then((r) => r.rows as CategoriaRow[])
      .catch((err) => {
        throw CustomError.internalServerError(
          `No se pudo listar categorías: ${err}`
        );
      });
  }

  getCategoriaById(id: string) {
    return pool
      .query(`SELECT * FROM categorias_libros WHERE id = $1`, [id])
      .then((r) => r.rows[0] as CategoriaRow | undefined);
  }

  // ------- Subcategorías -------
  async createSubcategoria(input: {
    categoriaId: string;
    nombre: string;
    descripcion?: string | null;
  }) {
    const id = generarIdUnico();
    const slug = slugify(input.nombre);

    // Validar que exista la categoría padre
    const cat = await this.getCategoriaById(input.categoriaId);
    if (!cat) throw CustomError.badRequest("La categoría padre no existe");

    const q = `
      INSERT INTO subcategorias_libros (id, categoria_id, nombre, slug, descripcion)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *;
    `;
    return pool
      .query(q, [
        id,
        input.categoriaId,
        input.nombre,
        slug,
        input.descripcion ?? null,
      ])
      .then((r) => r.rows[0] as SubcategoriaRow)
      .catch((err) => {
        if (String(err?.message || "").includes("duplicate key"))
          throw CustomError.badRequest(
            "Ya existe una subcategoría con ese slug en esta categoría"
          );
        throw CustomError.internalServerError(
          `No se pudo crear la subcategoría: ${err}`
        );
      });
  }

  listSubcategorias() {
    const q = `SELECT * FROM subcategorias_libros ORDER BY nombre ASC`;
    return pool
      .query(q)
      .then((r) => r.rows as SubcategoriaRow[])
      .catch((err) => {
        throw CustomError.internalServerError(
          `No se pudo listar subcategorías: ${err}`
        );
      });
  }

  listSubcategoriasPorCategoria(categoriaId: string) {
    const q = `
      SELECT * FROM subcategorias_libros
      WHERE categoria_id = $1
      ORDER BY nombre ASC
    `;
    return pool
      .query(q, [categoriaId])
      .then((r) => r.rows as SubcategoriaRow[]);
  }
}
