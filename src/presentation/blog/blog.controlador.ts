import { Request, Response } from "express";

import { BlogService } from "./blog.service";
import { CustomError } from "../../error/custom.error";
import { CreateBlogDto } from "../../dto/blog/create-blog.dto";
import { UpdateBlogDto } from "../../dto/blog/update-blog.dto";
import { TranslatableLocale } from "../../util/slug";
import { pickLocale } from "../../helpers/locale";
import { diffBlocks, ensureIdsAndHashes } from "../../util/blocks";

const ALLOWED_LOCALES = ["es", "en", "pt", "fr", "de", "ar"] as const;
type Locale = (typeof ALLOWED_LOCALES)[number];

const DEFAULT_LOCALES: TranslatableLocale[] = ["en", "pt", "fr", "de", "ar"];

function decodeParamSafe(s: unknown) {
  try {
    return decodeURIComponent(String(s ?? ""));
  } catch {
    return String(s ?? "");
  }
}

export class BlogControlador {
  constructor(private readonly blogService: BlogService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.log(`${error}`);
    return res.status(500).json({ error: "Internal server error" });
  };

  create = (req: Request, res: Response) => {
    const body = req.body;
    const [error, createBlogDto] = CreateBlogDto.create(body);
    if (error) return res.status(400).json({ error });

    // 1) Crea SOLO ES y responde de inmediato
    this.blogService
      .createBlogESOnly(createBlogDto!, req.body.usuario)
      .then(({ blog }) => {
        // Respuesta inmediata
        const willTranslate = !!createBlogDto!.autoTranslate;
        const locales: TranslatableLocale[] =
          willTranslate &&
          Array.isArray(createBlogDto!.locales) &&
          createBlogDto!.locales.length
            ? (createBlogDto!.locales as TranslatableLocale[])
            : DEFAULT_LOCALES;

        res.status(201).json({
          blog,
          translating: willTranslate ? locales : [],
        });

        // 2) Fire-and-forget (NO se espera, no bloquea la respuesta)
        if (willTranslate) {
          setImmediate(() => {
            this.blogService
              .translateInBackground(
                blog.id,
                {
                  titulo: createBlogDto!.titulo,
                  descripcion: createBlogDto!.descripcion ?? "",
                  contenido: createBlogDto!.contenido,
                  palabras_claves: createBlogDto!.palabras_claves ?? null,
                },
                locales
              )
              .catch((err) => console.error("[translate-bg] error:", err));
          });
        }
      })
      .catch((err) => this.handleError(err, res));
  };

  crearCategoria = async (req: Request, res: Response) => {
    const { nombre, descripcion } = req.body;

    this.blogService
      .crearCategoria(nombre, descripcion)
      .then((categoria) => res.status(201).json(categoria))
      .catch((error) => this.handleError(error, res));
  };

  getBlog = (req: Request, res: Response) => {
    const page =
      typeof req.query.page === "string" ? req.query.page : undefined;
    const limit =
      typeof req.query.limit === "string" ? req.query.limit : undefined;

    const qLocale = String(
      req.query.locale || req.headers["x-locale"] || "es"
    ).toLowerCase();
    const locale: Locale = (ALLOWED_LOCALES as readonly string[]).includes(
      qLocale
    )
      ? (qLocale as Locale)
      : "es";

    this.blogService
      .getBlog(req.body.usuario, page, limit, locale) // 👈 ahora se pasa el locale
      .then((blog) => res.json(blog))
      .catch((err) => this.handleError(err, res));
  };

  getBlogByAutor = (req: Request, res: Response) => {
    const autorRaw = req.query.autor;

    if (!autorRaw || typeof autorRaw !== "string") {
      return res
        .status(400)
        .json({ message: 'Falta o es inválido el parámetro "autor"' });
    }
    let autor: string;
    try {
      autor = decodeURIComponent(autorRaw); // ⚠️ Solo si estás seguro que vendrá codificado
    } catch (err) {
      return res.status(400).json({ message: 'Parámetro "autor" malformado' });
    }

    console.log("Autor recibido:", autor);

    const page =
      typeof req.query.page === "string" ? req.query.page : undefined;
    const limit =
      typeof req.query.limit === "string" ? req.query.limit : undefined;

    this.blogService
      .getBlogByAutor(autor, page, limit)
      .then((blogs) => res.json(blogs))
      .catch((err) => this.handleError(err, res));
  };

  getBlogId = (req: Request, res: Response) => {
    const { id } = req.params;
    console.log(id);

    this.blogService
      .getBlogId(id)
      .then((blog) => res.json(blog))
      .catch((error) => this.handleError(error, res));
  };

  getBlogSlug = async (req: Request, res: Response) => {
    const raw = req.params.slug; // puede venir encoded
    const slug = decodeParamSafe(raw).normalize("NFC"); // ← decodifica y normaliza
    const locale = pickLocale(req);

    // debug (solo mientras pruebas)
    // console.log({ raw, decoded: slug, url: req.originalUrl });

    try {
      const data = await this.blogService.getBlogBySlugWithLocale(slug, locale);
      res.set("Vary", "x-locale, Accept-Language");
      if (!data?.blog) return res.status(404).json({ error: "No encontrado" });
      return res.json(data);
    } catch (err) {
      return this.handleError(err, res);
    }
  };
  putBlog = (req: Request, res: Response) => {
    const { id } = req.params;

    const [error, dto] = UpdateBlogDto.create({ ...req.body, id });
    if (error) return res.status(400).json({ error });

    let prevSnapshot: any; // guardamos versión previa para diff
    let updatedSnapshot: any;

    // 1) Traer PREV, 2) Actualizar, 3) Calcular diffs, 4) (Opcional) traducir cambiado, 5) Responder
    this.blogService
      .getBlogId(id)
      .then((prev) => {
        prevSnapshot = prev;
        return this.blogService.putBlog(id, req.body.usuario, dto!);
      })
      .then((updated) => {
        updatedSnapshot = updated;

        const prevContenido = ensureIdsAndHashes(
          typeof prevSnapshot?.contenido === "string"
            ? JSON.parse(prevSnapshot.contenido)
            : (prevSnapshot?.contenido ?? { blocks: [] })
        );

        const nextContenido = ensureIdsAndHashes(
          typeof updatedSnapshot?.contenido === "string"
            ? JSON.parse(updatedSnapshot.contenido)
            : (updatedSnapshot?.contenido ?? { blocks: [] })
        );

        const changedBlockIds = diffBlocks(prevContenido, nextContenido);

        const locales =
          (dto as any)?.locales && (dto as any).locales.length
            ? (dto as any).locales
            : DEFAULT_LOCALES;

        const shouldTranslate =
          process.env.ENABLE_TRANSLATOR === "true" &&
          changedBlockIds.length > 0;

        if (shouldTranslate) {
          // Disparo en background, sin bloquear la respuesta
          this.blogService
            .translateInBackground(
              id,
              {
                titulo: updatedSnapshot.titulo,
                descripcion: updatedSnapshot.descripcion ?? "",
                contenido: nextContenido, // ya incluye ids+hash
                palabras_claves: updatedSnapshot.palabras_claves ?? null,
              },
              locales,
              { strategy: "changed-blocks", changedBlockIds }
            )
            .catch((e) => console.error("[translate-bg] fallo:", e));

          const titleChanged = dto!.titulo !== undefined;
          const descChanged = dto!.descripcion !== undefined;

          console.log("[translate-plan]", {
            blogId: id,
            locales,
            strategy: "changed-blocks",
            changedBlockIds,
            countBlocks: changedBlockIds.length,
            titleChanged,
            descChanged,
          });

          return res.status(200).json({
            msg: "Blog actualizado exitosamente",
            blog: updatedSnapshot,
            translation: {
              locales,
              strategy: "changed-blocks",
              changedBlockIds,
            },
          });
        }

        // Sin traducción (o sin cambios)
        return res.status(200).json({
          msg: "Blog actualizado exitosamente",
          blog: updatedSnapshot,
        });
      })
      .catch((err) => this.handleError(err, res));
  };
  deleteBlog = (req: Request, res: Response) => {
    const { id } = req.params;
    this.blogService
      .deleteBlog(id)
      .then((blog) => res.status(200).json(blog))
      .catch((error) => this.handleError(error, res));
  };

  traducirPorSlug = (req: Request, res: Response) => {
    const slug = String(req.params.slug || "").trim();
    const localesRaw = Array.isArray(req.body?.locales)
      ? req.body.locales
      : undefined;
    const locales = localesRaw?.map((l: string) => l.toLowerCase().trim()) as
      | TranslatableLocale[]
      | undefined;
    const force = !!req.body?.force;
    console.log("viendo", slug);

    if (!slug) return res.status(400).json({ error: "slug requerido" });

    this.blogService
      .translateBySlug(slug, locales, force)
      .then((r) => res.status(200).json(r))
      .catch((err) => {
        if (err instanceof CustomError) {
          return res.status(err.statusCode).json({ error: err.message });
        }
        return res.status(400).json({ error: String(err?.message ?? err) });
      });
  };

  /** POST /blog/translate/batch  body: { slugs: string[], locales?: string[], force?: boolean } */
  traducirBatch = (req: Request, res: Response) => {
    const slugs = Array.isArray(req.body?.slugs)
      ? req.body.slugs.map((s: any) => String(s))
      : [];
    const localesRaw = Array.isArray(req.body?.locales)
      ? req.body.locales
      : undefined;
    const locales = localesRaw?.map((l: string) => l.toLowerCase().trim()) as
      | TranslatableLocale[]
      | undefined;
    const force = !!req.body?.force;

    if (!slugs.length)
      return res.status(400).json({ error: "slugs[] requerido" });

    this.blogService
      .translateManyBySlugs(slugs, locales, force)
      .then((r) => res.status(200).json(r))
      .catch((err) => {
        if (err instanceof CustomError) {
          return res.status(err.statusCode).json({ error: err.message });
        }
        return res.status(400).json({ error: String(err?.message ?? err) });
      });
  };

  // GET /untranslated?locale=en&page=1&limit=20&search=palabra
  getUntranslated = (req: Request, res: Response) => {
    const locale = String(req.query.locale || "")
      .toLowerCase()
      .trim();

    console.log("viendo", locale);
    if (!locale)
      return res.status(400).json({ error: "Parámetro 'locale' requerido" });

    const page =
      typeof req.query.page === "string" ? req.query.page : undefined;
    const limit =
      typeof req.query.limit === "string" ? req.query.limit : undefined;
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : undefined;

    this.blogService
      .listUntranslated(locale, page, limit, search)
      .then((r) => res.json(r))
      .catch((err) => this.handleError(err, res));
  };
}
