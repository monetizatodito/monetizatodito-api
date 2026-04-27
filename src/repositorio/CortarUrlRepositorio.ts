


import { pool } from "../db/db-config";
import {generarIdUnico} from '../config/generar-id'

import { CustomError } from "../error/custom.error";
import { QueryResult } from "pg";

import { UrlsEntity } from '../entity/urls/urls-entity';


export class UrlRepositorio{
    async create(url: UrlsEntity): Promise<UrlsEntity> {
        
        const id = generarIdUnico();
        
        const query = `
          INSERT INTO urls (
            id, url_larga, url_corta, "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5
            
          ) RETURNING *;
        `;
      
        const values = [
          id,
         url.url_larga,
         url.url_corta,
         url.createdAt ?? new Date(),   // Usamos new Date() para obtener un valor de tipo Date
        url.updatedAt ?? new Date(),   // Lo mismo para updatedAt
            
        ];
      
        return pool.query(query, values)
          .then(result => result.rows[0])
          .catch(err => {
            throw CustomError.internalServerError(`No se pudo crear la url: ${err}`);
          });
      }
      

  getUrl(){
    const query = `SELECT * FROM urls`
    
    return pool.query(query)
    .then(result => result.rows)
    .catch((err) => {
        throw CustomError.internalServerError(`no se pudo listar los planes: ${err}` )
    })
  }

  
  

  public async getUrlCorta(url_corta: string): Promise<{ url_larga: string } | null> {
    try {
      const query = "SELECT url_larga FROM urls WHERE url_corta = $1 LIMIT 1";
      const result = await pool.query(query, [url_corta]);

      if (result.rows.length === 0) return null; // No se encontró la URL

      return result.rows[0]; // Devuelve { url_larga: "http://..." }
    } catch (error) {
      console.error("Error en getUrlCorta:", error);
      throw new Error("Error al obtener la URL corta");
    }
  }




deleteUrl(id: string): Promise<boolean> {
  const query = 'DELETE FROM urls WHERE id = $1';
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






