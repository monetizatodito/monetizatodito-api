import { Router } from "express";
import {
  handleFacebookWebhook,
  verifyFacebookWebhook,
} from "./facebookBot.controller";
// import { requireAuth } from "../../middlewares/auth";

export class FacebookBotRoutes {
  static get routes(): Router {
    const router = Router();

    // Verificación del webhook
    router.get("/webhook/facebook", verifyFacebookWebhook);

    // Notificaciones (comentarios, etc.)
    router.post("/webhook/facebook", handleFacebookWebhook);

    return router;
  }
}
