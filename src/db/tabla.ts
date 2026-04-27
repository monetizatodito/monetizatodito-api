export const tables = [
  {
    name: "migrations",
    createQuery: `
         CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
        `,
    alterQueries: [],
  },
  {
    name: "roles",
    createQuery: `
            CREATE TABLE IF NOT EXISTS roles(
                id VARCHAR(50) PRIMARY KEY,
                roll VARCHAR(50) NOT NULL,
                activo BOOLEAN DEFAULT TRUE,
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP

)



            `,
    alterQueries: [],
  },

  {
    name: "usuario",
    createQuery: `
            CREATE TABLE usuario (
                id VARCHAR(36) PRIMARY KEY,
                nombre VARCHAR NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password VARCHAR NOT NULL,
                cedula VARCHAR NOT NULL,
                celular VARCHAR NOT NULL,
                direccion VARCHAR NOT NULL,
                "rollId"  VARCHAR(36) NOT NULL,
                img TEXT DEFAULT NULL,
                activo BOOLEAN DEFAULT TRUE,
                "emailValidate" BOOLEAN DEFAULT FALSE,
                "configuracionId" TEXT DEFAULT NULL,
                autenticado BOOLEAN DEFAULT FALSE,
                FOREIGN KEY ("rollId") REFERENCES roles(id) ON DELETE CASCADE,
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP


            )

        `,
    alterQueries: [
      //`ALTER TABLE usuario RENAME COLUMN nombre TO name;`,
      `ALTER TABLE usuario ADD COLUMN biografia TEXT NULL;`,
      `ALTER TABLE usuario ADD COLUMN slug VARCHAR UNIQUE;`,

      //`ALTER TABLE usuario DROP COLUMN roll;`,
    ],
  },

  {
    name: "configuracion",
    createQuery: `
            CREATE TABLE IF NOT EXISTS configuracion(
                id VARCHAR(50) PRIMARY KEY,
                ambiente VARCHAR(50) NOT NULL,
                contabilidad VARCHAR(50) NOT NULL,
                firma TEXT NOT NULL,
                password VARCHAR(50) NOT NULL,
                "tipoRegimen" VARCHAR(100) NOT NULL,
                direccion VARCHAR(100) NOT NULL,
                emision VARCHAR(50) NOT NULL,
                empresa VARCHAR(50) NOT NULL,
                establecimiento VARCHAR(50) NOT NULL,
                estado BOOLEAN DEFAULT TRUE,
                logo VARCHAR(100) DEFAULT NULL,
                "numeroF" VARCHAR(50) DEFAULT '1',
                "personaSRI" VARCHAR(50) NOT NULL,
                "razonS" VARCHAR(50) NOT NULL,
                retener VARCHAR(50) NOT NULL,
                ruc VARCHAR(13) NOT NULL,
                activo BOOLEAN DEFAULT TRUE,
                "usuarioId" VARCHAR(36) NOT NULL,
                FOREIGN KEY ("usuarioId") REFERENCES usuario(id) ON DELETE CASCADE,
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)
    `,
    alterQueries: [
      //`ALTER TABLE configuracion ADD COLUMN "tipoRegimen" VARCHAR(100)`
    ],
  },

  {
    name: "producto",
    createQuery: `
           CREATE TABLE IF NOT EXISTS producto (
                id VARCHAR(36) PRIMARY KEY,
                "codigoB" VARCHAR(50) DEFAULT '12345',
                nombre VARCHAR(100) NOT NULL,
                descripcion TEXT DEFAULT NULL,
                categoria TEXT DEFAULT NULL,


                "configuracionId" VARCHAR(50) NOT NULL,
                "usuarioId" VARCHAR(36) NOT NULL,
                 FOREIGN KEY ("usuarioId") REFERENCES usuario(id) ON DELETE CASCADE,
                 FOREIGN KEY ("configuracionId") REFERENCES configuracion(id) ON DELETE CASCADE,

                activo BOOLEAN DEFAULT TRUE,
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
   )
        `,
    alterQueries: [],
  },

  {
    name: "blog",
    createQuery: `
           CREATE TABLE IF NOT EXISTS blog(
                id VARCHAR(50) PRIMARY KEY,
                titulo VARCHAR(200) NOT NULL,
                slug VARCHAR(200) UNIQUE,
                contenido JSONB NOT NULL,
                descripcion TEXT,
                palabras_claves TEXT[],
                autor VARCHAR(100) DEFAULT NULL,

                images VARCHAR(100) DEFAULT NULL,
                activo BOOLEAN DEFAULT TRUE,
                "usuarioId" VARCHAR(50) NOT NULL,
                FOREIGN KEY ("usuarioId") REFERENCES usuario(id) ON DELETE CASCADE,
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP

)


        `,
    alterQueries: [
      `ALTER TABLE blog
       ADD COLUMN IF NOT EXISTS type VARCHAR(20),
        ADD COLUMN IF NOT EXISTS youtube_urls TEXT[],
        ADD COLUMN IF NOT EXISTS images_alt TEXT;
       `,

      `UPDATE blog
       SET type = 'post'
      WHERE type IS NULL;`,
      `ALTER TABLE blog
       ALTER COLUMN type SET NOT NULL;`,
      `ALTER TABLE blog
       ALTER COLUMN type SET DEFAULT 'post';`,
      `CREATE INDEX IF NOT EXISTS blog_author_type_idx
       ON blog(autor, type);`,
      `CREATE INDEX IF NOT EXISTS blog_youtube_urls_gin_idx
      ON blog USING GIN (youtube_urls);`,
    ],
  },

  {
    name: "blog_translation",
    createQuery: `
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
                `,
    alterQueries: [
      `ALTER TABLE blog_translation
      ADD COLUMN IF NOT EXISTS images_alt TEXT;
      `,
    ],
  },

  {
    name: "blog_and_translation_indexes",
    createQuery: "",
    alterQueries: [
      // Para ES (búsquedas por slug)
      `CREATE INDEX IF NOT EXISTS blog_slug_idx ON blog(slug);`,

      // Para traducciones (joins por blog_id)
      `CREATE INDEX IF NOT EXISTS blog_trans_blogid_idx ON blog_translation(blog_id);`,

      // OPCIONAL/NO RECOMENDADO:
      // Ya existe un índice único automático por la constraint UNIQUE(locale, slug).
      // Si AÚN ASÍ quieres un índice con nombre fijo, sería redundante:
      // `CREATE INDEX IF NOT EXISTS blog_trans_locale_slug_idx ON blog_translation(locale, slug);`
    ],
  },

  {
    name: "laboratorio",
    createQuery: `
            CREATE TABLE IF NOT EXISTS laboratorio(
                id VARCHAR(50) PRIMARY KEY,
                laboratorio VARCHAR(50) NOT null,
                activo BOOLEAN DEFAULT TRUE,
                "configuracionId" VARCHAR(50) NOT NULL,
                "usuarioId" VARCHAR(36) NOT NULL,
                FOREIGN KEY ("usuarioId") REFERENCES usuario(id) ON DELETE CASCADE,
                FOREIGN KEY ("configuracionId") REFERENCES configuracion(id) ON DELETE CASCADE,
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP

)



        `,
    alterQueries: [],
  },
  {
    name: "logout",
    createQuery: `
           CREATE TABLE IF NOT EXISTS logout(
                id VARCHAR(50) PRIMARY KEY,
                token VARCHAR(50) NOT NULL,
                "configuracionId" VARCHAR(50) NOT NULL,
                "usuarioId" VARCHAR(36) NOT NULL,
                FOREIGN KEY ("usuarioId") REFERENCES usuario(id) ON DELETE CASCADE,
                FOREIGN KEY ("configuracionId") REFERENCES configuracion(id) ON DELETE CASCADE,
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP

)


        `,
    alterQueries: [],
  },

  {
    name: "planes",
    createQuery: `
            CREATE TABLE IF NOT EXISTS planes(
                id VARCHAR(50) PRIMARY KEY,
                titulo VARCHAR(50) NOT NULL,
                precio DECIMAL(10, 2) NOT NULL,
                descripcion TEXT NOT NULL,
                activo BOOLEAN DEFAULT TRUE,
                "configuracionId" VARCHAR(50) NOT NULL,
                FOREIGN KEY ("configuracionId") REFERENCES configuracion(id) ON DELETE CASCADE,
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)


            `,
    alterQueries: [],
  },

  {
    name: "permisos",
    createQuery: `
         CREATE TABLE IF NOT EXISTS permisos(
              id VARCHAR(50) PRIMARY KEY,
              nombre VARCHAR(50) UNIQUE NOT NULL,
              descripcion VARCHAR(255),
             "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP

)


      `,
    alterQueries: [],
  },

  {
    name: "roles_permisos",
    createQuery: `
         CREATE TABLE IF NOT EXISTS roles_permisos(
              id VARCHAR(50) PRIMARY KEY,

              "configuracionId" VARCHAR(50) NOT NULL,

              "rollId" VARCHAR(36) NOT NULL,
              "permisoId" VARCHAR(36) NOT NULL,



              FOREIGN KEY ("configuracionId") REFERENCES configuracion(id) ON DELETE CASCADE,
              FOREIGN KEY ("rollId") REFERENCES roles(id),
              FOREIGN KEY ( "permisoId") REFERENCES permisos(id),

              "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP

)


      `,
    alterQueries: [],
  },

  {
    name: "urls",
    createQuery: `
         CREATE TABLE IF NOT EXISTS urls(
              id VARCHAR(50) PRIMARY KEY,
              url_larga TEXT NOT NULL,
              url_corta VARCHAR(10) UNIQUE NOT NULL,
              "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP

)


      `,
    alterQueries: [],
  },

  {
    name: "categoria",
    createQuery: `
    CREATE TABLE IF NOT EXISTS categoria (
      id VARCHAR(50) PRIMARY KEY,
      nombre VARCHAR(50) NOT NULL UNIQUE,
      slug VARCHAR(100) UNIQUE,
      descripcion TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)


      `,
    alterQueries: [],
  },

  {
    name: "blog_categoria ",
    createQuery: `
    CREATE TABLE IF NOT EXISTS blog_categoria (
      "blogId" VARCHAR(50) NOT NULL,
      "categoriaId" VARCHAR(50) NOT NULL,
      PRIMARY KEY ("blogId", "categoriaId"),
      FOREIGN KEY ("blogId") REFERENCES blog(id) ON DELETE CASCADE,
      FOREIGN KEY ("categoriaId") REFERENCES categoria(id) ON DELETE CASCADE
)


      `,
    alterQueries: [],
  },

  {
    name: "partida",
    createQuery: `
    CREATE TABLE IF NOT EXISTS partida(
      id VARCHAR(36) PRIMARY KEY,
      "usuarioId" VARCHAR(36) NOT NULL,
      palabras TEXT[] NOT NULL,
      palabras_seleccionadas TEXT[] NULL,
      fecha DATE NOT NULL,
      hora_inicio TIMESTAMP NOT NULL,
      hora_fin TIMESTAMP, -- puede ser NULL al iniciar
      finalizada BOOLEAN DEFAULT false,
      FOREIGN KEY ("usuarioId") REFERENCES usuario(id) ON DELETE CASCADE
);


      `,
    alterQueries: [],
  },

  {
    name: "palabras",
    createQuery: `
    CREATE TABLE palabras (
      id VARCHAR(36) PRIMARY KEY,
      palabra TEXT NOT NULL
    );
  `,
    alterQueries: [],
  },
  {
    name: "md_draft",
    createQuery: `
    CREATE TABLE IF NOT EXISTS "md_draft" (
      id            VARCHAR(50) PRIMARY KEY,
      filename      TEXT NOT NULL,                 -- p.ej. documento-20250818-074839.md
      "storagePath" TEXT NOT NULL,                 -- p.ej. /uploads/md2pdf/drafts/...
      "usuarioId"   VARCHAR(36) NOT NULL,          -- FK a usuario(id)
      "createdAt"   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "fk_md_draft_usuario"
        FOREIGN KEY ("usuarioId") REFERENCES "usuario"(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "idx_md_draft_usuario"
    ON "md_draft"("usuarioId");
  `,
    alterQueries: [],
  },
  {
    name: "libros",
    createQuery: `
    CREATE TABLE IF NOT EXISTS libros (
      id            VARCHAR(36) PRIMARY KEY,
      slug          VARCHAR(255) UNIQUE NOT NULL,
      title         VARCHAR(255) NOT NULL,
      description   TEXT NOT NULL,
      price_usd     NUMERIC(10,2) NOT NULL DEFAULT 0,
      pages         INTEGER NOT NULL,
      language      VARCHAR(10) NOT NULL DEFAULT 'es',   -- 'es' | 'en' | 'pt' | 'fr'
      preview_pages VARCHAR(100) DEFAULT '',             -- "1,2,3"
      tipo          VARCHAR(10) NOT NULL DEFAULT 'pagado', -- 'gratis' | 'pagado'
      is_free       BOOLEAN NOT NULL DEFAULT false,
      pdf_url       TEXT NOT NULL,
      portada_url   TEXT NOT NULL,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_libros_slug ON libros(slug);
    CREATE INDEX IF NOT EXISTS idx_libros_tipo ON libros(tipo);
    CREATE INDEX IF NOT EXISTS idx_libros_language ON libros(language);
  `,
    alterQueries: [],
  },

  {
    name: "categorias_libros",
    createQuery: `
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
  `,
    alterQueries: [],
  },
  {
    name: "subcategorias_libros",
    createQuery: `
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
  `,
    alterQueries: [],
  },

  {
    name: "libros_add_cat_subcat",
    createQuery: `
    ALTER TABLE libros
      ADD COLUMN IF NOT EXISTS categoria_id   VARCHAR(36) REFERENCES categorias_libros(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS subcategoria_id VARCHAR(36) REFERENCES subcategorias_libros(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_libros_categoria    ON libros(categoria_id);
    CREATE INDEX IF NOT EXISTS idx_libros_subcategoria ON libros(subcategoria_id);
  `,
    alterQueries: [],
  },
  {
    name: "payments",
    createQuery: `
    CREATE TABLE IF NOT EXISTS payments (
      id              VARCHAR(36) PRIMARY KEY,
      provider        VARCHAR(20) NOT NULL,                   -- 'paypal'
      provider_id     VARCHAR(64) NOT NULL,                   -- orderID/captureID
      status          VARCHAR(30) NOT NULL,                   -- 'COMPLETED', etc.
      type            VARCHAR(20) NOT NULL,                   -- 'purchase'|'donation'
      libro_id        VARCHAR(36) REFERENCES libros(id) ON DELETE SET NULL,
      amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
      currency        VARCHAR(10) NOT NULL DEFAULT 'USD',
      payer_email     VARCHAR(200),
      payer_name      VARCHAR(200),
      raw             JSONB NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_payments_type    ON payments(type);
    CREATE INDEX IF NOT EXISTS idx_payments_libro   ON payments(libro_id);
    CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
  `,
    alterQueries: [],
  },
  {
    name: "libros_add_downloads",
    createQuery: `
    ALTER TABLE libros
      ADD COLUMN IF NOT EXISTS downloads_count INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS libro_downloads (
      id           VARCHAR(36) PRIMARY KEY,
      libro_id     VARCHAR(36) NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
      ip           VARCHAR(64),
      user_id      VARCHAR(36),                -- null si es público
      user_agent   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_libro_downloads_libro ON libro_downloads(libro_id);
    CREATE INDEX IF NOT EXISTS idx_libro_downloads_created ON libro_downloads(created_at);
  `,
    alterQueries: [],
  },
  {
    name: "diagnostic_core_v1",
    createQuery: `
  -- Extensión útil para búsqueda difusa (fuzzy)
  CREATE EXTENSION IF NOT EXISTS pg_trgm;

  -- Catálogo de tipos de nevera
  CREATE TABLE IF NOT EXISTS fridge_type (
    id    VARCHAR(36) PRIMARY KEY,
    code  VARCHAR(20) UNIQUE NOT NULL, -- 'digital' | 'analogica'
    name  VARCHAR(50) NOT NULL
  );

  -- ✅ Semilla con ID explícito (NO nulo)
  INSERT INTO fridge_type(id, code, name) VALUES
    ('FT_DIGITAL','digital','Digital'),
    ('FT_ANALOGICA','analogica','Analógica')
  ON CONFLICT (code) DO NOTHING;

  -- Preguntas (intenciones)
  CREATE TABLE IF NOT EXISTS diagnostic_question (
    id                   VARCHAR(36) PRIMARY KEY,
    slug                 VARCHAR(160) UNIQUE NOT NULL,
    title                TEXT NOT NULL,
    problem_keywords     TEXT[],
    default_fridge_type  VARCHAR(20) NOT NULL DEFAULT 'analogica',
    status               VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft | published | archived
    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
  );

  -- Índices (búsqueda fuzzy y filtros)
  CREATE INDEX IF NOT EXISTS idx_dq_title_trgm   ON diagnostic_question USING GIN (title gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_dq_status       ON diagnostic_question (status);
  CREATE INDEX IF NOT EXISTS idx_dq_default_type ON diagnostic_question (default_fridge_type);

  -- Artículos/guías
  CREATE TABLE IF NOT EXISTS diagnostic_article (
    id              VARCHAR(36) PRIMARY KEY,
    question_id     VARCHAR(36) NOT NULL REFERENCES diagnostic_question(id) ON DELETE CASCADE,
    fridge_type     VARCHAR(20) NOT NULL, -- digital | analogica
    seo_title       TEXT NOT NULL,
    seo_description TEXT NOT NULL,
    content_md      TEXT NOT NULL,
    published       BOOLEAN NOT NULL DEFAULT false,
    published_at    TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(question_id, fridge_type)
  );

  -- Índices artículos
  CREATE INDEX IF NOT EXISTS idx_da_published       ON diagnostic_article (published);
  CREATE INDEX IF NOT EXISTS idx_da_fridge_type     ON diagnostic_article (fridge_type);
  CREATE INDEX IF NOT EXISTS idx_da_seo_title_trgm  ON diagnostic_article USING GIN (seo_title gin_trgm_ops);

  -- Pasos (HowTo)
  CREATE TABLE IF NOT EXISTS article_step (
    id                VARCHAR(36) PRIMARY KEY,
    article_id        VARCHAR(36) NOT NULL REFERENCES diagnostic_article(id) ON DELETE CASCADE,
    idx               INT NOT NULL,
    title             TEXT NOT NULL,
    body_md           TEXT NOT NULL,
    tools             TEXT[], -- herramientas sugeridas
    duration_minutes  INT,
    risk_level        VARCHAR(20) DEFAULT 'bajo', -- bajo | medio | alto
    media_urls        TEXT[]
  );
  CREATE INDEX IF NOT EXISTS idx_step_article_idx ON article_step (article_id, idx);

  -- Marcas y modelos (opcional)
  CREATE TABLE IF NOT EXISTS brand (
    id   VARCHAR(36) PRIMARY KEY,
    name VARCHAR(80) UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS model (
    id        VARCHAR(36) PRIMARY KEY,
    brand_id  VARCHAR(36) NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
    name      VARCHAR(120) NOT NULL,
    UNIQUE(brand_id, name)
  );
  CREATE INDEX IF NOT EXISTS idx_model_brand ON model (brand_id);

  -- Especificaciones
  CREATE TABLE IF NOT EXISTS component_spec (
    id        VARCHAR(36) PRIMARY KEY,
    name      VARCHAR(80) NOT NULL,
    metric    VARCHAR(80) NOT NULL,
    good_min  NUMERIC,
    good_max  NUMERIC,
    note      TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_comp_spec_name ON component_spec (name);

  -- Etiquetas
  CREATE TABLE IF NOT EXISTS tag (
    id   VARCHAR(36) PRIMARY KEY,
    name VARCHAR(40) UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS diagnostic_question_tag (
    question_id VARCHAR(36) REFERENCES diagnostic_question(id) ON DELETE CASCADE,
    tag_id      VARCHAR(36) REFERENCES tag(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, tag_id)
  );
  CREATE INDEX IF NOT EXISTS idx_dqt_q ON diagnostic_question_tag (question_id);
  CREATE INDEX IF NOT EXISTS idx_dqt_t ON diagnostic_question_tag (tag_id);

  -- Árbol de decisión (opcional)
  CREATE TABLE IF NOT EXISTS decision_tree (
    id           VARCHAR(36) PRIMARY KEY,
    question_id  VARCHAR(36) NOT NULL REFERENCES diagnostic_question(id) ON DELETE CASCADE,
    fridge_type  VARCHAR(20) NOT NULL,
    version      INT NOT NULL DEFAULT 1,
    active       BOOLEAN NOT NULL DEFAULT true,
    tree_json    JSONB NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_dt_active ON decision_tree (question_id, fridge_type, active);

  -- Telemetría y feedback (opcional)
  CREATE TABLE IF NOT EXISTS telemetry_event (
    id          VARCHAR(36) PRIMARY KEY,
    ts          TIMESTAMP NOT NULL DEFAULT NOW(),
    event_type  VARCHAR(40) NOT NULL,
    search_term TEXT,
    slug        VARCHAR(160),
    fridge_type VARCHAR(20),
    meta        JSONB
  );
  CREATE INDEX IF NOT EXISTS idx_te_ts         ON telemetry_event (ts);
  CREATE INDEX IF NOT EXISTS idx_te_event_type ON telemetry_event (event_type);

  CREATE TABLE IF NOT EXISTS article_feedback (
    id         VARCHAR(36) PRIMARY KEY,
    article_id VARCHAR(36) REFERENCES diagnostic_article(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    success    BOOLEAN,
    comment    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_af_article ON article_feedback (article_id);
  CREATE INDEX IF NOT EXISTS idx_af_created ON article_feedback (created_at);
  `,
    alterQueries: [],
  },
  {
    name: "diagnostic_question_post_v1",
    createQuery: `
  -- Mapa Pregunta → Post del blog por idioma (para redirigir al contenido del blog)
  CREATE TABLE IF NOT EXISTS diagnostic_question_post (
    id           VARCHAR(36) PRIMARY KEY,
    question_id  VARCHAR(36) NOT NULL REFERENCES diagnostic_question(id) ON DELETE CASCADE,
    locale       VARCHAR(5)  NOT NULL,              -- 'es','en','pt','fr','de','ar'
    blog_slug    VARCHAR(200) NOT NULL,             -- slug público del post del blog
    published    BOOLEAN NOT NULL DEFAULT false,    -- true si ya debe redirigir / indexar
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (question_id, locale)
  );

  CREATE INDEX IF NOT EXISTS idx_dqp_question ON diagnostic_question_post(question_id);
  CREATE INDEX IF NOT EXISTS idx_dqp_locale   ON diagnostic_question_post(locale);
  `,
    alterQueries: [],
  },
  {
    name: "diagnostic_question_translation",
    createQuery: `
    CREATE TABLE IF NOT EXISTS diagnostic_question_translation (
      id            VARCHAR(36) PRIMARY KEY,
      question_id   VARCHAR(36) NOT NULL REFERENCES diagnostic_question(id) ON DELETE CASCADE,
      locale        TEXT NOT NULL,             -- 'en','pt','fr','de','ar'
      title         TEXT NOT NULL,
      slug          TEXT NOT NULL,
      created_at    TIMESTAMP DEFAULT NOW(),
      updated_at    TIMESTAMP DEFAULT NOW(),
      UNIQUE(question_id, locale),
      UNIQUE(locale, slug)                      -- evita duplicar slugs por idioma
    );
    -- (Opcional) índices recomendados
      CREATE INDEX IF NOT EXISTS idx_dqt_locale ON diagnostic_question_translation(locale);
      CREATE INDEX IF NOT EXISTS idx_dqt_slug_locale ON diagnostic_question_translation(locale, slug);
    `,
    alterQueries: [],
  },

  {
    name: "seo_pagespeed",
    createQuery: `
    CREATE TABLE IF NOT EXISTS seo_pagespeed (
      id            VARCHAR(36) PRIMARY KEY,
      url         TEXT NOT NULL,
      strategy    TEXT NOT NULL CHECK (strategy IN ('mobile', 'desktop')),
      score       NUMERIC NOT NULL,      -- 0–100
      raw_score   NUMERIC NOT NULL,      -- 0–1 de Lighthouse
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    -- (Opcional) índices recomendados
      CREATE INDEX IF NOT EXISTS idx_seo_pagespeed_url_created_at
      ON seo_pagespeed (url, created_at DESC);
    `,
    alterQueries: [],
  },
  // =========================
  // QUIZ TABLES (PostgreSQL)
  // =========================

  {
    name: "quiz_category",
    createQuery: `
      CREATE TABLE IF NOT EXISTS quiz_category(
        key VARCHAR(50) NOT NULL,
        context VARCHAR(20) NOT NULL DEFAULT 'daily',
        "order" INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,

        "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (key, context),
        CONSTRAINT quiz_category_context_chk CHECK (context IN ('daily', 'school'))
      );
    `,
    alterQueries: [
      `ALTER TABLE quiz_category
        ADD COLUMN IF NOT EXISTS "order" INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;`,

      `CREATE INDEX IF NOT EXISTS quiz_category_active_idx
        ON quiz_category(is_active);`,

      `CREATE INDEX IF NOT EXISTS quiz_category_context_order_idx
        ON quiz_category(context, "order");`,
    ],
  },

  {
    name: "quiz_category_translation",
    createQuery: `
      CREATE TABLE IF NOT EXISTS quiz_category_translation(
        id SERIAL PRIMARY KEY,

        category_key VARCHAR(50) NOT NULL,
        context VARCHAR(20) NOT NULL DEFAULT 'daily',
        locale VARCHAR(5) NOT NULL,

        title VARCHAR(120) NOT NULL,
        "desc" TEXT,
        badge VARCHAR(40),

        "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (category_key, context)
          REFERENCES quiz_category(key, context)
          ON DELETE CASCADE,

        UNIQUE (category_key, context, locale)
      );
    `,
    alterQueries: [
      `ALTER TABLE quiz_category_translation
        ADD COLUMN IF NOT EXISTS "desc" TEXT,
        ADD COLUMN IF NOT EXISTS badge VARCHAR(40);`,

      `CREATE INDEX IF NOT EXISTS quiz_cat_trans_locale_idx
        ON quiz_category_translation(locale);`,

      `CREATE INDEX IF NOT EXISTS quiz_cat_trans_key_ctx_idx
        ON quiz_category_translation(category_key, context);`,
    ],
  },

  {
    name: "quiz_question",
    createQuery: `
      CREATE TABLE IF NOT EXISTS quiz_question(
        id VARCHAR(60) PRIMARY KEY,

        context VARCHAR(20) NOT NULL DEFAULT 'daily',
        category_key VARCHAR(50) NOT NULL,

        answer_index SMALLINT NOT NULL,
        difficulty SMALLINT DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,

        "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (category_key, context)
          REFERENCES quiz_category(key, context)
          ON DELETE RESTRICT,

        CONSTRAINT quiz_question_context_chk CHECK (context IN ('daily', 'school')),
        CONSTRAINT quiz_question_answer_chk CHECK (answer_index BETWEEN 0 AND 3),
        CONSTRAINT quiz_question_diff_chk CHECK (difficulty BETWEEN 1 AND 5)
      );
    `,
    alterQueries: [
      `ALTER TABLE quiz_question
        ADD COLUMN IF NOT EXISTS difficulty SMALLINT DEFAULT 1,
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;`,

      `CREATE INDEX IF NOT EXISTS quiz_question_cat_ctx_active_idx
        ON quiz_question(category_key, context, is_active);`,

      `CREATE INDEX IF NOT EXISTS quiz_question_ctx_active_idx
        ON quiz_question(context, is_active);`,
    ],
  },

  {
    name: "quiz_question_translation",
    createQuery: `
      CREATE TABLE IF NOT EXISTS quiz_question_translation(
        id SERIAL PRIMARY KEY,

        question_id VARCHAR(60) NOT NULL REFERENCES quiz_question(id) ON DELETE CASCADE,
        locale VARCHAR(5) NOT NULL,

        question TEXT NOT NULL,
        choices TEXT[] NOT NULL,
        explanation TEXT,

        "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

        UNIQUE (question_id, locale),
        CONSTRAINT quiz_qtrans_choices_len_chk CHECK (array_length(choices, 1) = 4)
      );
    `,
    alterQueries: [
      `ALTER TABLE quiz_question_translation
        ADD COLUMN IF NOT EXISTS explanation TEXT;`,

      `CREATE INDEX IF NOT EXISTS quiz_qtrans_locale_idx
        ON quiz_question_translation(locale);`,

      `CREATE INDEX IF NOT EXISTS quiz_qtrans_qid_idx
        ON quiz_question_translation(question_id);`,

      // Opcional (si luego haces búsqueda full-text):
      // `CREATE INDEX IF NOT EXISTS quiz_qtrans_question_gin_idx
      //   ON quiz_question_translation USING GIN (to_tsvector('spanish', question));`,
    ],
  },

  {
    name: "quiz_daily_set",
    createQuery: `
      CREATE TABLE IF NOT EXISTS quiz_daily_set(
        id SERIAL PRIMARY KEY,

        date_key VARCHAR(10) NOT NULL, -- YYYY-MM-DD
        locale VARCHAR(5) NOT NULL,

        context VARCHAR(20) NOT NULL DEFAULT 'daily',
        category_key VARCHAR(50) NOT NULL,
        mode VARCHAR(20) NOT NULL, -- classic|fast|relaxed

        limit_count SMALLINT NOT NULL DEFAULT 10,
        seed INT,
        question_ids TEXT[] NOT NULL,

        "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (category_key, context)
          REFERENCES quiz_category(key, context)
          ON DELETE RESTRICT,

        CONSTRAINT quiz_daily_mode_chk CHECK (mode IN ('classic', 'fast', 'relaxed')),
        CONSTRAINT quiz_daily_ctx_chk CHECK (context IN ('daily', 'school')),
        CONSTRAINT quiz_daily_limit_chk CHECK (limit_count BETWEEN 1 AND 50),

        UNIQUE (date_key, locale, context, category_key, mode)
      );
    `,
    alterQueries: [
      `ALTER TABLE quiz_daily_set
        ADD COLUMN IF NOT EXISTS seed INT,
        ADD COLUMN IF NOT EXISTS limit_count SMALLINT DEFAULT 10;`,

      `CREATE INDEX IF NOT EXISTS quiz_daily_lookup_idx
        ON quiz_daily_set(date_key, locale, context, category_key, mode);`,

      `CREATE INDEX IF NOT EXISTS quiz_daily_date_idx
        ON quiz_daily_set(date_key);`,
    ],
  },

  {
    name: "quiz_indexes_extra",
    createQuery: "",
    alterQueries: [
      // Para joins rápidos (preguntas + traducción)
      `CREATE INDEX IF NOT EXISTS quiz_question_id_ctx_idx
        ON quiz_question(id, context);`,

      // Para filtrar categorías activas por contexto
      `CREATE INDEX IF NOT EXISTS quiz_category_ctx_active_idx
        ON quiz_category(context, is_active);`,
    ],
  },
  {
    name: "facebook_bot_queue",
    createQuery: `
    CREATE TABLE IF NOT EXISTS facebook_bot_queue (
      id              VARCHAR(36) PRIMARY KEY,
      page_id         VARCHAR(80) NOT NULL,
      post_id         VARCHAR(120) NOT NULL,
      comment_id      VARCHAR(120) NOT NULL UNIQUE,
      from_id         VARCHAR(120),
      comment_message TEXT NOT NULL,
      post_message    TEXT,
      status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | processing | retry | done | failed | skipped
      attempts        INT NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_until    TIMESTAMPTZ,
      worker_id       VARCHAR(80),
      last_error      TEXT,
      fb_code         INT,
      fb_subcode      INT,
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "processedAt"   TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_fbq_status_next_attempt
      ON facebook_bot_queue (status, next_attempt_at);

    CREATE INDEX IF NOT EXISTS idx_fbq_page_id
      ON facebook_bot_queue (page_id);

    CREATE INDEX IF NOT EXISTS idx_fbq_locked_until
      ON facebook_bot_queue (locked_until);
  `,
    alterQueries: [],
  },
  {
    name: "facebook_bot_cooldowns",
    createQuery: `
    CREATE TABLE IF NOT EXISTS facebook_bot_cooldowns (
      page_id         VARCHAR(80) PRIMARY KEY,
      cooldown_until  TIMESTAMPTZ NOT NULL,
      strikes         INT NOT NULL DEFAULT 1,
      reason          VARCHAR(120),
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_fbc_cooldown_until
      ON facebook_bot_cooldowns (cooldown_until);
  `,
    alterQueries: [],
  },
];
