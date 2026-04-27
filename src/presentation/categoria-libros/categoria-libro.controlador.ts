// src/presentation/categorias-libros/categorias-libros.controller.ts
import { Request, Response } from "express";

import { CustomError } from "../../error/custom.error";
import { CategoriasLibrosService } from "./categoria-libros.service";

export class CategoriasLibrosController {
  constructor(private readonly service = new CategoriasLibrosService()) {}

  crearCategoria = (req: Request, res: Response) => {
    const { nombre, descripcion } = req.body || {};
    if (!nombre) return res.status(400).json({ error: "nombre es requerido" });

    this.service
      .createCategoria({ nombre, descripcion })
      .then((row) => res.status(201).json(row))
      .catch((err) => {
        const status = err instanceof CustomError ? err.statusCode : 500;
        res
          .status(status)
          .json({ error: err.message || "Error al crear categoría" });
      });
  };

  listarCategorias = (_req: Request, res: Response) => {
    this.service
      .listCategorias()
      .then((rows) => res.json(rows))
      .catch((err) => res.status(500).json({ error: String(err) }));
  };

  crearSubcategoria = (req: Request, res: Response) => {
    const { categoriaId, nombre, descripcion } = req.body || {};
    if (!categoriaId || !nombre) {
      return res
        .status(400)
        .json({ error: "categoriaId y nombre son requeridos" });
    }

    this.service
      .createSubcategoria({ categoriaId, nombre, descripcion })
      .then((row) => res.status(201).json(row))
      .catch((err) => {
        const status = err instanceof CustomError ? err.statusCode : 500;
        res
          .status(status)
          .json({ error: err.message || "Error al crear subcategoría" });
      });
  };

  listarSubcategorias = (_req: Request, res: Response) => {
    this.service
      .listSubcategorias()
      .then((rows) => res.json(rows))
      .catch((err) => res.status(500).json({ error: String(err) }));
  };

  listarSubPorCategoria = (req: Request, res: Response) => {
    const { categoriaId } = req.params;
    this.service
      .listSubcategoriasPorCategoria(categoriaId)
      .then((rows) => res.json(rows))
      .catch((err) => res.status(500).json({ error: String(err) }));
  };
}
