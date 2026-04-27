// Si tu Node es < 18, descomenta esto:
// import fetch from "node-fetch";

export class IndexNowService {
  private enabled = process.env.INDEXNOW_ENABLED === "true";
  private key = process.env.INDEXNOW_KEY || "";
  private host = process.env.INDEXNOW_HOST || "mosanmultiverso.com";
  private keyLocation =
    process.env.INDEXNOW_KEY_LOCATION || `https://${this.host}/${this.key}.txt`;
  private endpoint =
    process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow";

  private normalizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url.trim());

      if (parsed.hostname !== this.host) return null;
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
        return null;

      return parsed.toString();
    } catch {
      return null;
    }
  }

  async submitUrls(urls: string[]) {
    if (!this.enabled) return { ok: true, skipped: true };

    if (!this.key) {
      throw new Error("INDEXNOW_KEY no configurada");
    }

    const cleanUrls = Array.from(
      new Set(
        urls
          .map((u) => this.normalizeUrl(u))
          .filter((u): u is string => Boolean(u)),
      ),
    );

    if (!cleanUrls.length) return { ok: true, skipped: true };

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        host: this.host,
        key: this.key,
        keyLocation: this.keyLocation,
        urlList: cleanUrls,
      }),
    });

    const text = await res.text().catch(() => "");

    if (![200, 202].includes(res.status)) {
      throw new Error(`IndexNow error ${res.status}: ${text || "sin detalle"}`);
    }

    console.log("✅ IndexNow enviado", {
      status: res.status,
      total: cleanUrls.length,
    });

    return {
      ok: true,
      status: res.status,
      total: cleanUrls.length,
      body: text,
    };
  }
}
