// src/presentation/diagnostico-neveras/diagnosticService.ts
import { generarSlugUnicoPreguntaPorIdioma } from "../../config/generarSlugUnicoPorIdiomaNevera";
import { TranslatableLocale } from "../../util/slug";
import { translateText } from "../traductor/translator.service";
import { DiagnosticRepository, TipoNevera } from "./diagnosticRepository";

const DEFAULT_LOCALES: TranslatableLocale[] = ["en", "pt", "fr", "de", "ar"];

type SearchOpts = {
  strict?: boolean; // si true, NO mezclar idiomas (filtrar por locale exacto)
};
type ResolveOpts = {
  preferBlog?: boolean; // si true, prioriza blog si existe en ese locale
  fallback?: boolean; // si true, si no hay match en locale, intentar 'es'
};
export class DiagnosticService {
  private repo = new DiagnosticRepository();

  // --- ADMIN: crear pregunta base (queda en draft) ---

  async crearPregunta(
    title: string,
    defaultType: TipoNevera = "analogica",
    tags: string[] = []
  ) {
    const created = await this.repo.createQuestion(title, defaultType, tags); // { id, slug }
    // Lánzalo en background (no bloquea la respuesta)
    if (process.env.ENABLE_TRANSLATOR === "true") {
      this.traducirPreguntaEnBackground(created.id, title).catch((e) =>
        console.error("[diag-translate-bg] error:", e)
      );
    }
    return created;
  }

  async traducirPreguntaEnBackground(
    questionId: string,
    esTitle: string,
    locales: TranslatableLocale[] = DEFAULT_LOCALES
  ) {
    for (const loc of locales) {
      try {
        const exists = await this.repo.existsQuestionTranslation(
          questionId,
          loc
        );
        if (exists) continue;

        const tTitle = await translateText(esTitle, loc);
        const tSlug = await generarSlugUnicoPreguntaPorIdioma(tTitle, loc);

        await this.repo.upsertQuestionTranslation(
          questionId,
          loc,
          tTitle,
          tSlug
        );
        console.log(`[diag-translate-bg] ${questionId} -> ${loc} OK`);
      } catch (err) {
        console.error(
          `[diag-translate-bg] ${questionId} -> ${loc} falló:`,
          err
        );
      }
    }
  }

  // --- ADMIN: crear/actualizar artículo (por tipo); publish=true para publicar ---
  publicarArticulo(input: {
    questionId: string;
    fridgeType: TipoNevera;
    seoTitle: string;
    seoDescription: string;
    contentMd: string;
    publish?: boolean;
  }) {
    const {
      questionId,
      fridgeType,
      seoTitle,
      seoDescription,
      contentMd,
      publish,
    } = input;

    return this.repo.upsertArticle(
      questionId,
      fridgeType,
      seoTitle,
      seoDescription,
      contentMd,
      !!publish
    );
  }

  // --- ADMIN: agregar paso atómico a un artículo (idx incremental) ---
  agregarPaso(input: {
    articleId: string;
    idx: number;
    title: string;
    bodyMd: string;
    tools?: string[];
    durationMinutes?: number;
    riskLevel?: "bajo" | "medio" | "alto";
    mediaUrls?: string[];
  }) {
    const {
      articleId,
      idx,
      title,
      bodyMd,
      tools = [],
      durationMinutes,
      riskLevel = "bajo",
      mediaUrls = [],
    } = input;

    return this.repo.addStep(
      articleId,
      idx,
      title,
      bodyMd,
      tools,
      durationMinutes,
      riskLevel,
      mediaUrls
    );
  }

  // --- ADMIN: vincular pregunta → post del blog por idioma ---
  mapearPreguntaABlog(params: {
    questionId: string;
    locale: string; // 'es' | 'en' | 'pt' | 'fr' | 'de' | 'ar'
    blogSlug: string;
    published?: boolean;
  }) {
    const { questionId, locale, blogSlug, published = false } = params;
    return this.repo.upsertQuestionBlog(
      questionId,
      locale,
      blogSlug,
      published
    );
  }

  // --- BÚSQUEDA: básica (sin info de blog) ---
  buscar(q: string, type?: TipoNevera, limit = 20) {
    return this.repo.searchQuestions(q, type, limit);
  }

  // --- BÚSQUEDA: con mapeo de blog (para autocomplete con badges/redirección) ---

  // --- RESOLVER: decide destino ideal (prioriza blog publicado en ese locale) ---

  // --- (LEGACY) resolver solo slug interno (si no usas blog mapping) ---
  resolverSlug(q: string, type?: TipoNevera) {
    return this.repo.searchQuestions(q, type, 1).then((rows) => {
      if (!rows.length) return null;
      return rows[0].slug as string;
    });
  }

  // --- obtener data por slug (y tipo) para renderizar la guía interna ---

  crearTags(names: string[]) {
    return this.repo.createTags(names);
  }

  buscarTags(q?: string, limit?: number) {
    return this.repo.searchTags(q, limit ?? 50);
  }

  vincularTags(questionId: string, tagIds: string[]) {
    return this.repo.attachTagsToQuestion(questionId, tagIds);
  }

  // ✅ buscar CON blog y COALESCE por locale
  buscarConBlog(q: string, locale: string, type?: TipoNevera, limit = 20) {
    return this.repo.searchQuestionsWithBlogLocalized(q, locale, type, limit);
  }

  // ✅ resolver priorizando blog, y si no hay usa el slug traducido del locale
  resolverDestino(q: string, locale: string, type?: TipoNevera) {
    return this.repo.resolveToTargetLocalized(q, locale, type);
  }

  // ✅ obtener por slug coalescido (title/slug traducido si existe)
  obtenerPorSlug(slug: string, type?: TipoNevera, locale: string = "es") {
    return this.repo.getBySlugLocalized(slug, locale, type);
  }
  listTranslations(questionId: string) {
    return this.repo.listQuestionTranslations(questionId);
  }
}
