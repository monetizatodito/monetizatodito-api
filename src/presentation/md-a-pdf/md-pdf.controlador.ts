// src/presentation/md-a-pdf/md-pdf.controlador.ts
import { Request, Response } from "express";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { ShikiPuppeteerService } from "./shiki-puppeteer.service";
import { PandocService } from "./pandoc.service";
import {
  createMdDraft,
  deleteMdDraft,
  getMdDraftById,
  getDraftsByUser,
} from "../../repositorio/mdDraft.repo";
import { generarIdUnico } from "../../config/generar-id";

type FileUploadFile = {
  name?: string;
  data?: Buffer;
  tempFilePath?: string;
};

/** Convierte un dataURL (PNG/JPG/SVG) a archivo temporal y devuelve la ruta. */
async function dataUrlToTempImage(
  dataUrl?: string
): Promise<string | undefined> {
  if (!dataUrl || !dataUrl.startsWith("data:image")) return undefined;

  const m = dataUrl.match(
    /^data:(image\/[a-zA-Z0-9+.\-]+);base64,([A-Za-z0-9+/=]+)$/
  );
  if (!m) return undefined;

  const mime = m[1]; // p.ej. image/png
  const b64 = m[2];
  const buf = Buffer.from(b64, "base64");

  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/jpeg"
        ? "jpg"
        : mime === "image/svg+xml"
          ? "svg"
          : "img";

  const tmpPath = path.join(os.tmpdir(), `wm_${Date.now()}.${ext}`);
  await fs.writeFile(tmpPath, buf);
  return tmpPath;
}

function getUserId(req: Request, res: Response): string | undefined {
  const fromLocals = (res.locals as any)?.userId;
  if (fromLocals) return String(fromLocals);

  const fromReqUser =
    (req as any)?.user?.id ||
    (req as any)?.usuario?.id ||
    req.body?.usuario?.id;
  if (fromReqUser) return String(fromReqUser);

  const fromHeader = req.headers["x-user-id"] as string | undefined;
  return fromHeader;
}

function getDraftsDir(): string {
  const base = process.env.PUBLIC_PATH || "public";
  return path.resolve(base, "uploads", "md2pdf", "drafts");
}

function stamp(): string {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14); // yyyymmddhhmmss
}

async function extractMarkdown(
  req: Request
): Promise<{ mdText: string; baseName: string }> {
  let mdText = "";
  let baseName = (req.body?.title || "documento").toString();
  const fileAny = req.files?.file as unknown as FileUploadFile | undefined;

  if (fileAny?.tempFilePath) {
    mdText = await fs.readFile(fileAny.tempFilePath, "utf8");
    baseName = (fileAny.name || baseName).replace(/\.md$/i, "");
    return { mdText, baseName };
  }

  if (fileAny?.data && fileAny.data.length) {
    mdText = fileAny.data.toString("utf8");
    baseName = (fileAny.name || baseName).replace(/\.md$/i, "");
    return { mdText, baseName };
  }

  if (typeof req.body?.text === "string" && req.body.text.trim().length > 0) {
    mdText = req.body.text;
    return { mdText, baseName };
  }

  return { mdText: "", baseName };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export class Md2PdfController {
  // POST /api/md2pdf/save
  static async save(req: Request, res: Response) {
    try {
      const usuarioId = getUserId(req, res);
      if (!usuarioId) return res.status(401).send("No autenticado");

      const { mdText, baseName } = await extractMarkdown(req);
      if (!mdText)
        return res.status(400).send('Debe enviar "file" (.md) o "text"');

      const dir = getDraftsDir();
      await fs.mkdir(dir, { recursive: true });

      const id = generarIdUnico();
      const filename = `${baseName}-${stamp()}.md`;
      const storagePath = path.join(dir, `${id}-${filename}`);

      await fs.writeFile(storagePath, mdText, "utf8");

      await createMdDraft({ id, usuarioId, filename, storagePath });

      return res.status(201).json({ draftId: id, filename, storagePath });
    } catch (e) {
      console.error(e);
      return res.status(500).send("Error interno guardando borrador");
    }
  }

  // GET /api/md2pdf/drafts
  static async listDrafts(req: Request, res: Response) {
    try {
      const usuarioId = getUserId(req, res);
      if (!usuarioId) return res.status(401).send("No autenticado");

      const drafts = await getDraftsByUser(usuarioId);
      return res.status(200).json({ drafts });
    } catch (e) {
      console.error(e);
      return res.status(500).send("Error listando borradores");
    }
  }

  // PUT /api/md2pdf/drafts/:id
  static async updateDraft(req: Request, res: Response) {
    try {
      const usuarioId = getUserId(req, res);
      if (!usuarioId) return res.status(401).send("No autenticado");

      const { id } = req.params;
      const draft = await getMdDraftById(id);
      if (!draft) return res.status(404).send("Borrador no encontrado");
      if (String(draft.usuarioId) !== String(usuarioId)) {
        return res.status(403).send("Borrador pertenece a otro usuario");
      }

      const { mdText } = await extractMarkdown(req);
      if (!mdText)
        return res.status(400).send('Debe enviar "file" (.md) o "text"');

      await fs.writeFile(draft.storagePath, mdText, "utf8");
      return res.status(200).json({ ok: true, draftId: draft.id });
    } catch (e) {
      console.error(e);
      return res.status(500).send("Error actualizando borrador");
    }
  }

  // POST /api/md2pdf/convert?engine=shiki|pandoc
  static async convert(req: Request, res: Response) {
    try {
      const usuarioId = getUserId(req, res);
      if (!usuarioId) return res.status(401).send("No autenticado");

      const engine = (req.query.engine || "shiki").toString();

      const theme = (
        req.body?.theme ||
        req.query.theme ||
        "github-dark"
      ).toString();
      const title = (
        req.body?.title ||
        req.query.title ||
        "Documento"
      ).toString();
      const author = (req.body?.author || req.query.author || "").toString();
      const date = (req.body?.date || req.query.date || "").toString();

      const watermarkScopeRaw = (
        req.body?.watermarkScope ||
        req.query.watermarkScope ||
        "page"
      ).toString();
      const watermarkScope: "page" | "column" =
        watermarkScopeRaw === "column" ? "column" : "page";

      const pagesize = (
        req.body?.pagesize ||
        req.query.pagesize ||
        "A4"
      ).toString();
      const marginTop = (
        req.body?.marginTop ||
        req.query.marginTop ||
        "18mm"
      ).toString();
      const marginRight = (
        req.body?.marginRight ||
        req.query.marginRight ||
        "14mm"
      ).toString();
      const marginBottom = (
        req.body?.marginBottom ||
        req.query.marginBottom ||
        "18mm"
      ).toString();
      const marginLeft = (
        req.body?.marginLeft ||
        req.query.marginLeft ||
        "14mm"
      ).toString();

      const toc =
        (req.body?.toc || req.query.toc || "true").toString().toLowerCase() ===
        "true";
      const pageNumbers =
        (req.body?.pageNumbers || req.query.pageNumbers || "true")
          .toString()
          .toLowerCase() === "true";
      const highlight = (
        req.body?.highlight ||
        req.query.highlight ||
        "monokai"
      ).toString();

      const logoDataUrl = (req.body?.logoDataUrl || "").toString();

      // Parámetros de marca de agua (opcionales)
      const watermarkDataUrl = (
        req.body?.watermarkDataUrl ||
        req.query.watermarkDataUrl ||
        logoDataUrl ||
        process.env.BRAND_WM_DATAURL ||
        ""
      ).toString();

      const wmModeRaw = (
        req.body?.watermarkMode ||
        req.query.watermarkMode ||
        "contain"
      ).toString();
      const watermarkMode: "cover" | "contain" =
        wmModeRaw === "cover" ? "cover" : "contain";

      const wmOpacityRaw = Number(
        req.body?.watermarkOpacity ?? req.query.watermarkOpacity ?? 0.14
      );
      const watermarkOpacity = clamp(
        isFinite(wmOpacityRaw) ? wmOpacityRaw : 0.14,
        0,
        1
      );

      const wmRotateRaw = Number(
        req.body?.watermarkRotateDeg ??
          req.query.watermarkRotateDeg ??
          (watermarkMode === "contain" ? -15 : -28)
      );
      const watermarkRotateDeg = isFinite(wmRotateRaw)
        ? wmRotateRaw
        : watermarkMode === "contain"
          ? -15
          : -28;

      const wmSizeRaw = Number(
        req.body?.watermarkSizePct ?? req.query.watermarkSizePct ?? 165
      );
      const watermarkSizePct = clamp(
        isFinite(wmSizeRaw) ? wmSizeRaw : 165,
        5,
        400
      ); // solo aplica en cover

      console.log(
        "[md2pdf] engine=%s logo.len=%s wm.len=%s mode=%s",
        engine,
        logoDataUrl?.length || 0,
        watermarkDataUrl?.length || 0,
        watermarkMode
      );

      const draftId = (req.body?.draftId || req.query.draftId || "")
        .toString()
        .trim();

      let mdText = "";
      let baseName = "documento";
      let draftToCleanup: { id: string; storagePath: string } | null = null;

      if (draftId) {
        const draft = await getMdDraftById(draftId);
        if (!draft) return res.status(404).send("Borrador no encontrado");
        if (String(draft.usuarioId) !== String(usuarioId)) {
          return res.status(403).send("Borrador pertenece a otro usuario");
        }
        const buf = await fs.readFile(draft.storagePath);
        mdText = buf.toString("utf8");
        baseName = (draft.filename || "documento").replace(/\.md$/i, "");
        draftToCleanup = { id: draft.id, storagePath: draft.storagePath };
      } else {
        const extracted = await extractMarkdown(req);
        mdText = extracted.mdText;
        baseName = extracted.baseName;
        if (!mdText)
          return res
            .status(400)
            .send('Debe enviar "file" (.md), "text" o "draftId"');
      }

      let pdf: Buffer;

      if (engine === "shiki") {
        pdf = await ShikiPuppeteerService.mdToPdf({
          mdText,
          theme,
          docTitleForHtml: baseName,
          cover: { title, author, date, logoDataUrl },
          page: { marginTop, marginRight, marginBottom, marginLeft, pagesize },
          pageNumbers,

          // ⬇️ Marca de agua ⬇️
          watermarkDataUrl, // <-- aquí pasas tu imagen en base64 o URL

          // Opciones de render de la marca de agua
          watermarkMode: "contain", // o "cover"
          watermarkOpacity: 0.16, // ajusta la transparencia
          watermarkRotateDeg: -12, // grados de inclinación
          watermarkSizePct: 115, // si "contain", sube a 110–115 para más grande
          watermarkScope: "page", // o "column"
        });
      } else if (engine === "pandoc") {
        // Pandoc: convertir dataURL a archivo temporal si viene inline
        let wmTemp: string | undefined;
        try {
          wmTemp = await dataUrlToTempImage(watermarkDataUrl);

          pdf = await PandocService.mdToPdf({
            mdText,
            meta: { title, author, date },
            page: {
              pagesize,
              marginTop,
              marginRight,
              marginBottom,
              marginLeft,
            },
            toc,
            highlight,
            // solo si tienes implementado watermark en tu PandocService
            watermark: wmTemp
              ? {
                  filePath: wmTemp,
                  widthFrac: 0.7,
                  angleDeg: watermarkRotateDeg,
                }
              : undefined,
          });
        } finally {
          if (wmTemp) await fs.unlink(wmTemp).catch(() => {});
        }
      } else {
        return res.status(400).send("engine inválido (use shiki o pandoc)");
      }

      if (draftToCleanup) {
        try {
          await fs.unlink(draftToCleanup.storagePath).catch(() => {});
          await deleteMdDraft(draftToCleanup.id).catch(() => {});
        } catch {}
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${baseName}.pdf"`
      );
      return res.status(200).send(pdf);
    } catch (e) {
      console.error(e);
      return res.status(500).send("Error interno");
    }
  }
}
