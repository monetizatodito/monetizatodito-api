import "dotenv/config";
import { pool } from "./db-config"; // ✅ ajusta si tu ruta es diferente
import { seedQuizCategories } from "../presentation/quiz/quiz.seed";

async function main() {
  try {
    console.log("[seed-quiz] iniciando...");
    await seedQuizCategories();
    console.log("[seed-quiz] listo ✅");
    process.exitCode = 0;
  } catch (err) {
    console.error("[seed-quiz] error ❌", err);
    process.exitCode = 1;
  } finally {
    // ✅ para que el proceso no se quede colgado por la conexión de PG
    await pool.end().catch(() => {});
  }
}

main();
