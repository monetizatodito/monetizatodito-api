// src/repositorio/mdDraft.repo.ts
import { pool } from "../db/db-config";

export interface MdDraftRow {
  id: string;
  filename: string;
  storagePath: string;
  usuarioId: string;
  title?: string; // opcional, por si luego decides guardar título
  createdAt: Date;
  updatedAt: Date;
}

export async function createMdDraft(row: {
  id: string;
  filename: string;
  storagePath: string;
  usuarioId: string;
  title?: string;
}): Promise<void> {
  // Solo guardamos referencia. Si quieres title, añade la columna y el valor.
  await pool.query(
    `INSERT INTO "md_draft"(id, filename, "storagePath", "usuarioId")
     VALUES ($1,$2,$3,$4)`,
    [row.id, row.filename, row.storagePath, row.usuarioId]
  );
}

export async function getMdDraftById(id: string): Promise<MdDraftRow | null> {
  const r = await pool.query(
    `SELECT id, filename, "storagePath", "usuarioId", "createdAt", "updatedAt"
     FROM "md_draft" WHERE id=$1`,
    [id]
  );
  return r.rows[0] || null;
}

export async function getDraftsByUser(
  usuarioId: string
): Promise<MdDraftRow[]> {
  const r = await pool.query(
    `SELECT id, filename, "storagePath", "usuarioId", "createdAt", "updatedAt"
     FROM "md_draft"
     WHERE "usuarioId"=$1
     ORDER BY "createdAt" DESC`,
    [usuarioId]
  );
  return r.rows as MdDraftRow[];
}

export async function deleteMdDraft(id: string): Promise<void> {
  await pool.query(`DELETE FROM "md_draft" WHERE id=$1`, [id]);
}
