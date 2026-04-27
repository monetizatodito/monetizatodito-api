// src/libros/libros.controlador.ts
import { Request, Response } from "express";
import { LibrosService } from "./libros.service";
import { CustomError } from "../../error/custom.error";
import path from "path";
import fs from "fs";
import { LibroEntity } from "../../entity/libros/libro.entity";

const UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.join(process.cwd(), "archivos-cargado");

const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

type LibrosQuery = {
  categoriaId?: string | string[];
  subcategoriaId?: string | string[];
};

export class LibrosControlador {
  constructor(private readonly service = new LibrosService()) {}

  private toStr(v: unknown): string | undefined {
    if (typeof v === "string") return v;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
    return undefined;
  }

  crear = async (req: Request, res: Response) => {
    try {
      // ⚠️ con express-fileupload (o similar) req.body tendrá los fields de multipart/form-data
      const b: any = req.body || {};

      // Acepta camelCase o snake_case
      const dto = {
        title: b.title,
        description: b.description,
        price: b.price ?? b.price_usd,
        pages: b.pages,
        language: b.language,
        previewPages: b.previewPages ?? b.preview_pages ?? "",
        tipo: b.tipo, // 'gratis' | 'pagado'
        isFree: b.isFree ?? b.is_free, // 'true' | 'false' | boolean
        pdfUrl: b.pdfUrl ?? b.pdf_url, // 👈 importante
        portadaUrl: b.portadaUrl ?? b.portada_url,
        categoriaId: b.categoriaId ?? b.categoria_id ?? null,
        subcategoriaId: b.subcategoriaId ?? b.subcategoria_id ?? null,
      };

      // Validaciones claras (evita insertar con campos críticos vacíos)
      if (!dto.title) return res.status(400).json({ error: "Falta 'title'" });
      if (!dto.description)
        return res.status(400).json({ error: "Falta 'description'" });
      if (!dto.pages) return res.status(400).json({ error: "Falta 'pages'" });
      if (!dto.language)
        return res.status(400).json({ error: "Falta 'language'" });
      if (!dto.tipo) return res.status(400).json({ error: "Falta 'tipo'" });
      if (!dto.pdfUrl)
        return res
          .status(400)
          .json({ error: "Falta 'pdfUrl' (referencia del PDF)" });
      if (!dto.portadaUrl)
        return res
          .status(400)
          .json({ error: "Falta 'portadaUrl' (referencia de la portada)" });

      const libro = await this.service.create(dto);
      return res.status(201).json(libro);
    } catch (err: any) {
      const status = err instanceof CustomError ? err.statusCode : 500;
      return res
        .status(status)
        .json({ error: err.message ?? "Error al crear libro" });
    }
  };

  listar = (req: Request<{}, any, any, LibrosQuery>, res: Response) => {
    const categoriaId = this.toStr(req.query.categoriaId) || undefined;
    const subcategoriaId = this.toStr(req.query.subcategoriaId) || undefined;

    this.service
      .list({ categoriaId, subcategoriaId }) // ← aquí pasas los filtros
      .then((rows) => res.json(rows))
      .catch((err) => res.status(500).json({ error: String(err) }));
  };

  porId = (req: Request, res: Response) => {
    this.service
      .getById(req.params.id)
      .then((libro) => {
        if (!libro) return res.status(404).json({ error: "No encontrado" });
        res.json(libro);
      })
      .catch((err) => res.status(500).json({ error: String(err) }));
  };

  porSlug = (req: Request, res: Response) => {
    this.service
      .getBySlug(req.params.slug)
      .then((libro) => {
        if (!libro) return res.status(404).json({ error: "No encontrado" });
        res.json(libro);
      })
      .catch((err) => res.status(500).json({ error: String(err) }));
  };

  actualizar = (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body as any;

    this.service
      .update(id, {
        ...body,
        categoriaId: body.categoriaId ?? undefined,
        subcategoriaId: body.subcategoriaId ?? undefined,
      })
      .then((libro) => res.json(libro))
      .catch((err) => {
        const status = err instanceof CustomError ? err.statusCode : 500;
        res
          .status(status)
          .json({ error: err?.message || "Error al actualizar" });
      });
  };

  eliminar = (req: Request, res: Response) => {
    this.service
      .delete(req.params.id)
      .then((ok) => res.json({ ok }))
      .catch((err) => res.status(500).json({ error: String(err) }));
  };
  descargarPorId = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const libro = await this.service.getById(id);
      if (!libro) return res.status(404).json({ error: "Libro no encontrado" });

      const filename = String(libro.pdf_url || "");
      if (!/^[\w.\-]+$/.test(filename)) {
        return res.status(400).json({ error: "Nombre de archivo inválido" });
      }
      const fullPath = path.join(UPLOADS_DIR, "libros", filename);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "Archivo no encontrado" });
      }

      const downloadName = `${libro.slug || "libro"}.pdf`;
      res.setHeader("Content-Type", "application/pdf");

      await this.service.registrarDescarga({
        libroId: libro.id,
        ip: req.ip,
        userId: (req as any).user?.id ?? null, // si usas JWT en rutas privadas
        userAgent: req.headers["user-agent"] ?? "",
      });
      return res.download(fullPath, downloadName);
    } catch (err) {
      console.error("descargarPorId:", err);
      const status = err instanceof CustomError ? err.statusCode : 500;
      return res.status(status).json({ error: "Error descargando el archivo" });
    }
  };

  descargarPorSlug = async (req: Request, res: Response) => {
    const { slug } = req.params;
    try {
      const libro = await this.service.getBySlug(slug);
      if (!libro) return res.status(404).json({ error: "Libro no encontrado" });

      const filename = String(libro.pdf_url || "");
      if (!/^[\w.\-]+$/.test(filename)) {
        return res.status(400).json({ error: "Nombre de archivo inválido" });
      }
      const fullPath = path.join(UPLOADS_DIR, "libros", filename);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "Archivo no encontrado" });
      }

      const downloadName = `${libro.slug || "libro"}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      return res.download(fullPath, downloadName);
    } catch (err) {
      console.error("descargarPorSlug:", err);
      const status = err instanceof CustomError ? err.statusCode : 500;
      return res.status(status).json({ error: "Error descargando el archivo" });
    }
  };
}
