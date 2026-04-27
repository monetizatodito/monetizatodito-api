import { Request, Response } from "express";

import { CustomError } from "../../error/custom.error";
import { CreatePlanesDto } from "../../dto/planes/create-planes.dto";
import { UpdatePlanesDto } from "../../dto/planes/update-planes.entity";
import { PartidaService } from "./partida.service";

export class PartidaControlador {
  constructor(private readonly partidaServicio: PartidaService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.log(`${error}`);
    return res.status(500).json({ error: "Internal server error" });
  };

  insertarPalabras = (req: Request, res: Response) => {
    const { palabras } = req.body; // ✅ extrae solo el array

    this.partidaServicio
      .insertarPalabrasDesdeArchivo(palabras)
      .then(() => res.json({ message: "Palabras insertadas correctamente" }))
      .catch((error) => this.handleError(error, res));
  };

  crearPartida = (req: Request, res: Response) => {
    const { usuarioId, fecha, horaInicio } = req.body;
    console.log("body", req.body);

    if (!usuarioId || !fecha || !horaInicio) {
      res.status(400).json({ message: "Faltan datos obligatorios" });
      return;
    }

    this.partidaServicio
      .obtenerPartidaActiva(usuarioId, fecha)
      .then((partidaActiva) => {
        // if (partidaActiva) {
        // res
        //   .status(400)
        //   .json({ message: "Ya tienes una partida activa para hoy" });
        // return;
        // }

        return this.partidaServicio.crearNuevaPartida(
          usuarioId,
          fecha,
          horaInicio
        );
      })
      .then((nuevaPartida) => {
        if (nuevaPartida) {
          res.status(201).json(nuevaPartida);
        }
      })
      .catch((err) => {
        res.status(500).json({ message: err.message || "Error interno" });
      });
  };

  palabrasDia = (req: Request, res: Response) => {
    this.partidaServicio
      .obtenerPalabrasDelDia()
      .then((palabras) => res.status(200).json(palabras))
      .catch((error) => this.handleError(error, res));
  };

  buscarPartidaCativa = (req: Request, res: Response) => {
    const usuarioId = req.params.usuarioId;
    const fecha = req.params.fecha;
    this.partidaServicio
      .obtenerPartidaActiva(usuarioId, fecha)
      .then((partida) => {
        if (!partida) {
          return res.status(404).json({ message: "No hay partida activa" });
        }
        res.json(partida);
      })
      .catch((err) => {
        res.status(500).json({ message: err.message || "Error interno" });
      });
  };

  finalizarPartida = (req: Request, res: Response) => {
    const partidaId = req.params.id;

    const { selectedWords } = req.body;

    console.log("fnaliza", selectedWords);

    this.partidaServicio
      .finalizarPartida(partidaId, selectedWords)
      .then(() => {
        res.json({ message: "Partida finalizada correctamente" });
      })
      .catch((err) => {
        res.status(500).json({ message: err.message || "Error interno" });
      });
  };

  obtenerRanking = async (req: Request, res: Response) => {
    try {
      const ranking = await this.partidaServicio.obtenerRanking();
      res.json(ranking);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Error interno" });
    }
  };
}
