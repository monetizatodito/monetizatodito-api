// src/presentation/diagnostico-neveras/diagnostico.controller.ts
import { Request, Response } from "express";
import { DiagnosticService } from "./diagnostico.service";
import { TipoNevera } from "./diagnosticRepository";
import { pickLocale } from "../../helpers/locale";

const svc = new DiagnosticService();

function parseTipo(t?: any): TipoNevera | undefined {
  return t === "digital" || t === "analogica" ? t : undefined;
}

function decodeParamSafe(s: unknown) {
  try {
    return decodeURIComponent(String(s ?? "")).normalize("NFC");
  } catch {
    return String(s ?? "");
  }
}

export class DiagnosticController {
  // ---------- PÚBLICAS ----------

  // Autocomplete / listado (con o sin mapeo a blog)
  static search = (req: Request, res: Response) => {
    const q = String(req.query.q || "").trim();
    const type = parseTipo(req.query.type);
    const locale = String(req.query.locale || "es");
    const withBlog = String(req.query.withBlog || "1") === "1"; // por defecto trae info de blog

    if (!q) return res.status(400).json({ error: "q requerido" });

    const exec = withBlog
      ? svc.buscarConBlog(q, locale, type, 20)
      : svc.buscar(q, type, 20);

    exec
      .then((rows) => res.json(rows))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: "internal_error" });
      });
  };

  // Resolver destino ideal: { kind:'blog', blogSlug } | { kind:'question', slug }
  static resolve = (req: Request, res: Response) => {
    const q = String(req.query.q || "").trim();
    const type = parseTipo(req.query.type);
    const locale = String(req.query.locale || "es");

    if (!q) return res.status(400).json({ error: "q requerido" });

    svc
      .resolverDestino(q, locale, type)
      .then((target) => {
        if (!target) return res.status(404).json({ notFound: true });
        return res.json(target);
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: "internal_error" });
      });
  };

  // Obtener datos por slug (para renderizar guía interna si aplica)
  static bySlug = (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const type = parseTipo(req.query.type);

    svc
      .obtenerPorSlug(slug, type)
      .then((rows) => {
        if (!rows || rows.length === 0)
          return res.status(404).json({ error: "not_found" });
        return res.json(rows);
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: "internal_error" });
      });
  };

  // ---------- ADMIN ----------

  // Crear pregunta base (queda en draft)
  static createQuestion = (req: Request, res: Response) => {
    const { title, defaultType = "analogica", tags = [] } = req.body || {};
    if (!title) return res.status(400).json({ error: "title requerido" });

    svc
      .crearPregunta(title, defaultType, tags)
      .then((row) => res.status(201).json(row))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: "internal_error" });
      });
  };

  // Crear/actualizar artículo por tipo; publish=true para publicar
  static upsertArticle = (req: Request, res: Response) => {
    const {
      questionId,
      fridgeType,
      seoTitle,
      seoDescription,
      contentMd,
      publish,
    } = req.body || {};

    if (
      !questionId ||
      !fridgeType ||
      !seoTitle ||
      !seoDescription ||
      !contentMd
    ) {
      return res.status(400).json({ error: "faltan_campos" });
    }

    svc
      .publicarArticulo({
        questionId,
        fridgeType,
        seoTitle,
        seoDescription,
        contentMd,
        publish,
      })
      .then((row) => res.status(200).json(row))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: "internal_error" });
      });
  };

  // Agregar paso atómico a un artículo
  static addStep = (req: Request, res: Response) => {
    const {
      articleId,
      idx,
      title,
      bodyMd,
      tools,
      durationMinutes,
      riskLevel,
      mediaUrls,
    } = req.body || {};

    if (!articleId || typeof idx !== "number" || !title || !bodyMd) {
      return res.status(400).json({ error: "faltan_campos" });
    }

    svc
      .agregarPaso({
        articleId,
        idx,
        title,
        bodyMd,
        tools,
        durationMinutes,
        riskLevel,
        mediaUrls,
      })
      .then((row) => res.status(201).json(row))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: "internal_error" });
      });
  };

  // Vincular/actualizar pregunta ↔ post del blog por idioma
  static upsertQuestionBlog = (req: Request, res: Response) => {
    const {
      questionId,
      locale = "es",
      blogSlug,
      published = false,
    } = req.body || {};
    if (!questionId || !blogSlug) {
      return res.status(400).json({ error: "faltan_campos" });
    }

    svc
      .mapearPreguntaABlog({ questionId, locale, blogSlug, published })
      .then((row) => res.status(200).json(row))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: "internal_error" });
      });
  };
  /** POST /admin/diagnostic/tags  { names: string[] } */
  static createTags = (req: Request, res: Response) => {
    const names: string[] = Array.isArray(req.body?.names)
      ? req.body.names
      : [];
    if (!names.length)
      return res.status(400).json({ error: "names requerido (array)" });

    svc
      .crearTags(names)
      .then((rows) => res.status(201).json({ tags: rows }))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: "internal_error" });
      });
  };

  /** GET /diagnostic/tags?q=...&limit=50 */
  static searchTags = (req: Request, res: Response) => {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const limit = Number(req.query.limit) || 50;

    svc
      .buscarTags(q, limit)
      .then((rows) => res.json({ tags: rows }))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: "internal_error" });
      });
  };

  /** POST /admin/diagnostic/questions/:id/tags  { tagIds: string[] } */
  static attachTags = (req: Request, res: Response) => {
    const questionId = String(req.params.id || "");
    const tagIds: string[] = Array.isArray(req.body?.tagIds)
      ? req.body.tagIds
      : [];
    if (!questionId)
      return res.status(400).json({ error: "questionId requerido en :id" });
    if (!tagIds.length)
      return res.status(400).json({ error: "tagIds requerido (array)" });

    svc
      .vincularTags(questionId, tagIds)
      .then((result) => res.status(201).json(result))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: "internal_error" });
      });
  };

  static bySlugLocalized = async (req: Request, res: Response) => {
    const slug = decodeParamSafe(req.params.slug);
    const locale = pickLocale(req); // lee ?locale, x-locale, Accept-Language

    try {
      const rows = await svc.obtenerPorSlug(
        slug,
        /* type? */ undefined,
        locale
      );
      if (!rows || !rows.length)
        return res.status(404).json({ error: "not_found" });

      res.set("Vary", "x-locale, Accept-Language");
      return res.json({ question: rows[0], locale });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "internal_error" });
    }
  };
  static listTranslations = async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id requerido" });

    try {
      const items = await svc.listTranslations(id); // ver repo en #3
      return res.json({ items });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "internal_error" });
    }
  };
}
