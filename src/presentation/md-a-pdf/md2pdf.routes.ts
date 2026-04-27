// md2pdf.routes.ts
import { Router } from "express";
import { Md2PdfController } from "./md-pdf.controlador";

export const md2pdfRouter = Router();
md2pdfRouter.post("/convert", Md2PdfController.convert);
