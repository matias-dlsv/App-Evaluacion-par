// src/types/app.ts

export interface NotaExtraida {
  identificacion: string;
  nota_promedio: number | null;
  cantidad_evaluaciones: number;
  notas_individuales: number[];
  nombres_evaluados: string[];
  grupo: string;
  evaluaciones_invalidas: number;
}

export interface AutoEvaluacion {
  identificacion: string;
  grupo: string;
  nota_auto: number | null;
}