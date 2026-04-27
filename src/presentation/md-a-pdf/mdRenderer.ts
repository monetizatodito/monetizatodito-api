// src/presentation/md-a-pdf/mdRenderer.ts
import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import toc from "markdown-it-toc-done-right";

type PageMargins = {
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
};

type Watermark = {
  dataUrl: string;
  opacity?: number;
  sizePct?: number; // 100 = base, 110 = +10%
  rotateDeg?: number; // grados
  mode?: "cover" | "contain";
  scope?: "page" | "column";
};

type Cover = {
  title?: string;
  author?: string;
  date?: string;
  logoDataUrl?: string;
};

const brand = {
  name: process.env.BRAND_NAME || "Mosan",
  primary: process.env.BRAND_PRIMARY || "#3B82F6",
  logoUrl: process.env.BRAND_LOGO_URL || "",
};

const baseCSS = (page?: PageMargins) => `
<style>
  :root{
    --brand-primary:${brand.primary};
    --content-pad:32px;
    --content-max:860px;
  }

  *{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body{ margin:0; padding:var(--content-pad); font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,"Noto Sans",sans-serif; }
  .markdown-body{ max-width:var(--content-max); margin:0 auto; }

  .brand-header{ display:flex; align-items:center; gap:12px; margin-bottom:16px; }
  .brand-pill{ background:var(--brand-primary); color:#fff; font-weight:600; padding:6px 10px; border-radius:6px; font-size:12px; }
  .shiki{ background-color:var(--shiki-color-background); color:var(--shiki-color-text); font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace; font-size:13px; border-radius:8px; padding:12px; overflow:auto; }

  /* ====== Área de página (por si la necesitas en otros cálculos) ====== */
  html{
    --page-mt:${page?.marginTop ?? "18mm"};
    --page-mr:${page?.marginRight ?? "14mm"};
    --page-mb:${page?.marginBottom ?? "18mm"};
    --page-ml:${page?.marginLeft ?? "14mm"};
  }

  /* ====== Marca de agua: posición/tamaño controlados por JS ====== */
  .wm-img{
    position: fixed;
    z-index: 0;
    pointer-events: none;

    /* Estas 3 variables las calcula el script según .markdown-body */
    left: var(--wm-cx, 50vw);
    top:  var(--wm-cy, 50vh);
    width: var(--wm-side, 60vw);
    height: auto;

    transform: translate(-50%, -50%)
               rotate(var(--wm-rotate, -12deg))
               scale(var(--wm-scale, 1));
    transform-origin: center center;
    opacity: var(--wm-opacity, 0.16);
    background: transparent;
    border: 0;
  }

  /* contenido por encima de la WM */
  body > .brand-header,
  body > header,
  body > article{
    position: relative;
    z-index: 1;
  }

  @page{
    margin:${page?.marginTop ?? "18mm"} ${page?.marginRight ?? "14mm"}
           ${page?.marginBottom ?? "18mm"} ${page?.marginLeft ?? "14mm"};
  }
</style>
`;

type ShikiModule = typeof import("shiki");
let shikiModPromise: Promise<ShikiModule> | null = null;
function loadShiki(): Promise<ShikiModule> {
  if (!shikiModPromise) {
    const importer = new Function("m", "return import(m)");
    shikiModPromise = (importer as any)("shiki") as Promise<ShikiModule>;
  }
  return shikiModPromise;
}

let cachedHighlighter: any | null = null;
async function getHighlighterCompat(
  theme: string
): Promise<{ h: any; themeOpt: string }> {
  const shiki = await loadShiki();

  const langs = [
    "cpp",
    "c",
    "bash",
    "python",
    "typescript",
    "javascript",
    "json",
    "html",
    "css",
    "markdown",
    "plaintext",
    "txt",
    "text",
  ];

  if (cachedHighlighter) return { h: cachedHighlighter, themeOpt: theme };

  const gh: any = (shiki as any).getHighlighter;
  if (typeof gh !== "function")
    throw new Error("Shiki no expone getHighlighter.");

  try {
    cachedHighlighter = await gh({ themes: [theme], langs });
  } catch {
    cachedHighlighter = await gh({ theme, langs });
  }
  return { h: cachedHighlighter, themeOpt: theme };
}

const LANG_ALIASES: Record<string, string> = {
  "c++": "cpp",
  cc: "cpp",
  hpp: "cpp",
  "c#": "csharp",
  cs: "csharp",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  md: "markdown",
  yml: "yaml",
};
function normalizeLang(raw?: string) {
  const n = (raw || "").trim().toLowerCase();
  return LANG_ALIASES[n] ?? n;
}

/* =========================================================
   Render HTML con WM
   ========================================================= */
export async function mdToHTML(
  mdText: string,
  opts?: {
    theme?: string;
    title?: string;
    page?: PageMargins;
    cover?: Cover;
    watermark?: Watermark;
  }
): Promise<string> {
  const theme = opts?.theme || "github-dark";

  let highlighter: any | null = null;
  let themeOpt = theme;
  try {
    const r = await getHighlighterCompat(theme);
    highlighter = r.h;
    themeOpt = r.themeOpt;
  } catch (e) {
    console.error("[mdToHTML] Shiki no disponible:", (e as Error)?.message);
  }

  const md = new MarkdownIt({ html: false, breaks: true, typographer: true });
  md.set({
    highlight(code: string, lang?: string): string {
      try {
        if (!highlighter) throw new Error("sin-highlighter");
        const getLoaded = (highlighter as any).getLoadedLanguages;
        const loaded: string[] =
          typeof getLoaded === "function"
            ? (getLoaded.call(highlighter) as string[])
            : [];
        const loadedLC = loaded.map((l) => l.toLowerCase());
        const requested = normalizeLang(lang);
        const fallback = loadedLC.includes("plaintext")
          ? "plaintext"
          : loadedLC.includes("txt")
            ? "txt"
            : loadedLC.includes("text")
              ? "text"
              : "txt";
        const finalLang =
          requested && loadedLC.includes(requested) ? requested : fallback;

        return (highlighter as any).codeToHtml(code, {
          lang: finalLang,
          theme: themeOpt,
        });
      } catch {
        const esc = md.utils.escapeHtml(code);
        return `<pre class="shiki"><code>${esc}</code></pre>`;
      }
    },
  });

  md.use(anchor as any, { permalink: false }).use(toc as any, {
    listType: "ul",
    level: [1, 2, 3],
  });

  const finalHtml = md.render(mdText || "");

  // ===== Marca de agua =====
  const wm = opts?.watermark;
  const hasWM = Boolean(wm?.dataUrl);
  const deg = wm?.rotateDeg ?? -12;
  const opacity = wm?.opacity ?? 0.16;
  const sizePct = wm?.sizePct ?? 100; // multiplicador opcional del usuario

  const wmBlock = hasWM
    ? `
      <img class="wm-img"
           src="${wm!.dataUrl}"
           alt="wm"
           style="--wm-rotate:${deg}deg; --wm-opacity:${opacity}; --wm-sizepct:${sizePct};" />
      <script>
      (function(){
        const img = document.querySelector('.wm-img');
        const article = document.querySelector('article.markdown-body');
        if(!img || !article) return;

        function place(){
          const r = article.getBoundingClientRect();

          // Centro del rectángulo de contenido (evita headers/footers/márgenes)
          const cx = r.left + r.width/2;
          const cy = r.top  + r.height/2;

          // Lado base = 90% del lado menor del rectángulo de contenido
          const side = Math.min(r.width, r.height) * 0.90;

          // Variables CSS para posición/tamaño
          img.style.setProperty('--wm-cx', cx + 'px');
          img.style.setProperty('--wm-cy', cy + 'px');
          img.style.setProperty('--wm-side', side + 'px');

          // Escala segura según aspect ratio + rotación
          const styles = getComputedStyle(img);
          const deg = parseFloat(styles.getPropertyValue('--wm-rotate')) || 0;
          const rad = Math.abs(deg) * Math.PI / 180;
          const c = Math.abs(Math.cos(rad));
          const s = Math.abs(Math.sin(rad));
          const w = img.naturalWidth  || 1;
          const h = img.naturalHeight || 1;
          const ratio = h / w; // alto/ancho

          // escala mínima que cabe en un cuadro unitario rotado
          const scaleContain = 1 / Math.max(c + ratio*s, ratio*c + s);

          // Boost opcional (watermarkSizePct)
          const sizePct = parseFloat(styles.getPropertyValue('--wm-sizepct')) || 100;

          img.style.setProperty('--wm-scale', String(scaleContain * (sizePct/100)));
        }

        function ready(fn){
          if (document.readyState === 'complete' || document.readyState === 'interactive') {
            fn();
          } else {
            window.addEventListener('DOMContentLoaded', fn, {once:true});
          }
        }

        if (img.complete) ready(place);
        else img.addEventListener('load', () => ready(place), { once: true });

        // Recalcular si cambia el layout
        window.addEventListener('resize', place);
      })();
      </script>
    `
    : "";

  const coverHtml = renderCover(opts?.cover);

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(opts?.title ?? "Documento")}</title>
  ${baseCSS(opts?.page)}
  <style>.markdown-body .anchor { display:none !important; }</style>
</head>
<body class="${hasWM ? "wm-on" : "wm-off"}">
  ${wmBlock}

  <div class="brand-header">
    ${brand.logoUrl ? `<img src="${brand.logoUrl}" alt="${brand.name}" style="height:24px">` : ""}
    <span class="brand-pill">${brand.name}</span>
  </div>

  ${coverHtml}

  <article class="markdown-body">
    ${finalHtml}
  </article>
</body>
</html>`;

  return html;
}

/* =========================================================
   Helpers
   ========================================================= */
function renderCover(c?: Cover): string {
  if (!c) return "";
  const logo = c.logoDataUrl?.startsWith("data:image")
    ? `<div style="margin-top:24px;"><img src="${c.logoDataUrl}" alt="logo" style="max-width:220px; max-height:120px;" /></div>`
    : "";
  const t = c.title || "";
  const a = c.author || "";
  const d = c.date || "";
  if (!t && !a && !d && !logo) return "";
  return `
  <header style="page-break-after:always; text-align:center; padding:48px 24px;">
    ${t ? `<h1 style="margin:0 0 8px 0;">${escapeHtml(t)}</h1>` : ""}
    ${a ? `<div>${escapeHtml(a)}</div>` : ""}
    ${d ? `<div>${escapeHtml(d)}</div>` : ""}
    ${logo}
  </header>`;
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>\"']/g,
    (ch) =>
      (
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }) as Record<string, string>
      )[ch]!
  );
}
