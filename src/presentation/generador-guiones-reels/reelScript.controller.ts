import { Request, Response } from "express";
import { generateReelScript } from "./reelScript.service";

export async function generateReelScriptController(
  req: Request,
  res: Response
) {
  try {
    const body = req.body || {};

    const result = await generateReelScript(body);

    return res.status(200).json({
      ok: true,
      result,
    });
  } catch (err: any) {
    console.error("❌ Error en generateReelScriptController:", err);

    const msg = err?.message || "Error generando el guion";
    const status =
      err?.statusCode && Number.isInteger(err.statusCode)
        ? err.statusCode
        : 500;

    return res.status(status).json({
      ok: false,
      error: msg,
    });
  }
}
