import { Router } from "express";
import { generateReelScriptController } from "./reelScript.controller";
import { toolsRateLimit } from "../middlewares/toolsRateLimit";

export class ReelScriptRoutes {
  static get routes(): Router {
    const router = Router();

    // POST /tools/reels
    router.post("/tools/reels", toolsRateLimit, generateReelScriptController);

    return router;
  }
}
