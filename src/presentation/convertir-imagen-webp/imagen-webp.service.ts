import sharp from "sharp";
import fs from "fs";
import path from "path";

export class ImagenWebpService {
  async convertirImagen(inputPath: string, calidad: number): Promise<string> {
    try {
      const outputPath = path.join("uploads", `${Date.now()}.webp`);
      await sharp(inputPath).webp({ quality: calidad }).toFile(outputPath);
      return outputPath;
    } catch (error) {
      throw new Error("Error al convertir imagen: " + error);
    }
  }

  eliminarTemporal(filePath: string) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
