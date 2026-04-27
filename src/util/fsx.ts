// src/presentation/md-a-pdf/utils/extractMd.ts
import fs from "fs/promises";

type FileUploadFile = {
  name: string;
  data?: Buffer; // puede venir vacío si useTempFiles=true
  size?: number;
  tempFilePath?: string; // con useTempFiles=true viene aquí
  mimetype?: string;
  md5?: string;
};

export async function extractMdFromRequest(req: any) {
  let mdText = "";
  let baseName = (req.body?.title || "documento").toString();

  const fileAny = req.files?.file as unknown as FileUploadFile | undefined;

  if (fileAny) {
    // 1) Si hay tempFilePath, léelo del disco (useTempFiles: true)
    if (fileAny.tempFilePath) {
      mdText = await fs.readFile(fileAny.tempFilePath, "utf8");
      baseName = (fileAny.name || baseName).replace(/\.md$/i, "");
      return { mdText, baseName };
    }
    // 2) Si hay buffer en memoria (useTempFiles: false)
    if (fileAny.data && fileAny.data.length) {
      mdText = fileAny.data.toString("utf8");
      baseName = (fileAny.name || baseName).replace(/\.md$/i, "");
      return { mdText, baseName };
    }
  }

  // 3) Campo de texto (FormData.append('text', ...))
  if (typeof req.body?.text === "string" && req.body.text.trim().length > 0) {
    mdText = req.body.text;
    return { mdText, baseName };
  }

  // 4) Nada encontrado
  return { mdText: "", baseName };
}
