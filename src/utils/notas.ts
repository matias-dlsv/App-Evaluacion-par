// src/utils/notas.ts

export interface Estudiante {
  identificacion: string;
  notaPar?: number;
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

export interface ConfigDescuentos {
  maxCastigoFueraGrupo: number;
  maxCastigoNoEvaluo: number;
}

export const DEFAULT_DESCUENTOS: ConfigDescuentos = {
  maxCastigoFueraGrupo: 0.1,
  maxCastigoNoEvaluo: 0.1,
};

export function calcularNotasAjustadas(
  curso: Curso,
  config: ConfigDescuentos = DEFAULT_DESCUENTOS
): Curso {
  const estudianteAGrupos: Record<string, string[]> = {};
  curso.grupos.forEach((grupo) => {
    grupo.estudiantes.forEach((est) => {
      if (!estudianteAGrupos[est.identificacion]) {
        estudianteAGrupos[est.identificacion] = [];
      }
      estudianteAGrupos[est.identificacion].push(grupo.numero);
    });
  });

  const gruposActualizados = curso.grupos.map((grupo) => {
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

      const proporcionBase = Math.round((est.notaPar / sumaNotasPar) * 1000) / 1000;

      // Castigo por evaluar fuera del grupo: fijo por cada evaluación inválida
      const invalidas = est.evaluacionesInvalidas ?? 0;
      const factorCastigoFueraGrupo =
        Math.round(Math.min(invalidas * config.maxCastigoFueraGrupo, 1) * 1000) / 1000;

      // Castigo por no evaluar compañeros: proporcional
      const evaluados = est.nombresEvaluados || [];
      const companeros = grupo.estudiantes
        .map((e) => e.identificacion)
        .filter((id) => id !== est.identificacion);
      const companerosSuGrupoEvaluados = evaluados.filter(
        (nombre) => miembrosGrupo.has(nombre) && nombre !== est.identificacion
      ).length;
      const noEvaluados = Math.max(0, companeros.length - companerosSuGrupoEvaluados);
      const fraccionNoEvaluada =
        companeros.length > 0 ? noEvaluados / companeros.length : 0;
      const factorCastigoNoEvaluo =
        Math.round(fraccionNoEvaluada * config.maxCastigoNoEvaluo * 1000) / 1000;

      const factorCastigoTotal =
        Math.round((factorCastigoFueraGrupo + factorCastigoNoEvaluo) * 1000) / 1000;

      // Proporción con castigo — sin renormalizar
      const proporcionConCastigo =
        Math.round(proporcionBase * (1 - factorCastigoTotal) * 1000) / 1000;

      // Nota sin castigo
      let notaAjustada = Math.round(pozoTotal * proporcionBase * 10) / 10;
      if (notaAjustada > 7.0) notaAjustada = 7.0;

      // Nota con castigo
      let notaConDescuento = Math.round(pozoTotal * proporcionConCastigo * 10) / 10;
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

  return { ...curso, grupos: gruposActualizados };
}