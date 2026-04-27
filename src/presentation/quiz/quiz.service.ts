// src/service/quiz/quiz.service.ts
import { generarIdUnico, validarIdUnico } from "../../config/generar-id";
import { CustomError } from "../../error/custom.error";
import { QuizRepository } from "../../repositorio/quizRepositorio";

import type { Locale, TranslatableLocale } from "../../util/slug";
import { translateText } from "../traductor/translator.service";

/** ================== Config de locales ================== */
const DEFAULT_LOCALES: TranslatableLocale[] = ["en", "pt", "fr", "de", "ar"];

function parseTargetsFromEnv(): TranslatableLocale[] {
  const raw = process.env.TRANSLATE_TARGETS?.trim();
  if (!raw) return DEFAULT_LOCALES;

  const arr = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as TranslatableLocale[];

  return arr.length ? arr : DEFAULT_LOCALES;
}

const LOCALES: TranslatableLocale[] = parseTargetsFromEnv();
/** ======================================================= */

type QuizContext = "daily" | "school";
type QuizMode = "classic" | "fast" | "relaxed";

export type QuizCategoryItem = {
  key: string;
  title: string;
  desc?: string;
  badge?: string;
  is_active?: boolean;
  order?: number;
};

export type QuizQuestionDTO = {
  id: string;
  context: QuizContext;
  category_key: string;
  question: string;
  choices: string[];
  answer_index: number; // 0..3
  explanation?: string;
  difficulty?: number; // 1..5
  is_active?: boolean;
  created_at?: string;
};

function ensure4Choices(choices: any): string[] {
  if (!Array.isArray(choices)) return ["A", "B", "C", "D"];
  const c = choices.map(String).slice(0, 4);
  while (c.length < 4) c.push("");
  return c;
}

/** ================== Random determinista (igual que frontend) ================== */
function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: number) {
  const a = [...arr];
  const rnd = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** ============================================================================ */

export class QuizService {
  private quizRepositorio = new QuizRepository();

  constructor() {}

  // =========================================================
  // PUBLIC API (frontend)
  // =========================================================

  public async getQuizCategories(
    locale: Locale,
    context: QuizContext = "daily",
  ) {
    // 1) DB
    const rows = await this.quizRepositorio.getCategoriesLocalizedWithFallback(
      locale,
      context,
    );

    const dbCats: QuizCategoryItem[] = (rows ?? []).map((r: any) => ({
      key: String(r.key),
      title: String(r.title ?? r.key),
      desc: r.desc ? String(r.desc) : undefined,
      badge: r.badge ? String(r.badge) : undefined,
      is_active: r.is_active ?? true,
      order: r.order != null ? Number(r.order) : 0,
    }));

    // 2) fallback (estático)
    const fallback = this.getDefaultCategoriesFallback(context);

    // 3) merge (fallback primero, DB sobrescribe)
    const map = new Map<string, QuizCategoryItem>();

    for (const f of fallback) map.set(f.key, f);

    for (const d of dbCats) {
      const prev = map.get(d.key);
      map.set(d.key, { ...prev, ...d });
    }

    // 4) lista final (activos) y orden
    return [...map.values()]
      .filter((c) => c.is_active !== false)
      .sort(
        (a, b) =>
          (a.order ?? 0) - (b.order ?? 0) ||
          String(a.title).localeCompare(String(b.title)),
      );
  }

  // 👇 cambia tu fallback para que dependa del context
  private getDefaultCategoriesFallback(
    context: QuizContext,
  ): QuizCategoryItem[] {
    if (context === "school") {
      // si quieres fallback de school, ponlo aquí; si no, vacío.
      return [];
    }

    // daily (como ya lo tenías)
    return [
      {
        key: "general",
        title: "Cultura General",
        desc: "Variadas para calentar.",
        badge: "Daily",
        is_active: true,
        order: 1,
      },
      {
        key: "historia",
        title: "Historia",
        desc: "Fechas, personajes y eventos.",
        badge: "Time",
        is_active: true,
        order: 2,
      },
      {
        key: "ciencia",
        title: "Ciencia",
        desc: "Naturaleza, tecnología y datos.",
        badge: "Lab",
        is_active: true,
        order: 3,
      },
      {
        key: "geografia",
        title: "Geografía",
        desc: "Países, capitales y mapas.",
        badge: "Map",
        is_active: true,
        order: 4,
      },
      {
        key: "entretenimiento",
        title: "Entretenimiento",
        desc: "Cine, música y series.",
        badge: "Pop",
        is_active: true,
        order: 5,
      },
      {
        key: "matematicas",
        title: "Matemáticas",
        desc: "Cálculo mental rápido.",
        badge: "Math",
        is_active: true,
        order: 6,
      },
    ];
  }

  public async getDailyQuestions(params: {
    locale: Locale;
    dateKey: string; // YYYY-MM-DD
    category: string;
    mode: QuizMode;
    context?: QuizContext;
    limit?: number;
  }): Promise<QuizQuestionDTO[]> {
    const ctx = params.context ?? "daily";
    const limit = params.limit ?? 10;

    // 1) si ya existe daily_set => usarlo
    const existing = await this.quizRepositorio.getDailySet({
      date_key: params.dateKey,
      locale: params.locale,
      context: ctx,
      category_key: params.category,
      mode: params.mode,
    });

    if (existing?.question_ids?.length) {
      const rows =
        await this.quizRepositorio.getQuestionsByIdsLocalizedWithFallback(
          params.locale,
          existing.question_ids,
        );

      return rows.slice(0, limit).map((row: any) => ({
        id: row.id,
        context: row.context,
        category_key: row.category_key,
        question: row.question,
        choices: ensure4Choices(row.choices),
        answer_index: Number(row.answer_index ?? 0),
        explanation: row.explanation ?? undefined,
        difficulty: row.difficulty ?? 1,
        is_active: row.is_active ?? true,
        created_at: row.createdAt,
      }));
    }

    // 2) no existe: generar determinista con seed (igual que frontend)
    const seed = hashSeed(
      `${params.dateKey}:${params.category}:${params.mode}`,
    );
    const idsCategory = await this.quizRepositorio.listActiveQuestionIds({
      context: ctx,
      category_key: params.category,
      locale: params.locale,
    });

    // shuffle determinista
    let picked = seededShuffle(idsCategory, seed).slice(0, limit);

    // 3) si no alcanza, rellena con general
    if (picked.length < limit) {
      const idsGeneral = await this.quizRepositorio.listActiveQuestionIds({
        context: ctx,
        category_key: "general",
        locale: params.locale,
      });

      const fill = seededShuffle(idsGeneral, seed ^ 0x9e3779b9).slice(
        0,
        limit - picked.length,
      );

      picked = [...picked, ...fill];
    }

    // si sigue corto, devuelve lo que haya (sin romper)
    const finalIds = picked.slice(0, limit);

    // 4) guardar daily_set (cache del día)
    await this.quizRepositorio.createDailySet({
      date_key: params.dateKey,
      locale: params.locale,
      context: ctx,
      category_key: params.category,
      mode: params.mode,
      limit_count: limit,
      seed,
      question_ids: finalIds,
    });

    // 5) devolver preguntas localizadas con fallback a ES
    const rows =
      await this.quizRepositorio.getQuestionsByIdsLocalizedWithFallback(
        params.locale,
        finalIds,
      );

    return rows.slice(0, limit).map((row: any) => ({
      id: row.id,
      context: row.context,
      category_key: row.category_key,
      question: row.question,
      choices: ensure4Choices(row.choices),
      answer_index: Number(row.answer_index ?? 0),
      explanation: row.explanation ?? undefined,
      difficulty: row.difficulty ?? 1,
      is_active: row.is_active ?? true,
      created_at: row.createdAt,
    }));
  }

  // =========================================================
  // ADMIN (crear ES y traducir)
  // =========================================================

  /** Crea categoría ES y lanza traducciones si ENABLE_TRANSLATOR=true */
  public async createCategoryESOnly(dto: {
    key: string;
    context?: QuizContext;
    order?: number;
    is_active?: boolean;

    // textos ES:
    title: string;
    desc?: string;
    badge?: string;
  }) {
    const ctx = dto.context ?? "daily";

    // base row (sin textos)
    await this.quizRepositorio.upsertCategory({
      key: dto.key,
      context: ctx,
      order: dto.order ?? 0,
      is_active: dto.is_active ?? true,
    });

    // ES translation
    await this.quizRepositorio.upsertCategoryTranslation({
      category_key: dto.key,
      context: ctx,
      locale: "es",
      title: dto.title,
      desc: dto.desc ?? null,
      badge: dto.badge ?? null,
    });

    // background translate
    if (process.env.ENABLE_TRANSLATOR === "true") {
      (async () => {
        try {
          await this.translateCategoryInBackground(
            { key: dto.key, context: ctx },
            { title: dto.title, desc: dto.desc ?? "", badge: dto.badge ?? "" },
            LOCALES,
          );
        } catch (e) {
          console.error("[quiz-translate-category-bg] fallo:", e);
        }
      })();
    }

    return { ok: true };
  }

  /** Crea pregunta ES y lanza traducciones si ENABLE_TRANSLATOR=true */
  public async createQuestionESOnly(dto: {
    id?: string;
    context?: QuizContext;
    category_key: string;
    answer_index: 0 | 1 | 2 | 3;
    difficulty?: number;
    is_active?: boolean;

    // textos ES
    question: string;
    choices: [string, string, string, string] | string[];
    explanation?: string;
  }) {
    const id = dto.id ?? generarIdUnico();
    const ctx = dto.context ?? "daily";

    // base
    await this.quizRepositorio.upsertQuestion({
      id,
      context: ctx,
      category_key: dto.category_key,
      answer_index: dto.answer_index,
      difficulty: dto.difficulty ?? 1,
      is_active: dto.is_active ?? true,
    });

    // ES translation
    await this.quizRepositorio.upsertQuestionTranslation({
      question_id: id,
      locale: "es",
      question: dto.question,
      choices: ensure4Choices(dto.choices),
      explanation: dto.explanation ?? null,
    });

    // background translate
    if (process.env.ENABLE_TRANSLATOR === "true") {
      (async () => {
        try {
          await this.translateQuestionInBackground(
            { id, context: ctx, category_key: dto.category_key },
            {
              question: dto.question,
              choices: ensure4Choices(dto.choices),
              explanation: dto.explanation ?? "",
            },
            LOCALES,
          );
        } catch (e) {
          console.error("[quiz-translate-question-bg] fallo:", e);
        }
      })();
    }

    return { ok: true, id };
  }

  // =========================================================
  // BACKGROUND TRANSLATION (reusa el traductor del blog)
  // =========================================================

  private async translateCategoryInBackground(
    category: { key: string; context: QuizContext },
    base: { title: string; desc: string; badge: string },
    locales: TranslatableLocale[],
  ) {
    for (const loc of locales) {
      try {
        const tTitle = await translateText(base.title, loc);
        const tDesc = base.desc ? await translateText(base.desc, loc) : "";
        const tBadge = base.badge ? await translateText(base.badge, loc) : "";

        await this.quizRepositorio.upsertCategoryTranslation({
          category_key: category.key,
          context: category.context,
          locale: loc,
          title: tTitle,
          desc: tDesc || null,
          badge: tBadge || null,
        });

        console.log(`[quiz-translate] category ${category.key} -> ${loc} OK`);
      } catch (err) {
        console.error(
          `[quiz-translate] category ${category.key} -> ${loc} falló:`,
          err,
        );
      }
    }
  }

  private async translateQuestionInBackground(
    q: { id: string; context: QuizContext; category_key: string },
    base: { question: string; choices: string[]; explanation: string },
    locales: TranslatableLocale[],
  ) {
    for (const loc of locales) {
      try {
        const tQuestion = await translateText(base.question, loc);

        const tChoices: string[] = [];
        for (const ch of ensure4Choices(base.choices)) {
          tChoices.push(ch ? await translateText(ch, loc) : "");
        }

        const tExplanation = base.explanation
          ? await translateText(base.explanation, loc)
          : null;

        await this.quizRepositorio.upsertQuestionTranslation({
          question_id: q.id,
          locale: loc,
          question: tQuestion,
          choices: ensure4Choices(tChoices),
          explanation: tExplanation,
        });

        console.log(`[quiz-translate] question ${q.id} -> ${loc} OK`);
      } catch (err) {
        console.error(
          `[quiz-translate] question ${q.id} -> ${loc} falló:`,
          err,
        );
      }
    }
  }

  // =========================================================
  // FALLBACKS (si DB está vacío)
  // =========================================================

  public async translateCategoryByKey(
    key: string,
    context: "daily" | "school",
    locales?: TranslatableLocale[],
    force: boolean = false,
  ) {
    if (process.env.ENABLE_TRANSLATOR !== "true") {
      throw CustomError.badRequest(
        "Traductor desactivado (ENABLE_TRANSLATOR != true)",
      );
    }

    // lee ES base
    const base = await this.quizRepositorio.getCategoryTranslation(
      key,
      context,
      "es",
    );
    if (!base) throw CustomError.notFound("Categoría ES no encontrada");

    const targets =
      locales && locales.length
        ? locales
        : (["en", "pt", "fr", "de", "ar"] as TranslatableLocale[]);
    let done = 0;

    for (const loc of targets) {
      try {
        if (!force) {
          const exists = await this.quizRepositorio.existsCategoryTranslation(
            key,
            context,
            loc,
          );
          if (exists) {
            done++;
            continue;
          }
        }

        const tTitle = await translateText(base.title, loc);
        const tDesc = base.desc ? await translateText(base.desc, loc) : null;
        const tBadge = base.badge ? await translateText(base.badge, loc) : null;

        await this.quizRepositorio.upsertCategoryTranslation({
          category_key: key,
          context,
          locale: loc,
          title: tTitle,
          desc: tDesc,
          badge: tBadge,
        });

        done++;
      } catch (e) {
        console.error(
          `[quiz.translateCategoryByKey] ${key} -> ${loc} falló:`,
          e,
        );
      }
    }

    return { ok: true, key, context, count: done, locales: targets };
  }
  public async translateQuestionById(
    id: string,
    locales?: TranslatableLocale[],
    force: boolean = false,
  ) {
    if (process.env.ENABLE_TRANSLATOR !== "true") {
      throw CustomError.badRequest(
        "Traductor desactivado (ENABLE_TRANSLATOR != true)",
      );
    }

    // ✅ lee ES base
    const base = await this.quizRepositorio.getQuestionTranslation(id, "es");
    if (!base) throw CustomError.notFound("Pregunta ES no encontrada");

    const targets =
      locales && locales.length
        ? locales
        : (["en", "pt", "fr", "de", "ar"] as TranslatableLocale[]);

    let done = 0;

    for (const loc of targets) {
      try {
        if (!force) {
          const exists = await this.quizRepositorio.existsQuestionTranslation(
            id,
            loc,
          );
          if (exists) {
            done++;
            continue;
          }
        }

        const tQuestion = await translateText(base.question, loc);

        const tChoices: string[] = [];
        for (const ch of ensure4Choices(base.choices)) {
          tChoices.push(ch ? await translateText(ch, loc) : "");
        }

        const tExplanation = base.explanation
          ? await translateText(base.explanation, loc)
          : null;

        await this.quizRepositorio.upsertQuestionTranslation({
          question_id: id,
          locale: loc,
          question: tQuestion,
          choices: ensure4Choices(tChoices),
          explanation: tExplanation,
        });

        done++;
      } catch (e) {
        console.error(`[quiz.translateQuestionById] ${id} -> ${loc} falló:`, e);
      }
    }

    return { ok: true, id, count: done, locales: targets };
  }
}
