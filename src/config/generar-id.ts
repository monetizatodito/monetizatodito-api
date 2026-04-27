// Genera un identificador único personalizado
let counter = 0;
const numeroUnico = Math.floor(Math.random() * 0xffff)
  .toString(16)
  .padStart(4, "0");

export function generarId(): string {
  const timestamp = Date.now().toString(16).padStart(13, "0"); // Asegura 13 dígitos
  counter = (counter + 1) % 0xffff;
  const counterStr = counter.toString(16).padStart(4, "0"); // Asegura 4 dígitos
  const randomBlock = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0"); // Asegura 8 dígitos
  return `${timestamp}-${numeroUnico}-${counterStr}-${randomBlock}`;
}

// Valida si un identificador sigue el formato esperado


export function validarIdUnico(id: string): boolean {
  const idRegex = /^[0-9a-f]{12}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{8}$/i;
  return idRegex.test(id);
}

// Contador global que no se reinicia entre llamadas

// Contador global

export function generarIdUnico(): string {
  // Obtener el timestamp actual en milisegundos
  const timestamp = Date.now().toString(16).padStart(12, "0");

  // Generar una parte aleatoria utilizando crypto para mayor entropía
  const randomPart = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");

  // Incrementar el contador y asegurar que no exceda el rango permitido
  counter = (counter + 1) % 0xffff;
  const counterHex = counter.toString(16).padStart(4, "0");

  // Crear un hash simple combinando el timestamp, la parte aleatoria y el contador
  const hashInput = timestamp + randomPart + counterHex;
  const hash =
    hashInput.split("").reduce((acc, char) => {
      const charCode = char.charCodeAt(0);
      acc = (acc << 5) - acc + charCode;
      return acc & acc; // Convertir a 32 bits con signo
    }, 0) >>> 0; // Usar unsigned right shift para asegurar que sea positivo

  // Convertir el hash a hexadecimal y asegurarse de que tenga un ancho fijo
  const hashHex = hash.toString(16).padStart(8, "0");

  // Combinar el timestamp, la parte aleatoria, el contador y el hash para formar el ID
  return `${timestamp}-${randomPart}-${counterHex}-${hashHex}`;
}



import { pool } from "../db/db-config";

export async function generarUrlCorta(): Promise<string> {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  
  let urlCorta = "";
  let existe = true;

  while (existe) {
    // Generar una URL de 6 caracteres aleatorios
    urlCorta = Array.from({ length: 6 }, () => caracteres[Math.floor(Math.random() * caracteres.length)]).join("");

    // Consultar en la base de datos si ya existe
    const query = "SELECT COUNT(*) FROM urls WHERE url_corta = $1";
    const result = await pool.query(query, [urlCorta]);

    existe = result.rows[0].count > 0; // Si el count es mayor a 0, la URL ya existe
  }

  return urlCorta;
}

