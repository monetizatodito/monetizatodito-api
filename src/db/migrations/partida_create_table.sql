
    CREATE TABLE IF NOT EXISTS partida(
      id VARCHAR(36) PRIMARY KEY,
      "usuarioId" VARCHAR(36) NOT NULL,
      palabras TEXT[] NOT NULL,
      palabras_seleccionadas TEXT[] NULL,
      fecha DATE NOT NULL,
      hora_inicio TIMESTAMP NOT NULL,
      hora_fin TIMESTAMP, -- puede ser NULL al iniciar
      finalizada BOOLEAN DEFAULT false,
      FOREIGN KEY ("usuarioId") REFERENCES usuario(id) ON DELETE CASCADE
);


      