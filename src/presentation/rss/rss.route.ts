import { Router } from "express";
import { RssXmlControlador } from "./rss";
import { RssENXmlControlador } from "./rss-en";
import { RssARXmlControlador } from "./rss-ar";
import { RssDEXmlControlador } from "./rss-de";
import { RssFRXmlControlador } from "./rss-fr";
import { RssPTXmlControlador } from "./rss-pt";

export class RssRoutes {
  static get routes(): Router {
    const router = Router();

    const controller = new RssXmlControlador();
    const controladorEN = new RssENXmlControlador();
    const controladorAR = new RssARXmlControlador();
    const controladorDE = new RssDEXmlControlador();
    const controladorFR = new RssFRXmlControlador();
    const controladorPT = new RssPTXmlControlador();

    router.get("/rss.xml", controller.getRssXml);
    router.get("/rss-en.xml", controladorEN.getRssEnXml);
    router.get("/rss-ar.xml", controladorAR.getRssArXml);
    router.get("/rss-de.xml", controladorDE.getRssDeXml);
    router.get("/rss-pt.xml", controladorPT.getRssPtXml);
    router.get("/rss-fr.xml", controladorFR.getRssFrXml);

    return router;
  }
}
