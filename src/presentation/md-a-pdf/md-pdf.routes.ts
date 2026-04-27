// src/presentation/md-a-pdf/md2pdf.routes.ts
import { Router } from "express";
import { Md2PdfController } from "./md-pdf.controlador";
import { AuthMiddleware } from "../middlewares/auth.middleware";

export const md2pdfRouter = Router();

md2pdfRouter.post("/save", AuthMiddleware.validateJWT, Md2PdfController.save);
md2pdfRouter.get(
  "/drafts",
  AuthMiddleware.validateJWT,
  Md2PdfController.listDrafts
);
md2pdfRouter.put(
  "/drafts/:id",
  AuthMiddleware.validateJWT,
  Md2PdfController.updateDraft
);
md2pdfRouter.post(
  "/convert",
  AuthMiddleware.validateJWT,
  Md2PdfController.convert
);
