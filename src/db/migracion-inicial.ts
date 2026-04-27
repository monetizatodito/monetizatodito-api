import { DatabaseInitializers } from "./migrate-db";

const createMigrationsTableMigration = {
  name: "migrations",
  createQuery: `
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `,
  alterQueries: [], // No hay consultas ALTER necesarias aquí
};

async function applyInitialMigration() {
  try {
    await DatabaseInitializers.runMigration(createMigrationsTableMigration);
    console.log("Migration table created successfully");
  } catch (error) {
    console.error("Error creating migration table:", error);
    process.exit(1); // Salida con error
  }
}

applyInitialMigration().catch((err) => {
  console.error("Error in initial migration process:", err);
  process.exit(1); // Salida con error
});
