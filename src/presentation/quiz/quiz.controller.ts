// src/presentation/quiz/quiz.controller.ts
import { Request, Response } from "express";
import { CustomError } from "../../error/custom.error";
import { TranslatableLocale } from "../../util/slug";
import { pickLocale } from "../../helpers/locale";
import { QuizService } from "./quiz.service";
import { translateText } from "../traductor/translator.service";
import { QuizRepository } from "../../repositorio/quizRepositorio";

const ALLOWED_LOCALES = ["es", "en", "pt", "fr", "de", "ar"] as const;
type Locale = (typeof ALLOWED_LOCALES)[number];

const DEFAULT_LOCALES: TranslatableLocale[] = ["en", "pt", "fr", "de", "ar"];

function decodeParamSafe(s: unknown) {
  try {
    return decodeURIComponent(String(s ?? ""));
  } catch {
    return String(s ?? "");
  }
}

function normalizeLocaleFromReq(req: Request): Locale {
  const qLocale = String(req.query.locale || req.headers["x-locale"] || "es")
    .toLowerCase()
    .trim();

  return (ALLOWED_LOCALES as readonly string[]).includes(qLocale)
    ? (qLocale as Locale)
    : "es";
}

function ensure4Choices(choices: any): string[] {
  if (!Array.isArray(choices)) return ["A", "B", "C", "D"];
  const c = choices.map(String).slice(0, 4);
  while (c.length < 4) c.push("");
  return c;
}

function normalizeContext(v: any): "daily" | "school" {
  const s = String(v ?? "daily")
    .toLowerCase()
    .trim();
  return s === "school" ? "school" : "daily";
}

function normalizeMode(v: any): "classic" | "fast" | "relaxed" {
  const s = String(v ?? "classic")
    .toLowerCase()
    .trim();
  if (s === "fast") return "fast";
  if (s === "relaxed") return "relaxed";
  return "classic";
}

function parseLimit(v: any, def = 10) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(50, Math.floor(n));
}

function parseLocalesFromBody(body: any): TranslatableLocale[] {
  const raw = Array.isArray(body?.locales) ? body.locales : [];
  const cleaned = raw
    .map((l: any) => String(l).toLowerCase().trim())
    .filter(Boolean) as TranslatableLocale[];

  return cleaned.length ? cleaned : DEFAULT_LOCALES;
}

export class QuizControlador {
  constructor(
    private readonly quizService: QuizService,
    private readonly quizRepositorio: QuizRepository,
  ) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.log(`${error}`);
    return res.status(500).json({ error: "Internal server error" });
  };

  // =========================
  // GET /quiz/categories?locale=es&context=daily
  // =========================
  getCategories = (req: Request, res: Response) => {
    const locale = normalizeLocaleFromReq(req);
    const context = normalizeContext(req.query.context);

    this.quizService
      .getQuizCategories(locale, context)
      .then((rows) => {
        res.set("Vary", "x-locale, Accept-Language");
        return res.json({ rows });
      })
      .catch((err) => this.handleError(err, res));
  };

  // =========================
  // GET /quiz/daily-questions?locale=es&date=YYYY-MM-DD&category=general&mode=classic&limit=10&context=daily
  // =========================
  getDailyQuestions = (req: Request, res: Response) => {
    const locale = normalizeLocaleFromReq(req);
    const context = normalizeContext(req.query.context);

    const dateKey = String(req.query.date || "").trim();
    const categoryRaw = req.query.category;
    const category = decodeParamSafe(categoryRaw).trim();
    const mode = normalizeMode(req.query.mode);
    const limit = parseLimit(req.query.limit, 10);

    if (!dateKey)
      return res.status(400).json({ error: "date requerido (YYYY-MM-DD)" });
    if (!category) return res.status(400).json({ error: "category requerido" });

    this.quizService
      .getDailyQuestions({
        locale,
        dateKey,
        category,
        mode,
        context,
        limit,
      })
      .then((rows) => {
        res.set("Vary", "x-locale, Accept-Language");
        return res.json({ rows });
      })
      .catch((err) => this.handleError(err, res));
  };

  // =========================
  // POST /quiz/category
  // body: { key, title, desc?, badge?, context?, order?, is_active?, autoTranslate?, locales? }
  // =========================
  createCategory = (req: Request, res: Response) => {
    const body = req.body ?? {};
    const key = String(body.key ?? "").trim();
    const title = String(body.title ?? "").trim();

    if (!key) return res.status(400).json({ error: "key requerido" });
    if (!title) return res.status(400).json({ error: "title requerido" });

    const context = normalizeContext(body.context);
    const order = body.order != null ? Number(body.order) : 0;
    const is_active = body.is_active != null ? !!body.is_active : true;

    const dto = {
      key,
      title,
      desc: body.desc ? String(body.desc) : undefined,
      badge: body.badge ? String(body.badge) : undefined,
      context,
      order: Number.isFinite(order) ? order : 0,
      is_active,
    };

    const willTranslate = !!body.autoTranslate;
    const locales = willTranslate ? parseLocalesFromBody(body) : [];

    this.quizService
      .createCategoryESOnly(dto)
      .then((result) => {
        // respuesta inmediata
        res.status(201).json({
          ok: true,
          category_key: key,
          translating: willTranslate ? locales : [],
        });

        // fire-and-forget (no bloquea)
        if (willTranslate) {
          setImmediate(() => {
            this.quizService
              .translateCategoryByKey(key, context, locales, false)
              .catch((e) => console.error("[quiz-translate-bg] category:", e));
          });
        }

        return result;
      })
      .catch((err) => this.handleError(err, res));
  };

  // =========================
  // POST /quiz/question
  // body: { id?, context?, category_key, question, choices[4], answer_index(0..3), explanation?, difficulty?, is_active?, autoTranslate?, locales? }
  // =========================
  createQuestion = (req: Request, res: Response) => {
    const body = req.body ?? {};
    const context = normalizeContext(body.context);

    const id = body.id ? String(body.id).trim() : undefined;
    const category_key = String(body.category_key ?? "").trim();
    const question = String(body.question ?? "").trim();

    const choices = Array.isArray(body.choices) ? body.choices.map(String) : [];
    const answer_index = Number(body.answer_index);

    if (!category_key)
      return res.status(400).json({ error: "category_key requerido" });
    if (!question) return res.status(400).json({ error: "question requerido" });
    if (choices.length < 4)
      return res.status(400).json({ error: "choices debe tener 4 opciones" });
    if (![0, 1, 2, 3].includes(answer_index)) {
      return res.status(400).json({ error: "answer_index inválido (0..3)" });
    }

    const difficulty = body.difficulty != null ? Number(body.difficulty) : 1;
    const is_active = body.is_active != null ? !!body.is_active : true;

    const dto = {
      id,
      context,
      category_key,
      question,
      choices: choices.slice(0, 4),
      answer_index: answer_index as 0 | 1 | 2 | 3,
      explanation: body.explanation ? String(body.explanation) : undefined,
      difficulty: Number.isFinite(difficulty) ? difficulty : 1,
      is_active,
    };

    const willTranslate = !!body.autoTranslate;
    const locales = willTranslate ? parseLocalesFromBody(body) : [];

    this.quizService
      .createQuestionESOnly(dto)
      .then(({ id: createdId }) => {
        res.status(201).json({
          ok: true,
          id: createdId,
          translating: willTranslate ? locales : [],
        });

        if (willTranslate) {
          setImmediate(() => {
            this.quizService
              .translateQuestionById(createdId, locales, false)
              .catch((e) => console.error("[quiz-translate-bg] question:", e));
          });
        }
      })
      .catch((err) => this.handleError(err, res));
  };

  // =========================
  // POST /quiz/translate/category/:key   body: { locales?: string[], force?: boolean, context?: daily|school }
  // =========================
  translateCategory = (req: Request, res: Response) => {
    const key = decodeParamSafe(req.params.key).trim();
    if (!key) return res.status(400).json({ error: "key requerido" });

    const context = normalizeContext(req.body?.context);
    const locales = parseLocalesFromBody(req.body);
    const force = !!req.body?.force;

    this.quizService
      .translateCategoryByKey(key, context, locales, force)
      .then((r) => res.status(200).json(r))
      .catch((err) => this.handleError(err, res));
  };

  // =========================
  // POST /quiz/translate/question/:id   body: { locales?: string[], force?: boolean }
  // =========================
  translateQuestion = (req: Request, res: Response) => {
    const id = decodeParamSafe(req.params.id).trim();
    if (!id) return res.status(400).json({ error: "id requerido" });

    const locales = parseLocalesFromBody(req.body);
    const force = !!req.body?.force;

    // (si quieres validarIdUnico aquí, hazlo según tu formato de ids)
    this.quizService
      .translateQuestionById(id, locales, force)
      .then((r: any) => res.status(200).json(r))
      .catch((err: any) => this.handleError(err, res));
  };

  public async translateQuestionById(
    questionId: string,
    locales?: TranslatableLocale[],
    force: boolean = false,
  ) {
    if (process.env.ENABLE_TRANSLATOR !== "true") {
      throw CustomError.badRequest(
        "Traductor desactivado (ENABLE_TRANSLATOR != true)",
      );
    }

    const base = await this.quizRepositorio.getQuestionTranslation(
      questionId,
      "es",
    );
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
            questionId,
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
          question_id: questionId,
          locale: loc,
          question: tQuestion,
          choices: ensure4Choices(tChoices),
          explanation: tExplanation,
        });

        done++;
      } catch (e) {
        console.error(
          `[quiz.translateQuestionById] ${questionId} -> ${loc} falló:`,
          e,
        );
      }
    }

    return { ok: true, id: questionId, count: done, locales: targets };
  }
}
