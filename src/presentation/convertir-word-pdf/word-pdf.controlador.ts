// src/modules/word-a-pdf/word-pdf.controlador.ts
import type { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { WordToPdfService } from "./word-pdf.service";

const allowed = [".docx", ".doc", ".odt", ".rtf"];

export class WordPdfController {
  private svc = new WordToPdfService();

  // 👇 ARROW: conserva 'this'
  uploadFile = (req: Request, res: Response) => {
    if (!req.files || (!(req.files as any).file && !(req.files as any).word)) {
      res.status(400).json({ message: "No se envió ningún archivo." });
      return;
    }

    const file = Array.isArray((req.files as any).file)
      ? (req.files as any).file[0]
      : (req.files as any).file || (req.files as any).word;

    const ext = path.extname(file.name).toLowerCase();
    if (!allowed.includes(ext)) {
      res
        .status(400)
        .json({ message: "Formato no soportado. Sube DOCX/DOC/ODT/RTF." });
      return;
    }

    const uploads = path.join(__dirname, "..", "uploads");
    const outputs = path.join(__dirname, "..", "outputs");
    if (!fs.existsSync(uploads)) fs.mkdirSync(uploads, { recursive: true });
    if (!fs.existsSync(outputs)) fs.mkdirSync(outputs, { recursive: true });

    const tempPath = path.join(uploads, file.name);

    file.mv(tempPath, (mvErr: any) => {
      if (mvErr) {
        res.status(500).json({ message: "No se pudo guardar el archivo." });
        return;
      }

      this.svc
        .convert(tempPath, outputs)
        .then(({ pdfPath, filename }) => {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(filename)}"`
          );
          res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

          res.download(pdfPath, filename, () => {
            try {
              fs.unlinkSync(tempPath);
            } catch {}
            try {
              fs.unlinkSync(pdfPath);
            } catch {}
          });
        })
        .catch((e) => {
          try {
            fs.unlinkSync(tempPath);
          } catch {}
          res
            .status(500)
            .json({ message: "Error al convertir a PDF.", error: "" + e });
        });
    });
  };
}
