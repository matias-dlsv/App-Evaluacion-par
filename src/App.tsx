// src/App.tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { create } from "zustand";
import "./App.css";
import {
  Curso,
  Grupo,
  ConfigDescuentos,
  DEFAULT_DESCUENTOS,
  calcularNotasAjustadas,
} from "./utils/notas";
import { exportarResultados } from "./utils/exportarExcel";

interface NotaExtraida {
  identificacion: string;
  nota_promedio: number;
  cantidad_evaluaciones: number;
  notas_individuales: number[];
  nombres_evaluados: string[];
  grupo: string;
  evaluaciones_invalidas: number;
}

interface AppState {
  cursos: Curso[];
  agregarCurso: (curso: Curso) => void;
  actualizarCurso: (cursoActualizado: Curso) => void;
}

const useAppStore = create<AppState>((set) => ({
  cursos: [],
  agregarCurso: (curso) =>
    set((state) => ({ cursos: [...state.cursos, curso] })),
  actualizarCurso: (cursoActualizado) =>
    set((state) => ({
      cursos: state.cursos.map((c) =>
        c.id === cursoActualizado.id ? cursoActualizado : c,
      ),
    })),
}));

function App() {
  const { cursos, agregarCurso, actualizarCurso } = useAppStore();
  const [cursoActivo, setCursoActivo] = useState<Curso | null>(null);
  const [nombreCurso, setNombreCurso] = useState("");
  const [estadoCarga, setEstadoCarga] = useState("");
  // notasBrutas indexed by cursoId -> grupoNumero -> value
  const [notasBrutas, setNotasBrutas] = useState<
    Record<string, Record<string, string>>
  >({});
  const [config, setConfig] = useState<ConfigDescuentos>(DEFAULT_DESCUENTOS);

  const crearCurso = async () => {
    if (!nombreCurso.trim()) return setEstadoCarga("Ingresa un nombre.");
    try {
      const file = await open({
        filters: [{ name: "Excel", extensions: ["xls", "xlsx"] }],
      });
      if (!file) return;
      setEstadoCarga("Procesando archivo...");

      const gruposExtraidos: Grupo[] = await invoke("procesar_respuestas", {
        ruta: file,
      });
      const notasExtraidas: NotaExtraida[] = await invoke("obtener_notas_par", {
        ruta: file,
      });

      const gruposConNotas = gruposExtraidos.map((grupo) => ({
        ...grupo,
        estudiantes: grupo.estudiantes.map((est) => {
          const nota = notasExtraidas.find(
            (n) => n.identificacion === est.identificacion,
          );
          if (!nota) return est;
          return {
            ...est,
            notaPar: nota.nota_promedio,
            evaluaciones: nota.cantidad_evaluaciones,
            notasIndividualesPar: nota.notas_individuales,
            nombresEvaluados: nota.nombres_evaluados,
            evaluacionesInvalidas: nota.evaluaciones_invalidas,
          };
        }),
      }));

      const nuevoCurso: Curso = {
        id: crypto.randomUUID(),
        nombre: nombreCurso,
        grupos: gruposConNotas,
      };

      agregarCurso(nuevoCurso);
      setNombreCurso("");
      setEstadoCarga("");
    } catch (error) {
      setEstadoCarga(`Error: ${error}`);
    }
  };

  const aplicarNotasBrutas = () => {
    if (!cursoActivo) return;
    const cursoData =
      cursos.find((c) => c.id === cursoActivo.id) || cursoActivo;

    // Use only this course's notas brutas
    const notasCurso = notasBrutas[cursoData.id] ?? {};

    const gruposActualizados = cursoData.grupos.map((grupo) => {
      const valor = notasCurso[grupo.numero];
      const nota =
        valor !== undefined ? parseFloat(valor) : grupo.promedio_bruto;
      return {
        ...grupo,
        promedio_bruto: isNaN(nota as number) ? grupo.promedio_bruto : nota,
      };
    });

    const cursoConBrutas: Curso = { ...cursoData, grupos: gruposActualizados };
    const cursoFinal = calcularNotasAjustadas(cursoConBrutas, config);
    actualizarCurso(cursoFinal);
    setCursoActivo(cursoFinal);
  };

  const estudiantesDuplicados = (() => {
    if (!cursoActivo) return new Set<string>();
    const cursoData =
      cursos.find((c) => c.id === cursoActivo.id) || cursoActivo;
    const conteo: Record<string, number> = {};
    cursoData.grupos.forEach((g) =>
      g.estudiantes.forEach((e) => {
        conteo[e.identificacion] = (conteo[e.identificacion] || 0) + 1;
      }),
    );
    return new Set(
      Object.entries(conteo)
        .filter(([, v]) => v > 1)
        .map(([k]) => k),
    );
  })();

  if (cursoActivo) {
    const cursoData =
      cursos.find((c) => c.id === cursoActivo.id) || cursoActivo;

    // Helper to get/set notas for the active course only
    const notasCurso = notasBrutas[cursoData.id] ?? {};
    const setNotaCurso = (grupoNumero: string, valor: string) =>
      setNotasBrutas((prev) => ({
        ...prev,
        [cursoData.id]: {
          ...(prev[cursoData.id] ?? {}),
          [grupoNumero]: valor,
        },
      }));

    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Top bar with Uniandes branding */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setCursoActivo(null)}
              className="text-[#1a56a0] font-medium hover:underline flex items-center"
            >
              ← Volver a Cursos
            </button>
            <span className="text-gray-300">|</span>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-widest">
              DIO
            </span>
          </div>

          {/* Header */}
          <div className="flex justify-between items-center bg-gradient-to-r from-[#1a56a0] to-[#2563eb] p-6 rounded-xl shadow mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white">
                {cursoData.nombre}
              </h1>
              <p className="text-blue-200 mt-1">
                {cursoData.grupos.length} grupos
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  await exportarResultados(cursoData);
                  alert("¡Excel exportado con éxito!");
                } catch (e) {
                  alert("Error al exportar: " + String(e));
                }
              }}
              className="px-5 py-3 bg-white text-[#1a56a0] font-semibold rounded shadow hover:bg-blue-50 transition cursor-pointer border border-blue-200"
            >
              Exportar a Excel
            </button>
          </div>

          {/* Alerta duplicados */}
          {estudiantesDuplicados.size > 0 && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 mb-6 flex gap-3 items-start">
              <span className="text-yellow-500 text-xl">⚠️</span>
              <div>
                <p className="font-bold text-yellow-800">
                  Estudiantes registrados en más de un grupo
                </p>
                <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside">
                  {[...estudiantesDuplicados].map((nombre) => (
                    <li key={nombre}>{nombre}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Config castigos */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
            <h2 className="text-lg font-bold text-[#1a56a0] mb-1">
              Configuración de castigos
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Fracción máxima de reducción sobre la proporción del estudiante (0
              a 1). Ej: 0.1 = hasta 10% menos de su parte del pozo.
            </p>
            <div className="flex gap-8 flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-red-500 uppercase">
                  Máx. castigo por evaluar fuera del grupo
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={config.maxCastigoFueraGrupo}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      maxCastigoFueraGrupo: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="p-2 border border-gray-300 rounded text-sm w-28 focus:ring-2 focus:ring-red-300 outline-none"
                />
                <span className="text-[10px] text-gray-400">
                  × cada evaluación inválida
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-orange-500 uppercase">
                  Máx. castigo por no evaluar compañeros
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={config.maxCastigoNoEvaluo}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      maxCastigoNoEvaluo: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="p-2 border border-gray-300 rounded text-sm w-28 focus:ring-2 focus:ring-orange-300 outline-none"
                />
                <span className="text-[10px] text-gray-400">
                  × (no evaluados / compañeros totales)
                </span>
              </div>
            </div>
          </div>

          {/* Notas brutas */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-[#1a56a0]">
                Notas brutas por grupo
              </h2>
              <button
                onClick={aplicarNotasBrutas}
                className="px-4 py-2 bg-[#1a56a0] text-white font-semibold rounded hover:bg-[#1e40af] transition cursor-pointer text-sm"
              >
                Calcular notas finales
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {cursoData.grupos.map((grupo) => (
                <div key={grupo.numero} className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-500">
                    Grupo {grupo.numero}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="7"
                    value={
                      notasCurso[grupo.numero] ?? grupo.promedio_bruto ?? ""
                    }
                    onChange={(e) => setNotaCurso(grupo.numero, e.target.value)}
                    className="p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Grilla de grupos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {cursoData.grupos.map((grupo) => (
              <div
                key={grupo.numero}
                className="bg-white p-5 rounded-xl shadow border border-gray-100 flex flex-col"
              >
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                  <h4 className="font-bold text-lg text-[#1a56a0]">
                    Grupo {grupo.numero}
                  </h4>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">
                    {grupo.estudiantes.length} integrantes
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {grupo.estudiantes.map((est, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col p-3 rounded-lg border ${
                        est.gruposDuplicados
                          ? "border-yellow-400 bg-yellow-50"
                          : "bg-gray-50 border-gray-100"
                      }`}
                    >
                      {/* Nombre */}
                      <div className="mb-2">
                        <span
                          className="text-sm font-medium text-gray-700 truncate block"
                          title={est.identificacion}
                        >
                          {est.identificacion}
                          {est.gruposDuplicados && (
                            <span className="ml-2 text-yellow-600 text-xs font-bold">
                              ⚠ duplicado
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Notas */}
                      <div className="flex gap-2 flex-wrap">
                        {/* Bruta */}
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] text-blue-500 font-bold uppercase">
                            Bruta
                          </span>
                          <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-100">
                            {grupo.promedio_bruto ?? "—"}
                          </span>
                        </div>

                        {/* Par */}
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] text-green-600 font-bold uppercase">
                            Par
                          </span>
                          {est.notaPar !== undefined ? (
                            <span className="font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded text-xs border border-green-200">
                              {est.notaPar}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic px-2 py-0.5">
                              ...
                            </span>
                          )}
                        </div>

                        {/* Final sin castigo */}
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] text-blue-600 font-bold uppercase">
                            Final
                          </span>
                          {est.notaAjustada !== undefined ? (
                            <span className="font-bold text-white bg-[#1a56a0] px-2 py-0.5 rounded text-xs shadow-sm">
                              {est.notaAjustada}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic px-2 py-0.5">
                              ...
                            </span>
                          )}
                        </div>

                        {/* Castigo */}
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] text-red-500 font-bold uppercase">
                            Castigo
                          </span>
                          {est.factorCastigoTotal !== undefined ? (
                            <span
                              className={`font-bold px-2 py-0.5 rounded text-xs border ${
                                est.factorCastigoTotal > 0
                                  ? "text-red-700 bg-red-50 border-red-200"
                                  : "text-gray-400 bg-gray-50 border-gray-100"
                              }`}
                              title={`Fuera de grupo: -${(est.factorCastigoFueraGrupo! * 100).toFixed(1)}% | No evaluó: -${(est.factorCastigoNoEvaluo! * 100).toFixed(1)}%`}
                            >
                              {est.factorCastigoTotal > 0
                                ? `-${(est.factorCastigoTotal * 100).toFixed(1)}%`
                                : "0%"}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic px-2 py-0.5">
                              ...
                            </span>
                          )}
                        </div>

                        {/* Nota con castigo */}
                        <div className="flex flex-col items-center border-l pl-2 border-gray-200">
                          <span className="text-[9px] text-gray-700 font-bold uppercase">
                            c/castigo
                          </span>
                          {est.notaConDescuento !== undefined ? (
                            <span className="font-bold text-white bg-gray-700 px-2 py-0.5 rounded text-xs shadow-sm">
                              {est.notaConDescuento}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic px-2 py-0.5">
                              ...
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detalle castigo */}
                      {est.factorCastigoTotal !== undefined &&
                        est.factorCastigoTotal > 0 && (
                          <div className="mt-2 text-[10px] text-red-500 flex gap-3 flex-wrap">
                            {est.factorCastigoFueraGrupo! > 0 && (
                              <span>
                                X Fuera de grupo: -
                                {(est.factorCastigoFueraGrupo! * 100).toFixed(
                                  1,
                                )}
                                %
                              </span>
                            )}
                            {est.factorCastigoNoEvaluo! > 0 && (
                              <span>
                                X No evaluó: -
                                {(est.factorCastigoNoEvaluo! * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 text-gray-800 font-sans">
      {/* Sidebar */}
      <div className="w-1/3 bg-gradient-to-b from-[#1a56a0] to-[#2563eb] p-8 shadow-lg flex flex-col gap-6 border-r border-blue-900 z-10 text-white">
        {/* Branding */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-16 h-8 rounded-full bg-white flex items-center justify-center shadow">
              <span className="text-[#1a56a0] font-extrabold text-xs leading-none">
                UANDES
              </span>
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow">
            DIO
          </h1>
          <p className="text-sm text-blue-200 font-medium">
            Plataforma de Evaluación Par
          </p>
        </div>

        <div className="flex flex-col gap-4 mt-4">
          <h2 className="text-xl font-semibold border-b border-blue-400 pb-2 text-white">
            Nuevo Curso
          </h2>
          <input
            type="text"
            value={nombreCurso}
            onChange={(e) => setNombreCurso(e.target.value)}
            placeholder="Ej: Neuromecánica..."
            className="p-2 border border-blue-300 rounded bg-white/10 text-white placeholder-blue-300 focus:ring-2 focus:ring-white outline-none"
          />
          <button
            onClick={crearCurso}
            className="mt-2 px-4 py-3 bg-white text-[#1a56a0] font-bold rounded hover:bg-blue-100 transition cursor-pointer shadow"
          >
            Subir Excel de Evaluación Par
          </button>
          {estadoCarga && (
            <p className="text-sm text-center text-blue-200 mt-2">
              {estadoCarga}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-6 border-t border-blue-500">
          <p className="text-[10px] text-blue-300 text-center leading-relaxed">
            <span className="font-semibold text-white">
              Universidad de los Andes
            </span>
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="w-2/3 p-8 bg-gray-50 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-[#1a56a0]">
          Cursos Creados
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {cursos.map((curso) => (
            <div
              key={curso.id}
              onClick={() => setCursoActivo(curso)}
              className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-[#2563eb] transition cursor-pointer flex justify-between items-center group"
            >
              <h3 className="text-xl font-bold text-gray-800 group-hover:text-[#1a56a0]">
                {curso.nombre}
              </h3>
              <span className="text-sm bg-blue-50 text-[#1a56a0] py-1 px-3 rounded-full border border-blue-200">
                {curso.grupos.length} grupos →
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
