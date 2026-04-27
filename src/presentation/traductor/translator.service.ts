// src/traductor/translator.service.ts
import { LRUCache } from "lru-cache";
import { TranslationServiceClient } from "@google-cloud/translate";

import { buildSlug, type Locale } from "./slug";

const G_LANG: Record<Locale, string> = {
  es: "es",
  en: "en",
  pt: "pt",
  fr: "fr",
  de: "de",
  ar: "ar",
};

const cache = new LRUCache<string, string>({
  max: 500,
  ttl: 24 * 60 * 60 * 1000,
});

let client: TranslationServiceClient | null = null;
const getClient = () => (client ||= new TranslationServiceClient());
const parent = () =>
  `projects/${process.env.GCLOUD_PROJECT_ID}/locations/${process.env.GCLOUD_TRANSLATE_LOCATION || "global"}`;

export async function warmupTranslator() {
  try {
    if (process.env.ENABLE_TRANSLATOR !== "true") return;
    await translateText("Hola", "en" as Locale);
    console.log("[translator] warmup listo (Google)");
  } catch (e) {
    console.error("[translator] warmup fallo:", e);
  }
}

const ck = (text: string, target: Locale) => `${target}::${text}`;

export async function translateText(
  text: string,
  target: Locale
): Promise<string> {
  if (!text?.trim() || target === "es") return text;
  if (process.env.ENABLE_TRANSLATOR !== "true") return text;

  const key = ck(text, target);
  const hit = cache.get(key);
  if (hit) return hit;

  const [res] = await getClient().translateText({
    parent: parent(),
    contents: [text],
    mimeType: "text/plain",
    sourceLanguageCode: "es",
    targetLanguageCode: G_LANG[target],
  });

  const out = res.translations?.[0]?.translatedText ?? text;
  cache.set(key, out);
  return out;
}

export async function translateHTML(html: string, target: Locale) {
  if (!html || target === "es") return html;
  if (process.env.ENABLE_TRANSLATOR !== "true") return html;

  const [res] = await getClient().translateText({
    parent: parent(),
    contents: [html],
    mimeType: "text/html", // mantiene etiquetas
    sourceLanguageCode: "es",
    targetLanguageCode: G_LANG[target],
  });

  return res.translations?.[0]?.translatedText ?? html;
}

export async function translateContentJSON(content: any, target: Locale) {
  if (!content || !Array.isArray(content?.blocks) || target === "es")
    return content;

  const blocks = await Promise.all(
    content.blocks.map(async (b: any) => {
      const out = { ...b };

      // 1) Traducir HTML si existe (tu comportamiento actual)
      if (typeof out?.html === "string") {
        out.html = await translateHTML(out.html, target);
      }

      // 2) ✅ NUEVO: traducir ALT cuando el bloque es imagen
      if (out?.type === "imagen") {
        const rawAlt = typeof out.alt === "string" ? out.alt.trim() : "";
        if (rawAlt) {
          const tAlt = await translateText(rawAlt, target);
          out.alt = tAlt;

          // 3) ✅ OPCIONAL: mantener el html consistente si trae alt="..."
          if (typeof out.html === "string" && out.html.includes('alt="')) {
            const safe = tAlt.replace(/"/g, "&quot;");
            out.html = out.html.replace(/alt="[^"]*"/i, `alt="${safe}"`);
          }
        }
      }

      return out;
    })
  );

  return { ...content, blocks };
}

export const makeSlugFromTitle = (title: string, locale: Locale) =>
  buildSlug(title, locale);
