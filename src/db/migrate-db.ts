import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { tables } from "./tabla";
import { pool } from "./db-config";

export class DatabaseInitializers {
  private static initializedTables: Set<string> = new Set();
  private static pool: Pool = pool;

  static getPool(): Pool {
    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }
    return this.pool;
  }

  private static async columnExists(
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    const query = `
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = $1
                AND column_name = $2
            ) AS exists
        `;
    try {
      const result = await this.getPool().query(query, [tableName, columnName]);
      return result.rows[0].exists;
    } catch (err) {
      console.error(
        `Error checking if column ${columnName} exists in table ${tableName}`,
        err,
      );
      throw err;
    }
  }

  private static async checkTypeExists(typeName: string): Promise<boolean> {
    const query = `
      SELECT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = $1
      ) AS exists;
    `;
    try {
      const result = await this.getPool().query(query, [typeName]);
      return result.rows[0].exists;
    } catch (err) {
      console.error(`Error checking if type ${typeName} exists`, err);
      throw err;
    }
  }
  static async runTypeMigration(typeMigration: {
    name: string;
    createQuery: string;
    alterQueries?: string[];
  }): Promise<void> {
    const { name, createQuery, alterQueries } = typeMigration;

    try {
      if (await this.checkTypeExists(name)) {
        console.log(`Type ${name} already exists, skipping creation.`);
      } else {
        await this.getPool().query(createQuery);
        console.log(`Type ${name} created successfully.`);
      }

      if (alterQueries && alterQueries.length > 0) {
        for (const query of alterQueries) {
          try {
            await this.getPool().query(query);
            console.log(`Type alteration applied: ${query}`);
          } catch (err) {
            console.error(`Error applying type alteration: ${query}`, err);
            throw err;
          }
        }
      }
    } catch (err) {
      console.error(`Error during type migration ${name}`, err);
      throw err;
    }
  }


  private static async alterTable(
    tableName: string,
    alterQueries: string[],
  ): Promise<void> {
    for (const query of alterQueries) {
      try {
        if (query.startsWith("ALTER TABLE") && query.includes("ADD COLUMN")) {
          const matches = query.match(/ALTER TABLE (\w+) ADD COLUMN (\w+)/);
          if (matches) {
            const columnName = matches[2];
            const exists = await this.columnExists(tableName, columnName);
            if (exists) {
              console.log(
                `Column ${columnName} already exists in table ${tableName}, skipping ALTER query.`,
              );
              continue; // Skip to next query
            }
          }
        }
        await this.getPool().query(query);
        console.log(`Query executed successfully: ${query}`);
      } catch (err) {
        console.error(
          `Error executing query ${query} for table ${tableName}`,
          err,
        );
        throw err;
      }
    }
  }

  static async checkTableExists(tableName: string): Promise<boolean> {
    const query = `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = $1`;
    try {
      const result = await this.getPool().query(query, [tableName]);
      return result.rows[0].count > 0;
    } catch (err) {
      console.error(`Error checking if table ${tableName} exists`, err);
      throw err;
    }
  }

  static async createTable(query: string): Promise<void> {
    try {
      await this.getPool().query(query);
      console.log("Table created successfully");
    } catch (err) {
      console.error("Error creating table", err);
      throw err;
    }
  }

  static async dropColumn(
    tableName: string,
    columnName: string,
  ): Promise<void> {
    try {
      const exists = await this.columnExists(tableName, columnName);
      if (exists) {
        const query = `ALTER TABLE ${tableName} DROP COLUMN ${columnName}`;
        await this.getPool().query(query);
        console.log(`Column ${columnName} dropped from table ${tableName}`);
      } else {
        console.log(
          `Column ${columnName} does not exist in table ${tableName}`,
        );
      }
    } catch (err) {
      console.error(
        `Error dropping column ${columnName} from table ${tableName}`,
        err,
      );
      throw err;
    }
  }

  static async updateColumn(
    tableName: string,
    columnName: string,
    newType: string,
  ): Promise<void> {
    const query = `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} TYPE ${newType}`;
    try {
      await this.getPool().query(query);
      console.log(
        `Column ${columnName} updated to ${newType} in table ${tableName}`,
      );
    } catch (err) {
      console.error(
        `Error updating column ${columnName} to ${newType} in table ${tableName}`,
        err,
      );
      throw err;
    }
  }

  static async initializeTable(
    tableName: string,
    createTableQuery: string,
    alterQueries: string[] = [],
  ): Promise<void> {
    if (this.initializedTables.has(tableName)) {
      return;
    }

    try {
      const tableExists = await this.checkTableExists(tableName);
      if (!tableExists) {
        await this.createTable(createTableQuery);
        this.initializedTables.add(tableName);
        console.log(`Created table: ${tableName}`);
      } else {
        console.log(`${tableName} table already exists`);
        if (alterQueries.length > 0) {
          await this.alterTable(tableName, alterQueries);
        }
      }
    } catch (err) {
      console.error(`Error checking or creating ${tableName} table`, err);
      throw err;
    }
  }

  static async initializeAllTables(): Promise<void> {
    try {
      for (const table of tables) {
        await this.initializeTable(
          table.name,
          table.createQuery,
          table.alterQueries,
        );
      }
      console.log("All tables initialized successfully");
    } catch (err) {
      console.error("Error initializing tables", err);
      throw err;
    }
  }

  private static async ensureMigrationTable(): Promise<void> {
    const query = `
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                migration_name VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            );
        `;
    try {
      await this.getPool().query(query);
      console.log("Migration table ensured successfully");
    } catch (err) {
      console.error("Error ensuring migration table", err);
      throw err;
    }
  }

  private static async migrationExists(
    migrationName: string,
  ): Promise<boolean> {
    await this.ensureMigrationTable();
    const query = `
            SELECT EXISTS (
                SELECT 1 FROM migrations WHERE migration_name = $1
            ) AS exists
        `;
    try {
      const result = await this.getPool().query(query, [migrationName]);
      return result.rows[0].exists;
    } catch (err) {
      console.error(`Error checking if migration ${migrationName} exists`, err);
      throw err;
    }
  }

  private static async recordMigration(migrationName: string): Promise<void> {
    const query = `INSERT INTO migrations (migration_name) VALUES ($1)`;
    try {
      await this.getPool().query(query, [migrationName]);
      console.log(`Migration ${migrationName} recorded successfully`);
    } catch (err) {
      console.error(`Error recording migration ${migrationName}`, err);
      throw err;
    }
  }

  static async runMigration(migration: {
    name: string;
    createQuery?: string;
    alterQueries?: string[];
  }): Promise<void> {
    const { name, createQuery, alterQueries } = migration;

    try {
      if (await this.migrationExists(name)) {
        console.log(`Migration ${name} has already been applied, skipping.`);
        return;
      }

      const tableExists = await this.checkTableExists(name);

      if (createQuery && !tableExists) {
        await this.createTable(createQuery);
        console.log(`Table ${name} created successfully.`);
      } else if (tableExists) {
        console.log(`Table ${name} already exists, skipping creation.`);
      }

      if (alterQueries && alterQueries.length > 0) {
        await this.alterTable(name, alterQueries);
        console.log(`Alterations applied to ${name} successfully.`);
      }

      await this.recordMigration(name);
    } catch (err) {
      console.error(`Error during migration ${name}`, err);
      throw err;
    }
  }

  // Método para aplicar todas las migraciones, incluidas las de tipos ENUM
  static async runAllMigrations(
    migrations: {
      name: string;
      createQuery?: string;
      alterQueries?: string[];
      isEnum?: boolean;
    }[],
  ): Promise<void> {
    for (const migration of migrations) {
      if (migration.isEnum) {
        await this.runTypeMigration({
          name: migration.name,
          createQuery: migration.createQuery || "",
          alterQueries: migration.alterQueries || [],
        });
      } else {
        await this.runMigration(migration);
      }
    }
  }

  static async createMigrationFile(
    migrationName: string,
    migrationQuery: string,
  ): Promise<void> {
    const filePath = path.join(__dirname, "migrations", `${migrationName}.sql`);
    fs.writeFileSync(filePath, migrationQuery, "utf-8");
    console.log(`Migration file ${migrationName} created successfully`);
  }

  static async deleteMigrationFile(migrationFileName: string): Promise<void> {
    const filePath = path.join(
      __dirname,
      "migrations",
      `${migrationFileName}.sql`,
    );

    // Convertir el nombre del archivo al nombre de la tabla correspondiente
    // Ejemplo: "usuario_create_table" se convierte en "usuario"
    const tableName = migrationFileName.replace(
      /_create_table|_alter_\d+$/,
      "",
    );

    // Verificar y eliminar la tabla en la base de datos
    try {
      // Consulta para verificar si la tabla existe
      const checkTableQuery = `SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = $1
            ) AS exists`;

      console.log("check", checkTableQuery); // Para depuración

      const checkResult = await this.getPool().query(checkTableQuery, [
        tableName,
      ]);
      const tableExists = checkResult.rows[0].exists;

      if (tableExists) {
        const dropTableQuery = `DROP TABLE "${tableName}" CASCADE;`;
        await this.getPool().query(dropTableQuery);
        console.log(`Table ${tableName} fue eliminada de la base de datos.`);
      } else {
        console.log(`Table ${tableName} no existe en la base de datos.`);
      }
    } catch (err) {
      console.error(`Error al eliminar la tabla ${tableName}:`, err);
      throw err;
    }

    // Eliminar el archivo de migración si existe
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Migration file ${migrationFileName} fue eliminada.`);
      } else {
        console.log(`Migration file ${migrationFileName} no existe.`);
      }
    } catch (err) {
      console.error(
        `Error al eliminar el archivo de migración ${migrationFileName}:`,
        err,
      );
      throw err;
    }
  }

  
}
