import { generarIdUnico, validarIdUnico } from "../../config/generar-id";
import {
  generarSlugUnico,
  generarSlugUnicoPorIdioma,
} from "../../config/generarSlug";

import { UpdateBlogDto } from "../../dto/blog/update-blog.dto";

import { UserEntity } from "../../entity/usuario/user.entity";
import { CustomError } from "../../error/custom.error";

import { BlogRepository } from "../../repositorio/blog.repositorio";

import { FileUploadService } from "../cargar-archivo/cargar-archivo.service";
import { Paginator } from "../paginacion/paginator";

import type { Locale, TranslatableLocale } from "../../util/slug";
import {
  translateContentJSON,
  translateText,
} from "../traductor/translator.service";
import { ensureIdsAndHashes } from "../../util/blocks";
import { IndexNowService } from "../bing-indexnow/indexnow.service";
import { IndexNowBlogUrlsService } from "../bing-indexnow/indexnow-blog-urls.service";

type TranslateStrategy = "changed-blocks" | "full";
type TranslateOpts = {
  strategy: TranslateStrategy;
  changedBlockIds?: string[];
};

/** ================== Config de locales ================== */
const DEFAULT_LOCALES: TranslatableLocale[] = ["en", "pt", "fr", "de", "ar"];
function parseTargetsFromEnv(): TranslatableLocale[] {
  const raw = process.env.TRANSLATE_TARGETS?.trim();
  if (!raw) return DEFAULT_LOCALES;
  const arr = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as TranslatableLocale[];
  return arr.length ? arr : DEFAULT_LOCALES;
}
const LOCALES: TranslatableLocale[] = parseTargetsFromEnv();

/** ======================================================= */

export class BlogService {
  private blogRepositorio = new BlogRepository();

  constructor() {}

  private indexNowService = new IndexNowService();
  private indexNowBlogUrlsService = new IndexNowBlogUrlsService();

  private async submitIndexNowByBlogId(blogId: string) {
    const urls = await this.indexNowBlogUrlsService.getPostUrlsByBlogId(blogId);
    if (!urls.length) return;
    await this.indexNowService.submitUrls(urls);
  }

  // Para no bloquear el flujo principal (create/update/delete)
  private fireIndexNowByBlogId(blogId: string, source: string) {
    this.submitIndexNowByBlogId(blogId).catch((err: any) => {
      console.warn(`⚠️ IndexNow ${source}:`, err?.message || err);
    });
  }

  // Para delete (cuando ya capturaste las URLs antes de borrar)
  private fireIndexNowByUrls(urls: string[], source: string) {
    this.indexNowService.submitUrls(urls).catch((err: any) => {
      console.warn(`⚠️ IndexNow ${source}:`, err?.message || err);
    });
  }

  /**
   * Crea SOLO la versión en español y devuelve inmediatamente.
   * Lanza la tarea de traducción en background si ENABLE_TRANSLATOR=true.
   */
  public async createBlogESOnly(createBlogDto: any, usuario: UserEntity) {
    const id = generarIdUnico();
    const slug = await generarSlugUnico(
      createBlogDto.slug || createBlogDto.titulo,
    );

    const type: "post" | "bio" = createBlogDto.type === "bio" ? "bio" : "post";

    const nuevoDto = {
      ...createBlogDto,
      type,
      slug,
      images: createBlogDto.images || "NO_LLEGO",
      imagesAlt: createBlogDto.imagesAlt, // ✅ NUEVO
      // ✅ NUEVO: videos youtube (opcional)
      youtubeUrls: Array.isArray(createBlogDto.youtubeUrls)
        ? createBlogDto.youtubeUrls
        : undefined,
    };

    try {
      const blog = await this.blogRepositorio.create(
        id,
        nuevoDto,
        usuario.nombre,
        usuario.id,
      );

      if (createBlogDto.categoriaIds?.length) {
        await this.blogRepositorio.asignarCategoriasABlog(
          blog.id,
          createBlogDto.categoriaIds,
        );
      }

      // ✅ Turbo IndexNow (ES ya existe)

      if (type === "post") {
        this.fireIndexNowByBlogId(blog.id, "createBlogESOnly");
      }

      // 🔁 Dispara traducción en background (no bloquea la respuesta)
      if (process.env.ENABLE_TRANSLATOR === "true") {
        // no esperes; deja correr en segundo plano
        // captura minuciosamente para no romper el request principal
        (async () => {
          try {
            await this.translateInBackground(
              blog.id,
              {
                titulo: createBlogDto.titulo,
                descripcion: createBlogDto.descripcion ?? "",
                contenido: createBlogDto.contenido ?? { blocks: [] },
                palabras_claves: createBlogDto.palabras_claves ?? null,
                imagesAlt: createBlogDto.imagesAlt ?? null, // ✅ NUEVO
              },
              LOCALES,
            );
          } catch (e) {
            console.error("[translate-bg] fallo general:", e);
          }
        })();
      }

      // Responder solo con ES
      return { blog };
    } catch (error) {
      throw CustomError.internalServerError(`${error}`);
    }
  }

  /**
   * Tarea en background: traducir y upsert en blog_translation
   * (Serial para no saturar API ni CPU; si quieres paralelizar, añade p-limit)
   */
  public async translateInBackground(
    blogId: string,
    base: {
      titulo: string;
      descripcion: string;
      contenido: any; // Contenido o JSON
      palabras_claves: string[] | null;
      imagesAlt?: string; // ✅ NUEVO
    },
    localesOrOpts?: TranslatableLocale[] | TranslateOpts,
    maybeOpts?: TranslateOpts,
  ) {
    // Normaliza parámetros (2, 3 o 4 args)
    let locales: TranslatableLocale[] = LOCALES;
    let opts: TranslateOpts = { strategy: "changed-blocks" };

    if (Array.isArray(localesOrOpts)) {
      locales = localesOrOpts;
      if (maybeOpts) opts = maybeOpts;
    } else if (localesOrOpts && typeof localesOrOpts === "object") {
      opts = localesOrOpts;
    }

    const contenidoNorm = ensureIdsAndHashes(base.contenido);

    // Estrategia: changed-blocks => traducir solo IDs de opts.changedBlockIds
    const shouldFilter =
      opts.strategy === "changed-blocks" &&
      Array.isArray(opts.changedBlockIds) &&
      opts.changedBlockIds.length > 0;

    const baseFiltrado = shouldFilter
      ? {
          ...base,
          contenido: {
            blocks: contenidoNorm.blocks.filter((b) =>
              opts.changedBlockIds!.includes(b.id!),
            ),
          },
        }
      : { ...base, contenido: contenidoNorm };

    // === Tu lógica actual por idioma ===
    for (const loc of locales) {
      try {
        const tTitulo = await translateText(base.titulo, loc);
        const tDescripcion = await translateText(base.descripcion, loc);
        const tContenido = await translateContentJSON(
          baseFiltrado.contenido,
          loc,
        );
        const tImagesAlt = base.imagesAlt
          ? await translateText(base.imagesAlt, loc)
          : null;

        const tSlug = await generarSlugUnicoPorIdioma(
          this.blogRepositorio,
          tTitulo,
          loc,
        );

        await this.blogRepositorio.upsertTranslation({
          blog_id: blogId,
          locale: loc,
          titulo: tTitulo,
          slug: tSlug,
          descripcion: tDescripcion,
          palabras_claves: base.palabras_claves,
          contenido: tContenido, // <-- fusionar/merge si filtras bloques (opcional)
          meta_title: tTitulo,
          meta_description: tDescripcion,
          images_alt: tImagesAlt, // ✅ NUEVO
        });

        console.log(`[translate-bg] ${blogId} -> ${loc} OK`);
      } catch (err) {
        console.error(`[translate-bg] ${blogId} -> ${loc} falló:`, err);
      }
    }
    // ✅ Al terminar traducciones, avisar todas las URLs disponibles (ES + locales que existan)
    try {
      await this.submitIndexNowByBlogId(blogId);
    } catch (e: any) {
      console.warn("⚠️ IndexNow translateInBackground:", e?.message || e);
    }
  }

  /**
   * Traduce un post existente (ES) por slug, y hace UPSERT en blog_translation
   * para los locales dados o los por defecto.
   *
   * @param slug      slug base en español
   * @param locales   ["en","de",...] opcional; si no se pasa usa DEFAULT_LOCALES
   * @param force     si true, re-genera aunque ya exista traducción (por blog_id+locale)
   */

  public async translateBySlug(
    slug: string,
    locales?: TranslatableLocale[],
    force: boolean = false,
  ) {
    if (process.env.ENABLE_TRANSLATOR !== "true") {
      throw new Error("Traductor desactivado (ENABLE_TRANSLATOR != true)");
    }

    const base = await this.blogRepositorio.getBlogSlug(slug);
    if (!base) throw new Error("Blog no encontrado por slug");

    const targets: TranslatableLocale[] =
      locales && locales.length ? locales : DEFAULT_LOCALES;
    if (!targets.length) return { ok: true, count: 0, blog_id: base.id, slug };

    // Datos base ES
    const src = {
      titulo: base.titulo as string,
      descripcion: (base.descripcion ?? "") as string,
      contenido: base.contenido ?? { blocks: [] },
      palabras_claves: (base.palabras_claves ?? null) as string[] | null,
      imagesAlt: (base as any).images_alt ?? null, // ✅ AQUI VA
    };

    let done = 0;

    for (const loc of targets) {
      try {
        // Evitar trabajo si ya existe (blog_id, locale), salvo force=true
        if (!force) {
          const exists =
            await this.blogRepositorio.existsTranslationByBlogAndLocale(
              base.id,
              loc,
            );
          if (exists) {
            done++;
            continue;
          }
        }

        const tTitulo = await translateText(src.titulo, loc);
        const tDescripcion = await translateText(src.descripcion, loc);
        const tContenido = await translateContentJSON(src.contenido, loc);

        // slug único por idioma a partir del título traducido
        const tSlug = await generarSlugUnicoPorIdioma(
          this.blogRepositorio,
          tTitulo,
          loc,
        );

        const tImagesAlt = src.imagesAlt
          ? await translateText(src.imagesAlt, loc)
          : null;

        await this.blogRepositorio.upsertTranslation({
          blog_id: base.id,
          locale: loc,
          titulo: tTitulo,
          slug: tSlug,
          descripcion: tDescripcion,
          palabras_claves: src.palabras_claves, // tradúcelas si lo necesitas
          contenido: tContenido,
          meta_title: tTitulo,
          meta_description: tDescripcion,
          images_alt: tImagesAlt, // ✅ y esto también
        });

        done++;
      } catch (err) {
        // Loguea el fallo y continúa con el siguiente idioma
        console.error(`[translateBySlug] ${base.id} -> ${loc} falló:`, err);
      }
    }

    // ✅ Avisar nuevas/actualizadas traducciones
    this.fireIndexNowByBlogId(base.id, "translateBySlug");

    return { ok: true, count: done, blog_id: base.id, slug };
  }

  /**
   * Traduce varios slug en un solo llamado.
   * Si ocurre un error con uno, continúa con los demás y lo reporta.
   */
  public async translateManyBySlugs(
    slugs: string[],
    locales?: TranslatableLocale[],
    force: boolean = false,
  ) {
    const results: Array<{
      slug: string;
      ok: boolean;
      count?: number;
      error?: string;
    }> = [];
    for (const slug of slugs) {
      try {
        const r = await this.translateBySlug(slug, locales, force);
        results.push({ slug, ok: true, count: r.count });
      } catch (e: any) {
        results.push({ slug, ok: false, error: String(e?.message ?? e) });
      }
    }
    return { ok: true, results };
  }

  /** Utilidad opcional para re-generar traducciones bajo demanda (admin) */
  public async retraducirBlog(blogId: string, locales?: TranslatableLocale[]) {
    const base = await this.blogRepositorio.getBlogId(blogId);
    if (!base) throw CustomError.notFound("Blog no encontrado");
    if (process.env.ENABLE_TRANSLATOR !== "true") {
      throw CustomError.badRequest(
        "Traductor desactivado (ENABLE_TRANSLATOR != true)",
      );
    }
    await this.translateInBackground(
      blogId,
      {
        titulo: base.titulo,
        descripcion: base.descripcion ?? "",
        contenido: base.contenido ?? { blocks: [] },
        palabras_claves: base.palabras_claves ?? null,
        imagesAlt: (base as any).images_alt ?? null, // ✅ AQUI VA
      },
      locales && locales.length ? locales : LOCALES,
    );
    return { ok: true };
  }

  async crearCategoria(nombre: string, descripcion?: string) {
    if (!nombre || nombre.trim() === "") {
      throw CustomError.badRequest("El nombre de la categoría es obligatorio.");
    }

    const categoria = await this.blogRepositorio.crearCategoria(
      nombre,
      descripcion,
    );
    return {
      msg: "Categoría creada exitosamente",
      categoria,
    };
  }

  public async getBlog(
    user: any,
    page?: number | string,
    limit?: number | string,
    locale: Locale = "es",
  ) {
    const paginator = new Paginator({ page, limit });

    if (locale === "es") {
      const [totalItems, dataResult] = await Promise.all([
        this.blogRepositorio.countAll(),
        this.blogRepositorio.getBlog(paginator.limit, paginator.offset),
      ]);
      const meta = paginator.getMeta(totalItems);
      return { blog: dataResult, meta };
    }

    // listado localizado (LEFT JOIN con fallback)
    const [totalItems, dataResult] = await Promise.all([
      this.blogRepositorio.countAll(),
      this.blogRepositorio.getBlogLocalized(
        paginator.limit,
        paginator.offset,
        locale,
      ),
    ]);

    const meta = paginator.getMeta(totalItems);
    return { blog: dataResult, meta };
  }

  public async getBlogId(id: string) {
    const validId = validarIdUnico(id);
    if (!validId) throw CustomError.badRequest("el id no es valido");

    const blog = await this.blogRepositorio.getBlogId(id);
    if (!blog) throw CustomError.notFound("Blog no encontrado");

    const categorias = await this.blogRepositorio.getCategoriasDeBlog(id);

    return {
      blog,
      categorias,
    };
  }

  public async getBlogSlug(slug: string) {
    const blog = await this.blogRepositorio.getBlogSlug(slug);
    if (!blog) throw CustomError.notFound("Blog no encontrado");
    return { blog };
  }

  public async putBlog(
    id: string,
    usuario: UserEntity,
    updateBlogDto: UpdateBlogDto,
  ) {
    const validId = validarIdUnico(id);
    if (!validId) throw CustomError.badRequest("el id no es valido");

    const blog = await this.blogRepositorio.putBlog(id, updateBlogDto);

    if (updateBlogDto.categoriaIds) {
      await this.blogRepositorio.actualizarCategoriasDeBlog(
        id,
        updateBlogDto.categoriaIds,
      );
    }

    if (blog?.type === "post") {
      this.fireIndexNowByBlogId(id, "putBlog");
    }
    // Si cambiaste campos base ES, opcional: retraducir en background
    if (
      process.env.ENABLE_TRANSLATOR === "true" &&
      (updateBlogDto.titulo ||
        updateBlogDto.descripcion ||
        updateBlogDto.contenido ||
        updateBlogDto.imagesAlt) // ✅ NUEVO
    ) {
      (async () => {
        try {
          const base = await this.blogRepositorio.getBlogId(id);
          if (base) {
            await this.translateInBackground(
              id,
              {
                titulo: base.titulo,
                descripcion: base.descripcion ?? "",
                contenido: base.contenido ?? { blocks: [] },
                palabras_claves: base.palabras_claves ?? null,
                imagesAlt: base.images_alt ?? null, // ✅ NUEVO (según como lo devuelva el repo)
              },
              LOCALES,
            );
          }
        } catch (e) {
          console.error("[translate-bg] retranslate fallo:", e);
        }
      })();
    }

    return {
      msg: "Blog actualizado exitosamente",
      blog,
    };
  }

  public async deleteBlog(id: string) {
    const validId = validarIdUnico(id);
    if (!validId) throw CustomError.badRequest("El ID no es válido");

    let urlsToNotifyDelete: string[] = [];
    try {
      urlsToNotifyDelete =
        await this.indexNowBlogUrlsService.getPostUrlsByBlogId(id);
    } catch (e: any) {
      console.warn(
        "⚠️ No se pudieron preparar URLs para IndexNow delete:",
        e?.message || e,
      );
    }

    // Obtener el blog antes de eliminarlo
    const blog = await this.blogRepositorio.getBlogById(id);
    if (!blog) throw CustomError.notFound("El blog no existe");

    // Eliminar la imagen si existe
    if (blog.images) {
      const fileUploadService = new FileUploadService();
      try {
        fileUploadService.deleteFile("archivos-cargado", blog.images);
      } catch (error: any) {
        console.warn(`No se pudo eliminar la imagen: ${error.message}`);
      }
    }

    // (Opcional) puedes eliminar traducciones asociadas si tu FK no las borra en cascada
    // await this.blogRepositorio.deleteTranslationsByBlogId(id);
    // ✅ Capturar URLs antes de borrar (incluye traducciones)

    const eliminado = await this.blogRepositorio.deleteBlog(id);
    if (!eliminado)
      throw CustomError.internalServerError("No se pudo eliminar el blog");

    // ✅ Avisar eliminación (IndexNow también sirve para URLs eliminadas)
    if (urlsToNotifyDelete.length) {
      this.fireIndexNowByUrls(urlsToNotifyDelete, "deleteBlog");
    }

    return {
      msg: "Blog eliminado correctamente",
      blog,
    };
  }

  /** Servir por slug + locale */
  public async getBlogBySlugWithLocale(slug: string, locale: Locale = "es") {
    const row = await this.blogRepositorio.getBySlugAndLocale(slug, locale);
    if (!row) throw CustomError.notFound("Blog no encontrado");

    return {
      blog: {
        id: row.id,
        slug: locale === "es" ? slug : (row.t_slug ?? slug),
        slug_base: row.base_slug ?? slug,
        titulo: row.titulo,
        descripcion: row.descripcion,
        contenido: row.contenido,
        images: row.images,
        imagesAlt: (row as any).images_alt ?? null, // ✅

        autor: row.autor,
        usuarioId: row.usuarioId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        // ✅ NUEVO
        youtubeUrls: row.youtube_urls ?? [],
        locale,
      },
    };
  }

  /** Servir por id + locale */
  public async getBlogIdWithLocale(id: string, locale: Locale = "es") {
    const validId = validarIdUnico(id);
    if (!validId) throw CustomError.badRequest("el id no es valido");

    const row = await this.blogRepositorio.getByIdAndLocale(id, locale);
    if (!row) throw CustomError.notFound("Blog no encontrado");

    return {
      blog: {
        id: row.id,
        slug: locale === "es" ? row.base_slug : (row.t_slug ?? row.base_slug),
        slug_base: row.base_slug,
        titulo: row.titulo,
        descripcion: row.descripcion,
        contenido: row.contenido,
        images: row.images,
        imagesAlt: (row as any).images_alt ?? null, // ✅

        autor: row.autor,
        usuarioId: row.usuarioId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        // ✅ NUEVO
        youtubeUrls: row.youtube_urls ?? [],
        locale,
      },
    };
  }

  public async listUntranslated(
    locale: string,
    page?: number | string,
    limit?: number | string,
    search?: string,
  ) {
    const paginator = new Paginator({ page, limit });

    const [totalItems, items] = await Promise.all([
      this.blogRepositorio.countUntranslated(locale, search),
      this.blogRepositorio.listUntranslated(
        locale,
        paginator.limit,
        paginator.offset,
        search,
      ),
    ]);

    const meta = paginator.getMeta(totalItems);
    return { items, meta };
  }

  public async getBlogByAutor(
    nombre: string,
    page?: number | string,
    limit?: number | string,
  ) {
    const paginator = new Paginator({ page, limit });

    const [bio, totalItems, dataResult] = await Promise.all([
      this.blogRepositorio.getBioByAutor(nombre), // 👈 BIO
      this.blogRepositorio.countByAutor(nombre), // posts count
      this.blogRepositorio.getBlogByAutor(
        nombre,
        paginator.limit,
        paginator.offset,
      ),
    ]);

    const meta = paginator.getMeta(totalItems);
    return {
      bio, // 👈 aquí mandas la bio (o null si no hay)
      blog: dataResult,
      meta,
    };
  }
}
