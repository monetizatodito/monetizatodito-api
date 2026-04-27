// src/dtos/UpdateBlogDto.ts
import { createHash } from "crypto";
import { generarIdUnico } from "../../config/generar-id";

type Locale = "es" | "en" | "pt" | "fr" | "de" | "ar";
type RetranslateStrategy = "changed-blocks" | "full";

type Block = {
  id?: string;
  type: string;
  html?: string;
  src?: string;
  alt?: string;
  align?: string;
  width?: string;
  fontSize?: string;
  fontFamily?: string;
  color?: string;
  hash?: string; // ← (hash/ids)
};
type Contenido = { blocks: Block[] };

// ---------- helpers (hash/ids) ----------
function normalizeHTML(html: string) {
  return (html || "").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}
function sha1(s: string) {
  return createHash("sha1").update(s).digest("hex");
}
function ensureIdsAndHashes(contenido: any): Contenido {
  const c: Contenido =
    typeof contenido === "string"
      ? JSON.parse(contenido)
      : (contenido ?? { blocks: [] });

  const blocks = (Array.isArray(c.blocks) ? c.blocks : []).map((b: Block) => {
    const out = { ...b };
    out.id ||= generarIdUnico();
    const payload =
      b.type === "imagen"
        ? `${b.type}|${b.src || ""}|${b.alt || ""}|${b.align || ""}|${b.width || ""}`
        : `${b.type}|${normalizeHTML(b.html || "")}`;
    out.hash = sha1(payload);
    return out;
  });

  return { blocks };
}

// ---------- DTO ----------
export class UpdateBlogDto {
  private constructor(
    public id: string,
    public titulo?: string,
    public contenido?: Contenido | string, // aceptamos string/obj
    public autor?: string,
    public descripcion?: string,
    public categoriaIds?: string[],
    public images?: string,
    public imagesAlt?: string, // ✅ NUEVO (ALT imagen principal)

    // ✅ NUEVO: lista opcional de URLs de YouTube (para UPDATE)
    public youtubeUrls?: string[],

    public updatedAt?: Date,

    // NUEVO: control de traducción
    public autoTranslate: boolean = false,
    public locales?: Locale[],
    public retranslateStrategy: RetranslateStrategy = "changed-blocks"
  ) {}

  /** Solo los campos presentes (para construir UPDATE dinámico) */
  get values() {
    const obj: { [key: string]: any } = {};
    if (this.titulo !== undefined) obj.titulo = this.titulo;
    if (this.contenido !== undefined) obj.contenido = this.contenido;
    if (this.autor !== undefined) obj.autor = this.autor;
    if (this.descripcion !== undefined) obj.descripcion = this.descripcion;
    if (this.images !== undefined) obj.images = this.images;
    // ✅ NUEVO: mapeo a columna DB (snake_case)
    if (this.imagesAlt !== undefined) obj.images_alt = this.imagesAlt;

    // ✅ NUEVO
    if (this.youtubeUrls !== undefined) obj.youtube_urls = this.youtubeUrls;

    if (this.updatedAt !== undefined) obj.updatedAt = this.updatedAt;

    return obj;
  }

  static create(obj: { [key: string]: any }): [string?, UpdateBlogDto?] {
    const {
      id,
      titulo,
      contenido,
      autor,
      descripcion,
      categoriaIds,
      images,
      imagesAlt, // ✅ NUEVO

      // ✅ NUEVO
      youtubeUrls,

      updatedAt,

      // NUEVO
      autoTranslate,
      locales,
      retranslateStrategy,
    } = obj;

    if (!id || typeof id !== "string") {
      return ["id es requerido"];
    }

    // fecha
    let newUpdatedAt: Date | undefined = undefined;
    if (updatedAt) {
      const d = new Date(updatedAt);
      if (isNaN(d.getTime())) return ["updatedAt debe ser una fecha válida"];
      newUpdatedAt = d;
    }

    // locales (opcional, si viene validar)
    let locs: Locale[] | undefined = undefined;
    if (Array.isArray(locales) && locales.length) {
      const allowed: Locale[] = ["es", "en", "pt", "fr", "de", "ar"];
      const cleaned = locales.filter((l: any): l is Locale =>
        allowed.includes(l)
      );
      if (cleaned.length === 0) return ["locales no válidos"];
      locs = cleaned;
    }

    // estrategia
    const strat: RetranslateStrategy =
      retranslateStrategy === "full" ? "full" : "changed-blocks";

    // contenido: normaliza y añade ids+hashes (hash/ids)
    let normalizedContent: Contenido | undefined = undefined;
    if (contenido !== undefined) {
      try {
        normalizedContent = ensureIdsAndHashes(contenido);
      } catch {
        return ["contenido debe ser JSON válido con blocks"];
      }
    }

    // ✅ NUEVO: valida youtubeUrls (opcional)
    const safeYoutubeUrls =
      youtubeUrls === undefined
        ? undefined
        : Array.isArray(youtubeUrls)
          ? youtubeUrls.filter((u: any) => typeof u === "string" && u.trim())
          : (() => {
              // si viene un string único, lo aceptamos también (opcional)
              if (typeof youtubeUrls === "string" && youtubeUrls.trim())
                return [youtubeUrls.trim()];
              return undefined;
            })();

    // ✅ NUEVO: ALT opcional (string limpio o undefined)
    const safeImagesAlt =
      imagesAlt === undefined
        ? undefined
        : typeof imagesAlt === "string" && imagesAlt.trim()
          ? imagesAlt.trim()
          : "";

    return [
      undefined,
      new UpdateBlogDto(
        id,
        titulo,
        normalizedContent ?? contenido,
        autor,
        descripcion,
        categoriaIds,
        images,
        safeImagesAlt, // ✅ aquí

        safeYoutubeUrls, // ✅

        newUpdatedAt,

        Boolean(autoTranslate),
        locs,
        strat
      ),
    ];
  }
}
