import { Router } from "express";

import { AuthMiddleware } from "../middlewares/auth.middleware";

import { ValidardRoll } from "../middlewares/role.middleware";

import { PartidaService } from "./partida.service";
import { PartidaControlador } from "./partida.controlador";

export class PartidaRoutes {
  static get routes(): Router {
    const router = Router();
    const partidaService = new PartidaService();
    const controller = new PartidaControlador(partidaService);

    router.get(
      "/",
      [AuthMiddleware.validateJWT],
      controller.buscarPartidaCativa
    );
    router.post(
      "/agregar-palabras",
      //[AuthMiddleware.validateJWT],
      controller.insertarPalabras
    );

    router.post(
      "/iniciar-juego",
      //[AuthMiddleware.validateJWT],
      controller.crearPartida
    );
    router.get(
      "/palabras",
      //[AuthMiddleware.validateJWT],
      controller.palabrasDia
    );
    router.post("/", [AuthMiddleware.validateJWT], controller.crearPartida);
    router.put(
      "/finalizar/:id",
      //[AuthMiddleware.validateJWT],
      controller.finalizarPartida
    );

    router.get("/ranking", controller.obtenerRanking);

    return router;
  }
}
