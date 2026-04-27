import { Router } from "express";

import { AuthMiddleware } from "../middlewares/auth.middleware";
import { ValidardRoll } from "../middlewares/role.middleware";
import { parseLocale } from "../middlewares/locale.middleware";

import { QuizService } from "./quiz.service";
import { QuizControlador } from "./quiz.controller";
import { QuizRepository } from "../../repositorio/quizRepositorio";

export class QuizRoutes {
  static get routes(): Router {
    const router = Router();

    const quizService = new QuizService();
    const quizRepositorio = new QuizRepository();
    const controller = new QuizControlador(quizService, quizRepositorio);

    // ---- PUBLIC (frontend) ----
    router.get("/categories", parseLocale, controller.getCategories);
    router.get("/daily-questions", parseLocale, controller.getDailyQuestions);

    // ---- ADMIN (crear) ----
    router.post(
      "/category",
      [AuthMiddleware.validateJWT, ValidardRoll.tieneRoll("admin", "empresa")],
      controller.createCategory,
    );

    router.post(
      "/question",
      [AuthMiddleware.validateJWT, ValidardRoll.tieneRoll("admin", "empresa")],
      controller.createQuestion,
    );

    // ---- TRADUCCIONES (admin) ----
    router.post(
      "/translate/category/:key",
      [AuthMiddleware.validateJWT, ValidardRoll.tieneRoll("admin", "empresa")],
      controller.translateCategory,
    );

    router.post(
      "/translate/question/:id",
      [AuthMiddleware.validateJWT, ValidardRoll.tieneRoll("admin", "empresa")],
      controller.translateQuestion,
    );

    return router;
  }
}
