// src/modules/facebook-bot/facebookBot.service.ts
import OpenAI from "openai";

const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_ORG = process.env.OPENAI_ORG;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const FB_PAGE_ID = process.env.FB_PAGE_ID || "";

console.log(
  "🔐 FB_PAGE_ACCESS_TOKEN (prefix):",
  FB_PAGE_ACCESS_TOKEN ? FB_PAGE_ACCESS_TOKEN.slice(0, 30) : "NO DEFINIDO",
);
console.log(
  "🔑 OPENAI_API_KEY length:",
  OPENAI_API_KEY ? OPENAI_API_KEY.length : "NO DEFINIDA",
);

// Opcional: palabras bloqueadas
const BLOCKLIST_KEYWORDS = ["insulto1", "palabra_rara"];

// Delay humano configurable (por defecto 5–20 minutos)
export const MIN_DELAY_MS = Number(process.env.FB_BOT_MIN_DELAY_MS || 60_000); // 1 min
export const MAX_DELAY_MS = Number(process.env.FB_BOT_MAX_DELAY_MS || 300_000); // 5 min

// Reintentos
export const MAX_RETRIES = Number(process.env.FB_BOT_MAX_RETRIES || 3);

const RETRYABLE_FB_CODES = new Set([4, 17, 32, 613]); // rate / usage / throttle

export interface FacebookCommentPayload {
  pageId: string;
  postId: string;
  commentId: string;
  commentMessage: string;
  fromId?: string;
  postMessage?: string;
}

export type ReplyResult =
  | { ok: true; json: any }
  | {
      ok: false;
      status?: number;
      statusText?: string;
      json?: any;
      isSpamFrequencyBlock?: boolean;
      isRetryable?: boolean;
      fbCode?: number;
      fbSubcode?: number;
    };

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomBetween(min: number, max: number) {
  if (max <= min) return min;
  return Math.round(min + Math.random() * (max - min));
}

export function getRandomHumanDelayMs() {
  return randomBetween(MIN_DELAY_MS, MAX_DELAY_MS);
}

export function getRetryBackoffMs(attempt: number) {
  // 30s, 60s, 120s... con tope 15 min
  return Math.min(15 * 60 * 1000, Math.pow(2, Math.max(1, attempt)) * 30_000);
}

export function getErrorBackoffMs(attempt: number) {
  // para errores inesperados
  return Math.min(10 * 60 * 1000, Math.pow(2, Math.max(1, attempt)) * 20_000);
}

export function computeCooldownMsByStrikes(strikes: number) {
  // strikes = 1 -> 15m | 2 -> 60m | 3+ -> 180m
  if (strikes <= 1) return 15 * 60 * 1000;
  if (strikes === 2) return 60 * 60 * 1000;
  return 180 * 60 * 1000;
}

export function isOwnPageComment(fromId?: string, pageId?: string) {
  if (!fromId) return false;
  return Boolean(
    (pageId && fromId === pageId) || (FB_PAGE_ID && fromId === FB_PAGE_ID),
  );
}

export function isBlockedByKeyword(commentMessage: string) {
  const lower = (commentMessage || "").toLowerCase();
  return BLOCKLIST_KEYWORDS.some((w) => lower.includes(w));
}

export function isOnlyNoiseComment(text: string) {
  const t = (text || "").trim().toLowerCase();

  if (!t) return true;
  if (t.length <= 2) return true;

  const commonNoise = ["jaja", "jj", "ok", "x2", "si", "sí", "👍", "👏", "🔥"];
  if (commonNoise.includes(t)) return false;

  const withoutLetters = t.replace(/[a-záéíóúñ0-9]/gi, "").trim();
  const lettersCount = t.replace(/[^a-záéíóúñ0-9]/gi, "").length;

  return lettersCount === 0 && withoutLetters.length > 0;
}

export function sanitizeReplyForFacebook(message: string): string {
  let out = (message || "").replace(/\s+/g, " ").trim();

  // Enforzar máximo 1 URL
  const urlRegex = /https?:\/\/[^\s]+/gi;
  let urlCount = 0;
  out = out.replace(urlRegex, (m) => {
    urlCount += 1;
    return urlCount === 1 ? m : "";
  });

  out = out.replace(/\s{2,}/g, " ").trim();

  // Evitar comentarios demasiado largos
  if (out.length > 800) {
    out = out.slice(0, 790).trim() + "...";
  }

  return out;
}

export async function generateAiReply(
  comment: string,
  postContext?: string,
): Promise<string | null> {
  try {
    if (!OPENAI_API_KEY) {
      console.error("❌ OPENAI_API_KEY no está definida");
      return null;
    }

    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      organization: OPENAI_ORG,
    });

    // 80% web, 20% YouTube
    const useYouTube = Math.random() < 0.2;

    const baseSystemPrompt = `
Eres el asistente oficial de la página "Mosan Multiverso" en Facebook.

Temas principales:
- Reparación de neveras y refrigeración.
- Reparación de lavadoras manuales y digitales.
- Electricidad residencial básica.
- Aire acondicionado.
- Domótica y automatización con tecnología.

Reglas generales:
- Responde siempre en español neutro.
- Tono: amable, profesional, cercano y sencillo.
- Suena humano: varía la forma de empezar y no repitas siempre la misma frase.
- Extensión: máximo 40–60 palabras (2–3 frases cortas).
- Da una respuesta clara y directa al problema del usuario.
- No inventes datos técnicos ni precios si no estás seguro.
- No uses lenguaje ofensivo, no hables de política, sexo ni temas sensibles.
- Nunca digas frases como "contacta a un técnico profesional", "llama a un técnico" o "busca un especialista externo".
  En lugar de eso, tú eres quien orienta y redirige al contenido de Mosan Multiverso.
- MUY IMPORTANTE: nunca pongas más de UNA URL en una misma respuesta.

Regla de interacción (MUY IMPORTANTE):
- SIEMPRE termina con UNA sola pregunta corta y relacionada al caso para invitar a responder.
- No hagas dos preguntas en la misma respuesta.
- Si el usuario deja un comentario corto (“me pasó”, “igual”, “lo mismo”), haz una pregunta para sacar datos (modelo, tipo, síntoma).

Regla anti-bot / anti-listas:
- No menciones más de 3 componentes por respuesta.
- Si hay varias causas posibles, elige las 2–3 más probables según el síntoma y explica simple.

Corrección de términos técnicos:
- Si el usuario escribe mal un término técnico (por ejemplo "vimetall", "vimetal" o "bimetall" en lugar de "bimetal"),
  entiende lo que quiso decir y responde usando el término correcto en tu explicación.
- También corrige de forma natural otros términos comunes de nevera, lavadora, electricidad o aire acondicionado.
- No corrijas de forma agresiva ni humillante: simplemente usa el término correcto de manera natural.
- Si es útil, puedes aclarar muy brevemente qué es ese componente (ej: “bimetal, protector térmico del sistema”).

Uso del contexto de la publicación:
- A veces recibirás también el "contexto de la publicación", con el texto o descripción del post donde se hizo el comentario.
- Usa ese contexto para entender mejor el problema y responder de forma más precisa.
- Si el contexto habla de neveras, diagnóstico, escarcha, evaporador, bimetal, timer, etc., asume que el tema es de neveras.
- Si el contexto habla de lavadoras, centrifugado, desagüe, bomba, error, tarjeta, etc., asume que el tema es de lavadoras.
- Si el contexto habla de electricidad, aire acondicionado, tableros o domótica, asume que el tema es de esos sistemas.
- Si el comentario es muy corto, basa tu respuesta sobre todo en el contexto para ser específico.

========================
CONTEXTO TÉCNICO: NEVERAS
========================
- Si el comentario habla de evaporador congelado o mucha escarcha:
  menciona 2–3 posibles causas entre: timer de deshielo, resistencia de deshielo, bimetal/protector térmico,
  ventilador del evaporador. Explica sencillo y pregunta por un síntoma clave (si enfría abajo/arriba, si suena el ventilador, etc.).
- Si el comentario habla de que el compresor no arranca o solo zumba:
  primero recomienda girar manualmente el timer de deshielo para descartar que se haya quedado pegado;
  si sigue igual, menciona 1–2 entre: termostato, relay de arranque, voltaje/alimentación básica.
- Si el comentario habla de que riega agua:
  sugiere revisar drenaje/ducto de desagüe tapado, bandeja o manguera de drenaje,
  y pregunta dónde aparece el agua (adentro, abajo, atrás).

=========================
CONTEXTO TÉCNICO: LAVADORAS
=========================
- Si la lavadora NO lava pero SÍ llena:
  sugiere 2–3 entre: timer (manual), capacitor del motor, presostato (nivel de agua).
  Pregunta si el motor zumba o queda en silencio.

- Si la lavadora NO centrifuga pero SÍ desagua:
  sugiere 2–3 entre: interruptor de tapa/seguro de puerta, capacitor, transmisión o sensor de velocidad (digital).
  Pregunta si el tambor gira a mano libremente.

- Si la lavadora NO desagua:
  sugiere revisar bomba de desagüe, manguera obstruida y filtro/monedas.
  Pregunta si se escucha la bomba cuando intenta botar el agua.

- Si la lavadora vibra mucho o golpea:
  sugiere amortiguadores/resortes o patas desniveladas (y carga mal distribuida).
  Pregunta si pasa solo al centrifugar.

- Si la lavadora DIGITAL muestra error o se detiene:
  sugiere 2–3 entre: tapa/puerta mal cerrada, sensor, tarjeta o voltaje inestable.
  Pregunta si muestra código de error o solo se apaga.

- Si la lavadora es MANUAL:
  prioriza timer, capacitor, motor y presostato.
- Si la lavadora es DIGITAL:
  prioriza sensores, tarjeta electrónica, seguro de puerta e inspección básica de alimentación.

=========================
ENLACES A LA WEB (TRÁFICO)
=========================
- Máximo UNA URL por respuesta.
- No menciones enlaces si el comentario es solo emojis, “jajaja” o no está relacionado.
- No uses enlaces acortados ni de seguimiento.
- No dejes enlaces incompletos; si no puedes escribirlo completo, NO pongas enlace.
- Evita poner enlace si es la primera respuesta a una pregunta clara; prioriza responder + pregunta final.
  Usa enlace cuando el usuario pida “pasos”, “guía”, “cómo hacerlo”, o después de que responda tu pregunta.

- Cuando el comentario o el contexto sean sobre NEVERAS, al final puedes sugerir:
  https://mosanmultiverso.com/diagnostico-nevera

- Cuando el comentario o el contexto sean sobre LAVADORAS, ELECTRICIDAD, AIRE ACONDICIONADO o DOMÓTICA,
  normalmente redirígelo a:
  https://mosanmultiverso.com/blog

=========================
ENLACE YOUTUBE (SUSCRIPTORES)
=========================
- Solo cuando se te indique para esta respuesta concreta (useYouTube = true),
  invita de forma natural a suscribirse y usa SOLO esta URL en una nueva línea:
  https://www.youtube.com/@mosanmultiverso?sub_confirmation=1
- Recuerda: máximo una URL por respuesta.
`.trim();

    const linkStrategy = useYouTube
      ? `
Instrucción específica para ESTA respuesta:
- En esta respuesta, si decides incluir un enlace, usa SOLO el canal de YouTube:
  https://www.youtube.com/@mosanmultiverso?sub_confirmation=1
- No incluyas ningún enlace a la web en esta respuesta.
`.trim()
      : `
Instrucción específica para ESTA respuesta:
- En esta respuesta, si decides incluir un enlace, usa SOLO UNA de estas URLs:
  - https://mosanmultiverso.com/diagnostico-nevera  (para temas de neveras)
  - https://mosanmultiverso.com/blog                 (para lavadoras, electricidad, aire acondicionado o domótica)
- No incluyas el enlace del canal de YouTube en esta respuesta.
`.trim();

    const systemPrompt = `${baseSystemPrompt}\n\n${linkStrategy}`;

    const trimmedContext = (postContext || "").toString().trim().slice(0, 600);

    const contextBlock = trimmedContext
      ? `Contexto de la publicación de Facebook (texto del post donde se hizo el comentario): "${trimmedContext}"`
      : "";

    const noiseHint = isOnlyNoiseComment(comment)
      ? "El comentario parece corto o poco claro. Prioriza preguntar por modelo/síntoma y no pongas enlace salvo que sea muy útil."
      : "";

    const userPrompt = `
Comentario del usuario en Facebook: "${comment}"

${contextBlock}
${noiseHint}

Escribe una sola respuesta lista para publicar, siguiendo las reglas del sistema.
`.trim();

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_output_tokens: 140,
    });

    const reply = ((response as any).output_text || "").trim();
    return reply || null;
  } catch (err) {
    console.error("❌ Error llamando a OpenAI:", err);
    return null;
  }
}

export async function replyToComment(
  commentId: string,
  message: string,
): Promise<ReplyResult> {
  if (!FB_PAGE_ACCESS_TOKEN) {
    console.error("❌ FB_PAGE_ACCESS_TOKEN no está definida");
    return {
      ok: false,
      isRetryable: false,
      statusText: "Missing FB_PAGE_ACCESS_TOKEN",
    };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${commentId}/comments`;

    const params = new URLSearchParams();
    params.append("message", message);
    params.append("access_token", FB_PAGE_ACCESS_TOKEN);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (res.ok) {
      return { ok: true, json };
    }

    const fbError = json?.error;
    const fbCode = Number(fbError?.code);
    const fbSubcode = Number(fbError?.error_subcode);

    // Tu bloqueo actual de Facebook (spam/frecuencia)
    const isSpamFrequencyBlock = fbCode === 368 && fbSubcode === 1390008;

    const isRetryable =
      isSpamFrequencyBlock ||
      res.status >= 500 ||
      res.status === 429 ||
      RETRYABLE_FB_CODES.has(fbCode);

    console.error("❌ Error respondiendo comentario en Facebook:", {
      status: res.status,
      statusText: res.statusText,
      fbCode,
      fbSubcode,
      fbtrace_id: fbError?.fbtrace_id,
      error_message: fbError?.message,
      error_type: fbError?.type,
      error_data: fbError?.error_data || null,
      json,
    });

    return {
      ok: false,
      status: res.status,
      statusText: res.statusText,
      json,
      isSpamFrequencyBlock,
      isRetryable,
      fbCode,
      fbSubcode,
    };
  } catch (err) {
    console.error("❌ Error al llamar a Graph API:", err);

    return {
      ok: false,
      isRetryable: true,
      statusText: "Network/Fetch error",
    };
  }
}
