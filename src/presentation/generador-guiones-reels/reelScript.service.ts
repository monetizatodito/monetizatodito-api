import OpenAI from "openai";

type ReelArea =
  | "aire_acondicionado"
  | "refrigeracion"
  | "lavadoras"
  | "electricidad"
  | "domotica"
  | "camaras";

type ReelTipo =
  | "falla_comun"
  | "error_frecuente"
  | "consejo_rapido"
  | "advertencia_seguridad"
  | "tip_profesional"
  | "mito_tecnico";

type ReelObjetivo =
  | "educar"
  | "seguidores"
  | "whatsapp"
  | "guia_post"
  | "marca_personal";

type ReelIdioma = "es" | "en" | "pt" | "fr" | "de";

type ReelPlataforma = "facebook_reels" | "tiktok" | "youtube_shorts";
type ReelPlantilla = "viral" | "educativa" | "venta" | "tutorial";

type ReelDuracion = 15 | 30 | 60;

export interface ReelScriptPayload {
  area: ReelArea;
  tipo: ReelTipo;
  duracion: ReelDuracion;
  objetivo: ReelObjetivo;
  idioma: ReelIdioma;
  tema: string;
  plataforma?: ReelPlataforma;
  plantilla?: ReelPlantilla;
}

const allowed = {
  area: [
    "aire_acondicionado",
    "refrigeracion",
    "lavadoras",
    "electricidad",
    "domotica",
    "camaras",
  ],
  tipo: [
    "falla_comun",
    "error_frecuente",
    "consejo_rapido",
    "advertencia_seguridad",
    "tip_profesional",
    "mito_tecnico",
  ],
  objetivo: ["educar", "seguidores", "whatsapp", "guia_post", "marca_personal"],
  idioma: ["es", "en", "pt", "fr", "de"],
  duracion: [15, 30, 60],
  plataforma: ["facebook_reels", "tiktok", "youtube_shorts"],
  plantilla: ["viral", "educativa", "venta", "tutorial"],
} as const;

function isAllowed<T extends string>(
  val: unknown,
  list: readonly T[]
): val is T {
  return typeof val === "string" && (list as readonly string[]).includes(val);
}

function isReelDuracion(value: unknown): value is ReelDuracion {
  return value === 15 || value === 30 || value === 60;
}

function badRequest(message: string) {
  const err: any = new Error(message);
  err.statusCode = 400;
  return err;
}

const AREA_LABEL: Record<ReelArea, string> = {
  aire_acondicionado: "Aire acondicionado",
  refrigeracion: "Refrigeración (neveras)",
  lavadoras: "Lavadoras y equipos de lavado",
  electricidad: "Electricidad",
  domotica: "Domótica",
  camaras: "Cámaras de seguridad",
};

const TIPO_LABEL: Record<ReelTipo, string> = {
  falla_comun: "Falla común",
  error_frecuente: "Error frecuente",
  consejo_rapido: "Consejo rápido",
  advertencia_seguridad: "Advertencia de seguridad",
  tip_profesional: "Tip profesional",
  mito_tecnico: "Mito técnico",
};

const OBJ_LABEL: Record<ReelObjetivo, string> = {
  educar: "Educar",
  seguidores: "Ganar seguidores",
  whatsapp: "Llevar a WhatsApp",
  guia_post: "Llevar a una guía/post",
  marca_personal: "Marca personal",
};

const PLAT_LABEL: Record<ReelPlataforma, string> = {
  facebook_reels: "Facebook Reels",
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
};

const PLANT_LABEL: Record<ReelPlantilla, string> = {
  viral: "Viral (hook fuerte, ritmo rápido)",
  educativa: "Educativa (claridad y pasos cortos)",
  venta: "Venta (beneficio + CTA a contacto)",
  tutorial: "Tutorial (mini paso a paso en cámara)",
};

const SYSTEM_PROMPT = `
Eres un técnico profesional con experiencia real en:
- Aire acondicionado
- Refrigeración (neveras)
- Lavadoras y equipos de lavado
- Electricidad
- Domótica
- Cámaras de seguridad

Tu tarea es generar guiones profesionales para videos cortos verticales
(Reels, Shorts, TikTok), pensados para publicarse en redes.

Usa lenguaje humano, claro y natural.
Habla como un técnico que explica frente a la cámara.

NO suenes académico.
NO suenes como inteligencia artificial.
NO hagas introducciones largas.
NO hagas listas innecesarias.
NO uses tecnicismos que no se dicen al hablar.

Optimiza el contenido para retener atención en los primeros 3 segundos.

Incluye advertencias de seguridad reales cuando el tema lo requiera.

Responde ÚNICAMENTE en el idioma solicitado.
`.trim();

function buildUserPrompt(payload: {
  area: ReelArea;
  tipo: ReelTipo;
  duracion: ReelDuracion;
  objetivo: ReelObjetivo;
  idioma: ReelIdioma;
  tema: string;
  plataforma: ReelPlataforma;
  plantilla: ReelPlantilla;
}) {
  return `
Área técnica: ${AREA_LABEL[payload.area]}
Tipo de contenido: ${TIPO_LABEL[payload.tipo]}
Duración del video: ${payload.duracion} segundos
Objetivo del video: ${OBJ_LABEL[payload.objetivo]}
Plataforma: ${PLAT_LABEL[payload.plataforma]}
Plantilla: ${PLANT_LABEL[payload.plantilla]}
Idioma: ${payload.idioma}
Tema específico: ${payload.tema}

Genera un guion para un video corto siguiendo EXACTAMENTE este formato:

🟦 TÍTULO CORTO PARA FACEBOOK:
Título llamativo, breve y claro (máximo 8–10 palabras).
NO uses emojis.
NO uses mayúsculas exageradas.
NO uses clickbait falso.

🎬 HOOK (0–3 segundos):
Frase corta, directa y llamativa que atrape al espectador desde el inicio.

🎙️ TEXTO PARA HABLAR:
Guion natural, como si el técnico estuviera explicando el problema o consejo
frente a la cámara. Ajusta el contenido a la duración indicada.

👆 QUÉ MOSTRAR EN CÁMARA:
Indica claramente qué debe mostrar la persona mientras habla
(pieza, panel, manguera, filtro, cable, gesto, acercamiento, etc.).

⚠️ ADVERTENCIA O ERROR COMÚN:
Menciona un error frecuente o un riesgo real.
Si no aplica, incluye un consejo preventivo profesional.

📢 CTA FINAL:
Llamado a la acción claro y coherente con el objetivo indicado.

📝 DESCRIPCIÓN PARA REEL:
Texto optimizado para la plataforma indicada, humano, natural y listo para copiar y pegar.

#️⃣ HASHTAGS:
Hashtags técnicos y relevantes, sin exagerar.

NO inventes enlaces.
NO menciones que eres una IA.
NO hagas preguntas al usuario.
NO agregues texto fuera del formato indicado.
`.trim();
}

export async function generateReelScript(raw: any): Promise<{ raw: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw badRequest("OPENAI_API_KEY no está configurada en el servidor");

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const area = raw?.area;
  const tipo = raw?.tipo;
  const objetivo = raw?.objetivo;
  const idioma = raw?.idioma;

  // ✅ Tipado correcto: convertimos number -> 15|30|60 con type guard
  const rawDuracion = raw?.duracion;
  let duracion: ReelDuracion;

  if (isReelDuracion(rawDuracion)) {
    duracion = rawDuracion;
  } else if (
    typeof rawDuracion === "string" &&
    isReelDuracion(Number(rawDuracion))
  ) {
    duracion = Number(rawDuracion) as ReelDuracion; // seguro por isReelDuracion
  } else {
    throw badRequest("Duración inválida (solo 15, 30 o 60 segundos)");
  }

  const tema =
    typeof raw?.tema === "string" ? raw.tema.trim().slice(0, 140) : "";

  if (!isAllowed(area, allowed.area)) throw badRequest("Área inválida");
  if (!isAllowed(tipo, allowed.tipo)) throw badRequest("Tipo inválido");
  if (!isAllowed(objetivo, allowed.objetivo))
    throw badRequest("Objetivo inválido");
  if (!isAllowed(idioma, allowed.idioma)) throw badRequest("Idioma inválido");
  if (!tema || tema.length < 6)
    throw badRequest("Tema muy corto (mínimo 6 caracteres)");

  const plataforma: ReelPlataforma = isAllowed(
    raw?.plataforma,
    allowed.plataforma
  )
    ? raw.plataforma
    : "facebook_reels";

  const plantilla: ReelPlantilla = isAllowed(raw?.plantilla, allowed.plantilla)
    ? raw.plantilla
    : "educativa";

  const openai = new OpenAI({
    apiKey,
    organization: process.env.OPENAI_ORG,
  });

  const userPrompt = buildUserPrompt({
    area,
    tipo,
    duracion,
    objetivo,
    idioma,
    tema,
    plataforma,
    plantilla,
  });

  const response = await openai.responses.create({
    model,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    max_output_tokens: 650,
  });

  const out = (response as any).output_text?.trim?.() || "";
  if (!out) throw new Error("La IA no devolvió salida");

  return { raw: out };
}
