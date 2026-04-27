import { Router } from "express";
import { ImagenWebpControlador } from "./imagen-webp.controlador";

export class ImagenWebpRoutes {
  static get routes(): Router {
    const router = Router();
    const controller = new ImagenWebpControlador();

    router.post("/webp", controller.convertir);

    return router;
  }
}
