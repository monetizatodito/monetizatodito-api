
          CREATE TABLE IF NOT EXISTS blog_translation(
                id SERIAL PRIMARY KEY,
                blog_id VARCHAR(50) NOT NULL REFERENCES blog(id) ON DELETE CASCADE,
                locale VARCHAR(5) NOT NULL,
                titulo VARCHAR(200) NOT NULL,
                slug  VARCHAR(200) NOT NULL,
                descripcion TEXT,
                palabras_claves TEXT[],
                contenido JSONB NOT NULL,
                meta_title TEXT,
                meta_description TEXT,
                -- si quieres permitir imagen distinta por idioma, añade:
                -- image_override   VARCHAR(300),

                UNIQUE (blog_id, locale),
                UNIQUE (locale, slug)
                )
                