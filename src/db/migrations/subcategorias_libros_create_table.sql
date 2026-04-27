
    CREATE TABLE IF NOT EXISTS subcategorias_libros (
      id            VARCHAR(36) PRIMARY KEY,
      categoria_id  VARCHAR(36) NOT NULL REFERENCES categorias_libros(id) ON DELETE CASCADE,
      nombre        VARCHAR(120) NOT NULL,
      slug          VARCHAR(140) NOT NULL,
      descripcion   TEXT,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (categoria_id, slug)  -- mismo slug puede existir en otra categoría, pero no duplicado dentro
    );

    CREATE INDEX IF NOT EXISTS idx_subcats_categoria ON subcategorias_libros(categoria_id);
    CREATE INDEX IF NOT EXISTS idx_subcats_nombre    ON subcategorias_libros(nombre);
    CREATE INDEX IF NOT EXISTS idx_subcats_slug      ON subcategorias_libros(slug);
  