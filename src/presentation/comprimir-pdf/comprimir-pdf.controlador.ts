import type { Request, Response } from "express";
import path from "path";
import fs from "fs";
import {
  PdfCompressorService,
  type CompressResult,
} from "./comprimir-pdf.service";

type Profile = "high" | "recommended" | "smallest" | "custom";
const allowed = [".pdf"];

function kb(n: number) {
  return (n / 1024).toFixed(1) + " KB";
}

export class PdfCompressController {
  private svc = new PdfCompressorService();

  uploadFile = (req: Request, res: Response) => {
    // ---------- Validación archivo ----------
    if (!req.files || (!(req.files as any).file && !(req.files as any).pdf)) {
      res.status(400).json({ message: "No se envió ningún archivo." });
      return;
    }
    const theFile = Array.isArray((req.files as any).file)
      ? (req.files as any).file[0]
      : (req.files as any).file || (req.files as any).pdf;

    const ext = path.extname(theFile.name || "").toLowerCase();
    if (!allowed.includes(ext)) {
      res.status(400).json({ message: "Formato no soportado. Sube un PDF." });
      return;
    }

    // ---------- Paths ----------
    const uploads = path.join(__dirname, "..", "uploads");
    const outputs = path.join(__dirname, "..", "outputs");
    if (!fs.existsSync(uploads)) fs.mkdirSync(uploads, { recursive: true });
    if (!fs.existsSync(outputs)) fs.mkdirSync(outputs, { recursive: true });

    const id = Math.random().toString(36).slice(2);
    const unique = `${Date.now()}-${id}`;
    const tempPath = path.join(uploads, `${unique}-${theFile.name}`);

    // ---------- Query ----------
    const q = req.query;
    const targetKb = Number((q.targetKb ?? "").toString());
    const profile = String(q.profile || "recommended") as Profile;
    const mode = String(q.mode || ""); // "aggressive" o vacío
    const dpi = Number(q.dpi || NaN);
    const jpegq = Number(q.q || NaN);
    const grayscale =
      String(q.grayscale || "") === "1" ||
      String(q.grayscale || "").toLowerCase() === "true";

    // Para logs compactos
    const log = (lvl: "info" | "warn" | "error", ...args: any[]) =>
      console[lvl](`[compress][${id}]`, ...args);

    log("info", "Nueva petición");
    log("info", "Query:", JSON.stringify(q));

    // ---------- Helpers de respuesta ----------
    const done = (r: CompressResult, meta: Record<string, string | number>) => {
      log(
        "info",
        `Resultado -> orig=${kb(r.originalBytes)}, comp=${kb(r.compressedBytes)}, ratio=${(r.ratio ?? 1).toFixed(4)}, saved=${kb(r.savedBytes)}`
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(r.filename)}"`
      );
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private"
      );
      res.setHeader(
        "Access-Control-Expose-Headers",
        "Content-Disposition,X-Original-Bytes,X-Compressed-Bytes,X-Compression-Ratio,X-Saved-Bytes,X-Branch,X-Profile,X-TargetKB,X-Params,X-AllowRaster"
      );

      res.setHeader("X-Original-Bytes", String(r.originalBytes));
      res.setHeader("X-Compressed-Bytes", String(r.compressedBytes));
      res.setHeader("X-Compression-Ratio", (r.ratio ?? 1).toFixed(4));
      res.setHeader("X-Saved-Bytes", String(r.savedBytes));
      for (const [k, v] of Object.entries(meta))
        res.setHeader(`X-${k}`, String(v));

      // Enviamos archivo y limpiamos
      res.download(r.pdfPath, r.filename, () => {
        try {
          fs.unlinkSync(tempPath);
        } catch {}
        try {
          // si el servicio devolvió un path en outputs, bórralo para no acumular
          if (
            r.pdfPath !== tempPath &&
            r.pdfPath.includes(path.sep + "outputs" + path.sep)
          ) {
            fs.unlinkSync(r.pdfPath);
          }
        } catch {}
        log("info", "Descarga enviada y temporales limpiados.");
      });
    };

    const fail = (e: any) => {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
      log("error", e);
      res
        .status(500)
        .json({ message: "Error al comprimir el PDF.", error: String(e) });
    };

    // ---------- Mover archivo recibido ----------
    (theFile as any).mv(tempPath, async (mvErr: any) => {
      if (mvErr) {
        res.status(500).json({ message: "No se pudo guardar el archivo." });
        return;
      }

      try {
        const originalBytes = fs.statSync(tempPath).size;
        log("info", "Filename:", theFile.name);
        log("info", "Tamaño original:", kb(originalBytes));

        // ---------- 1) Target explícito del cliente (tiene prioridad) ----------
        if (Number.isFinite(targetKb) && targetKb > 1) {
          log("info", "Rama: target explícito =", targetKb, "KB");
          let branch = "target";

          // Primero, intentar acercarse al objetivo (búsqueda)
          let r = await this.svc.compressToTargetKB(
            tempPath,
            outputs,
            Math.floor(targetKb)
          );

          // Si quedó >= original o lejos del objetivo, probar agresivo
          if (
            r.compressedBytes >= originalBytes ||
            r.compressedBytes > Math.floor(targetKb) * 1024 * 1.05
          ) {
            log(
              "info",
              "Resultado lejos del target o >= original. Probando agresivo…"
            );
            const a = await this.svc.compressAggressive(tempPath, outputs, {
              dpi: Number.isFinite(dpi) ? dpi : 56,
              jpegq: Number.isFinite(jpegq) ? jpegq : 28,
              grayscale,
            });
            if (a.compressedBytes < r.compressedBytes) {
              r = a;
              branch = "target+aggressive";
            } else {
              log("info", "Se mantiene resultado de target.");
            }
          }

          done(r, {
            Branch: branch,
            Profile: String(profile),
            TargetKB: Math.floor(targetKb),
            Params: JSON.stringify({
              dpi: Number.isFinite(dpi) ? dpi : 56,
              q: Number.isFinite(jpegq) ? jpegq : 28,
              grayscale,
            }),
          });
          return;
        }

        // ---------- 2) Modo personalizado/agresivo explícito ----------
        if (profile === "custom" || mode === "aggressive") {
          log("info", "Rama: custom/aggressive");
          const r = await this.svc.compressAggressive(tempPath, outputs, {
            dpi: Number.isFinite(dpi) ? dpi : 56,
            jpegq: Number.isFinite(jpegq) ? jpegq : 28,
            grayscale,
          });
          done(r, {
            Branch: "custom-aggressive",
            Profile: "custom",
            Params: JSON.stringify({
              dpi: Number.isFinite(dpi) ? dpi : 56,
              q: Number.isFinite(jpegq) ? jpegq : 28,
              grayscale,
            }),
          });
          return;
        }

        // ---------- 3) Perfiles predefinidos ----------
        if (
          profile === "high" ||
          profile === "recommended" ||
          profile === "smallest"
        ) {
          const pct: Record<Exclude<Profile, "custom">, number> = {
            high: 0.85,
            recommended: 0.5,
            smallest: 0.4,
          };

          const allowRaster = profile === "smallest";
          const targetFromProfileKB = Math.max(
            1,
            Math.floor((originalBytes * pct[profile]) / 1024)
          );

          // ⚠️ FIX TS2367: calculamos una sola vez los parámetros según el perfil
          const paramsForProfile =
            profile === "smallest"
              ? { dpi: 56, jpegq: 28, grayscale: false }
              : { dpi: 72, jpegq: 40, grayscale: false };

          log(
            "info",
            `Rama: profile ${profile} => target aprox ${targetFromProfileKB} KB`
          );

          // 1º intento: búsqueda hacia el objetivo del perfil
          let r = await this.svc.compressToTargetKB(
            tempPath,
            outputs,
            targetFromProfileKB
          );

          // Si quedó arriba del objetivo (con margen) o >= original → agresivo con params del perfil
          if (
            r.compressedBytes >= originalBytes ||
            r.compressedBytes > targetFromProfileKB * 1024 * 1.05
          ) {
            log(
              "info",
              "Resultado lejos del target de perfil o >= original. Probando agresivo…"
            );
            const a = await this.svc.compressAggressive(
              tempPath,
              outputs,
              paramsForProfile
            );
            if (a.compressedBytes < r.compressedBytes) {
              r = a;
            } else {
              log("info", "Se mantiene resultado de target de perfil.");
            }
          }

          done(r, {
            Branch: "profile-target",
            Profile: profile,
            TargetKB: targetFromProfileKB,
            AllowRaster: Number(allowRaster), // meta informativa
          });
          return;
        }

        // ---------- 4) Fallback 50% ----------
        log("info", "Rama: fallback 50%");
        const r = await this.svc.compressToTargetKB(
          tempPath,
          outputs,
          Math.max(1, Math.floor((originalBytes * 0.5) / 1024))
        );
        done(r, { Branch: "fallback-50", Profile: "recommended" });
      } catch (e) {
        fail(e);
      }
    });
  };
}
