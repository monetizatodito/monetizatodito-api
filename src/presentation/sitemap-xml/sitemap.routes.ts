import { Router } from "express";
import { SitemapXmlControlador } from "./sitemap.controlador";
import { SitemapENXmlControlador } from "./sitemap-en";
import { SitemapARXmlControlador } from "./sitemap-ar";
import { SitemapDEXmlControlador } from "./sitemap-de";
import { SitemapFRXmlControlador } from "./sitemap-fr";
import { SitemapPTXmlControlador } from "./sitemap-pt";

export class SitemapRoutes {
  static get routes(): Router {
    const router = Router();

    const controller = new SitemapXmlControlador();
    const controladorEN = new SitemapENXmlControlador();
    const controladorAR = new SitemapARXmlControlador();
    const controladorDE = new SitemapDEXmlControlador();
    const controladorFR = new SitemapFRXmlControlador();
    const controladorPT = new SitemapPTXmlControlador();

    router.get("/sitemap.xml", controller.getSitemapXml);
    router.get("/sitemap-en.xml", controladorEN.getSitemapEnXml);
    router.get("/sitemap-ar.xml", controladorAR.getSitemapArXml);
    router.get("/sitemap-de.xml", controladorDE.getSitemapDeXml);
    router.get("/sitemap-pt.xml", controladorPT.getSitemapPtXml);
    router.get("/sitemap-fr.xml", controladorFR.getSitemapFrXml);

    return router;
  }
}
