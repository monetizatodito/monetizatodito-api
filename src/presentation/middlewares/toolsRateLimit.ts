import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Request } from "express";

/**
 * 10 requests por IP cada 10 minutos (por defecto).
 * Basado en IP real (con trust proxy bien configurado).
 */
export const toolsRateLimit = rateLimit({
  windowMs: Number(process.env.TOOLS_RATELIMIT_WINDOW_MS || 600000), // 10 min

  // Compatibilidad: algunas versiones usan "max", otras "limit"
  max: Number(process.env.TOOLS_RATELIMIT_MAX || 10),
  limit: Number(process.env.TOOLS_RATELIMIT_MAX || 10) as any,

  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: "Límite alcanzado. Intenta nuevamente en unos minutos.",
  },

  keyGenerator: (req: Request) => {
    // Si tienes `app.set("trust proxy", 1)`, req.ip ya viene correcto.
    // Aun así, tomamos X-Forwarded-For como fallback (primer IP).
    const xff = req.headers["x-forwarded-for"]?.toString();
    const rawIp = (req.ip || xff?.split(",")[0]?.trim() || "").toString();

    // ✅ Normaliza IPv6 para evitar bypass
    return rawIp ? ipKeyGenerator(rawIp) : "unknown";
  },
});
