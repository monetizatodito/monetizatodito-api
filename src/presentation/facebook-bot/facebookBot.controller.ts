// src/modules/facebook-bot/facebookBot.controller.ts
import { Request, Response } from "express";
import { FacebookBotQueueRepository } from "./facebookBotRepositorio";

const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || "mi_token_secreto";
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN || "";

// ✅ Repositorio de cola (DB)
const facebookBotQueueRepository = new FacebookBotQueueRepository();

// Cache simple del texto del post para evitar llamar a Graph API muchas veces
const POST_MESSAGE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 min
const postMessageCache = new Map<
  string,
  { message?: string; expiresAt: number }
>();

function getCachedPostMessage(postId: string): string | undefined {
  const item = postMessageCache.get(postId);
  if (!item) return undefined;
  if (Date.now() > item.expiresAt) {
    postMessageCache.delete(postId);
    return undefined;
  }
  return item.message;
}

function setCachedPostMessage(postId: string, message?: string) {
  postMessageCache.set(postId, {
    message,
    expiresAt: Date.now() + POST_MESSAGE_CACHE_TTL_MS,
  });
}

// ✅ Helper para obtener texto del post desde Graph API
async function fetchPostMessage(postId: string): Promise<string | undefined> {
  if (!FB_PAGE_ACCESS_TOKEN) {
    console.error("❌ FB_PAGE_ACCESS_TOKEN no definido en el controlador");
    return undefined;
  }

  // 1) Cache
  const cached = getCachedPostMessage(postId);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${postId}`);
    url.searchParams.set("fields", "message,story");
    url.searchParams.set("access_token", FB_PAGE_ACCESS_TOKEN);

    const res = await fetch(url.toString());

    if (!res.ok) {
      console.error("❌ Error al obtener el post desde Graph API:", {
        postId,
        status: res.status,
        statusText: res.statusText,
      });
      setCachedPostMessage(postId, undefined);
      return undefined;
    }

    const json = await res.json();
    const message: string | undefined = json?.message || json?.story;

    setCachedPostMessage(postId, message);

    console.log("📝 Texto del post obtenido para contexto:", {
      postId,
      hasMessage: Boolean(message),
      preview: message ? message.slice(0, 120) : undefined,
    });

    return message;
  } catch (err) {
    console.error("❌ Error en fetchPostMessage:", err);
    return undefined;
  }
}

// ✅ GET (verificación del webhook)
export function verifyFacebookWebhook(req: Request, res: Response) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("✅ GET /webhook/facebook (verify) recibido:", {
    mode,
    token,
    challenge,
  });

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
}

// ✅ POST (eventos reales: comentarios)
export function handleFacebookWebhook(req: Request, res: Response) {
  console.log("📩 POST /webhook/facebook recibido");

  // Ojo con el body completo (puede ser grande). Si quieres, déjalo solo en debug.
  try {
    console.log("🧾 BODY:", JSON.stringify(req.body, null, 2));
  } catch {
    console.log("🧾 BODY: [no serializable]");
  }

  // Facebook exige respuesta rápida
  res.sendStatus(200);

  // Procesa en segundo plano (sin bloquear el request)
  void (async () => {
    const body = req.body;

    if (!body || body.object !== "page") {
      console.log("🚫 body.object distinto de 'page':", body?.object);
      return;
    }

    for (const entry of body.entry || []) {
      const pageId = entry?.id;
      const localPostContextCache = new Map<string, string | undefined>();

      for (const change of entry.changes || []) {
        if (change?.field !== "feed") {
          console.log("🔎 Campo distinto de feed:", change?.field);
          continue;
        }

        const value: any = change?.value || {};

        // Solo comentarios nuevos
        if (!(value.item === "comment" && value.verb === "add")) {
          console.log("🔎 Cambio feed ignorado:", {
            item: value.item,
            verb: value.verb,
          });
          continue;
        }

        const commentId: string | undefined = value.comment_id;
        const commentMessage: string = (value.message || "").toString();
        const postId: string | undefined = value.post_id;
        const fromId: string | undefined = value.from?.id;

        if (!commentId || !postId || !pageId) {
          console.log("⚠️ Evento incompleto, se ignora:", {
            pageId,
            postId,
            commentId,
          });
          continue;
        }

        // 1) Intentar mensaje del post desde el webhook
        let postMessage: string | undefined = value.post?.message;

        // 2) Si no viene, usar cache local por payload para no repetir fetch
        if (!postMessage) {
          if (localPostContextCache.has(postId)) {
            postMessage = localPostContextCache.get(postId);
          } else {
            postMessage = await fetchPostMessage(postId);
            localPostContextCache.set(postId, postMessage);
          }
        }

        console.log("💬 Nuevo comentario detectado:", {
          pageId,
          postId,
          commentId,
          fromId,
          commentPreview: commentMessage?.slice?.(0, 120),
          hasPostMessage: Boolean(postMessage),
        });

        // ✅ Encolar en DB (ya NO procesar directo aquí)
        const queued = await facebookBotQueueRepository.enqueue({
          pageId,
          postId,
          commentId,
          commentMessage,
          fromId,
          postMessage,
        });

        if (!queued) {
          // ON CONFLICT(comment_id) DO NOTHING => duplicado
          console.log(
            "🟡 Comentario ya estaba en cola/procesado (duplicado):",
            {
              commentId,
              postId,
            },
          );
          continue;
        }

        console.log("📥 Comentario encolado en DB:", {
          queueId: queued.id,
          commentId: queued.comment_id,
          pageId: queued.page_id,
          status: queued.status,
        });
      }
    }
  })().catch((err) => {
    console.error("❌ Error procesando webhook de Facebook:", err);
  });
}
