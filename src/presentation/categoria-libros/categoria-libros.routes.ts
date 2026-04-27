// src/presentation/categorias-libros/categorias-libros.routes.ts
import { Router } from "express";

import { AuthMiddleware } from "../middlewares/auth.middleware"; // si quieres proteger POSTs
import { CategoriasLibrosController } from "./categoria-libro.controlador";

export class CategoriasLibrosRoutes {
  static get routes(): Router {
    const r = Router();
    const ctrl = new CategoriasLibrosController();

    // Categorías
    r.get("/categorias-libros", ctrl.listarCategorias);
    r.post(
      "/categorias-libros",
      AuthMiddleware.validateJWT,
      ctrl.crearCategoria
    );

    // Subcategorías
    r.get("/subcategorias-libros", ctrl.listarSubcategorias);
    r.get(
      "/categorias-libros/:categoriaId/subcategorias",
      ctrl.listarSubPorCategoria
    );
    r.post(
      "/subcategorias-libros",
      AuthMiddleware.validateJWT,
      ctrl.crearSubcategoria
    );

    return r;
  }
}
