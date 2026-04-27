
    CREATE TABLE IF NOT EXISTS "md_draft" (
      id            VARCHAR(50) PRIMARY KEY,
      filename      TEXT NOT NULL,                 -- p.ej. documento-20250818-074839.md
      "storagePath" TEXT NOT NULL,                 -- p.ej. /uploads/md2pdf/drafts/...
      "usuarioId"   VARCHAR(36) NOT NULL,          -- FK a usuario(id)
      "createdAt"   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "fk_md_draft_usuario"
        FOREIGN KEY ("usuarioId") REFERENCES "usuario"(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "idx_md_draft_usuario"
    ON "md_draft"("usuarioId");
  