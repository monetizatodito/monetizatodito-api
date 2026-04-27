import { Router } from "express";

import { AuthMiddleware } from "../middlewares/auth.middleware";
import { BlogService } from "./blog.service";
import { BlogControlador } from "./blog.controlador";
import { ValidardRoll } from "../middlewares/role.middleware";
import { parseLocale } from "../middlewares/locale.middleware";

export class BlogRoutes {
  static get routes(): Router {
    const router = Router();
    const blogService = new BlogService();
    const controller = new BlogControlador(blogService);

    // ---- LISTADOS / CONSULTAS ----
    router.get("/", parseLocale, controller.getBlog);
    router.get("/autor", parseLocale, controller.getBlogByAutor);
    router.get("/slug/:slug", parseLocale, controller.getBlogSlug);

    // Blogs NO traducidos por locale
    router.get(
      "/untranslated",
      [AuthMiddleware.validateJWT, ValidardRoll.tieneRoll("admin", "empresa")],
      controller.getUntranslated
    );

    // ---- CREAR / MODIFICAR ----
    router.post("/", [AuthMiddleware.validateJWT], controller.create);

    router.post(
      "/categoria",
      [AuthMiddleware.validateJWT],
      controller.crearCategoria
    );

    router.put(
      "/:id",
      [
        AuthMiddleware.validateJWT,
        ValidardRoll.tieneRoll("admin", "cliente", "empresa"),
      ],
      controller.putBlog
    );

    // ---- ELIMINAR ----
    router.delete("/:id", controller.deleteBlog);

    // ---- TRADUCCIONES ----
    router.post(
      "/translate/:slug",
      [AuthMiddleware.validateJWT, ValidardRoll.tieneRoll("admin", "empresa")],
      controller.traducirPorSlug
    );

    router.post(
      "/translate/batch",
      [AuthMiddleware.validateJWT, ValidardRoll.tieneRoll("admin", "empresa")],
      controller.traducirBatch
    );

    // ⚠️ RUTA GENÉRICA: SIEMPRE AL FINAL
    router.get("/:id", parseLocale, controller.getBlogId);

    return router;
  }
}
