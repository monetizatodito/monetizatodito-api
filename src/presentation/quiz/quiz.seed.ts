import { QuizRepository } from "../../repositorio/quizRepositorio";

// 🔥 Tus categorías "core" (antes eran estáticas en el service)
const DAILY_CATS_ES = [
  {
    key: "general",
    title: "Cultura General",
    desc: "Variadas para calentar.",
    badge: "Daily",
    order: 1,
    is_active: true,
  },
  {
    key: "historia",
    title: "Historia",
    desc: "Fechas, personajes y eventos.",
    badge: "Time",
    order: 2,
    is_active: true,
  },
  {
    key: "ciencia",
    title: "Ciencia",
    desc: "Naturaleza, tecnología y datos.",
    badge: "Lab",
    order: 3,
    is_active: true,
  },
  {
    key: "geografia",
    title: "Geografía",
    desc: "Países, capitales y mapas.",
    badge: "Map",
    order: 4,
    is_active: true,
  },
  {
    key: "entretenimiento",
    title: "Entretenimiento",
    desc: "Cine, música y series.",
    badge: "Pop",
    order: 5,
    is_active: true,
  },
  {
    key: "matematicas",
    title: "Matemáticas",
    desc: "Cálculo mental rápido.",
    badge: "Math",
    order: 6,
    is_active: true,
  },
];

// ✅ Ejemplo “school” (grados)
const SCHOOL_CATS_ES = [
  {
    key: "g1",
    title: "Primer grado",
    desc: "Preguntas para estudiantes de 1er grado",
    badge: "Grado 1",
    order: 1,
    is_active: true,
  },
  {
    key: "g2",
    title: "Segundo grado",
    desc: "Preguntas para estudiantes de 2do grado",
    badge: "Grado 2",
    order: 2,
    is_active: true,
  },
  {
    key: "g3",
    title: "Tercer grado",
    desc: "Preguntas para estudiantes de 3er grado",
    badge: "Grado 3",
    order: 3,
    is_active: true,
  },
];

type Cat = {
  key: string;
  title: string;
  desc?: string;
  badge?: string;
  order?: number;
  is_active?: boolean;
};

export async function seedQuizCategories() {
  const repo = new QuizRepository();

  // ⚠️ IMPORTANTE: idempotente y “no pisa traducciones” si ya existen
  async function seedOne(context: "daily" | "school", cats: Cat[]) {
    for (const c of cats) {
      // crea/actualiza base category
      await repo.upsertCategory({
        key: c.key,
        context,
        order: c.order ?? 0,
        is_active: c.is_active ?? true,
      });

      // solo inserta traducción ES si NO existe (para no pisar cambios del admin)
      const existsEs = await repo.existsCategoryTranslation(
        c.key,
        context,
        "es",
      );
      if (!existsEs) {
        await repo.upsertCategoryTranslation({
          category_key: c.key,
          context,
          locale: "es",
          title: c.title,
          desc: c.desc ?? null,
          badge: c.badge ?? null,
        });
      }
    }
  }

  await seedOne("daily", DAILY_CATS_ES);
  await seedOne("school", SCHOOL_CATS_ES);

  console.log("[seedQuizCategories] OK");
}
