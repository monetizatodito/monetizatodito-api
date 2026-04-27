import { DatabaseInitializers } from "./migrate-db";
import { tables } from "./tabla";

async function main() {
  try {
    // Inicializar todas las tablas
    await DatabaseInitializers.initializeAllTables();

    // Ejecutar todas las migraciones (si es necesario)
    const migrations = tables.map((table) => ({
      name: table.name,
      createQuery: table.createQuery,
      alterQueries: table.alterQueries || [],
    }));

    // Crear archivos de migración y luego ejecutarlos
    for (const migration of migrations) {
      const { name, createQuery, alterQueries } = migration;

      // Solo proceder si `name` tiene un valor
      if (name) {
        // Crear archivo de migración para la creación de tabla si existe
        if (createQuery) {
          await DatabaseInitializers.createMigrationFile(
            `${name}_create_table`,
            createQuery
          );
        }

        // Crear archivos de migración para cada consulta ALTER
        for (let i = 0; i < alterQueries.length; i++) {
          const alterQuery = alterQueries[i];
          await DatabaseInitializers.createMigrationFile(
            `${name}_alter_${i + 1}`,
            alterQuery
          );
        }
      }
    }

    // Ejecutar las migraciones
    await DatabaseInitializers.runAllMigrations(migrations);

    // Eliminar archivos de migración después de ejecutarlas
    for (const migration of migrations) {
      const { name, createQuery, alterQueries } = migration;
      const nombre = " migrate";

      // Solo proceder si `name` tiene un valor
      if (nombre) {
        // Eliminar archivo de migración para la creación de tabla si existe
        if (createQuery) {
          await DatabaseInitializers.deleteMigrationFile(
            `${nombre}_create_table`
          );
        }

        // Eliminar archivos de migración para cada consulta ALTER
        for (let i = 0; i < alterQueries.length; i++) {
          await DatabaseInitializers.deleteMigrationFile(
            `${nombre}_alter_${i + 1}`
          );
        }
      }
    }

    console.log("Migrations completed and files deleted successfully!");
  } catch (error) {
    console.error("Error during migration process:", error);
    process.exit(1); // Salir con un código de error si algo falla
  }
}

main();
