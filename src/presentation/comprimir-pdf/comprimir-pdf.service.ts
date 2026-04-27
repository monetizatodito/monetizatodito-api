import { spawn, exec } from "child_process";
import fs from "fs";
import path from "path";

export type CompressResult = {
  pdfPath: string;
  filename: string;
  originalBytes: number;
  compressedBytes: number;
  ratio: number;
  savedBytes: number;
};

type Preset = "screen" | "ebook" | "printer" | "prepress" | "default";

const GS_BIN = process.env.GHOSTSCRIPT_BIN || "/usr/bin/gs";
const QPDF_BIN = process.env.QPDF_BIN || "/usr/bin/qpdf";
const MUTOOL_BIN = process.env.MUTOOL_BIN || "/usr/bin/mutool";

/* ---------------------- utilidades ---------------------- */
function size(p: string): number {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}
function spawnp(bin: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(err.trim() || `${bin} failed (${code})`));
    });
  });
}
async function qpdfLinearize(input: string, output: string) {
  await spawnp(QPDF_BIN, ["--linearize", input, output]);
}

/** Compactado “sin pérdida” con qpdf (+ opcional mutool) sobre el PDF original */
async function qpdfCompact(input: string, tmpDir: string, tag: string) {
  const a = path.join(tmpDir, `${tag}.qpdf.pdf`);
  const b = path.join(tmpDir, `${tag}.qpdf-mutool.pdf`);
  try {
    // maximiza compresión de streams y genera object streams
    await spawnp(QPDF_BIN, [
      "--object-streams=generate",
      "--stream-data=compress",
      "--recompress-flate",
      "--linearize",
      input,
      a,
    ]);
    // mutool suele raspar algunos KB más (opcional)
    try {
      await spawnp(MUTOOL_BIN, ["clean", "-ggg", "-i", "-c", a, b]);
      if (fs.existsSync(b))
        return { path: b, size: size(b), tag: "qpdf+mutool" };
    } catch {
      /* noop */
    }
    if (fs.existsSync(a)) return { path: a, size: size(a), tag: "qpdf" };
  } catch {
    /* noop */
  }
  return null;
}

/* ---------------------- Servicio ---------------------- */
export class PdfCompressorService {
  private gs = GS_BIN;

  private gsArgsBase() {
    // PDF 1.7 → permite object streams y mejor compresión
    return ["-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.7"];
  }

  private async gsPreset(input: string, output: string, preset: Preset) {
    const args = [
      ...this.gsArgsBase(),
      `-dPDFSETTINGS=/${preset}`,
      "-dDetectDuplicateImages=true",
      "-dCompressFonts=true",
      "-dSubsetFonts=true",
      "-dAutoRotatePages=/None",
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${output}`,
      input,
    ];
    await spawnp(this.gs, args);
  }

  private async gsWithOptions(
    input: string,
    output: string,
    opts: { dpi: number; jpegq: number; grayscale?: boolean }
  ) {
    const args = [
      ...this.gsArgsBase(),
      "-dDetectDuplicateImages=true",
      "-dCompressFonts=true",
      "-dSubsetFonts=true",
      "-dAutoRotatePages=/None",
      "-dDownsampleColorImages=true",
      "-dDownsampleGrayImages=true",
      "-dDownsampleMonoImages=true",
      "-dColorImageDownsampleType=/Average",
      "-dGrayImageDownsampleType=/Average",
      "-dMonoImageDownsampleType=/Subsample",
      `-dColorImageResolution=${opts.dpi}`,
      `-dGrayImageResolution=${opts.dpi}`,
      `-dMonoImageResolution=${opts.dpi}`,
      "-dAutoFilterColorImages=false",
      "-dAutoFilterGrayImages=false",
      "-dEncodeColorImages=true",
      "-dEncodeGrayImages=true",
      "-dColorImageFilter=/DCTEncode",
      "-dGrayImageFilter=/DCTEncode",
      `-dJPEGQ=${opts.jpegq}`,
      ...(opts.grayscale
        ? ["-sColorConversionStrategy=Gray", "-dProcessColorModel=/DeviceGray"]
        : []),
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${output}`,
      input,
    ];
    await spawnp(this.gs, args);
  }

  /* ---------- Preset simple ---------- */
  async compressPreset(
    inputPath: string,
    outDir: string,
    preset: Preset = "ebook"
  ): Promise<CompressResult> {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const base = path.basename(inputPath, path.extname(inputPath));
    const outPath = path.join(outDir, `${base}.compressed.pdf`);

    const original = size(inputPath);
    await this.gsPreset(inputPath, outPath, preset);

    // Linearizar puede raspar algunos KB
    try {
      const lin = outPath.replace(/\.pdf$/i, ".lin.pdf");
      await qpdfLinearize(outPath, lin);
      fs.renameSync(lin, outPath);
    } catch {}

    const final = size(outPath);
    const chosen = final && final < original ? outPath : inputPath;
    return {
      pdfPath: chosen,
      filename: `${base}.pdf`,
      originalBytes: original,
      compressedBytes: chosen === outPath ? final : original,
      ratio: original ? (chosen === outPath ? final / original : 1) : 1,
      savedBytes: original - (chosen === outPath ? final : original),
    };
  }

  /* ---------- Target KB (mejor esfuerzo) ---------- */
  async compressToTargetKB(
    inputPath: string,
    outDir: string,
    targetKB: number
  ): Promise<CompressResult> {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const base = path.basename(inputPath, path.extname(inputPath));
    const finalPath = path.join(outDir, `${base}.compressed.pdf`);
    const tmp = (s: string) => path.join(outDir, `${base}.tmp.${s}.pdf`);

    const targetBytes = Math.max(1, Math.floor(targetKB * 1024));
    const original = size(inputPath);

    // Si ya es <= objetivo, devuelve tal cual
    if (original <= targetBytes) {
      fs.copyFileSync(inputPath, finalPath);
      return {
        pdfPath: finalPath,
        filename: `${base}.pdf`,
        originalBytes: original,
        compressedBytes: original,
        ratio: 1,
        savedBytes: 0,
      };
    }

    const candidates: Array<{ path: string; size: number; tag: string }> = [];

    // A) PRIMERO: compactación sin pérdida sobre el original (ideal para texto/vectores)
    const qp = await qpdfCompact(inputPath, outDir, "orig");
    if (qp) candidates.push(qp);

    // B) Búsqueda DPI/JPEGQ (si hay imágenes / objetivo más bajo)
    const dpis = [144, 120, 96, 84, 72, 64, 56, 48];
    let bestUnder: { path: string; size: number } | null = null;
    let bestOver: { path: string; size: number } | null = null;
    for (const dpi of dpis) {
      let lo = 30,
        hi = 92;
      for (let i = 0; i < 6; i++) {
        const mid = Math.round((lo + hi) / 2);
        const out = tmp(`search-dpi${dpi}-q${mid}`);
        try {
          await this.gsWithOptions(inputPath, out, { dpi, jpegq: mid });
          const sz = size(out);
          if (sz <= targetBytes) {
            if (!bestUnder || sz > bestUnder.size)
              bestUnder = { path: out, size: sz };
            lo = mid + 1;
          } else {
            if (!bestOver || sz < bestOver.size)
              bestOver = { path: out, size: sz };
            hi = mid - 1;
          }
        } catch {
          /* noop */
        }
      }
      if (bestUnder && bestUnder.size >= targetBytes * 0.97) break;
    }
    const chosenSearch = bestUnder ?? bestOver;
    if (chosenSearch) candidates.push({ ...chosenSearch, tag: "search" });

    // C) Presets texto/vector como alternativas
    try {
      const p = tmp("preset-ebook");
      await this.gsPreset(inputPath, p, "ebook");
      candidates.push({ path: p, size: size(p), tag: "preset-ebook" });
    } catch {}
    try {
      const p = tmp("preset-screen");
      await this.gsPreset(inputPath, p, "screen");
      candidates.push({ path: p, size: size(p), tag: "preset-screen" });
    } catch {}

    // D) Elegir el mejor
    const best = candidates
      .filter((c) => fs.existsSync(c.path))
      .sort((a, b) => a.size - b.size)[0];

    // Limpia temporales (excepto el ganador, que renombraremos)
    try {
      for (const f of fs.readdirSync(outDir)) {
        if (
          f.startsWith(`${base}.tmp.`) &&
          path.join(outDir, f) !== best?.path
        ) {
          try {
            fs.unlinkSync(path.join(outDir, f));
          } catch {}
        }
      }
    } catch {}

    // No inflar
    if (!best || best.size >= original) {
      fs.copyFileSync(inputPath, finalPath);
      return {
        pdfPath: finalPath,
        filename: `${base}.pdf`,
        originalBytes: original,
        compressedBytes: original,
        ratio: 1,
        savedBytes: 0,
      };
    }

    try {
      fs.existsSync(finalPath) && fs.unlinkSync(finalPath);
    } catch {}
    fs.renameSync(best.path, finalPath);

    const final = size(finalPath);
    return {
      pdfPath: finalPath,
      filename: `${base}.pdf`,
      originalBytes: original,
      compressedBytes: final,
      ratio: original ? final / original : 1,
      savedBytes: original - final,
    };
  }

  /* ---------- Agresivo (útil con muchas imágenes/escaneos) ---------- */
  async compressAggressive(
    inputPath: string,
    outDir: string,
    opts?: { dpi?: number; jpegq?: number; grayscale?: boolean }
  ): Promise<CompressResult> {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const base = path.basename(inputPath, path.extname(inputPath));
    const outPath = path.join(outDir, `${base}.compressed.pdf`);

    const original = size(inputPath);
    const dpi = opts?.dpi ?? 72;
    const jpegq = opts?.jpegq ?? 40;
    const gray = !!opts?.grayscale;

    await this.gsWithOptions(inputPath, outPath, {
      dpi,
      jpegq,
      grayscale: gray,
    });

    // Linearizar (ligero extra)
    try {
      const lin = outPath.replace(/\.pdf$/i, ".lin.pdf");
      await qpdfLinearize(outPath, lin);
      fs.renameSync(lin, outPath);
    } catch {}

    const final = size(outPath);
    const deliver = final && final < original ? outPath : inputPath;
    return {
      pdfPath: deliver,
      filename: `${base}.pdf`,
      originalBytes: original,
      compressedBytes: deliver === outPath ? final : original,
      ratio: original ? (deliver === outPath ? final / original : 1) : 1,
      savedBytes: original - (deliver === outPath ? final : original),
    };
  }
}
