
         CREATE TABLE IF NOT EXISTS urls(
              id VARCHAR(50) PRIMARY KEY,
              url_larga TEXT NOT NULL,
              url_corta VARCHAR(10) UNIQUE NOT NULL,
              "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP

)


      