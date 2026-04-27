// src/presentation/seo/seo.controller.ts
import { Request, Response } from "express";
import { SeoService } from "./seo.service";

const seoService = new SeoService();

type Strategy = "mobile" | "desktop";

export class SeoController {
  public static runPageSpeed(req: Request, res: Response): void {
    const url = (req.query.url as string) || "";
    const strategyParam = (req.query.strategy as string) || "mobile";

    // normalizamos el valor para que siempre sea 'mobile' o 'desktop'
    const strategy: Strategy =
      strategyParam === "desktop" ? "desktop" : "mobile";

    if (!url) {
      res.status(400).json({ error: "Falta parámetro url" });
      return;
    }

    seoService
      .runPageSpeed(url, strategy)
      .then((result) => {
        res.json(result);
      })
      .catch((err: any) => {
        console.error("Error en SeoController.runPageSpeed:", err);
        res.status(500).json({
          error: "Error al ejecutar PageSpeed",
          details: err?.message || String(err),
        });
      });
  }

  // Opcional: endpoint para ver histórico desde el panel
  public static history(req: Request, res: Response): void {
    const url = (req.query.url as string) || "";
    const strategyParam = req.query.strategy as string | undefined;

    let strategy: Strategy | undefined;
    if (strategyParam === "mobile" || strategyParam === "desktop") {
      strategy = strategyParam;
    } else {
      strategy = undefined;
    }

    if (!url) {
      res.status(400).json({ error: "Falta parámetro url" });
      return;
    }

    seoService
      .getPageSpeedHistory(url, strategy)
      .then((rows) => {
        res.json({ url, strategy, rows });
      })
      .catch((err: any) => {
        console.error("Error en SeoController.history:", err);
        res.status(500).json({
          error: "Error al obtener histórico PageSpeed",
          details: err?.message || String(err),
        });
      });
  }
}
