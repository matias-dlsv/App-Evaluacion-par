// src/utils/helpers.ts
import { invoke } from "@tauri-apps/api/core";
import { Grupo, Estudiante } from "./notas";
import { NotaExtraida, AutoEvaluacion } from "../types/app";

export function nuevoEstudiante(): Estudiante {
  return { identificacion: "" };
}

export function nuevoGrupo(grupos: Grupo[]): Grupo {
  const nums = grupos.map((g) => parseInt(g.numero)).filter((n) => !isNaN(n));
  const siguiente = nums.length ? Math.max(...nums) + 1 : 1;
  return { numero: String(siguiente), estudiantes: [] };
}

export async function procesarArchivoEvaluacion(ruta: string) {
  const gruposExtraidos: Grupo[] = await invoke("procesar_respuestas", {
    ruta,
  });
  const notasExtraidas: NotaExtraida[] = await invoke("obtener_notas_par", {
    ruta,
  });
  const autoevaluaciones: AutoEvaluacion[] = await invoke(
    "obtener_autoevaluaciones",
    { ruta },
  );

  const mapaAuto = new Map(
    autoevaluaciones.map((a) => [a.identificacion, a.nota_auto]),
  );

  const gruposConNotas = gruposExtraidos.map((grupo) => ({
    ...grupo,
    estudiantes: grupo.estudiantes.map((est) => {
      const nota = notasExtraidas.find(
        (n) => n.identificacion === est.identificacion,
      );
      const notaAuto = mapaAuto.get(est.identificacion);
      return {
        ...est,
        notaPar:
          nota?.nota_promedio !== null && nota?.nota_promedio !== undefined
            ? nota.nota_promedio
            : undefined,
        evaluaciones: nota?.cantidad_evaluaciones,
        notasIndividualesPar: nota?.notas_individuales,
        nombresEvaluados: nota?.nombres_evaluados,
        evaluacionesInvalidas: nota?.evaluaciones_invalidas,
        notaAuto:
          notaAuto !== null && notaAuto !== undefined ? notaAuto : undefined,
      };
    }),
  }));

  return gruposConNotas;
}
