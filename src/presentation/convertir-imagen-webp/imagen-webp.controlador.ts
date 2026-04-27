import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import sharp from "sharp";

export class ImagenWebpControlador {
  async convertir(req: Request, res: Response) {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ message: "No se envió ninguna imagen." });
    }

    const file = Array.isArray(req.files.image)
      ? req.files.image[0]
      : req.files.image;

    const extension = path.extname(file.name).toLowerCase();
    const allowedImageExtensions = [".jpg", ".jpeg", ".png"];

    if (!allowedImageExtensions.includes(extension)) {
      return res
        .status(400)
        .json({ message: "Tipo de archivo no soportado. Solo JPG y PNG." });
    }

    const uploadsPath = path.join(__dirname, "..", "uploads");
    const outputsPath = path.join(__dirname, "..", "outputs");

    if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath);
    if (!fs.existsSync(outputsPath)) fs.mkdirSync(outputsPath);

    const tempPath = path.join(uploadsPath, file.name);
    const outputPath = path.join(
      outputsPath,
      `${path.basename(file.name, extension)}.webp`
    );

    try {
      // Guardar archivo en /uploads
      await file.mv(tempPath);

      // Calidad desde query (default 80)
      const calidad = parseInt(req.query.quality as string) || 80;

      // Convertir a WebP
      await sharp(tempPath).webp({ quality: calidad }).toFile(outputPath);

      // Descargar archivo convertido
      res.download(
        outputPath,
        `${path.basename(file.name, extension)}.webp`,
        (err) => {
          fs.unlinkSync(tempPath); // Eliminar original
          fs.unlinkSync(outputPath); // Eliminar convertido
        }
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error al procesar la imagen." });
    }
  }
}
