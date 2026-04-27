// src/modules/pdf-compress/pdf-compress.routes.ts

import { Router } from "express";

import { AuthMiddleware } from "../middlewares/auth.middleware";
import { PdfCompressController } from "./comprimir-pdf.controlador";

export class ComprimirPdfRoutes {
  static get routes(): Router {
    const router = Router();

    const controller = new PdfCompressController();

    router.post("/", controller.uploadFile);

    return router;
  }
}
