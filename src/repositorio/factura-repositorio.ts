



import { QueryResult } from "pg";
import { pool } from "../db/db-config";
import {generarIdUnico} from '../config/generar-id'
import { CustomError } from "../error/custom.error";
import { FacturaEntity } from '../entity/factura/factura.entity';



export class FacturaRepository {
    async create(data: FacturaEntity, usuarioId: string, configuracionId: string): Promise<FacturaEntity> {
      
        const id = generarIdUnico();
        const query = `
          INSERT INTO factura(
            id, "numeroFactura", "fechaCompra", "provedorId",total,
           "createdAt", "updatedAt",  "configuracionId", "usuarioId"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, 
            $8, $9
            
          ) RETURNING *;
        `;
      
        const values = [
          id,
          data.numeroFactura,
          data.fechaCompra,
          data.provedorId,
          data.total,
          data.createdAt ?? new Date(),   // Usamos new Date() para obtener un valor de tipo Date
          data.updatedAt ?? new Date(),   // Lo mismo para updatedAt
          configuracionId,   // Ahora en la posición correcta
          usuarioId, 
        ];
      
        return pool.query(query, values)
          .then(result => result.rows[0])
          .catch(err => {
            throw CustomError.internalServerError(`No se pudo crear el provedor: ${err}`);
          });
      }
      

      getFactura(usuarioId?: string, configuracionId?: string): Promise<FacturaEntity[]> {
        const query = `
          SELECT *
          FROM factura
          WHERE activo = true 
            AND ("usuarioId" = $1 OR "configuracionId" = $2)
          ORDER BY "fechaCompra" DESC;
        `;
      
        const values = [usuarioId || null, configuracionId || null]; // Manejar valores opcionales con `null`
      
        return pool.query(query, values)
          .then(result => {
            console.log('Facturas activas obtenidas:', result.rows);
            return result.rows as FacturaEntity[];
          })
          .catch(err => {
            console.error('Error ejecutando la consulta', err);
            throw CustomError.internalServerError(`No se pudo listar las facturas: ${err}`);
          });
      }
      

  getFacturaId(id: string, usuarioId?: string, configuracionId?: string) {
    const query = `SELECT * FROM factura WHERE id = $1 AND ("usuarioId" = $2 OR "configuracionId" = $3)`;
    return pool.query(query, [id, usuarioId, configuracionId])
        .then(result => result.rows[0])
        .catch(err => {
            throw CustomError.internalServerError(`no se pudo crear el producto: ${err}` )
        })
}

putFactura(
  id: string,
  data: Partial<FacturaEntity>,
  usuarioId?: string,
  configuracionId?: string
): Promise<FacturaEntity> {
  const fields = [];
  const values = [];
  let index = 1;

  // Construir dinámicamente los campos a actualizar
  for (const [key, value] of Object.entries(data)) {
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

  values.push(id);
  let whereClause = `id = $${index}`;
  index++;

  // Condiciones opcionales para usuarioId y configuracionId
  if (usuarioId) {
    whereClause += ` AND "usuarioId" = $${index}`;
    values.push(usuarioId);
    index++;
  }

  if (configuracionId) {
    whereClause += ` OR "configuracionId" = $${index}`;
    values.push(configuracionId);
  }

  // Añadir condiciones para id y usuarioId
  const query = `
    UPDATE factura
    SET ${fields.join(", ")}
    WHERE ${whereClause}
    RETURNING *
  `;
  

  return pool
    .query(query, values)
    .then((provedor) => {
      if (provedor.rows.length === 0) {
        throw CustomError.badRequest("No se encontró la configuración o no tienes permiso para actualizarla");
      }
      return provedor.rows[0];
    })
    .catch((err) => {
      console.error("Error al actualizar la configuración:", err);
      throw CustomError.internalServerError("No se pudo actualizar la configuración");
    });
}


deleteFactura(id: string, usuarioId?: string, configuracionId?: string): Promise<boolean> {
  if (!id) {
    throw CustomError.badRequest('El ID es obligatorio');
  }

  // Verificar si al menos usuarioId o configuracionId están definidos
  if (!usuarioId && !configuracionId) {
    throw CustomError.badRequest('Debe proporcionarse usuarioId o configuracionId');
  }

  const values = [id];
  let whereClause = `id = $1`;
  let index = 2;

  if (usuarioId) {
    whereClause += ` AND "usuarioId" = $${index}`;
    values.push(usuarioId);
    index++;
  }

  if (configuracionId) {
    const operator = usuarioId ? 'OR' : 'AND';
    whereClause += ` ${operator} "configuracionId" = $${index}`;
    values.push(configuracionId);
  }

  const query = `
    UPDATE factura
    SET activo = false
    WHERE ${whereClause};
  `;

  return pool.query(query, values)
    .then((result: QueryResult) => {
      console.log('Resultado de la actualización:', result.rowCount);
      return result.rowCount! > 0; // Retorna true si se actualizó alguna fila
    })
    .catch((err) => {
      console.error('Error ejecutando la consulta', err);
      throw CustomError.internalServerError(`No se pudo actualizar el estado de la factura: ${err}`);
    });
}




}
