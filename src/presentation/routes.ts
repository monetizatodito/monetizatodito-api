import { Router } from "express";
import { UsuarioRoutes } from "./usuario/usuario.routes";
import { ConfiguracionRoutes } from "./configuracion/configuracion.routes";
import { ProductoRoutes } from "./producto/producto.routes";

import { BlogRoutes } from "./blog/blog.routes";
import { PlanesRoutes } from "./planes/planes.routes";

import { CargarArchivoRoutes } from "./cargar-archivo/cargar-archivo.routes";

import { RollRoutes } from "./roll/roll.routes";
import { FacturaRoutes } from "./factura/fatura.routes";
import { UrlRoutes } from "./urls/url.routes";
import { ConvertirRoutes } from "./combertir-pdf-work/pdf-work.routes";
import { SitemapRoutes } from "./sitemap-xml/sitemap.routes";
import { PartidaRoutes } from "./juego/partida.routes";
import { ImagenWebpRoutes } from "./convertir-imagen-webp/imagen-webp.routes";
import { md2pdfRouter } from "./md-a-pdf/md-pdf.routes";
import { LibrosRoutes } from "./libros/libros.routes";
import { PaymentsRoutes } from "./ventas/ventas.routes";
import { CategoriasLibrosRoutes } from "./categoria-libros/categoria-libros.routes";
import { WordPdfRoutes } from "./convertir-word-pdf/word-pdf.routes";
import { ComprimirPdfRoutes } from "./comprimir-pdf/comprimir-pdf.routes";
import { VelocidadInternetRoutes } from "./velocidad-internet/velocidad-internet.routes";
import { DiagnosticoNeveraRoutes } from "./diagnostico-neveras/diagnostico.routes";
import { SeoRoutes } from "./seo/seo.routes";
import { FacebookBotRoutes } from "./facebook-bot/facebookBot.routes";
import { ReelScriptRoutes } from "./generador-guiones-reels/reelScript.routes";
import { QuizRoutes } from "./quiz/quiz.routes";
import { RssRoutes } from "./rss/rss.route";

export class AppRoutes {
  static get routes(): Router {
    const router = Router();

    router.use("/api/auth", UsuarioRoutes.routes);
    router.use("/api/productos", ProductoRoutes.routes);

    router.use("/api/planes", PlanesRoutes.routes);
    router.use("/api/url", UrlRoutes.routes);
    router.use("/api/blog", BlogRoutes.routes);
    router.use("/api/convertir", ImagenWebpRoutes.routes);
    router.use("/api/convertir-pdf", ConvertirRoutes.routes);
    router.use("/api/convertir-word-pdf", WordPdfRoutes.routes);
    router.use("/api/comprimir-pdf", ComprimirPdfRoutes.routes);
    router.use("/api/libros", LibrosRoutes.routes);
    router.use("/api/ventas", PaymentsRoutes.routes);
    router.use("/api", SitemapRoutes.routes);
    router.use("/api", RssRoutes.routes);
    router.use("/api", CategoriasLibrosRoutes.routes);
    router.use("/api", VelocidadInternetRoutes.routes);
    router.use("/api/nevera", DiagnosticoNeveraRoutes.routes);
    router.use("/api/seo", SeoRoutes.routes);
    router.use("/api", FacebookBotRoutes.routes);

    router.use("/api/md2pdf", md2pdfRouter);
    router.use("/api/cargar-archivo", CargarArchivoRoutes.routes);
    router.use("/api/partida", PartidaRoutes.routes);
    router.use("/api", ReelScriptRoutes.routes);
    router.use("/api/quiz", QuizRoutes.routes);

    router.use("/api/config", ConfiguracionRoutes.routes);
    router.use("/api/roll", RollRoutes.routes);
    router.use("/api/factura", FacturaRoutes.routes);
    //router.use('/api/pdf', PdfRoutes.routes);
    //router.use('/api/logout', LogoutRoutes.routes);

    return router;
  }
}
