import { generarUrlCorta } from "../../config/generar-id";
import { UrlRepositorio } from "../../repositorio/CortarUrlRepositorio";
import { validarIdUnico } from "../../config/generar-id";
import { CustomError } from "../../error/custom.error";
import { UrlsDto } from "../../dto/urls/urls-dto";
import dotenv from "dotenv";

dotenv.config();

export class UrlService {
  private urlRepositorio = new UrlRepositorio();

  constructor() {}

  public async createUrl(createUrlDto: UrlsDto) {
    try {
      const urlCorta = await generarUrlCorta();

      // Crear un nuevo DTO sin modificar el original
      const nuevaUrl: UrlsDto = {
        ...createUrlDto,
        url_corta: urlCorta,
      };

      const url = await this.urlRepositorio.create(nuevaUrl);
      return `${process.env.API_URL}/url/${urlCorta}`;
    } catch (error) {
      throw CustomError.internalServerError(`Error al crear la URL: ${error}`);
    }
  }

  public async getUrlCorta(url_corta: string): Promise<string> {
    try {
      const url = await this.urlRepositorio.getUrlCorta(url_corta);
  
      if (!url) {
        throw CustomError.notFound("URL corta no encontrada");
      }
  
      console.log("URL larga encontrada:", url.url_larga); // Depuración
  
      return url.url_larga; // Retorna la URL larga correctamente
    } catch (error) {
      console.error("Error en getUrlCorta:", error);
      throw CustomError.internalServerError(`Error al obtener la URL: ${error}`);
    }
  }

  public async deleteUrl(id: string) {
    try {
      const validId = validarIdUnico(id);
      if (!validId) {
        throw CustomError.badRequest("El ID no es válido");
      }

      const url = await this.urlRepositorio.deleteUrl(id);
      if (!url) {
        throw CustomError.notFound("URL no encontrada");
      }

      return {
        msg: "URL eliminada correctamente",
        url,
      };
    } catch (error) {
      throw CustomError.internalServerError(`Error al eliminar la URL: ${error}`);
    }
  }
}
