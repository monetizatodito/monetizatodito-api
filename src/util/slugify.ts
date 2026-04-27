import { pool } from "../db/db-config";

export function generarSlug(slugUrl: string): string {
  return slugUrl
    .toLowerCase()
    .normalize("NFD") // elimina acentos
    .replace(/[\u0300-\u036f]/g, "") // remueve diacríticos
    .replace(/[^\w\s-]/g, "") // elimina caracteres no deseados
    .trim()
    .replace(/\s+/g, "-") // reemplaza espacios por guiones
    .replace(/-+/g, "-"); // quita guiones repetidos
}

export async function generarSlugAuthUnico(slugUrl: string): Promise<string> {
  const baseSlug = generarSlug(slugUrl);
  let slug = baseSlug;
  let contador = 1;

  while (true) {
    const { rowCount } = await pool.query(
      "SELECT 1 FROM usuario WHERE slug = $1",
      [slug]
    );
    if (rowCount === 0) break;
    slug = `${baseSlug}-${contador}`;
    contador++;
  }

  return slug;
}
export function toSlug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
