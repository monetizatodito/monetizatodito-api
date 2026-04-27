import { Router } from "express";

import { FileUploadService } from "./cargar-archivo.service";
import { CargarArchivoMiddleWare } from "../middlewares/cargar-archivo.middleware";
import { CargarArchivoController } from "./cargar-archivo.controlador";
import { TypeMiddleware } from "../middlewares/type-files";

export class CargarArchivoRoutes {
  static get routes(): Router {
    const router = Router();
    const controller = new CargarArchivoController(new FileUploadService());

    router.post(
      "/single/:type",
      [
        CargarArchivoMiddleWare.archivoMiddleware,
        TypeMiddleware.validTypes([
          "perfil",
          "producto",
          "categories",
          "blog",
          "firma",
          "logo",
          "libros",
          "portada-libros",
        ]),
      ],
      controller.uploadFile
    );
    router.post(
      "/multiple/:type",
      [
        CargarArchivoMiddleWare.archivoMiddleware,
        TypeMiddleware.validTypes([
          "perfil",
          "producto",
          "categories",
          "blog",
          "firma",
          "logo",
        ]),
      ],
      controller.uploadMultileFiles
    );

    router.get("/:type/:fileName", controller.getFile);

    return router;
  }
}
