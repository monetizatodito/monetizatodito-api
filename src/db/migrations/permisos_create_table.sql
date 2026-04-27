
         CREATE TABLE IF NOT EXISTS permisos(
              id VARCHAR(50) PRIMARY KEY,
              nombre VARCHAR(50) UNIQUE NOT NULL,
              descripcion VARCHAR(255),
             "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP

)


      