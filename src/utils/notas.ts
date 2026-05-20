// src/utils/notas.ts

export interface Estudiante {
  identificacion: string;
  notaPar?: number;
  notaAuto?: number; // autoevaluación, solo para referencia del profesor
  evaluaciones?: number;
  notasIndividualesPar?: number[];
  nombresEvaluados?: string[];
  notaAjustada?: number;
  factorCastigoFueraGrupo?: number;
  factorCastigoNoEvaluo?: number;
  factorCastigoTotal?: number;
  notaConDescuento?: number;
  gruposDuplicados?: boolean;
  evaluacionesInvalidas?: number;
  proporcionBase?: number;
  proporcionConCastigo?: number;
  descuentoManual?: boolean;
}

export interface Grupo {
  numero: string;
  promedio_bruto?: number;
  estudiantes: Estudiante[];
}

export interface Evaluacion {
  id: string;
  nombre: string;
  grupos: Grupo[];
}

export interface Curso {
  id: string;
  nombre: string;
  evaluaciones: Evaluacion[];
}

export interface ConfigDescuentos {
  maxCastigoFueraGrupo: number;
  maxCastigoNoEvaluo: number;
}

export const DEFAULT_DESCUENTOS: ConfigDescuentos = {
  maxCastigoFueraGrupo: 0.1,
  maxCastigoNoEvaluo: 0.1,
};

export interface EstudianteSeguimiento {
  identificacion: string;
  evaluaciones: {
    evalId: string;
    evalNombre: string;
    grupo: string;
    notaGrupo?: number;
    notaFinal?: number;
    notaPar?: number;
    factorCastigoTotal?: number;
  }[];
}

/**
 * Migra un curso del formato viejo (grupos directamente en el curso)
 * al nuevo formato (grupos dentro de evaluaciones).
 * Si el curso ya tiene evaluaciones, lo retorna sin cambios.
 */
export function migrarCurso(curso: any): Curso {
  if (curso.evaluaciones && Array.isArray(curso.evaluaciones)) {
    return curso as Curso;
  }
  return {
    id: curso.id,
    nombre: curso.nombre,
    evaluaciones: [
      {
        id: crypto.randomUUID(),
        nombre: "Evaluación 1",
        grupos: curso.grupos || [],
      },
    ],
  };
}

/**
 * Construye el seguimiento longitudinal de cada estudiante a través
 * de todas las evaluaciones del curso. Matching exacto por identificacion.
 * Si un estudiante aparece en varios grupos de la misma evaluación,
 * se toma solo la primera ocurrencia.
 * Resultado ordenado alfabéticamente por identificacion.
 */
export function construirSeguimiento(curso: Curso): EstudianteSeguimiento[] {
  const mapa = new Map<string, EstudianteSeguimiento>();

  curso.evaluaciones.forEach((evaluacion) => {
    const vistoEnEval = new Set<string>();
    evaluacion.grupos.forEach((grupo) => {
      grupo.estudiantes.forEach((est) => {
        if (!mapa.has(est.identificacion)) {
          mapa.set(est.identificacion, {
            identificacion: est.identificacion,
            evaluaciones: [],
          });
        }
        if (!vistoEnEval.has(est.identificacion)) {
          vistoEnEval.add(est.identificacion);
          mapa.get(est.identificacion)!.evaluaciones.push({
            evalId: evaluacion.id,
            evalNombre: evaluacion.nombre,
            grupo: grupo.numero,
            notaGrupo: grupo.promedio_bruto,
            notaFinal: est.notaConDescuento,
            notaPar: est.notaPar,
            factorCastigoTotal: est.factorCastigoTotal,
          });
        }
      });
    });
  });

  const resultado: EstudianteSeguimiento[] = [];
  mapa.forEach((seg) => resultado.push(seg));

  // Ordenar alfabéticamente por identificacion
  resultado.sort((a, b) =>
    a.identificacion.localeCompare(b.identificacion, "es", {
      sensitivity: "base",
    })
  );

  return resultado;
}

/**
 * Calcula las notas ajustadas de una evaluación.
 * Recibe una Evaluacion y retorna la Evaluacion actualizada con los campos calculados.
 */
export function calcularNotasAjustadas(
  evaluacion: Evaluacion,
  config: ConfigDescuentos = DEFAULT_DESCUENTOS
): Evaluacion {
  const estudianteAGrupos: Record<string, string[]> = {};
  evaluacion.grupos.forEach((grupo) => {
    grupo.estudiantes.forEach((est) => {
      if (!estudianteAGrupos[est.identificacion]) {
        estudianteAGrupos[est.identificacion] = [];
      }
      estudianteAGrupos[est.identificacion].push(grupo.numero);
    });
  });

  const gruposActualizados = evaluacion.grupos.map((grupo) => {
    if (grupo.promedio_bruto === undefined) return grupo;

    const pozoTotal = grupo.promedio_bruto * grupo.estudiantes.length;
    const miembrosGrupo = new Set(grupo.estudiantes.map((e) => e.identificacion));

    const sumaNotasPar = grupo.estudiantes.reduce(
      (suma, est) => suma + (est.notaPar || 0),
      0
    );
    if (sumaNotasPar === 0) return grupo;

    const estudiantesAjustados = grupo.estudiantes.map((est) => {
      if (est.notaPar === undefined) return est;

      const proporcionBase =
        Math.round((est.notaPar / sumaNotasPar) * 1000) / 1000;

      let factorCastigoFueraGrupo: number;
      let factorCastigoNoEvaluo: number;

      if (est.descuentoManual) {
        factorCastigoFueraGrupo = est.factorCastigoFueraGrupo ?? 0;
        factorCastigoNoEvaluo = est.factorCastigoNoEvaluo ?? 0;
      } else {
        const invalidas = est.evaluacionesInvalidas ?? 0;
        factorCastigoFueraGrupo =
          Math.round(
            Math.min(invalidas * config.maxCastigoFueraGrupo, 1) * 1000
          ) / 1000;

        const evaluados = est.nombresEvaluados || [];
        const companeros = grupo.estudiantes
          .map((e) => e.identificacion)
          .filter((id) => id !== est.identificacion);
        const companerosSuGrupoEvaluados = evaluados.filter(
          (nombre) =>
            miembrosGrupo.has(nombre) && nombre !== est.identificacion
        ).length;
        const noEvaluados = Math.max(
          0,
          companeros.length - companerosSuGrupoEvaluados
        );
        const fraccionNoEvaluada =
          companeros.length > 0 ? noEvaluados / companeros.length : 0;
        factorCastigoNoEvaluo =
          Math.round(
            fraccionNoEvaluada * config.maxCastigoNoEvaluo * 1000
          ) / 1000;
      }

      const factorCastigoTotal =
        Math.round((factorCastigoFueraGrupo + factorCastigoNoEvaluo) * 1000) /
        1000;

      const proporcionConCastigo =
        Math.round(proporcionBase * (1 - factorCastigoTotal) * 1000) / 1000;

      let notaAjustada = Math.round(pozoTotal * proporcionBase * 10) / 10;
      if (notaAjustada > 7.0) notaAjustada = 7.0;

      let notaConDescuento =
        Math.round(pozoTotal * proporcionConCastigo * 10) / 10;
      if (notaConDescuento > 7.0) notaConDescuento = 7.0;

      const gruposDuplicados =
        (estudianteAGrupos[est.identificacion]?.length ?? 0) > 1;

      return {
        ...est,
        notaAjustada,
        factorCastigoFueraGrupo,
        factorCastigoNoEvaluo,
        factorCastigoTotal,
        notaConDescuento,
        gruposDuplicados,
        proporcionBase,
        proporcionConCastigo,
      };
    });

    estudiantesAjustados.sort((a, b) =>
      a.identificacion.localeCompare(b.identificacion)
    );

    return { ...grupo, estudiantes: estudiantesAjustados };
  });

  return { ...evaluacion, grupos: gruposActualizados };
}