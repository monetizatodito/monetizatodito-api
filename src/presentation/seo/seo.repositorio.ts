// src/presentation/seo/seo.repositorio.ts
import { pool } from "../../db/db-config"; // 🔁 ajusta la ruta si tu db-config está en otro sitio
import { generarIdUnico } from "../../config/generar-id";

export type Strategy = "mobile" | "desktop";

export type PageSpeedLog = {
  id?: string;
  url: string;
  strategy: Strategy;
  score: number; // 0–100
  rawScore: number; // 0–1 (Lighthouse)
  createdAt?: Date;
};

export class SeoRepository {
  /**
   * Inserta un log de PageSpeed en la tabla seo_pagespeed.
   * Genera el id con generarIdUnico() igual que en tus otros repos.
   */
  public insertPageSpeedLog(log: PageSpeedLog) {
    const id = log.id ?? generarIdUnico();

    const query = `
      INSERT INTO seo_pagespeed (
        id,
        url,
        strategy,
        score,
        raw_score,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
    `;

    const values = [id, log.url, log.strategy, log.score, log.rawScore];

    return pool.query(query, values);
  }

  /**
   * Histórico de PageSpeed para una URL (y opcionalmente por estrategia).
   */
  public getHistoryByUrl(url: string, strategy?: Strategy) {
    let query = `
      SELECT
        id,
        url,
        strategy,
        score,
        raw_score,
        created_at
      FROM seo_pagespeed
      WHERE url = $1
    `;
    const params: any[] = [url];

    if (strategy) {
      query += ` AND strategy = $2`;
      params.push(strategy);
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    return pool
      .query(query, params)
      .then((result) => result.rows as PageSpeedLog[]);
  }
}
