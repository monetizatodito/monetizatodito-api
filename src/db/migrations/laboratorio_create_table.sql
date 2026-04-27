
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



        