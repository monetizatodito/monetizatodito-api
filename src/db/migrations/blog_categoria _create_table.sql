
    CREATE TABLE IF NOT EXISTS blog_categoria (
      "blogId" VARCHAR(50) NOT NULL,
      "categoriaId" VARCHAR(50) NOT NULL,
      PRIMARY KEY ("blogId", "categoriaId"),
      FOREIGN KEY ("blogId") REFERENCES blog(id) ON DELETE CASCADE,
      FOREIGN KEY ("categoriaId") REFERENCES categoria(id) ON DELETE CASCADE
)


      