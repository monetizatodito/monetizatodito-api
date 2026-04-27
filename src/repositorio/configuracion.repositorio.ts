import { generarIdUnico } from "../config/generar-id";
import { pool } from "../db/db-config";
import { ConfiguracionEntity } from "../entity/configuracion/configuracion.entity";
import { CustomError } from '../error/custom.error';

export class ConfiguracionRepositorio {
  
  createConfiguracion(
    configuracion: ConfiguracionEntity,
    usuarioId: string,
  ): Promise<ConfiguracionEntity> {
    const id = generarIdUnico();
    const query = `
            INSERT INTO configuracion(
            id, ambiente, contabilidad, firma, "tipoRegimen", password, direccion,
            emision, empresa, establecimiento, estado, logo, "numeroF",
            "personaSRI", "razonS", retener, ruc, activo, "usuarioId",
            "createdAt", "updatedAt"
            )
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,$21)RETURNING *
        `;
    const values = [
      id,
      configuracion.ambiente,
      configuracion.contabilidad,
      configuracion.firma,
      configuracion.tipoRegimen,
      configuracion.password,
      configuracion.direccion,
      configuracion.emision,
      configuracion.empresa,
      configuracion.establecimiento,
      configuracion.estado ?? true,
      configuracion.logo,
      configuracion.numeroF,
      configuracion.personaSRI,
      configuracion.razonS,
      configuracion.retener,
      configuracion.ruc,

      configuracion.activo ?? true,
      usuarioId,
      configuracion.createdAt || new Date(),
      configuracion.updatedAt || new Date(),
    ];

    return pool
      .query(query, values)
      .then((config) => config.rows[0])
      .catch((err) => {
        console.log("nose puedo crear la configuracion", err);
        throw err;
      });
  }
  // getConfiguracion(usuarioId: string, configuracionId: string): Promise<ConfiguracionEntity[]> {
  //     const query = `
  //         SELECT *
  //         FROM configuracion_db
  //         WHERE "usuarioId" = $1 OR "id" = $2
  //     `;
  //
  //     return pool.query(query, [usuarioId, configuracionId])
  //         .then(result => result.rows)
  //         .catch(err => {
  //             console.error(`Hubo un error al obtener las configuraciones: ${err.message}`);
  //             console.error(err.stack);
  //             throw err;
  //         });
  // }

  


  getConfiguracion(
    usuarioId: string,  // usuarioId es obligatorio
    id?: string         // id es opcional
  ): Promise<{ totalConfiguracion: number; config: ConfiguracionEntity }> {
    let query = `
      WITH config_count AS (
        SELECT COUNT(*) AS count
        FROM configuracion
        WHERE "usuarioId" = $1
    `;
  
    const queryParams = [usuarioId];
  
    // Si se pasa un id, agregamos el filtro
    if (id) {
      query += ` AND id = $2`;
      queryParams.push(id);
    }
  
    query += `
      )
      SELECT c.*, cc.count
      FROM configuracion c, config_count cc
      WHERE c."usuarioId" = $1
    `;
  
    // Si hay un id, lo agregamos también a la cláusula WHERE
    if (id) {
      query += ` AND c.id = $2`;
    }
  
    query += ` LIMIT 1`;
  
    console.log("Query SQL:", query);               // Verifica la consulta SQL
    console.log("Parámetros de consulta:", queryParams);  // Verifica los parámetros de consulta
  
    return pool
      .query(query, queryParams)
      .then((result) => {
        if (result.rows.length === 0) {
          throw CustomError.badRequest(`No se encontró ninguna configuración para el usuario con ID: ${usuarioId}${id ? ` y configuración ID: ${id}` : ''}`);
        }
  
        const totalConfiguracion = parseInt(result.rows[0].count, 10);
        const { count, ...config } = result.rows[0]; // Extraer la configuración sin el count
  
        return { totalConfiguracion, config };
      })
      .catch((err) => {
        console.error(`Hubo un error al obtener la configuración: ${err.message}`);
        console.error(err.stack);
        throw CustomError.badRequest(`${err}`);
      });
  }
  
  
  async verificarConfiguracionExistente(
    usuarioId?: string,
    id?: string,
  ): Promise<boolean> {
    const query = `
        SELECT 1
        FROM configuracion
        WHERE "usuarioId" = $1 OR id = $2
        LIMIT 1;
    `;

    try {
      const result = await pool.query(query, [usuarioId, id]);
      return result.rows.length > 0; // Retorna true si existe al menos una coincidencia
    } catch (err) {
      console.error("Error al verificar la configuración existente", err);
      throw new Error("Error al verificar la configuración existente");
    }
  }
  getConfiguracionId(usuarioId?: string, id?: string) {
    const query = `
        SELECT * FROM configuracion
        WHERE "usuarioId" = $1 OR id = $2

        `;
    const values = [usuarioId, id];
    return pool
      .query(query, values)
      .then((ressult) => ressult.rows[0])
      .catch((err) => {
        console.log("nose se pudo ver la info", err);
        throw err;
      });
  }
  
  deleteConfiguracion() {}


  putConfiguracion(
    id: string,
    configuracion: Partial<ConfiguracionEntity>,
    usuarioId: string
  ): Promise<ConfiguracionEntity> {
    const fields = [];
    const values = [];
    let index = 1;
  
    // Construir dinámicamente los campos a actualizar
    for (const [key, value] of Object.entries(configuracion)) {
      if (value !== undefined) { // Solo actualizar si el valor está definido
        fields.push(`"${key}" = $${index}`);
        values.push(value);
        index++;
      }
    }
  
    // Validar si hay campos para actualizar
    if (fields.length === 0) {
      throw CustomError.badRequest('No hay campos para actualizar');
    }
  
    // Añadir condiciones para id y usuarioId
    const query = `
      UPDATE configuracion
      SET ${fields.join(", ")}
      WHERE id = $${index} AND "usuarioId" = $${index + 1}
      RETURNING *
    `;
    values.push(id, usuarioId);
  
    return pool
      .query(query, values)
      .then((config) => {
        if (config.rows.length === 0) {
          throw CustomError.badRequest("No se encontró la configuración o no tienes permiso para actualizarla");
        }
        return config.rows[0];
      })
      .catch((err) => {
        console.error("Error al actualizar la configuración:", err);
        throw CustomError.internalServerError("No se pudo actualizar la configuración");
      });
  }
  
}
