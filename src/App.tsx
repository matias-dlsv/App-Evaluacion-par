// src/App.tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { create } from "zustand";
import "./App.css";
import { Curso, Grupo, calcularNotasAjustadas } from "./utils/notas";
import { exportarResultados } from "./utils/exportarExcel";

interface NotaExtraida {
  identificacion: string;
  nota_promedio: number;
  cantidad_evaluaciones: number;
  notas_individuales: number[];
  nombres_evaluados: string[]; // <-- NUEVA PROPIEDAD
}

// --- ESTADO GLOBAL ---
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

// --- COMPONENTE PRINCIPAL ---
function App() {
  const { cursos, agregarCurso, actualizarCurso } = useAppStore();
  const [cursoActivo, setCursoActivo] = useState<Curso | null>(null);
  const [nombreCurso, setNombreCurso] = useState("");
  const [estadoCarga, setEstadoCarga] = useState("");

  const crearCurso = async () => {
    if (!nombreCurso.trim()) return setEstadoCarga("Ingresa un nombre.");

    try {
      const file = await open({
        filters: [{ name: "Excel", extensions: ["xls", "xlsx"] }],
      });
      if (file) {
        setEstadoCarga("Procesando archivo...");
        const gruposExtraidos: Grupo[] = await invoke("procesar_excel", {
          ruta: file,
        });

        const nuevoCurso: Curso = {
          id: crypto.randomUUID(),
          nombre: nombreCurso,
          grupos: gruposExtraidos,
        };

        agregarCurso(nuevoCurso);
        setNombreCurso("");
        setEstadoCarga("");
      }
    } catch (error) {
      setEstadoCarga(`Error: ${error}`);
    }
  };

  const subirNotas = async () => {
    if (!cursoActivo) return;
    try {
      const file = await open({
        filters: [{ name: "Excel", extensions: ["xls", "xlsx"] }],
      });
      if (file) {
        const notasExtraidas: NotaExtraida[] = await invoke(
          "procesar_notas_excel",
          { ruta: file },
        );

        // 1. Asignamos la evaluación par a cada estudiante
        let cursoConNotasPar = {
          ...cursoActivo,
          grupos: cursoActivo.grupos.map((grupo) => ({
            ...grupo,
            estudiantes: grupo.estudiantes.map((est) => {
              const notaEncontrada = notasExtraidas.find(
                (n) => n.identificacion === est.identificacion,
              );
              if (notaEncontrada) {
                return {
                  ...est,
                  notaPar: notaEncontrada.nota_promedio,
                  evaluaciones: notaEncontrada.cantidad_evaluaciones,
                  notasIndividualesPar: notaEncontrada.notas_individuales,
                  nombresEvaluados: notaEncontrada.nombres_evaluados,
                };
              }
              return est;
            }),
          })),
        };

        // 2. Calculamos la NOTA AJUSTADA usando nuestra nueva función externa
        const cursoFinal = calcularNotasAjustadas(cursoConNotasPar);

        actualizarCurso(cursoFinal);
        setCursoActivo(cursoFinal);
      }
    } catch (error) {
      console.error(error);
      alert("Error al procesar el Excel de notas");
    }
  };

  if (cursoActivo) {
    const cursoData =
      cursos.find((c) => c.id === cursoActivo.id) || cursoActivo;

    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => setCursoActivo(null)}
            className="mb-6 text-blue-600 font-medium hover:underline flex items-center"
          >
            ← Volver a Cursos
          </button>

          <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                {cursoData.nombre}
              </h1>
              <p className="text-gray-500 mt-1">
                {cursoData.grupos.length} grupos registrados
              </p>
            </div>

            <div className="flex gap-4">
              {/* BOTÓN NUEVO: EXPORTAR */}
              <button
                onClick={async () => {
                  try {
                    await exportarResultados(cursoData);
                    alert("¡Excel exportado con éxito!"); // Agregamos este aviso de éxito
                  } catch (e) {
                    // AQUÍ ESTÁ EL CAMBIO: Mostramos el error exacto
                    alert(
                      "Error al exportar: " +
                        JSON.stringify(e, null, 2) +
                        " | " +
                        String(e),
                    );
                    console.error("Error completo:", e);
                  }
                }}
                className="px-5 py-3 bg-purple-600 text-white font-semibold rounded shadow hover:bg-purple-700 transition cursor-pointer"
              >
                Exportar a Excel
              </button>

              <button
                onClick={subirNotas}
                className="px-5 py-3 bg-green-600 text-white font-semibold rounded shadow hover:bg-green-700 transition cursor-pointer"
              >
                Subir Notas Ev. Par
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {cursoData.grupos.map((grupo) => (
              <div
                key={grupo.numero}
                className="bg-white p-5 rounded-xl shadow border border-gray-100 flex flex-col"
              >
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                  <h4 className="font-bold text-lg text-blue-800">
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
                      className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100"
                    >
                      <span
                        className="text-sm font-medium text-gray-700 truncate w-2/5"
                        title={est.identificacion}
                      >
                        {est.identificacion}
                      </span>

                      <div className="flex gap-2 w-3/5 justify-end">
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] text-blue-500 font-bold uppercase">
                            Bruta
                          </span>
                          <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-100">
                            {grupo.promedio_bruto ?? "—"}
                          </span>
                        </div>

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

                        {/* NUEVO: NOTA AJUSTADA */}
                        <div className="flex flex-col items-center ml-2 border-l pl-2 border-gray-200">
                          <span className="text-[9px] text-purple-600 font-bold uppercase">
                            Final
                          </span>
                          {est.notaAjustada !== undefined ? (
                            <span className="font-bold text-white bg-purple-600 px-2 py-0.5 rounded text-xs shadow-sm">
                              {est.notaAjustada}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic px-2 py-0.5">
                              ...
                            </span>
                          )}
                        </div>
                      </div>
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

  // ... (El bloque "return" principal de abajo se mantiene igual que antes)
  return (
    <div className="flex h-screen bg-gray-100 text-gray-800 font-sans">
      <div className="w-1/3 bg-white p-8 shadow-lg flex flex-col gap-6 border-r border-gray-200 z-10">
        <div>
          <h1 className="text-3xl font-bold text-blue-600">DIO</h1>
          <p className="text-sm text-gray-500">Evaluación Par</p>
        </div>
        <div className="flex flex-col gap-4 mt-6">
          <h2 className="text-xl font-semibold border-b pb-2">Nuevo Curso</h2>
          <input
            type="text"
            value={nombreCurso}
            onChange={(e) => setNombreCurso(e.target.value)}
            placeholder="Ej: Programación Avanzada..."
            className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={crearCurso}
            className="mt-2 px-4 py-3 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition cursor-pointer"
          >
            Subir "Administrativo" (Excel) y Crear
          </button>
          {estadoCarga && (
            <p className="text-sm text-center text-gray-600 mt-2">
              {estadoCarga}
            </p>
          )}
        </div>
      </div>

      <div className="w-2/3 p-8 bg-gray-50 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-700">
          Cursos Creados
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {cursos.map((curso) => (
            <div
              key={curso.id}
              onClick={() => setCursoActivo(curso)}
              className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition cursor-pointer flex justify-between items-center group"
            >
              <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600">
                {curso.nombre}
              </h3>
              <span className="text-sm bg-blue-50 text-blue-800 py-1 px-3 rounded-full border border-blue-100">
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
