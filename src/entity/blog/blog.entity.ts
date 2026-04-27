export class BlogEntity {
  id: string;
  titulo: string;
  slug: string;
  contenido: any; // JSON (formato tipo blocks de editor, por ejemplo)
  descripcion?: string;
  categoriaIds?: string[];
  palabras_claves?: string[]; // Array de palabras clave
  images?: string;
  autor?: string;
  type?: string;

  // ✅ NUEVO: lista opcional de URLs de YouTube
  youtubeUrls?: string[]; // en DB: youtube_urls TEXT[]

  activo?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
