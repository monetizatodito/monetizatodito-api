// src/presentation/seo/seo.service.ts

import { PageSpeedLog, SeoRepository, Strategy } from "./seo.repositorio";

const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY;

export class SeoService {
  private repo: SeoRepository;

  constructor() {
    this.repo = new SeoRepository();
  }

  public runPageSpeed(url: string, strategy: Strategy = "mobile") {
    if (!PAGESPEED_API_KEY) {
      return Promise.reject(
        new Error("Falta PAGESPEED_API_KEY en el .env del backend")
      );
    }

    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
      url
    )}&strategy=${strategy}&key=${PAGESPEED_API_KEY}`;

    return fetch(apiUrl)
      .then((res) => {
        if (!res.ok) {
          return res.text().then((text) => {
            throw new Error(`PageSpeed error ${res.status}: ${text}`);
          });
        }
        return res.json() as Promise<any>; // 👈 importantísimo para quitar el error de 'unknown'
      })
      .then((json) => {
        const rawScore = json?.lighthouseResult?.categories?.performance?.score;

        if (typeof rawScore !== "number") {
          throw new Error(
            "No se pudo leer lighthouseResult.categories.performance.score"
          );
        }

        const score = Math.round(rawScore * 100);

        const log: PageSpeedLog = {
          url,
          strategy,
          score,
          rawScore,
        };

        // Guardar histórico y luego devolver el resultado
        return this.repo.insertPageSpeedLog(log).then(() => ({
          url,
          strategy,
          score,
          rawScore,
          lighthouseResult: json.lighthouseResult, // opcional para debug
        }));
      });
  }

  public getPageSpeedHistory(url: string, strategy?: Strategy) {
    return this.repo.getHistoryByUrl(url, strategy);
  }
}
