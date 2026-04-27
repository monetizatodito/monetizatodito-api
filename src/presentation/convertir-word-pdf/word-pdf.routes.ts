import { Router } from "express";

import { AuthMiddleware } from "../middlewares/auth.middleware";

import { ValidardRoll } from "../middlewares/role.middleware";

import { TypeMiddleware } from "../middlewares/type-files";
import { WordPdfController } from "./word-pdf.controlador";

export class WordPdfRoutes {
  static get routes(): Router {
    const router = Router();

    const controller = new WordPdfController();

    router.post("/", controller.uploadFile);

    return router;
  }
}
