// src/presentation/diagnostico-neveras/diagnostico.routes.ts
import { Router } from "express";
import { DiagnosticController } from "./diagnostico.controller";
// import { requireAuth } from "../../middlewares/auth";

export class DiagnosticoNeveraRoutes {
  static get routes(): Router {
    const router = Router();

    /** Público */
    router.get("/diagnostic/search", DiagnosticController.search);
    router.get("/diagnostic/resolve", DiagnosticController.resolve);

    // ✅ NUEVA: obtener pregunta por slug, coalescida al locale (?locale=en o header x-locale)
    router.get(
      "/diagnostic/questions/slug/:slug",
      DiagnosticController.bySlugLocalized
    );

    // (legacy) mantener si ya la usa algo del front
    router.get("/diagnostic/questions/:slug", DiagnosticController.bySlug);

    // 🔹 Público (para autocompletar en el admin UI/cliente)
    router.get("/diagnostic/tags", DiagnosticController.searchTags);

    /** Admin (protege con tu middleware si corresponde) */
    router.post(
      "/admin/diagnostic/questions",
      /* requireAuth, */ DiagnosticController.createQuestion
    );
    router.post(
      "/admin/diagnostic/articles",
      /* requireAuth, */ DiagnosticController.upsertArticle
    );
    router.post(
      "/admin/diagnostic/article-steps",
      /* requireAuth, */ DiagnosticController.addStep
    );

    // 🔹 NUEVOS: gestión de tags
    router.post(
      "/admin/diagnostic/tags",
      /* requireAuth, */ DiagnosticController.createTags
    );
    router.post(
      "/admin/diagnostic/questions/:id/tags",
      /* requireAuth, */ DiagnosticController.attachTags
    );
    // (opcional futuro) DELETE /admin/diagnostic/questions/:id/tags

    // 🔹 NUEVO: mapea pregunta ↔ post del blog por idioma
    router.post(
      "/admin/diagnostic/question-blog",
      /* requireAuth, */ DiagnosticController.upsertQuestionBlog
    );

    // ✅ NUEVA (admin): lista ES + traducciones por pregunta
    router.get(
      "/admin/diagnostic/questions/:id/translations",
      DiagnosticController.listTranslations
    );

    return router;
  }
}
