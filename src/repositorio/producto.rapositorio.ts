



import { QueryResult } from "pg";
import { pool } from "../db/db-config";
import {generarIdUnico} from '../config/generar-id'
import { ProductoEntity } from "../entity/producto/producto-entity";
import { CustomError } from "../error/custom.error";


export class ProductoRepository {
    async create(producto: ProductoEntity, usuarioId: string, configuracionId: string): Promise<ProductoEntity> {
        const id = generarIdUnico();
        const query = `
          INSERT INTO producto (
            id, "codigoB", nombre, descripcion, activo, "createdAt", "updatedAt",  "configuracionId", "usuarioId"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, 
            $8, $9
          ) RETURNING *;
        `;
      
        const values = [
          id,
          producto.codigoB || '12345',
          producto.nombre,
          producto.descripcion || null,
          producto.categoria || null,
         
          producto.images || '',
          
          producto.activo ?? true,
          producto.createdAt ?? new Date(),   // Usamos new Date() para obtener un valor de tipo Date
          producto.updatedAt ?? new Date(),   // Lo mismo para updatedAt
          configuracionId,   // Ahora en la posición correcta
          usuarioId, 
        ];
      
        return pool.query(query, values)
          .then(result => result.rows[0])
          .catch(err => {
            throw CustomError.internalServerError(`No se pudo crear el producto: ${err}`);
          });
      }
      

  getProducto(usuarioId?: string, configuracionId?: string){
    const query = `SELECT * FROM producto WHERE "usuarioId" = $1 OR "configuracionId" = $2`
    const values = [usuarioId, configuracionId]
    return pool.query(query, values)
    .then(result => result.rows)
    .catch((err) => {
        throw CustomError.internalServerError(`no se pudo crear el producto: ${err}` )
    })
  }

  getProductoId(id: string) {
    const query = `SELECT * FROM producto WHERE id = $1`;
    return pool.query(query, [id])
        .then(result => result.rows[0])
        .catch(err => {
            throw CustomError.internalServerError(`no se pudo crear el producto: ${err}` )
        })
}

getProductsByIds(productIds: string[]) {
  const query = `
    SELECT id, FROM producto WHERE id = ANY($1);
  `;
  return pool.query(query, [productIds]);
}

async putProducto(id: string, producto: ProductoEntity, usuarioId?: string, configuracionId?: string): Promise<ProductoEntity> {
  const fields = [];
  const values = [];
  let index = 1;

  // Verificar y agregar cada campo opcionalmente
  if (producto.codigoB !== undefined) {
    fields.push(`"codigoB" = $${index++}`);
    values.push(producto.codigoB);
  }
  if (producto.nombre !== undefined) {
    fields.push(`nombre = $${index++}`);
    values.push(producto.nombre);
  }
  if (producto.descripcion !== undefined) {
    fields.push(`descripcion = $${index++}`);
    values.push(producto.descripcion);
  }
  if (producto.categoria !== undefined) {
    fields.push(`categoria = $${index++}`);
    values.push(producto.categoria);
  }
  
  
  
  if (producto.images !== undefined) {
    fields.push(`images = $${index++}`);
    values.push(producto.images);
  }
  
  
  // Agregar la actualización de `updatedAt`
  fields.push(`"updatedAt" = $${index++}`);
  values.push(new Date());

  // Verificar si hay campos para actualizar
  if (fields.length === 0) {
    throw CustomError.notModified("No hay campos para actualizar");
  }

  // Agregar ID, usuarioId, y configuracionId
  values.push(id, usuarioId, configuracionId);

  // Construir la consulta SQL
  const query = `
    UPDATE producto
    SET ${fields.join(", ")}
    WHERE id = $${index++}
      AND ("usuarioId" = $${index++} OR "configuracionId" = $${index++})
    RETURNING *;
  `;

  try {
    // Ejecutar la consulta SQL
    const result = await pool.query(query, values);

    // Verificar si se actualizó algún registro
    if (result.rowCount === 0) {
      throw CustomError.notModified("No se actualizó el producto");
    }

    // Retornar el producto actualizado
    return result.rows[0];
  } catch (err) {
    console.error("Error al actualizar el producto:", err);
    throw CustomError.internalServerError(`Error interno del servidor: ${err}`);
  }
}


deleteProduct(id: string): Promise<boolean> {
  const query = 'DELETE FROM producto WHERE id = $1';
  return pool.query(query, [id])
      .then((result: QueryResult) => {
          return result.rowCount !== undefined && result.rowCount! > 0;
      })
      .catch((err) => {
          console.error('Error executing query', err);
          throw CustomError.internalServerError(`no se pudo crear el producto: ${err}` )
          return false; // O manejar el error de otra forma según tus necesidades
      });
}





}
