export class CreateBlogDto {
  constructor(
    public id: string,
    public titulo: string,
    public slug: string,
    public contenido: any, // JSON
    public autor: string,

    public descripcion?: string,
    public categoriaIds?: string[],
    public palabras_claves?: string[],
    public images?: string,
    public imagesAlt?: string, // ✅ NUEVO (ALT imagen principal)

    public usuarioId?: string,

    // 👇 nuevos campos opcionales
    public autoTranslate?: boolean,
    public locales?: string[],
    // 👇 NUEVO
    public youtubeUrls?: string[],
    public type: "post" | "bio" = "post",
  ) {}

  static create(obj: { [key: string]: any }): [string?, CreateBlogDto?] {
    const {
      id,
      titulo,
      slug,
      contenido,
      autor,

      descripcion,
      categoriaIds, // 🔧 corregido: antes tenías "categoriaId"
      palabras_claves,
      images,
      imagesAlt, // ✅ NUEVO

      usuarioId,

      // 👇 nuevos
      autoTranslate,
      locales,
      type,
      youtubeUrls,
    } = obj;

    if (!titulo) return ["El título es obligatorio"];
    if (!contenido) return ["El contenido es obligatorio"];

    // ======================================
    // VALIDACIÓN DE CATEGORÍAS
    // ======================================

    if (categoriaIds !== undefined) {
      if (!Array.isArray(categoriaIds)) {
        return ["categoriaIds debe ser un arreglo"];
      }

      if (
        categoriaIds.some(
          (id: unknown) =>
            typeof id !== "string" || !id.trim() || id.trim().length > 50,
        )
      ) {
        return ["Los IDs de las categorías no son válidos"];
      }
    }

    // Normalizar y eliminar IDs duplicados
    const safeCategoriaIds: string[] | undefined = Array.isArray(categoriaIds)
      ? [...new Set(categoriaIds.map((id: string) => id.trim()))]
      : undefined;

    // Normalizar tipo: por defecto "post"
    let safeType: "post" | "bio" = "post";
    if (type === "bio") safeType = "bio";
    // ✅ normaliza: solo array de strings
    const safeYoutubeUrls = Array.isArray(youtubeUrls)
      ? youtubeUrls.filter((u) => typeof u === "string" && u.trim())
      : undefined;

    // ✅ ALT opcional: string limpio o undefined
    const safeImagesAlt =
      typeof imagesAlt === "string" && imagesAlt.trim()
        ? imagesAlt.trim()
        : undefined;

    return [
      undefined,
      new CreateBlogDto(
        id,
        titulo,
        slug,
        contenido,
        autor,

        descripcion,
        safeCategoriaIds,
        palabras_claves,
        images,
        safeImagesAlt, // ✅ aquí

        usuarioId,

        !!autoTranslate, // asegura boolean
        Array.isArray(locales) ? locales : undefined,
        safeYoutubeUrls, // ✅ aquí
        safeType,
      ),
    ];
  }
}
