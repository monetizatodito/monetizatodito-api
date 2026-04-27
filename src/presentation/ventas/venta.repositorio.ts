// src/presentation/ventas/venta.repositorio.ts
import { Pool } from "pg";
// TODO: ajusta path a tu pool real
import { pool } from "../../db/db-config";
import { generarIdUnico } from "../../config/generar-id"; // TODO: ajusta path

export type InsertPayment = {
  provider: "paypal";
  provider_id: string;
  status: string; // COMPLETED, etc.
  type: "purchase" | "donation";
  libro_id?: string | null;
  amount: number;
  currency: string; // USD
  payer_email?: string | null;
  payer_name?: string | null;
  raw: any;
};

export class PaymentsRepository {
  constructor(private readonly db: Pool = pool) {}

  /**
   * Inserta/actualiza un pago por provider_id (evita duplicados).
   * Si el provider_id ya existe, actualiza los campos importantes y retorna la fila final.
   */
  async upsert(p: InsertPayment) {
    const id = generarIdUnico();
    const q = `
      INSERT INTO payments (
        id, provider, provider_id, status, type, libro_id,
        amount, currency, payer_email, payer_name, raw
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb
      )
      ON CONFLICT (provider_id) DO UPDATE SET
        status       = EXCLUDED.status,
        type         = EXCLUDED.type,
        libro_id     = COALESCE(EXCLUDED.libro_id, payments.libro_id),
        amount       = EXCLUDED.amount,
        currency     = EXCLUDED.currency,
        payer_email  = COALESCE(EXCLUDED.payer_email, payments.payer_email),
        payer_name   = COALESCE(EXCLUDED.payer_name, payments.payer_name),
        raw          = EXCLUDED.raw
      RETURNING *;
    `;
    const v = [
      id,
      p.provider,
      p.provider_id,
      p.status,
      p.type,
      p.libro_id ?? null,
      p.amount,
      p.currency,
      p.payer_email ?? null,
      p.payer_name ?? null,
      JSON.stringify(p.raw ?? {}),
    ];
    const r = await this.db.query(q, v);
    return r.rows[0];
  }

  async listAdmin(
    params: {
      from?: string | null; // YYYY-MM-DD
      to?: string | null; // YYYY-MM-DD
      limit?: number;
    } = {}
  ) {
    const { from = null, to = null, limit = 1000 } = params;

    const q = `
      SELECT
        p.id,
        p.created_at,
        p.provider,
        p.provider_id,
        p.status,
        p.type,
        p.amount,
        p.currency,
        p.payer_email,
        p.payer_name,
        l.title AS libro_titulo
      FROM payments p
      LEFT JOIN libros l ON l.id = p.libro_id
      WHERE ($1::date IS NULL OR p.created_at::date >= $1::date)
        AND ($2::date IS NULL OR p.created_at::date <= $2::date)
      ORDER BY p.created_at DESC
      LIMIT $3;
    `;
    const r = await this.db.query(q, [from, to, limit]);
    return r.rows;
  }
}
