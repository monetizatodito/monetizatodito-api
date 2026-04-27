
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


      