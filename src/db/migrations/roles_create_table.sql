
            CREATE TABLE IF NOT EXISTS roles(
                id VARCHAR(50) PRIMARY KEY,
                roll VARCHAR(50) NOT NULL,
                activo BOOLEAN DEFAULT TRUE,
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP

)



            