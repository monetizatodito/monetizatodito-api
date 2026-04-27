
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
    