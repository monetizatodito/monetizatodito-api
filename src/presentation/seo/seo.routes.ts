// src/presentation/seo/seo.routes.ts
import { Router } from "express";
import { SeoController } from "./seo.controller";

export class SeoRoutes {
  static get routes(): Router {
    const router = Router();

    // GET /seo/pagespeed?url=...&strategy=mobile|desktop
    router.get("/pagespeed", SeoController.runPageSpeed);

    // opcional: histórico
    router.get("/pagespeed/history", SeoController.history);

    return router;
  }
}
