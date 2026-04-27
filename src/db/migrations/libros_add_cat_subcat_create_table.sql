
    ALTER TABLE libros
      ADD COLUMN IF NOT EXISTS categoria_id   VARCHAR(36) REFERENCES categorias_libros(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS subcategoria_id VARCHAR(36) REFERENCES subcategorias_libros(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_libros_categoria    ON libros(categoria_id);
    CREATE INDEX IF NOT EXISTS idx_libros_subcategoria ON libros(subcategoria_id);
  