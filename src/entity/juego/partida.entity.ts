export interface PartidaEntity {
  id: string;
  usuarioId: string;
  palabras: string[]; // Palabras del día
  palabras_seleccionadas?: string[]; // Palabras que el jugador encontró
  total_palabras?: string;
  total_acertadas?: string;
  fecha: Date;
  hora_inicio: Date;
  hora_fin: Date | null;
  finalizada: boolean;
}
