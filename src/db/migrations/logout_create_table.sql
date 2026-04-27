
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


        