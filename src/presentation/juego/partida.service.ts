import { generarIdUnico } from "../../config/generar-id";
import { PartidaEntity } from "../../entity/juego/partida.entity";
import { CustomError } from "../../error/custom.error";
import { PartidaRepository } from "../../repositorio/juego.repositorio";

export class PartidaService {
  private partidaRepository: PartidaRepository;

  constructor() {
    this.partidaRepository = new PartidaRepository();
  }

  // Este método debería recibir usuarioId y fecha, no hora_fin
  async obtenerPartidaActiva(usuarioId: string, fecha: string) {
    return this.partidaRepository.buscarPartidaActiva(usuarioId, fecha);
  }

  async crearNuevaPartida(
    usuarioId: string,
    fecha: string, // <-- formato 'YYYY-MM-DD'
    horaInicio: string // <-- formato 'HH:mm:ss'
  ) {
    const partidaExistente = await this.partidaRepository.buscarPartidaActiva(
      usuarioId,
      fecha
    );

    if (partidaExistente) {
      const fechaUltimaPartida = new Date(
        `${partidaExistente.fecha.toISOString().split("T")[0]}T${partidaExistente.hora_inicio.toISOString().split("T")[1]}`
      );
      const ahora = new Date();
      const diferenciaHoras =
        (ahora.getTime() - fechaUltimaPartida.getTime()) / (1000 * 60 * 60);

      //if (!partidaExistente.finalizada || diferenciaHoras < 24) {
      // throw CustomError.badRequest(
      //   "Ya has jugado hoy. Intenta nuevamente después de 24 horas."
      // );
      //}
    }

    const palabras = await this.partidaRepository.palabrasDelDia();

    // ✅ Convertimos los strings a objetos Date como requiere PartidaEntity
    const fechaObj = new Date(`${fecha}T00:00:00`); // Solo la fecha
    const horaInicioObj = new Date(`${fecha}T${horaInicio}`); // Fecha + hora

    const nuevaPartida: PartidaEntity = {
      id: generarIdUnico(),
      usuarioId,
      palabras,
      palabras_seleccionadas: [],
      fecha: fechaObj,
      hora_inicio: horaInicioObj,
      hora_fin: null,
      finalizada: false,
    };

    await this.partidaRepository.insertarPartida(nuevaPartida);
    return nuevaPartida;
  }

  async finalizarPartida(partidaId: string, palabrasSeleccionadas: string[]) {
    return this.partidaRepository.finalizarPartida(
      partidaId,
      palabrasSeleccionadas
    );
  }

  async obtenerPalabrasDelDia() {
    const palabras = await this.partidaRepository.palabrasDelDia();
    return { palabras };
  }

  async validarPalabrasSeleccionadas(
    partidaId: string,
    palabrasSeleccionadas: string[]
  ) {
    const partida = await this.partidaRepository.buscarPorId(partidaId);

    if (!partida) {
      throw CustomError.notFound("Partida no encontrada");
    }

    const palabrasCorrectasSet = new Set(
      partida.palabras.map((p) => p.toLowerCase())
    );
    const palabrasSeleccionadasSet = new Set(
      palabrasSeleccionadas.map((p) => p.toLowerCase())
    );

    const palabrasAcertadas: string[] = [];

    for (const palabra of palabrasSeleccionadasSet) {
      if (palabrasCorrectasSet.has(palabra)) {
        palabrasAcertadas.push(palabra);
      }
    }

    return {
      correct: palabrasAcertadas.length,
      total: partida.palabras.length,
      palabrasCorrectas: palabrasAcertadas,
    };
  }

  // ✅ Nuevo método para insertar palabras
  async insertarPalabrasDesdeArchivo(palabras: string[]): Promise<void> {
    if (!Array.isArray(palabras) || palabras.length === 0) {
      throw CustomError.badRequest("No se proporcionaron palabras válidas.");
    }

    return this.partidaRepository.insertarPalabrasMasivamente(palabras);
  }

  async obtenerRanking(): Promise<PartidaEntity[]> {
    const partidas =
      await this.partidaRepository.obtenerTop10PartidasConMasAcertadas();
    return partidas;
  }
}
