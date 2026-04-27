import { Request, Response } from "express";

import { ConfiguracionService } from "./configuracion.service";
import { CustomError } from "../../error/custom.error";
import { CreateConfiguracionDto } from "../../dto/configuracion/create-configuracion.dto";

export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.log(`${error}`);
    return res.status(500).json({ error: "Internal server error" });
  };

  create = (req: Request, res: Response) => {
    const body = req.body;
    const [error, createConfiguracionDto] = CreateConfiguracionDto.create(body);
    if (error) return res.json({ error });
    this.configuracionService
      .createConfiguracion(createConfiguracionDto!, req.body.usuario)
      .then((config) => res.status(201).json(config))
      .catch((error) => this.handleError(error, res));
  };
  getConfiguracion = (req: Request, res: Response) => {
    this.configuracionService
      .getConfiguracion(req.body.usuario)
      .then((config) => res.status(201).json(config))
      .catch((error) => this.handleError(error, res));
  };
}
