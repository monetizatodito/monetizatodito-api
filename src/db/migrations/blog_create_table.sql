
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


        