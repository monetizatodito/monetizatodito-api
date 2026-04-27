// src/libros/libros.routes.ts
import { Router } from "express";
import { LibrosControlador } from "./libros.controlador";
import { AuthMiddleware } from "../middlewares/auth.middleware";

export class LibrosRoutes {
  static get routes(): Router {
    const router = Router();
    const ctrl = new LibrosControlador();

    // listar / obtener
    router.get("/", ctrl.listar);
    router.get("/id/:id", ctrl.porId);
    router.get("/slug/:slug", ctrl.porSlug);

    // ✅ descarga por id o por slug
    router.get("/:id/download", ctrl.descargarPorId);
    router.get("/slug/:slug/download", ctrl.descargarPorSlug);

    // crear / actualizar / eliminar
    // Nota: con express-fileupload basta con tenerlo en server.ts; aquí no necesitas más middlewares
    router.post("/", AuthMiddleware.validateJWT, ctrl.crear);
    router.put("/:id", AuthMiddleware.validateJWT, ctrl.actualizar);
    router.delete("/:id", AuthMiddleware.validateJWT, ctrl.eliminar);

    return router;
  }
}
