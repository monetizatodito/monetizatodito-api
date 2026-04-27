import { pool } from "../db/db-config";
import { CustomError } from "../error/custom.error";
import { generarIdUnico } from "../config/generar-id";
import { PartidaEntity } from "../entity/juego/partida.entity";

export class PartidaRepository {
  insertarPalabrasMasivamente(palabras: string[]): Promise<void> {
    if (palabras.length === 0) return Promise.resolve();

    const query = `
      INSERT INTO palabras (id, palabra)
      VALUES ${palabras.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ")}
    `;

    const values: string[] = [];
    for (const palabra of palabras) {
      const id = generarIdUnico();
      values.push(id, palabra);
    }

    return pool
      .query(query, values)
      .then(() => {})
      .catch((err) => {
        throw CustomError.internalServerError(
          "Error al insertar palabras: " + err
        );
      });
  }

  buscarPartidaActiva(
    usuarioId: string,
    fecha: string
  ): Promise<PartidaEntity | null> {
    const query = `
      SELECT * FROM partida
      WHERE "usuarioId" = $1 AND fecha = $2 AND finalizada = false
      LIMIT 1
    `;

    return pool
      .query(query, [usuarioId, fecha])
      .then((result) => result.rows[0] || null)
      .catch((err) => {
        throw CustomError.internalServerError(
          "Error al buscar partida activa: " + err
        );
      });
  }

  insertarPartida(partida: PartidaEntity): Promise<void> {
    const query = `
  INSERT INTO partida (id, "usuarioId", palabras, palabras_seleccionadas, fecha, hora_inicio)
  VALUES ($1, $2, $3, $4, $5, $6)
`;

    const values = [
      partida.id,
      partida.usuarioId,
      partida.palabras || [],
      partida.palabras_seleccionadas || [],
      partida.fecha,
      partida.hora_inicio,
    ];

    return pool
      .query(query, values)
      .then(() => {})
      .catch((err) => {
        throw CustomError.internalServerError(
          "Error al insertar partida: " + err
        );
      });
  }

  palabrasDelDia(): Promise<string[]> {
    const query = `
      SELECT palabra FROM palabras

      ORDER BY RANDOM()
      LIMIT 50
    `;

    return pool
      .query(query)
      .then((result) => result.rows.map((r) => r.palabra))
      .catch((err) => {
        throw CustomError.internalServerError(
          "Error al obtener palabras del día: " + err
        );
      });
  }

  async finalizarPartida(
    partidaId: string,
    palabrasSeleccionadas: string[]
  ): Promise<void> {
    const query = `
    UPDATE partida
    SET finalizada = true,
        hora_fin = NOW(),
        palabras_seleccionadas = $2
    WHERE id = $1
  `;

    try {
      await pool.query(query, [
        partidaId,
        palabrasSeleccionadas, // 👈 Aquí sin JSON.stringify
      ]);
    } catch (err) {
      throw CustomError.internalServerError(
        "Error al finalizar partida: " + err
      );
    }
  }

  buscarPorId(partidaId: string): Promise<PartidaEntity | null> {
    const query = `
    SELECT * FROM partida
    WHERE id = $1
    LIMIT 1
  `;

    return pool
      .query(query, [partidaId])
      .then((result) => {
        if (result.rows.length === 0) return null;

        const row = result.rows[0];

        const partida: PartidaEntity = {
          id: row.id,
          usuarioId: row.usuarioid, // cuidado con las mayúsculas si tu columna es "usuarioId"
          palabras: JSON.parse(row.palabras),
          fecha: row.fecha,
          hora_inicio: row.hora_inicio,
          hora_fin: row.hora_fin,
          finalizada: row.finalizada,
        };

        return partida;
      })
      .catch((err) => {
        throw CustomError.internalServerError(
          "Error al buscar partida por ID: " + err
        );
      });
  }

  obtenerPalabrasAleatorias(): Promise<string[]> {
    const query = `
    SELECT palabra FROM palabras
    ORDER BY RANDOM()
    LIMIT 100
  `;

    return pool
      .query(query)
      .then((result) => result.rows.map((r) => r.palabra))
      .catch((err) => {
        throw CustomError.internalServerError(
          "Error al obtener palabras aleatorias: " + err
        );
      });
  }

  async obtenerTop10PartidasConMasAcertadas(): Promise<any[]> {
    const query = `
    SELECT
      p.*,
      u.nombre AS nombre_usuario,
      cardinality(p.palabras) AS total_palabras,
      cardinality(p.palabras_seleccionadas) AS total_acertadas
    FROM partida p
    JOIN usuario u ON p."usuarioId" = u.id
    ORDER BY total_acertadas DESC, p.hora_inicio DESC
    LIMIT 10
  `;

    try {
      const result = await pool.query(query);

      return result.rows.map((row) => ({
        id: row.id,
        usuarioId: row.usuarioid,
        nombreUsuario: row.nombre_usuario,
        palabras: row.palabras,
        palabras_seleccionadas: row.palabras_seleccionadas,
        fecha: row.fecha,
        hora_inicio: row.hora_inicio,
        hora_fin: row.hora_fin,
        finalizada: row.finalizada,
        total_palabras: row.total_palabras,
        total_acertadas: row.total_acertadas,
      }));
    } catch (err) {
      throw CustomError.internalServerError(
        "Error al obtener el top 10 de partidas: " + err
      );
    }
  }
}
