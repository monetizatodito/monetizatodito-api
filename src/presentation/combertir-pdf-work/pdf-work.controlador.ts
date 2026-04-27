import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";

export class FileUploadController {
  async uploadFile(req: Request, res: Response) {
    if (!req.files || (!req.files.file && !req.files.pdf)) {
      return res.status(400).json({ message: "No se envió ningún archivo." });
    }

    const file = Array.isArray(req.files.file)
      ? req.files.file[0]
      : req.files.file || req.files.pdf;

    const extension = path.extname(file.name).toLowerCase();
    const allowedVideoExtensions = [".mp4", ".avi", ".mov", ".mkv"];

    const uploadsPath = path.join(__dirname, "..", "uploads");
    const outputsPath = path.join(__dirname, "..", "outputs");

    if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath);
    if (!fs.existsSync(outputsPath)) fs.mkdirSync(outputsPath);

    const tempPath = path.join(uploadsPath, file.name);

    try {
      // Guardar archivo en /uploads
      await file.mv(tempPath);

      if (extension === ".pdf") {
        // Convertir PDF a Word

        const pythonPath = process.env.VIRTUAL_ENV
          ? path.join(process.env.VIRTUAL_ENV, "bin", "python3")
          : "python3"; // Si no hay venv, usa el sistema

        const wordPath = path.join(
          outputsPath,
          `${path.basename(file.name, ".pdf")}.docx`
        );
        const command = `${pythonPath} ${path.join(__dirname, "../../../convertir_pdf_a_word.py")} "${tempPath}" "${wordPath}"`;

        exec(command, { env: process.env }, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error al ejecutar el script: ${stderr}`);
            return res
              .status(500)
              .json({ message: "Error al procesar el archivo." });
          }

          // Construir el nombre basado en el PDF
          const originalDocxName = `${path.basename(file.name, ".pdf")}.docx`;

          // Descargar el archivo Word
          res.download(wordPath, originalDocxName, (err) => {
            fs.unlinkSync(tempPath);
            fs.unlinkSync(wordPath);
          });
        });
      } else if (allowedVideoExtensions.includes(extension)) {
        // Es un video
        return res.status(200).json({
          message: "Video subido exitosamente.",
          fileName: file.name,
          path: tempPath,
        });
      } else {
        // Tipo de archivo no permitido
        fs.unlinkSync(tempPath);
        return res.status(400).json({
          message: "Tipo de archivo no soportado. Solo PDFs y videos.",
        });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error al procesar el archivo." });
    }
  }
}
