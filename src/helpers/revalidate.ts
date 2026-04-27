// helpers/revalidate.ts (o arriba del controlador)

export async function triggerRevalidate({
  tags = [],
  paths = [],
}: {
  tags?: string[];
  paths?: string[];
}) {
  if (!process.env.FRONTEND_URL || !process.env.REVALIDATE_SECRET) {
    console.error("[revalidate] Falta FRONTEND_URL o REVALIDATE_SECRET");
    return;
  }

  try {
    const res = await fetch(`${process.env.FRONTEND_URL}/api/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: process.env.REVALIDATE_SECRET,
        tags,
        paths,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("[revalidate] fallo:", res.status, txt);
    }
  } catch (e) {
    console.error("[revalidate] error de red:", e);
  }
}
