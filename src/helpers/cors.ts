// helpers/cors.ts (opcional) o dentro de Server.start()
export function buildAllowedOrigins() {
  const parse = (v?: string) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const set = new Set<string>([
    ...parse(process.env.FRONTEND_URL), // <-- producción (dominios reales)
    ...parse(process.env.FRONTEND_URL_LOCAL), // <-- dev/local
  ]);

  // Opcional: permitir previews de Vercel si pones CORS_ALLOW_VERCEL=1
  if (process.env.CORS_ALLOW_VERCEL === "1") {
    // los orígenes exactos se validan abajo con endsWith
  }

  return Array.from(set);
}
