// src/modules/word-a-pdf/WordToPdf.service.ts
import { exec } from "child_process";
import fs from "fs";
import path from "path";

export class WordToPdfService {
  private soffice = process.env.SOFFICE_PATH || "libreoffice";

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  convert(
    inputPath: string,
    outDir: string
  ): Promise<{ pdfPath: string; filename: string }> {
    this.ensureDir(outDir);

    return new Promise((resolve, reject) => {
      const base = path.basename(inputPath, path.extname(inputPath));
      const pdfPath = path.join(outDir, `${base}.pdf`);

      // LibreOffice genera el PDF en --outdir con el mismo baseName
      const cmd = `${this.soffice} --headless --nologo --nofirststartwizard --convert-to pdf --outdir "${outDir}" "${inputPath}"`;

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(stderr || stdout || "Fallo en LibreOffice"));
        }
        if (!fs.existsSync(pdfPath)) {
          return reject(new Error("No se generó el PDF"));
        }
        resolve({ pdfPath, filename: `${base}.pdf` });
      });
    });
  }
}
