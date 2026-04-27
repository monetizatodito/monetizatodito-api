// src/libros/libros.service.ts
import { LibroEntity } from "../../entity/libros/libro.entity";
import { LibrosRepository } from "./repositorio";

type CreateLibroDTO = {
  title: string;
  description: string;
  price: number | string;
  pages: number | string;
  language: "es" | "en" | "pt" | "fr";
  previewPages?: string;
  tipo: "gratis" | "pagado";
  isFree: boolean | string;
  pdfUrl: string;
  portadaUrl: string;

  // 🆕
  categoriaId?: string | null;
  subcategoriaId?: string | null;
};

export class LibrosService {
  constructor(private readonly repo = new LibrosRepository()) {}

  async create(dto: CreateLibroDTO) {
    // valida relación cat/subcat si ambas vienen
    if (dto.categoriaId && dto.subcategoriaId) {
      await this.repo.assertSubcategoriaEnCategoria(
        dto.subcategoriaId,
        dto.categoriaId
      );
    }

    const entity = {
      title: dto.title,
      description: dto.description,
      price_usd: Number(dto.price ?? 0),
      pages: Number(dto.pages ?? 0),
      language: dto.language,
      preview_pages: dto.previewPages ?? "",
      tipo: dto.tipo,
      is_free: String(dto.isFree) === "true" || dto.isFree === true,
      pdf_url: dto.pdfUrl,
      portada_url: dto.portadaUrl,
      categoria_id: dto.categoriaId ?? null,
      subcategoria_id: dto.subcategoriaId ?? null,
    } as Omit<LibroEntity, "id" | "slug" | "createdAt" | "updatedAt">;

    if (entity.tipo === "gratis") entity.price_usd = 0;

    return this.repo.create(entity);
  }

  /** ✅ Sólo orquesta; el SQL quedó en el repo */
  registrarDescarga(args: {
    libroId: string;
    ip?: string | null;
    userId?: string | null;
    userAgent?: string | null;
  }) {
    return this.repo.registrarDescarga(args);
  }

  list(filters?: { categoriaId?: string; subcategoriaId?: string }) {
    return this.repo.list(filters);
  }
  getById(id: string) {
    return this.repo.getById(id);
  }
  getBySlug(slug: string) {
    return this.repo.getBySlug(slug);
  }
  delete(id: string) {
    return this.repo.delete(id);
  }

  async update(
    id: string,
    patch: Partial<LibroEntity> & {
      categoriaId?: string | null;
      subcategoriaId?: string | null;
    }
  ) {
    const p: Partial<LibroEntity> = {};

    if (patch.title !== undefined) p.title = patch.title;
    if (patch.description !== undefined) p.description = patch.description;
    if (patch.price_usd !== undefined) p.price_usd = Number(patch.price_usd);
    if (patch.pages !== undefined) p.pages = Number(patch.pages);
    if (patch.language !== undefined) p.language = patch.language;
    if (patch.preview_pages !== undefined)
      p.preview_pages = patch.preview_pages;
    if (patch.tipo !== undefined) p.tipo = patch.tipo;
    if (patch.is_free !== undefined) p.is_free = !!patch.is_free;
    if (patch.pdf_url !== undefined) p.pdf_url = patch.pdf_url;
    if (patch.portada_url !== undefined) p.portada_url = patch.portada_url;

    // 🆕 normaliza ids
    if (patch.categoriaId !== undefined)
      p.categoria_id = patch.categoriaId ?? null;
    if (patch.subcategoriaId !== undefined)
      p.subcategoria_id = patch.subcategoriaId ?? null;

    if (p.categoria_id && p.subcategoria_id) {
      await this.repo.assertSubcategoriaEnCategoria(
        p.subcategoria_id,
        p.categoria_id
      );
    }

    if (p.tipo === "gratis") p.price_usd = 0;

    return this.repo.update(id, p);
  }
}
