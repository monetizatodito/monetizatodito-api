
    CREATE TABLE IF NOT EXISTS categorias_libros (
      id          VARCHAR(36) PRIMARY KEY,
      nombre      VARCHAR(120) NOT NULL,
      slug        VARCHAR(140) UNIQUE NOT NULL,
      descripcion TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_categorias_nombre ON categorias_libros(nombre);
    CREATE INDEX IF NOT EXISTS idx_categorias_slug   ON categorias_libros(slug);
  