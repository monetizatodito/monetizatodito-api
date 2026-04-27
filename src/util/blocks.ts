// utils/blocks.ts
import { createHash } from "crypto";
import { generarIdUnico } from "../config/generar-id";

export type Block = {
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
  hash?: string;
};

export type Contenido = { blocks: Block[] };

function normalizeHTML(html: string) {
  return (html || "").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}
function sha1(s: string) {
  return createHash("sha1").update(s).digest("hex");
}

export function ensureIdsAndHashes(contenido: any): Contenido {
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

export function diffBlocks(prevC: Contenido, nextC: Contenido) {
  const prevMap = new Map<string, string>(); // id -> hash
  for (const b of prevC.blocks) if (b.id && b.hash) prevMap.set(b.id, b.hash);

  const changedIds: string[] = [];
  for (const b of nextC.blocks) {
    const prevHash = b.id ? prevMap.get(b.id) : undefined;
    if (!prevHash || prevHash !== b.hash) changedIds.push(b.id!);
  }
  return changedIds;
}
