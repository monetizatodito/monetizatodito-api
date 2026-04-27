// src/.../services/pandoc.service.ts
import path from "path";
import fs from "fs/promises";
import os from "os";
import { spawn } from "child_process";

type WatermarkOpts = {
  /** Ruta a imagen ya en disco (opcional si usas dataUrl) */
  filePath?: string;
  /** data:image/...;base64,...  -> se guarda a tmp */
  dataUrl?: string;
  /** 0.0–1.0 del ancho de página (ej. 0.70) */
  widthFrac?: number;
  /** grados, ej. -25 */
  angleDeg?: number;
};

export class PandocService {
  static async mdToPdf(params: {
    mdText: string;
    meta: { title: string; author: string; date: string };
    page: {
      pagesize: string;
      marginTop: string;
      marginRight: string;
      marginBottom: string;
      marginLeft: string;
    };
    toc: boolean;
    highlight: string;
    /** NUEVO (opcional) */
    watermark?: WatermarkOpts;
  }): Promise<Buffer> {
    const { mdText, meta, page, toc, highlight, watermark } = params;

    const tmpDir = os.tmpdir();
    const mdPath = path.join(
      tmpDir,
      `${Date.now()}_${Math.random().toString(16).slice(2)}.md`
    );
    const outPdf = mdPath.replace(/\.md$/, ".pdf");
    await fs.writeFile(mdPath, mdText, "utf8");

    const pyPath = await resolvePyPath();

    // ---- Marca de agua: prepara PNG temporal si llega como dataUrl ----
    let wmTempPath: string | undefined = undefined;
    let wmPathToUse: string | undefined =
      watermark?.filePath && watermark.filePath.trim()
        ? watermark.filePath
        : undefined;

    if (!wmPathToUse && watermark?.dataUrl?.startsWith("data:image")) {
      const m = watermark.dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
      if (m?.[2]) {
        const buf = Buffer.from(m[2], "base64");
        wmTempPath = path.join(tmpDir, `wm_${Date.now()}.png`);
        await fs.writeFile(wmTempPath, buf);
        wmPathToUse = wmTempPath;
      }
    }

    const args = [
      pyPath,
      mdPath,
      outPdf,
      "--title",
      meta.title || "",
      "--author",
      meta.author || "",
      "--date",
      meta.date || "",
      "--pagesize",
      page.pagesize || "A4",
      "--marginTop",
      page.marginTop || "18mm",
      "--marginRight",
      page.marginRight || "14mm",
      "--marginBottom",
      page.marginBottom || "18mm",
      "--marginLeft",
      page.marginLeft || "14mm",
      "--toc",
      toc ? "true" : "false",
      "--highlight",
      highlight || "monokai",
    ];

    // ---- Añade flags de watermark si corresponde ----
    if (wmPathToUse) {
      args.push(
        "--wmPath",
        wmPathToUse,
        "--wmWidth",
        String(
          watermark?.widthFrac ?? 0.7 // 70% del ancho de página
        ),
        "--wmAngle",
        String(watermark?.angleDeg ?? -25)
      );
    }

    const py = spawn("python3", args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    py.stderr.on("data", (d) => (stderr += d.toString()));

    return await new Promise<Buffer>((resolve, reject) => {
      py.on("close", async (code) => {
        try {
          if (code !== 0) {
            return reject(new Error(stderr || "Error en conversión Pandoc"));
          }
          const pdfBuf = await fs.readFile(outPdf);
          resolve(pdfBuf);
        } catch (e) {
          reject(e as Error);
        } finally {
          // limpia temporales
          fs.unlink(mdPath).catch(() => {});
          fs.unlink(outPdf).catch(() => {});
          if (wmTempPath) fs.unlink(wmTempPath).catch(() => {});
        }
      });
    });
  }
}

/**
 * Resuelve la ruta del script Python en CommonJS.
 * Intenta primero relativo al archivo compilado, y si no está,
 * prueba relativo al cwd del proyecto (útil con ts-node).
 */
async function resolvePyPath(): Promise<string> {
  // Compilado: dist/.../services/pandoc.service.js → ../py/convert_md_to_pdf.py
  const candidate1 = path.join(__dirname, "..", "py", "convert_md_to_pdf.py");

  // Fuente: si ejecutas con ts-node desde root del repo
  // Ajusta este path si tu módulo se llama distinto (md2pdf, md-a-pdf, etc.)
  const candidate2 = path.join(
    process.cwd(),
    "src",
    "presentation",
    "md-a-pdf",
    "py",
    "convert_md_to_pdf.py"
  );

  if (await exists(candidate1)) return candidate1;
  if (await exists(candidate2)) return candidate2;

  // Último recurso: asume junto a este archivo (misma carpeta)
  const fallback = path.join(__dirname, "convert_md_to_pdf.py");
  if (await exists(fallback)) return fallback;

  throw new Error(
    `No se encontró convert_md_to_pdf.py. Probados:
    - ${candidate1}
    - ${candidate2}
    - ${fallback}`
  );
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
