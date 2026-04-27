import { bcryptAdapter } from "../config/bcrypt.adapter";
import { generarIdUnico } from "../config/generar-id";
import { CustomError } from "../error/custom.error";
import { pool } from "./db-config";

async function insertarUsuarioMaestro() {
  const id = generarIdUnico();
  const password = "Monetiza123"; // Contraseña por defecto o personalizable
  const hashedPassword = await bcryptAdapter.hash(password); // Hasheamos la contraseña
  const rollId = await insertarORetornarRoll("empresa"); // Garantizamos que el rol "empresa" existe

  // Verificar si ya existe un usuario maestro
  const checkUserQuery = `
    SELECT COUNT(*) AS user_count
    FROM usuario
    WHERE email = $1
  `;
  const result = await pool.query(checkUserQuery, ["master@empresa.com"]);
  const userCount = parseInt(result.rows[0].user_count, 10);

  if (userCount > 0) {
    console.log("El usuario Lobito ya ha sido creado previamente.");
    return;
  }

  // Insertar el usuario maestro
  const insertUserQuery = `
    INSERT INTO usuario (id, nombre, email, biografia, password, cedula, celular, direccion, "rollId", "emailValidate")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `;

  await pool.query(insertUserQuery, [
    id,
    "Lobito Isaias",
    "monetizatodito@gmail.com",
    "es uno de los mas grandes del seo",
    hashedPassword,
    "13111372434", // Cedula genérica para maestro
    "0994967552", // Celular genérico
    "Oficina Central",
    rollId,
    true,
  ]);

  console.log("Usuario Lobito creado exitosamente.");
}

async function insertarORetornarRoll(roll: string): Promise<string> {
  // Verificar si el rol ya existe
  const checkRollQuery = `
    SELECT id
    FROM roles
    WHERE roll = $1
  `;
  const checkResult = await pool.query(checkRollQuery, [roll]);

  if (checkResult.rows.length > 0) {
    return checkResult.rows[0].id; // Retorna el ID si el rol ya existe
  }

  // Insertar el rol si no existe
  const id = generarIdUnico();
  const insertRollQuery = `
    INSERT INTO roles (id, roll)
    VALUES ($1, $2)
    RETURNING id;
  `;

  const insertResult = await pool.query(insertRollQuery, [id, roll]);
  console.log(`Rol "${roll}" creado con ID: ${id}`);
  return insertResult.rows[0].id; // Retorna el ID del rol recién creado
}

// Ejecutar el script de consola
insertarUsuarioMaestro()
  .catch((err) => {
    console.error("Error al insertar el usuario maestro:", err);
  })
  .finally(() => {
    pool.end();
  });
