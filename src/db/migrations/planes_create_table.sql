
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


            