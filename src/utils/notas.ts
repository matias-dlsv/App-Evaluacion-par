// src/utils/notas.ts

// Exportamos las interfaces para poder usarlas aquí y en App.tsx
export interface Estudiante {
  identificacion: string;
  notaPar?: number;
  evaluaciones?: number;
  notasIndividualesPar?: number[];
  nombresEvaluados?: string[]; // <-- NUEVA PROPIEDAD
  notaAjustada?: number;
}
export interface Grupo {
  numero: string;
  promedio_bruto?: number;
  estudiantes: Estudiante[];
}

export interface Curso {
  id: string;
  nombre: string;
  grupos: Grupo[];
}

export function calcularNotasAjustadas(curso: Curso): Curso {
  const gruposActualizados = curso.grupos.map((grupo) => {
    // Si el grupo no tiene nota bruta o sus estudiantes no tienen nota par, lo devolvemos tal cual
    if (grupo.promedio_bruto === undefined) return grupo;

    const N = grupo.estudiantes.length;
    const pozoTotal = grupo.promedio_bruto * N;

    // Calculamos la suma de las notas par de todos los integrantes del grupo
    const sumaNotasPar = grupo.estudiantes.reduce((suma, est) => {
      return suma + (est.notaPar || 0);
    }, 0);

    // Si nadie tiene nota par (suma = 0), evitamos dividir por cero
    if (sumaNotasPar === 0) return grupo;

    // Calculamos la nota ajustada para cada estudiante
    const estudiantesAjustados = grupo.estudiantes.map((est) => {
      if (est.notaPar === undefined) return est;

      const proporcion = est.notaPar / sumaNotasPar;
      let notaFinal = pozoTotal * proporcion;

      // Redondeamos a 1 decimal
      notaFinal = Math.round(notaFinal * 10) / 10;

      // Opcional: Topar la nota máxima a 7.0 (si usan escala 1 a 7 en Chile)
      // Si usan otra escala (ej. 1 a 10 o 0 a 100), cambia el 7.0 por tu nota máxima.
      if (notaFinal > 7.0) notaFinal = 7.0;

      return {
        ...est,
        notaAjustada: notaFinal,
      };
    });

    return {
      ...grupo,
      estudiantes: estudiantesAjustados,
    };
  });

  return {
    ...curso,
    grupos: gruposActualizados,
  };
}
