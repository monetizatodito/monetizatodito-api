// src/presentation/md-a-pdf/shiki-puppeteer.service.ts
import puppeteer from "puppeteer";
import fs from "fs/promises";
import type { Page } from "puppeteer";
import { mdToHTML } from "./mdRenderer";

type LifeCycleEvent =
  | "load"
  | "domcontentloaded"
  | "networkidle0"
  | "networkidle2";

type PageCfg = {
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  pagesize: "A4" | "Letter" | string;
};

type CoverCfg = {
  title: string;
  author: string;
  date: string;
  logoDataUrl?: string;
};

export interface MdToPdfParams {
  mdText: string;
  theme: string;
  docTitleForHtml: string;
  cover: CoverCfg;
  page: PageCfg;
  pageNumbers: boolean;
  /** NUEVO (opcional): marca de agua */
  watermarkDataUrl?: string; // data:image/png;base64,...
  watermarkOpacity?: number; // 0.0 - 1.0 (default 0.08)
  watermarkSizePct?: number; // porcentaje del ancho de página (default 70)
  watermarkRotateDeg?: number; // grados (default -30)
  watermarkMode?: "cover" | "contain"; // 👈 NUEVO
  watermarkScope?: "page" | "column"; // default "page"
}

const BRAND_FOOTER_TEXT = process.env.BRAND_FOOTER_TEXT || "localhost";
const ENV_EXEC_PATH = process.env.PUPPETEER_EXECUTABLE_PATH;

export class ShikiPuppeteerService {
  static async mdToPdf(params: MdToPdfParams): Promise<Buffer> {
    const {
      mdText,
      theme,
      docTitleForHtml,
      cover,
      page: pageCfg,
      pageNumbers,
    } = params;

    // ...
    const html = await mdToHTML(mdText, {
      theme,
      title: docTitleForHtml,
      page: {
        marginTop: pageCfg.marginTop,
        marginRight: pageCfg.marginRight,
        marginBottom: pageCfg.marginBottom,
        marginLeft: pageCfg.marginLeft,
      },
      cover,
      watermark: params.watermarkDataUrl
        ? {
            dataUrl: params.watermarkDataUrl,
            /* ☑️ siempre "contain" por defecto */
            mode: params.watermarkMode ?? "contain",
            scope: params.watermarkScope ?? "page",
            opacity: params.watermarkOpacity ?? 0.14,
            /* en contain permitimos un “boost” opcional: usa watermarkSizePct como multiplicador */
            sizePct: params.watermarkSizePct, // opcional (100 = sin cambio)
            rotateDeg: params.watermarkRotateDeg ?? -15,
          }
        : undefined,
    });
    // ...

    const browser = await puppeteer.launch({
      headless: true, // tu versión solo acepta boolean | "shell"
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: ENV_EXEC_PATH || undefined,
    });

    let pageCtx: Page | null = null;
    try {
      pageCtx = await browser.newPage();
      const wait: LifeCycleEvent = "networkidle0";
      await pageCtx.setContent(html, { waitUntil: wait });

      const headerTemplate = pageNumbers
        ? `<div style="font-size:9px;width:100%;display:flex;justify-content:flex-end;padding-right:${pageCfg.marginRight};">
             <span class="pageNumber"></span>
           </div>`
        : `<div></div>`;

      const footerTemplate = `<div style="font-size:9px;width:100%;display:flex;justify-content:center;color:#666;">
        ${BRAND_FOOTER_TEXT}
      </div>`;
      console.log("[shiki] watermark?", Boolean(params.watermarkDataUrl));

      const useHeaderFooter = pageNumbers || Boolean(BRAND_FOOTER_TEXT);

      //borrar
      await fs.writeFile("/tmp/md2pdf_preview.html", html, "utf8");
      console.log("[md2pdf] preview -> /tmp/md2pdf_preview.html");
      // morrar el anterior
      const pdfBuffer = await pageCtx.pdf({
        format: pageCfg.pagesize === "Letter" ? "Letter" : "A4",
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: useHeaderFooter,
        headerTemplate,
        footerTemplate,
        margin: {
          top: pageCfg.marginTop,
          right: pageCfg.marginRight,
          bottom: pageCfg.marginBottom,
          left: pageCfg.marginLeft,
        },
      });

      return Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    } finally {
      if (pageCtx) await pageCtx.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }
}
