



import { QueryResult } from "pg";
import { pool } from "../db/db-config";
import {generarIdUnico} from '../config/generar-id'
import { CustomError } from "../error/custom.error";

import { RollEntity } from '../entity/roll/create-roll.entity';


export class RollRepository {
    async create(data: RollEntity): Promise<RollEntity> {
        const id = generarIdUnico();
        const query = `
          INSERT INTO roles (
            id, roll,  "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4
            
            
          ) RETURNING *;
        `;
      
        const values = [
          id,
          data.roll, 
          data.createdAt ?? new Date(),   // Usamos new Date() para obtener un valor de tipo Date
          data.updatedAt ?? new Date(),   // Lo mismo para updatedAt
         
        ];
      
        return pool.query(query, values)
          .then(result => result.rows[0])
          .catch(err => {
            throw CustomError.internalServerError(`No se pudo crear el roll: ${err}`);
          });
      }
      

  getRoll(){
    const query = `SELECT * FROM roles`
    
    return pool.query(query)
    .then(result => result.rows)
    .catch((err) => {
        throw CustomError.internalServerError(`no se pudo listar el roll: ${err}` )
    })
  }

  getRollId(id: string) {
    const query = `SELECT * FROM roles WHERE id = $1 `;
    return pool.query(query, [id])
        .then(result => result.rows[0])
        .catch(err => {
            throw CustomError.internalServerError(`no se pudo crear el roll: ${err}` )
        })
}

putRoll(
  id: string,
  dataRoll: Partial<RollEntity>,
 
): Promise<RollEntity> {
  const fields = [];
  const values = [];
  let index = 1;

  
  // Construir dinámicamente los campos a actualizar
  for (const [key, value] of Object.entries(dataRoll)) {
    if (value !== undefined) { 
      fields.push(`"${key}" = $${index}`);
      values.push(value);
      index++;
    }
  }

  // Validar si hay campos para actualizar
  if (fields.length === 0) {
    throw CustomError.badRequest('No hay campos para actualizar');
  }

  // Añadir id a los valores
  values.push(id);
  let whereClause = `id = $${index}`;
  index++;

  // Condiciones opcionales para usuarioId y configuracionId
 
  

  const query = `
    UPDATE roles
    SET ${fields.join(", ")}
    WHERE ${whereClause}
    RETURNING *
  `;

  return pool
    .query(query, values)
    .then((roll) => {
      if (roll.rows.length === 0) {
        throw CustomError.badRequest(
          "No se encontró el roll o no tienes permiso para actualizarlo"
        );
      }
      return roll.rows[0];
    })
    .catch((err) => {
      console.error("Error al actualizar la configuración:", err);
      throw CustomError.internalServerError("No se pudo actualizar el roll");
    });
}


deleteRoll(id: string): Promise<boolean> {
  const query = `
    DELETE FROM roles
    WHERE id = $1 AND ("usuarioId" = $2 OR "configuracionId" = $3)
  `;

  return pool.query(query, [id])
    .then((result: QueryResult) => {
      // Verifica si se eliminó al menos una fila
      return result.rowCount !== undefined && result.rowCount! > 0;
    })
    .catch((err) => {
      console.error('Error ejecutando la consulta', err);
      throw CustomError.internalServerError(`No se pudo eliminar el roll: ${err}`);
    });
}



async asignarPermiso(roleId: string, permissions: string[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Validar que los permisos existen en la tabla permisos
    const validPermissionsQuery = `
      SELECT id 
      FROM permisos 
      WHERE id = ANY($1)
    `;
    const validPermissionsResult = await client.query(validPermissionsQuery, [permissions]);
    const validPermissions = validPermissionsResult.rows.map(row => row.id);

    console.log("Permisos válidos encontrados en la base de datos:", validPermissions);

    // Obtener los permisos actualmente asignados al rol
    const existingPermissionsQuery = `
      SELECT "permisoId" 
      FROM roles_permisos 
      WHERE "rollId" = $1
    `;
    const existingPermissionsResult = await client.query(existingPermissionsQuery, [roleId]);
    const existingPermissions = existingPermissionsResult.rows.map(row => row.permisoId);

    // Filtrar los permisos que no estén asignados y que sean válidos
    const newPermissions = validPermissions.filter(
      permisoId => !existingPermissions.includes(permisoId)
    );

    console.log("Permisos para insertar:", newPermissions);

    if (newPermissions.length > 0) {
      const insertValues = newPermissions
        .map(permisoId => `('${generarIdUnico()}', '${roleId}', '${permisoId}')`)
        .join(', ');

      const insertQuery = `
        INSERT INTO roles_permisos (id, "rollId", "permisoId")
        VALUES ${insertValues}
      `;
      await client.query(insertQuery);
    }

    await client.query("COMMIT");
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error interno al asignar permisos:", error);
    throw CustomError.internalServerError(`No se pudo asignar permisos al rol: ${error.message}`);
  } finally {
    client.release();
  }
}



async getPermisoRoll(rollId: string, ): Promise<any[]> {
  const query = `
    SELECT *
    FROM roles_permisos
    WHERE "rollId" = $1 
  `;
  const result = await pool.query(query, [rollId]);
  return result.rows; // Devuelve todas las filas completas
}


}
