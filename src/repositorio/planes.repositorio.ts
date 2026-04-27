



import { QueryResult } from "pg";
import { pool } from "../db/db-config";
import {generarIdUnico} from '../config/generar-id'

import { CustomError } from "../error/custom.error";


import { PlanesEntity } from "../entity/planes/planes.entity";


export class PlanesRepository {
    async create(plan: PlanesEntity, configuracionId: string): Promise<PlanesEntity> {
        
        const id = generarIdUnico();
        console.log('repo', id)
        const query = `
          INSERT INTO planes (
            id, titulo, precio, descripcion,
             "createdAt", "updatedAt",  "configuracionId"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7 
            
          ) RETURNING *;
        `;
      
        const values = [
          id,
          plan.titulo,
          plan.precio,
          plan.descripcion,
         
          plan.createdAt ?? new Date(),   // Usamos new Date() para obtener un valor de tipo Date
          plan.updatedAt ?? new Date(),   // Lo mismo para updatedAt
          configuracionId,   // Ahora en la posición correcta
          
        ];
      
        return pool.query(query, values)
          .then(result => result.rows[0])
          .catch(err => {
            throw CustomError.internalServerError(`No se pudo crear el plan: ${err}`);
          });
      }
      

  getPlan(){
    const query = `SELECT * FROM planes`
    
    return pool.query(query)
    .then(result => result.rows)
    .catch((err) => {
        throw CustomError.internalServerError(`no se pudo listar los planes: ${err}` )
    })
  }

  
  

  getPlanId(id: string) {
    const query = `SELECT * FROM planes WHERE id = $1`;
    return pool.query(query, [id])
        .then(result => result.rows[0])
        .catch(err => {
            throw CustomError.internalServerError(`no se ecuentre la apertura: ${err}` )
        })
}

async putPlan(id: string, plan: Partial<PlanesEntity>): Promise<PlanesEntity> {
  // Paso 1: Construir la consulta de actualización dinámica
  const fields = [];
  const values = [];
  let index = 1;

  

  // Verificar si "montoA" está presente
  if (plan.titulo !== undefined) {
    fields.push(`titulo = $${index++}`);
    values.push(plan.titulo);
  }

  // Verificar si "abrirCaja" está presente, incluso si es "false"
  if (plan.precio !== undefined) {
    fields.push(`precio = $${index++}`);
    values.push(plan.precio);
  }
  if (plan.descripcion !== undefined) {
    fields.push(`descripcion = $${index++}`);
    values.push(plan.descripcion);
  }

  // Actualizar "updatedAt"
  fields.push(`"updatedAt" = $${index++}`);
  values.push(new Date());

  // Agregar el ID al final de los valores
  values.push(id);

  // Verificar si hay campos para actualizar
  if (fields.length === 0) {
    throw CustomError.notModified("No hay campos para actualizar");
  }

  // Construir la consulta SQL
  const query = `
    UPDATE planes
    SET ${fields.join(", ")}
    WHERE id = $${index}
    RETURNING *;
  `;

  try {
    // Ejecutar la consulta SQL
    const result = await pool.query(query, values);

    // Verificar si se actualizó algún registro
    if (result.rowCount === 0) {
      throw CustomError.notModified("No se actualizó LA CAJA");
    }

    // Retornar la caja actualizada
    return result.rows[0];
  } catch (err) {
    console.error("Error al actualizar LA CAJA:", err);
    throw CustomError.internalServerError("Error interno del servidor");
  }
}


deletePlan(id: string): Promise<boolean> {
  const query = 'DELETE FROM planes WHERE id = $1';
  return pool.query(query, [id])
      .then((result: QueryResult) => {
          return result.rowCount !== undefined && result.rowCount! > 0;
      })
      .catch((err) => {
          console.error('Error executing query', err);
          throw CustomError.internalServerError(`no se pudo eliminar el plan ${err}` )
          
      });
}



}
