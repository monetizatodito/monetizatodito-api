
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
        