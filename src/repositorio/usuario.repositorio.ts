import { pool } from "../db/db-config";

import { generarIdUnico } from "../config/generar-id";
import { UsuarioEntity } from "../entity/usuario/usuario.entity";
import { CustomError } from "../error/custom.error";

export class UsuarioRepository {
  emailExists(email: string): Promise<boolean> {
    const query = `
            SELECT EXISTS (
                SELECT 1
                FROM usuario
                WHERE email = $1
            ) AS exists;
        `;

    return pool
      .query(query, [email])
      .then((result) => result.rows[0].exists)
      .catch((error) => {
        console.error("Error checking email existence:", error);
        throw error;
      });
  }
  getUserByEmail(email: string): Promise<UsuarioEntity | null> {
    const query = `
            SELECT * FROM usuario
            WHERE email = $1
        `;
    return pool
      .query(query, [email])
      .then((result) => {
        // Validar si rowCount no es null y si hay filas
        if (result && result.rowCount && result.rowCount > 0) {
          return result.rows[0]; // Retorna el usuario que tiene el email (si es diferente al ID proporcionado)
        }
        return null; // El email no está en uso
      })
      .catch((err) => {
        console.error("Error al consultar el usuario por email:", err);
        throw new Error("Error interno del servidor");
      });
  }

  getUserByNombre(nombre: string): Promise<UsuarioEntity | null> {
    const query = `
            SELECT * FROM usuario
            WHERE nombre = $1
        `;
    return pool
      .query(query, [nombre])
      .then((result) => {
        // Validar si rowCount no es null y si hay filas
        if (result && result.rowCount && result.rowCount > 0) {
          return result.rows[0]; // Retorna el usuario que tiene el email (si es diferente al ID proporcionado)
        }
        return null; // El email no está en uso
      })
      .catch((err) => {
        console.error("Error al consultar el usuario por nombre:", err);
        throw new Error("Error interno del servidor");
      });
  }

  login(email: string): Promise<UsuarioEntity | null> {
    const query = `
    SELECT u.*, r.roll AS rol
    FROM usuario u
    JOIN roles r ON u."rollId" = r.id
    WHERE u.email = $1
  `;

    return pool
      .query(query, [email])
      .then((result) => {
        if (result.rows.length === 0) {
          return null;
        }
        return result.rows[0]; // Incluye campo 'rol'
      })
      .catch((err) => {
        console.error("Error retrieving user by email", err);
        throw err;
      });
  }

  // Crear un usuario

  createUsuario(
    usuario: UsuarioEntity,
    configuracionId?: string,
    rollId?: string
  ): Promise<UsuarioEntity> {
    const id = generarIdUnico();

    const query = `
            INSERT INTO usuario (id, nombre, email, password, cedula,
            celular, direccion, "rollId", img, activo, "emailValidate",
            autenticado, biografia, slug, "createdAt", "updatedAt","configuracionId")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17 )RETURNING *
        `;

    const values = [
      //usuario.id,
      id,
      usuario.nombre,
      usuario.email,
      usuario.password,
      usuario.cedula,
      usuario.celular,
      usuario.direccion,
      rollId ? rollId : usuario.rollId,
      usuario.img,
      usuario.activo ?? true,
      usuario.emailValidate ?? false,

      usuario.autenticado ?? true,
      usuario.biografia ? usuario.biografia : "no tienes biografia configurada",
      usuario.slug,
      usuario.createdAt || new Date(),
      usuario.updatedAt || new Date(),
      configuracionId,
    ];

    return pool
      .query(query, values)
      .then((result) => result.rows[0])
      .catch((err) => {
        console.error("Error al crear el usuario", err);
        throw err;
      });
  }

  getUsuarioId(id: string): Promise<UsuarioEntity | null> {
    console.log("Consultando usuario con id:", id); // Depuración adicional

    const query = `SELECT * FROM usuario WHERE id = $1`;

    return pool
      .query(query, [id])
      .then((result) => {
        console.log("Resultado de la consulta:", result.rows); // Verifica qué retorna la consulta
        if (result.rows.length === 0) {
          console.warn(`No se encontró un usuario con el id: ${id}`);
          return null; // Devuelve null si no se encuentra el usuario
        }
        return result.rows[0]; // Devuelve el usuario si existe
      })
      .catch((err) => {
        console.error("Error al obtener el usuario", err);
        throw new Error("Error al obtener el usuario de la base de datos");
      });
  }
  async getUsuarioEmail(
    email?: string,
    id?: string
  ): Promise<UsuarioEntity | null> {
    const query = `
            SELECT * FROM usuario
            WHERE email = $1 AND id <> $2
        `;
    const result = await pool.query(query, [email, id]);

    // Validar si rowCount no es null y si hay filas
    if (result && result.rowCount && result.rowCount > 0) {
      return result.rows[0]; // Retorna el usuario que tiene el email (si es diferente al ID proporcionado)
    }
    return null; // El email no está en uso por otro usuario
  }

  // Actualizar un usuario por ID
  async updateUsuario(id: string, usuario: any): Promise<UsuarioEntity> {
    // Paso 1: Construir la consulta de actualización dinámica
    const fields = [];
    const values = [];
    let index = 1;

    // Preparar la consulta de actualización
    if (usuario.nombre) {
      fields.push(`nombre = $${index++}`);
      values.push(usuario.nombre);
    }
    if (usuario.email) {
      fields.push(`email = $${index++}`);
      values.push(usuario.email);
    }
    if (usuario.password) {
      fields.push(`password = $${index++}`);
      values.push(usuario.password);
    }
    if (usuario.cedula) {
      fields.push(`cedula = $${index++}`);
      values.push(usuario.cedula);
    }
    if (usuario.celular) {
      fields.push(`celular = $${index++}`);
      values.push(usuario.celular);
    }
    if (usuario.direccion) {
      fields.push(`direccion = $${index++}`);
      values.push(usuario.direccion);
    }
    if (usuario.roll) {
      fields.push(`roll = $${index++}`);
      values.push(usuario.roll);
    }
    if (usuario.img) {
      fields.push(`img = $${index++}`);
      values.push(usuario.img);
    }
    if (typeof usuario.activo !== "undefined") {
      fields.push(`activo = $${index++}`);
      values.push(usuario.activo);
    }
    if (typeof usuario.emailValidate !== "undefined") {
      fields.push(`"emailValidate" = $${index++}`);
      values.push(usuario.emailValidate);
    }
    if (typeof usuario.autenticado !== "undefined") {
      fields.push(`autenticado = $${index++}`);
      values.push(usuario.autenticado);
    }

    // Siempre actualizar el campo "updatedAt"
    fields.push(`"updatedAt" = $${index++}`);
    values.push(new Date());

    // Agregar el ID al final de los valores
    values.push(id);

    if (fields.length === 0) {
      throw CustomError.notModified("No hay campos para actualizar");
    }

    const query = `
            UPDATE usuario
            SET ${fields.join(", ")}
            WHERE id = $${index}
            RETURNING *;
        `;

    try {
      const result = await pool.query(query, values);
      if (result.rowCount === 0) {
        throw new Error("No se actualizó ningún usuario");
      }
      return result.rows[0];
    } catch (err) {
      console.error("Error al actualizar el usuario:", err);
      throw new Error("Error interno del servidor");
    }
  }

  // Eliminar un usuario por ID
  deleteUsuario(id: string): Promise<void> {
    const checkExistenceQuery = `SELECT 1 FROM usuario WHERE id = $1`;
    const deleteQuery = `DELETE FROM usuario WHERE id = $1`;

    return pool
      .query(checkExistenceQuery, [id])
      .then((result) => {
        if (result.rowCount === 0) {
          console.warn(`Usuario con id ${id} no encontrado`);
          return; // No se hace nada si el usuario no existe
        }

        return pool
          .query(deleteQuery, [id])
          .then(() => console.log("Usuario eliminado exitosamente"))
          .catch((err) => {
            console.error("Error al eliminar el usuario", err);
            throw err;
          });
      })
      .catch((err) => {
        console.error("Error al verificar existencia del usuario", err);
        throw err;
      });
  }

  getUsuario(): Promise<{ usuario: UsuarioEntity[]; totalUsuario: number }> {
    const queryUsuarios = `
            SELECT * FROM usuario
        `;

    const queryConteo = `
            SELECT COUNT(*) AS "totalUsuario"
            FROM usuario
        `;

    // Ejecutar ambas consultas en paralelo
    return Promise.all([pool.query(queryUsuarios), pool.query(queryConteo)])
      .then(([resultUsuarios, resultConteo]) => {
        const usuario = resultUsuarios.rows as UsuarioEntity[];
        const totalUsuario =
          parseInt(resultConteo.rows[0]?.totalUsuario, 10) || 0;
        return { usuario, totalUsuario };
      })
      .catch((err) => {
        console.error("Error al obtener los usuarios", err);
        throw err;
      });
  }
  getUsuarioEmpleado(
    configuracionId: string
  ): Promise<{ usuarios: UsuarioEntity[]; totalEmpleado: number }> {
    const queryUsuarios = `
      SELECT usuario.*
      FROM usuario
      INNER JOIN roles ON usuario."rollId" = roles.id
      WHERE usuario."configuracionId" = $1
        AND roles.roll IN ('admin', 'empleado', 'contador')
    `;

    const queryConteo = `
      SELECT COUNT(*) AS "totalEmpleado"
      FROM usuario
      INNER JOIN roles ON usuario."rollId" = roles.id
      WHERE usuario."configuracionId" = $1
        AND roles.roll IN ('admin', 'empleado', 'contador')
    `;

    // Ejecutar ambas consultas en paralelo
    return Promise.all([
      pool.query(queryUsuarios, [configuracionId]),
      pool.query(queryConteo, [configuracionId]),
    ])
      .then(([resultUsuarios, resultConteo]) => {
        const usuarios = resultUsuarios.rows as UsuarioEntity[];
        const totalEmpleado =
          parseInt(resultConteo.rows[0]?.totalEmpleado, 10) || 0;
        return { usuarios, totalEmpleado };
      })
      .catch((err) => {
        console.error("Error al obtener los usuarios", err);
        throw err;
      });
  }

  getUsuarioCliente(): Promise<{
    usuarios: UsuarioEntity[];
    totalCliente: number;
  }> {
    const queryUsuarios = `
                SELECT *
                FROM usuario

                WHERE roll = 'cliente'
            `;

    const queryConteo = `
                SELECT COUNT(*) AS "totalCliente"
                FROM usuario
                WHERE roll = 'cliente'

            `;

    // Ejecutar ambas consultas en paralelo
    return Promise.all([pool.query(queryUsuarios), pool.query(queryConteo)])
      .then(([resultUsuarios, resultConteo]) => {
        const usuarios = resultUsuarios.rows as UsuarioEntity[];
        // Aquí debes usar "totalCliente" con mayúsculas tal como en el alias
        const totalCliente =
          parseInt(resultConteo.rows[0]?.totalCliente, 10) || 0;
        return { usuarios, totalCliente };
      })
      .catch((err) => {
        console.error("Error al obtener los usuarios", err);
        throw err;
      });
  }

  updatePassword(
    id: string,
    newPassword: string
  ): Promise<UsuarioEntity | null> {
    const query = `
        UPDATE usuario
        SET password = $1, "updatedAt" = $2
        WHERE id = $3
        RETURNING *;
    `;
    return pool
      .query(query, [newPassword, new Date(), id])
      .then((result) => {
        if (result && result.rowCount && result.rowCount > 0) {
          return result.rows[0]; // Retorna el usuario que tiene el email (si es diferente al ID proporcionado)
        }
        return null; // El usuario no fue encontrado
      })
      .catch((err) => {
        console.error("Error al actualizar la contraseña:", err);
        throw new Error("Error interno del servidor");
      });
  }

  async getUsuarioPermisos(userId: string): Promise<string[]> {
    const query = `
    SELECT DISTINCT p.nombre
  FROM permisos p
  LEFT JOIN roles_permisos rp ON p.id = rp."permisoId"
  LEFT JOIN usuarios_permisos up ON p.id = up."permisoId"
  LEFT JOIN roles r ON rp."rollId" = r.id  -- Asegúrate de que "rollId" sea el campo correcto
  WHERE r.id = (SELECT "rollId" FROM usuario WHERE id = $1)
     OR up."usuarioId" = $1;
  `;
    return pool
      .query(query, [userId])
      .then((result) => result.rows.map((row) => row.nombre))
      .catch((err) => {
        throw CustomError.internalServerError(
          `No se pudieron obtener los permisos: ${err}`
        );
      });
  }
}
