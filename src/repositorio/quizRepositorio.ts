import { QueryResult } from "pg";
import { pool } from "../db/db-config";
import { generarIdUnico } from "../config/generar-id";
import { CustomError } from "../error/custom.error";

/**
 * Tipos DB (alineados a las tablas que te propuse)
 */
export interface QuizCategoryRow {
  key: string;
  context: "daily" | "school";
  order: number | null;
  is_active: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuizCategoryTranslationRow {
  id: number;
  category_key: string;
  context: "daily" | "school";
  locale: string;
  title: string;
  desc: string | null;
  badge: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestionRow {
  id: string;
  context: "daily" | "school";
  category_key: string;
  answer_index: number; // 0..3
  difficulty: number | null; // 1..5
  is_active: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestionTranslationRow {
  id: number;
  question_id: string;
  locale: string;
  question: string;
  choices: string[]; // length 4
  explanation: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuizDailySetRow {
  id: number;
  date_key: string; // YYYY-MM-DD
  locale: string;
  context: "daily" | "school";
  category_key: string;
  mode: "classic" | "fast" | "relaxed";
  limit_count: number;
  seed: number | null;
  question_ids: string[];
  createdAt: string;
  updatedAt: string;
}

type UpsertCategoryInput = {
  key: string;
  context?: "daily" | "school";
  order?: number;
  is_active?: boolean;
};

type UpsertCategoryTranslationInput = {
  category_key: string;
  context?: "daily" | "school";
  locale: string;
  title: string;
  desc?: string | null;
  badge?: string | null;
};

type UpsertQuestionInput = {
  id?: string;
  context?: "daily" | "school";
  category_key: string;
  answer_index: 0 | 1 | 2 | 3;
  difficulty?: number; // 1..5
  is_active?: boolean;
};

type UpsertQuestionTranslationInput = {
  question_id: string;
  locale: string;
  question: string;
  choices: [string, string, string, string] | string[];
  explanation?: string | null;
};

type CreateDailySetInput = {
  date_key: string;
  locale: string;
  context?: "daily" | "school";
  category_key: string;
  mode: "classic" | "fast" | "relaxed";
  limit_count?: number; // default 10
  seed?: number | null;
  question_ids: string[];
};

function ensure4Choices(choices: any): string[] {
  if (!Array.isArray(choices)) return ["A", "B", "C", "D"];
  const c = choices.map(String).slice(0, 4);
  while (c.length < 4) c.push("");
  return c;
}

export class QuizRepository {
  // =========================================================
  // CATEGORIES
  // =========================================================

  async upsertCategory(data: UpsertCategoryInput): Promise<QuizCategoryRow> {
    const ctx = data.context ?? "daily";
    const sql = `
      INSERT INTO quiz_category (key, context, "order", is_active)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (key, context) DO UPDATE SET
        "order" = EXCLUDED."order",
        is_active = EXCLUDED.is_active,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING key, context, "order", is_active, "createdAt", "updatedAt";
    `;

    try {
      const { rows } = await pool.query(sql, [
        data.key,
        ctx,
        data.order ?? 0,
        data.is_active ?? true,
      ]);
      return rows[0];
    } catch (err) {
      throw CustomError.internalServerError(
        `No se pudo upsert quiz_category: ${err}`,
      );
    }
  }

  async upsertCategoryTranslation(
    data: UpsertCategoryTranslationInput,
  ): Promise<QuizCategoryTranslationRow> {
    const ctx = data.context ?? "daily";
    const sql = `
      INSERT INTO quiz_category_translation
        (category_key, context, locale, title, "desc", badge)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (category_key, context, locale) DO UPDATE SET
        title = EXCLUDED.title,
        "desc" = EXCLUDED."desc",
        badge = EXCLUDED.badge,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING
        id, category_key, context, locale, title, "desc", badge, "createdAt", "updatedAt";
    `;

    try {
      const { rows } = await pool.query(sql, [
        data.category_key,
        ctx,
        data.locale,
        data.title,
        data.desc ?? null,
        data.badge ?? null,
      ]);
      return rows[0];
    } catch (err) {
      throw CustomError.internalServerError(
        `No se pudo upsert quiz_category_translation: ${err}`,
      );
    }
  }

  async getCategories(params: {
    locale: string;
    context?: "daily" | "school";
    onlyActive?: boolean;
  }) {
    const ctx = params.context ?? "daily";
    const onlyActive = params.onlyActive ?? true;

    const sql = `
      SELECT
        c.key,
        c.context,
        c."order",
        c.is_active,
        t.title,
        t."desc",
        t.badge
      FROM quiz_category c
      LEFT JOIN quiz_category_translation t
        ON t.category_key = c.key
       AND t.context = c.context
       AND t.locale = $2
      WHERE c.context = $1
        AND ($3::bool = false OR c.is_active = true)
      ORDER BY c."order" ASC, c.key ASC;
    `;

    return pool
      .query(sql, [ctx, params.locale, onlyActive])
      .then((r) =>
        r.rows.map((row) => ({
          key: String(row.key),
          title: String(row.title ?? row.key),
          desc: row.desc ? String(row.desc) : undefined,
          badge: row.badge ? String(row.badge) : undefined,
          is_active: row.is_active ?? true,
          order: row.order != null ? Number(row.order) : 0,
          context: row.context as "daily" | "school",
        })),
      )
      .catch((err) => {
        console.error("[DB:getCategories] Error:", err);
        throw CustomError.internalServerError(
          `No se pudo listar categorías quiz: ${err}`,
        );
      });
  }

  async existsCategory(key: string, context: "daily" | "school" = "daily") {
    const sql = `SELECT 1 FROM quiz_category WHERE key = $1 AND context = $2 LIMIT 1`;
    const { rows } = await pool.query(sql, [key, context]);
    return rows.length > 0;
  }

  // =========================================================
  // QUESTIONS
  // =========================================================

  async upsertQuestion(data: UpsertQuestionInput): Promise<QuizQuestionRow> {
    const ctx = data.context ?? "daily";
    const id = data.id ?? generarIdUnico(); // o usa tu propio prefijo q_...
    const sql = `
      INSERT INTO quiz_question
        (id, context, category_key, answer_index, difficulty, is_active)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO UPDATE SET
        context = EXCLUDED.context,
        category_key = EXCLUDED.category_key,
        answer_index = EXCLUDED.answer_index,
        difficulty = EXCLUDED.difficulty,
        is_active = EXCLUDED.is_active,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING
        id, context, category_key, answer_index, difficulty, is_active, "createdAt", "updatedAt";
    `;

    try {
      const { rows } = await pool.query(sql, [
        id,
        ctx,
        data.category_key,
        data.answer_index,
        data.difficulty ?? 1,
        data.is_active ?? true,
      ]);
      return rows[0];
    } catch (err) {
      throw CustomError.internalServerError(
        `No se pudo upsert quiz_question: ${err}`,
      );
    }
  }

  async upsertQuestionTranslation(
    data: UpsertQuestionTranslationInput,
  ): Promise<QuizQuestionTranslationRow> {
    const sql = `
      INSERT INTO quiz_question_translation
        (question_id, locale, question, choices, explanation)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (question_id, locale) DO UPDATE SET
        question = EXCLUDED.question,
        choices = EXCLUDED.choices,
        explanation = EXCLUDED.explanation,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING
        id, question_id, locale, question, choices, explanation, "createdAt", "updatedAt";
    `;

    const choices = ensure4Choices(data.choices);

    try {
      const { rows } = await pool.query(sql, [
        data.question_id,
        data.locale,
        data.question,
        choices,
        data.explanation ?? null,
      ]);
      return rows[0];
    } catch (err) {
      throw CustomError.internalServerError(
        `No se pudo upsert quiz_question_translation: ${err}`,
      );
    }
  }

  async existsQuestion(id: string) {
    const sql = `SELECT 1 FROM quiz_question WHERE id = $1 LIMIT 1`;
    const { rows } = await pool.query(sql, [id]);
    return rows.length > 0;
  }

  async getQuestionsByCategoryLocalized(params: {
    locale: string;
    context?: "daily" | "school";
    category_key: string;
    limit?: number;
    offset?: number;
    onlyActive?: boolean;
  }) {
    const ctx = params.context ?? "daily";
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    const onlyActive = params.onlyActive ?? true;

    const sql = `
      SELECT
        q.id,
        q.context,
        q.category_key,
        q.answer_index,
        q.difficulty,
        q.is_active,
        qt.question,
        qt.choices,
        qt.explanation
      FROM quiz_question q
      LEFT JOIN quiz_question_translation qt
        ON qt.question_id = q.id
       AND qt.locale = $2
      WHERE q.context = $1
        AND q.category_key = $3
        AND ($6::bool = false OR q.is_active = true)
      ORDER BY q."createdAt" DESC
      LIMIT $4 OFFSET $5;
    `;

    return pool
      .query(sql, [
        ctx,
        params.locale,
        params.category_key,
        limit,
        offset,
        onlyActive,
      ])
      .then((r) => r.rows)
      .catch((err) => {
        console.error("[DB:getQuestionsByCategoryLocalized] Error:", err);
        throw CustomError.internalServerError(
          `No se pudo listar preguntas: ${err}`,
        );
      });
  }

  // =========================================================
  // DAILY SET (cache del día)
  // - si existe, devuelves las mismas 10
  // - si no existe, lo insertas y listo
  // =========================================================

  async getDailySet(params: {
    date_key: string;
    locale: string;
    context?: "daily" | "school";
    category_key: string;
    mode: "classic" | "fast" | "relaxed";
  }): Promise<QuizDailySetRow | null> {
    const ctx = params.context ?? "daily";
    const sql = `
      SELECT
        id, date_key, locale, context, category_key, mode, limit_count, seed, question_ids,
        "createdAt", "updatedAt"
      FROM quiz_daily_set
      WHERE date_key = $1
        AND locale = $2
        AND context = $3
        AND category_key = $4
        AND mode = $5
      LIMIT 1;
    `;

    try {
      const { rows } = await pool.query(sql, [
        params.date_key,
        params.locale,
        ctx,
        params.category_key,
        params.mode,
      ]);
      return rows[0] || null;
    } catch (err) {
      throw CustomError.internalServerError(
        `No se pudo leer quiz_daily_set: ${err}`,
      );
    }
  }

  async createDailySet(data: CreateDailySetInput): Promise<QuizDailySetRow> {
    const ctx = data.context ?? "daily";
    const sql = `
      INSERT INTO quiz_daily_set
        (date_key, locale, context, category_key, mode, limit_count, seed, question_ids)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (date_key, locale, context, category_key, mode) DO UPDATE SET
        limit_count = EXCLUDED.limit_count,
        seed = EXCLUDED.seed,
        question_ids = EXCLUDED.question_ids,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING
        id, date_key, locale, context, category_key, mode, limit_count, seed, question_ids,
        "createdAt", "updatedAt";
    `;

    try {
      const { rows } = await pool.query(sql, [
        data.date_key,
        data.locale,
        ctx,
        data.category_key,
        data.mode,
        data.limit_count ?? 10,
        data.seed ?? null,
        data.question_ids,
      ]);
      return rows[0];
    } catch (err) {
      throw CustomError.internalServerError(
        `No se pudo crear quiz_daily_set: ${err}`,
      );
    }
  }

  /**
   * Devuelve las preguntas (con traducción) en el orden exacto del daily_set.
   * Importante: orden por array_position
   */
  async getQuestionsByIdsLocalized(params: { ids: string[]; locale: string }) {
    if (!params.ids?.length) return [];

    const sql = `
      SELECT
        q.id,
        q.context,
        q.category_key,
        q.answer_index,
        q.difficulty,
        q.is_active,
        qt.question,
        qt.choices,
        qt.explanation,
        array_position($2::text[], q.id) AS ord
      FROM quiz_question q
      LEFT JOIN quiz_question_translation qt
        ON qt.question_id = q.id
       AND qt.locale = $1
      WHERE q.id = ANY($2::text[])
      ORDER BY ord ASC NULLS LAST;
    `;

    return pool
      .query(sql, [params.locale, params.ids])
      .then((r) => r.rows)
      .catch((err) => {
        console.error("[DB:getQuestionsByIdsLocalized] Error:", err);
        throw CustomError.internalServerError(
          `No se pudo obtener preguntas por ids: ${err}`,
        );
      });
  }

  // =========================================================
  // UTILIDADES (admin/import)
  // =========================================================

  /**
   * Inserta en lote preguntas + traducciones (rápido para importar QUESTION_BANK)
   * Nota: esto asume que ya existen categorías.
   */
  async bulkInsertQuestions(data: {
    locale: string;
    context?: "daily" | "school";
    items: Array<{
      id?: string;
      category_key: string;
      question: string;
      choices: string[];
      answer_index: number;
      explanation?: string;
      difficulty?: number;
      is_active?: boolean;
    }>;
  }) {
    const ctx = data.context ?? "daily";

    // Transacción para consistencia
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const it of data.items) {
        const qid = it.id ?? generarIdUnico();

        await client.query(
          `
          INSERT INTO quiz_question
            (id, context, category_key, answer_index, difficulty, is_active)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (id) DO UPDATE SET
            context = EXCLUDED.context,
            category_key = EXCLUDED.category_key,
            answer_index = EXCLUDED.answer_index,
            difficulty = EXCLUDED.difficulty,
            is_active = EXCLUDED.is_active,
            "updatedAt" = CURRENT_TIMESTAMP
        `,
          [
            qid,
            ctx,
            it.category_key,
            Number(it.answer_index ?? 0),
            Number(it.difficulty ?? 1),
            it.is_active ?? true,
          ],
        );

        await client.query(
          `
          INSERT INTO quiz_question_translation
            (question_id, locale, question, choices, explanation)
          VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT (question_id, locale) DO UPDATE SET
            question = EXCLUDED.question,
            choices = EXCLUDED.choices,
            explanation = EXCLUDED.explanation,
            "updatedAt" = CURRENT_TIMESTAMP
        `,
          [
            qid,
            data.locale,
            it.question,
            ensure4Choices(it.choices),
            it.explanation ?? null,
          ],
        );
      }

      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      throw CustomError.internalServerError(
        `No se pudo bulkInsertQuestions: ${err}`,
      );
    } finally {
      client.release();
    }
  }
  // ✅ dentro de QuizRepository

  async getCategoriesLocalizedWithFallback(
    locale: string,
    context: "daily" | "school",
  ) {
    const sql = `
    SELECT
      c.key,
      c.context,
      c."order",
      c.is_active,
      COALESCE(tloc.title, tes.title, c.key) AS title,
      COALESCE(tloc."desc", tes."desc") AS "desc",
      COALESCE(tloc.badge, tes.badge) AS badge
    FROM quiz_category c
    LEFT JOIN quiz_category_translation tloc
      ON tloc.category_key = c.key
     AND tloc.context = c.context
     AND tloc.locale = $2
    LEFT JOIN quiz_category_translation tes
      ON tes.category_key = c.key
     AND tes.context = c.context
     AND tes.locale = 'es'
    WHERE c.context = $1
      AND c.is_active = TRUE
    ORDER BY c."order" ASC, c.key ASC
  `;
    const { rows } = await pool.query(sql, [context, locale]);
    return rows;
  }

  async listActiveQuestionIds(params: {
    context: "daily" | "school";
    category_key: string;
    locale: string;
  }) {
    const sql = `
    SELECT q.id
    FROM quiz_question q
    LEFT JOIN quiz_question_translation tloc
      ON tloc.question_id = q.id AND tloc.locale = $3
    LEFT JOIN quiz_question_translation tes
      ON tes.question_id = q.id AND tes.locale = 'es'
    WHERE q.context = $1
      AND q.category_key = $2
      AND q.is_active = TRUE
      AND (tloc.id IS NOT NULL OR tes.id IS NOT NULL)
    ORDER BY q.id ASC
  `;
    const { rows } = await pool.query(sql, [
      params.context,
      params.category_key,
      params.locale,
    ]);
    return rows.map((r) => String(r.id));
  }

  async getQuestionsByIdsLocalizedWithFallback(locale: string, ids: string[]) {
    if (!ids?.length) return [];

    const sql = `
    SELECT
      q.id,
      q.context,
      q.category_key,
      q.answer_index,
      q.difficulty,
      q.is_active,
      q."createdAt",
      COALESCE(tloc.question, tes.question, '') AS question,
      COALESCE(tloc.choices, tes.choices, ARRAY['A','B','C','D']::text[]) AS choices,
      COALESCE(tloc.explanation, tes.explanation) AS explanation,
      array_position($2::text[], q.id) AS ord
    FROM quiz_question q
    LEFT JOIN quiz_question_translation tloc
      ON tloc.question_id = q.id AND tloc.locale = $1
    LEFT JOIN quiz_question_translation tes
      ON tes.question_id = q.id AND tes.locale = 'es'
    WHERE q.id = ANY($2::text[])
    ORDER BY ord ASC NULLS LAST
  `;
    const { rows } = await pool.query(sql, [locale, ids]);
    return rows;
  }
  // ==============================
  // TRANSLATIONS: CATEGORY
  // ==============================
  async existsCategoryTranslation(
    category_key: string,
    context: "daily" | "school" = "daily",
    locale: string,
  ): Promise<boolean> {
    const sql = `
    SELECT 1
    FROM quiz_category_translation
    WHERE category_key = $1 AND context = $2 AND locale = $3
    LIMIT 1
  `;
    const { rows } = await pool.query(sql, [category_key, context, locale]);
    return rows.length > 0;
  }

  async getCategoryTranslation(
    category_key: string,
    context: "daily" | "school" = "daily",
    locale: string,
  ): Promise<{
    title: string;
    desc: string | null;
    badge: string | null;
  } | null> {
    const sql = `
    SELECT title, "desc", badge
    FROM quiz_category_translation
    WHERE category_key = $1 AND context = $2 AND locale = $3
    LIMIT 1
  `;
    const { rows } = await pool.query(sql, [category_key, context, locale]);
    return rows[0] || null;
  }

  // ==============================
  // TRANSLATIONS: QUESTION
  // ==============================
  async existsQuestionTranslation(
    question_id: string,
    locale: string,
  ): Promise<boolean> {
    const sql = `
    SELECT 1
    FROM quiz_question_translation
    WHERE question_id = $1 AND locale = $2
    LIMIT 1
  `;
    const { rows } = await pool.query(sql, [question_id, locale]);
    return rows.length > 0;
  }

  async getQuestionTranslation(
    question_id: string,
    locale: string,
  ): Promise<{
    question: string;
    choices: string[];
    explanation: string | null;
  } | null> {
    const sql = `
    SELECT question, choices, explanation
    FROM quiz_question_translation
    WHERE question_id = $1 AND locale = $2
    LIMIT 1
  `;
    const { rows } = await pool.query(sql, [question_id, locale]);
    if (!rows[0]) return null;

    return {
      question: String(rows[0].question ?? ""),
      choices: ensure4Choices(rows[0].choices),
      explanation: rows[0].explanation ?? null,
    };
  }
}
