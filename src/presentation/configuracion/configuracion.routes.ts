import { Router } from "express";

import { AuthMiddleware } from "../middlewares/auth.middleware";

import { ConfiguracionService } from "./configuracion.service";
import { ConfiguracionController } from "./configuracion.controlador";

export class ConfiguracionRoutes {
  static get routes(): Router {
    const router = Router();
    const configuracionService = new ConfiguracionService();
    const controller = new ConfiguracionController(configuracionService);

    router.get("/", [AuthMiddleware.validateJWT], controller.getConfiguracion);
    router.post("/", [AuthMiddleware.validateJWT], controller.create);

    return router;
  }
}
