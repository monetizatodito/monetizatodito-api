import path from "path";
import fs from "fs";
import { UploadedFile } from "express-fileupload";
import { CustomError } from "../../error/custom.error";
import { generarIdUnico } from "../../config/generar-id";

export class FileUploadService {
  // Método para verificar y crear la carpeta si no existe
  private checkFolder(folderPath: string) {
    if (!fs.existsSync(folderPath)) {
      // Crear el directorio de manera recursiva
      fs.mkdirSync(folderPath, { recursive: true });
    }
  }

  // Método para cargar un solo archivo
  async uploadSingle(
    file: UploadedFile,
    folder: string = "archivos-cargado",
    validExtensions: string[] = [
      "png",
      "gif",
      "jpg",
      "jpeg",
      "p12",
      "xml",
      "pdf",
      "webp",
    ]
  ) {
    try {
      // Obtener la extensión del archivo basada en su nombre
      const fileExtension = path.extname(file.name).substring(1).toLowerCase(); // Obtiene la extensión sin el punto inicial

      // Verificar si la extensión es válida
      if (!validExtensions.includes(fileExtension)) {
        throw CustomError.badRequest(
          `Invalid extension: ${fileExtension}, valid ones are ${validExtensions.join(", ")}`
        );
      }

      // Construir la ruta de destino
      const destination = path.resolve(__dirname, "../../../", folder);
      this.checkFolder(destination); // Asegurar que la carpeta existe

      const id = generarIdUnico(); // Generar un ID único para el archivo
      const fileName = `${id}.${fileExtension}`; // Definir el nombre final del archivo

      // Mover el archivo de manera asíncrona
      await this.moveFile(file, `${destination}/${fileName}`);

      return { fileName };
    } catch (error) {
      // Manejar y lanzar el error capturado
      throw error;
    }
  }

  // Método para cargar múltiples archivos
  async uploadMultiple(
    files: UploadedFile[],
    folder: string = "archivos-cargado",
    validExtensions: string[] = [
      "png",
      "jpg",
      "jpeg",
      "gif",
      "p12",
      "xml",
      "pdf",
    ]
  ) {
    const fileNames = await Promise.all(
      files.map((file) => this.uploadSingle(file, folder, validExtensions))
    );

    return fileNames;
  }

  // Método para mover el archivo de manera asíncrona usando Promesas
  private moveFile(file: UploadedFile, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      file.mv(dest, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  // Listar archivos por tipo (carpeta)
  getFileByTypeAndName(type: string, fileName: string): string {
    const filePath = path.resolve(
      __dirname,
      "../../../",
      "archivos-cargado",
      type,
      fileName
    );

    if (!fs.existsSync(filePath)) {
      throw CustomError.badRequest(`Archivo no encontrado: ${fileName}`);
    }

    return filePath;
  }

  deleteFile(folder: string, fileName: string) {
    const filePath = path.resolve(__dirname, "../../../", folder, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    } else {
      console.warn(`Archivo no encontrado: ${filePath}`);
    }
  }
}
