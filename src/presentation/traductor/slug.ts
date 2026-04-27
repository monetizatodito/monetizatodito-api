// Slugs nativos (Unicode): mantienen el script del idioma.
// Ej.: "每天天喝水的好处" -> "每天天喝水的好处"
//      "¿Quiénes somos?" -> "¿quiénes-somos?" (acentos se conservan)

export type Locale = "es" | "en" | "pt" | "fr" | "de" | "ar";

/**
 * Genera un slug "nativo" (Unicode) válido para URL:
 * - minúsculas
 * - espacios → guiones
 * - solo letras/números de cualquier idioma + guiones
 * - colapsa guiones y recorta extremos
 */
export function buildSlug(title: string, _locale?: Locale): string {
  const base = (title ?? "").trim().toLowerCase();

  const slug = base
    .replace(/[\s\p{Z}]+/gu, "-") // espacios -> guion
    .replace(/[^-\p{L}\p{N}]+/gu, "") // solo letras/números (cualquier script) y guiones
    .replace(/-+/g, "-") // colapsar guiones
    .replace(/^-|-$/g, ""); // recortar extremos

  // Fallback simple si quedara vacío (título solo con signos)
  return slug || "entrada";
}
