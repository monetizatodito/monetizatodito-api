
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

        