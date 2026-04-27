// src/entity/libros/libro.entity.ts

export type TipoLibro = "gratis" | "pagado";
export type Lang = "es" | "en" | "pt" | "fr";

export interface LibroEntity {
  id: string;
  slug: string;
  title: string;
  description: string;
  price_usd: number;
  pages: number;
  language: Lang;
  preview_pages: string;
  tipo: TipoLibro;
  is_free: boolean;
  pdf_url: string;
  portada_url: string;
  createdAt: Date;
  updatedAt: Date;

  categoria_id: string | null;
  subcategoria_id: string | null;
}

// 🆕 filtros de búsqueda basados en campos de la entidad
export type LibroFilters = {
  categoriaId?: string;
  subcategoriaId?: string;
};
