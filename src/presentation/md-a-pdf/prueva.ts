// src/presentation/md-a-pdf/md-pdf.controlador.ts
import { Request, Response } from "express";
import path from "path";
import fs from "fs/promises";
import { ShikiPuppeteerService } from "./shiki-puppeteer.service";
import { PandocService } from "./pandoc.service";
import {
  createMdDraft,
  deleteMdDraft,
  getMdDraftById,
} from "../../repositorio/mdDraft.repo";
import { generarIdUnico } from "../../config/generar-id";

type FileUploadFile = {
  name?: string;
  data?: Buffer; // puede venir vacío si useTempFiles:true
  size?: number;
  tempFilePath?: string; // con useTempFiles:true viene aquí
  mimetype?: string;
  md5?: string;
  mv?: (savePath: string, cb: (err?: any) => void) => void;
};

function getUserId(req: Request, res: Response): string | undefined {
  // Preferido: set por middleware
  const fromLocals = (res.locals as any)?.userId;
  if (fromLocals) return String(fromLocals);

  // Alternativas por compatibilidad
  const fromReqUser = (req as any)?.user?.id || (req as any)?.usuario?.id;
  if (fromReqUser) return String(fromReqUser);

  const fromBody = (req.body as any)?.usuario?.id;
  if (fromBody) return String(fromBody);

  // Modo demo / pruebas (no usar en prod)
  const fromHeaderDemo = req.headers["x-user-id"] as string | undefined;
  return fromHeaderDemo;
}

function getDraftsDir(): string {
  const base = process.env.PUBLIC_PATH || "public";
  return path.resolve(base, "uploads", "md2pdf", "drafts");
}

function nowStamp(): string {
  // yyyymmddhhmmss
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14);
}

async function extractMarkdown(
  req: Request
): Promise<{ mdText: string; baseName: string }> {
  let mdText = "";
  let baseName = (req.body?.title || "documento").toString();

  const fileAny =
    (req.files?.file as unknown as FileUploadFile | undefined) || undefined;

  // 1) useTempFiles:true => tempFilePath
  if (fileAny?.tempFilePath) {
    mdText = await fs.readFile(fileAny.tempFilePath, "utf8");
    baseName = (fileAny.name || baseName).replace(/\.md$/i, "");
    return { mdText, baseName };
  }

  // 2) Buffer en memoria (useTempFiles:false)
  if (fileAny?.data && fileAny.data.length) {
    mdText = fileAny.data.toString("utf8");
    baseName = (fileAny.name || baseName).replace(/\.md$/i, "");
    return { mdText, baseName };
  }

  // 3) Campo de texto
  if (typeof req.body?.text === "string" && req.body.text.trim().length > 0) {
    mdText = req.body.text;
    return { mdText, baseName };
  }

  return { mdText: "", baseName };
}

export class Md2PdfController {
  /**
   * Guarda un borrador .md en /uploads/md2pdf/drafts y registra solo la referencia en BD.
   * Body: { text? } o file .md (express-fileupload).
   * Responde: { draftId, filename, storagePath }
   */
  static async save(req: Request, res: Response) {
    try {
      const usuarioId = getUserId(req, res);
      if (!usuarioId) return res.status(401).send("No autenticado");

      const { mdText, baseName } = await extractMarkdown(req);
      if (!mdText) {
        return res.status(400).send('Debe enviar "file" (.md) o "text"');
      }

      // Asegurar carpeta
      const dir = getDraftsDir();
      await fs.mkdir(dir, { recursive: true });

      // Generar nombre y escribir
      const draftId = generarIdUnico();
      const filename = `${baseName}-${nowStamp()}.md`;
      const storagePath = path.join(dir, `${draftId}-${filename}`);
      await fs.writeFile(storagePath, mdText, "utf8");

      // Insertar referencia (opcional: guarda title/baseName)
      await createMdDraft({
        id: draftId,
        usuarioId, // ⚠️ importante para FK
        filename,
        storagePath,
        title: baseName,
      });

      return res.status(201).json({ draftId, filename, storagePath });
    } catch (e) {
      console.error(e);
      return res.status(500).send("Error interno guardando borrador");
    }
  }

  /**
   * Convierte Markdown a PDF (Shiki+Puppeteer o Pandoc).
   * Si viene draftId: lee desde disco, genera PDF y luego borra archivo + registro.
   * Si no viene draftId: usa file/text como siempre.
   */
  static async convert(req: Request, res: Response) {
    try {
      const usuarioId = getUserId(req, res);
      if (!usuarioId) return res.status(401).send("No autenticado");

      const engine = (req.query.engine || "shiki").toString(); // 'shiki' | 'pandoc'

      // opciones comunes
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
      const draftId = (req.body?.draftId || req.query.draftId || "")
        .toString()
        .trim();

      let mdText = "";
      let baseName = "documento";
      let draftToCleanup: {
        id: string;
        storagePath: string;
        usuarioId: string;
      } | null = null;

      if (draftId) {
        // Leer borrador desde disco
        const draft = await getMdDraftById(draftId);
        if (!draft) return res.status(404).send("Borrador no encontrado");

        // Seguridad: el borrador debe pertenecer al usuario autenticado
        if (draft.usuarioId && String(draft.usuarioId) !== String(usuarioId)) {
          return res.status(403).send("Borrador pertenece a otro usuario");
        }

        const buf = await fs.readFile(draft.storagePath);
        mdText = buf.toString("utf8");
        baseName = (draft.title || draft.filename || "documento").replace(
          /\.md$/i,
          ""
        );
        draftToCleanup = {
          id: draft.id,
          storagePath: draft.storagePath,
          usuarioId,
        };
      } else {
        // Extraer desde file/text
        const extracted = await extractMarkdown(req);
        mdText = extracted.mdText;
        baseName = extracted.baseName || baseName;

        if (!mdText) {
          return res
            .status(400)
            .send('Debe enviar "file" (.md), "text" o "draftId"');
        }
      }

      // Generar PDF
      let pdf: Buffer;
      if (engine === "shiki") {
        pdf = await ShikiPuppeteerService.mdToPdf({
          mdText,
          theme,
          docTitleForHtml: baseName,
          cover: { title, author, date, logoDataUrl },
          page: { marginTop, marginRight, marginBottom, marginLeft, pagesize },
          pageNumbers,
        });
      } else if (engine === "pandoc") {
        pdf = await PandocService.mdToPdf({
          mdText,
          meta: { title, author, date },
          page: { pagesize, marginTop, marginRight, marginBottom, marginLeft },
          toc,
          highlight,
        });
      } else {
        return res.status(400).send("engine inválido (use shiki o pandoc)");
      }

      // Limpieza si fue un borrador
      if (draftToCleanup) {
        try {
          await fs.unlink(draftToCleanup.storagePath).catch(() => {});
          await deleteMdDraft(draftToCleanup.id).catch(() => {});
        } catch {
          // no interrumpir respuesta si la limpieza falla
        }
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
