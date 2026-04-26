// src/App.tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { create } from "zustand";
import "./App.css";
import {
  Curso,
  Grupo,
  Estudiante,
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

// ─── helpers ──────────────────────────────────────────────────────────────────

function nuevoEstudiante(): Estudiante {
  return { identificacion: "" };
}

function nuevoGrupo(grupos: Grupo[]): Grupo {
  const nums = grupos.map((g) => parseInt(g.numero)).filter((n) => !isNaN(n));
  const siguiente = nums.length ? Math.max(...nums) + 1 : 1;
  return { numero: String(siguiente), estudiantes: [] };
}

// ─── SVG delete button ────────────────────────────────────────────────────────

function BtnEliminar({ onClick, title = "Eliminar" }: { onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-6 h-6 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition cursor-pointer"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="w-3.5 h-3.5"
      >
        <path
          fillRule="evenodd"
          d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

// ─── componente de edición de grupo ───────────────────────────────────────────

interface EditGrupoProps {
  grupo: Grupo;
  onSave: (g: Grupo) => void;
  onCancel: () => void;
}

function EditGrupo({ grupo, onSave, onCancel }: EditGrupoProps) {
  const [draft, setDraft] = useState<Grupo>(() =>
    JSON.parse(JSON.stringify(grupo)),
  );

  const setPromedio = (v: string) =>
    setDraft((p) => ({
      ...p,
      promedio_bruto: v === "" ? undefined : parseFloat(v),
    }));

  const setEst = (idx: number, field: keyof Estudiante, val: string) =>
    setDraft((p) => {
      const ests = [...p.estudiantes];
      const numFields = ["notaPar", "evaluaciones", "factorCastigoFueraGrupo", "factorCastigoNoEvaluo"];
      ests[idx] = {
        ...ests[idx],
        [field]: numFields.includes(field as string)
          ? val === "" ? undefined : parseFloat(val)
          : val,
      };
      return { ...p, estudiantes: ests };
    });

  const addEst = () =>
    setDraft((p) => ({
      ...p,
      estudiantes: [...p.estudiantes, nuevoEstudiante()],
    }));

  const removeEst = (idx: number) =>
    setDraft((p) => ({
      ...p,
      estudiantes: p.estudiantes.filter((_, i) => i !== idx),
    }));

  return (
    <div className="flex flex-col gap-4 p-4 bg-red-50 border-t border-red-200">
      {/* Nota bruta del grupo */}
      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase">
            Nota bruta del grupo
          </label>
          <input
            type="number"
            step="0.1"
            min="1"
            max="7"
            value={draft.promedio_bruto ?? ""}
            onChange={(e) => setPromedio(e.target.value)}
            className="w-24 p-1.5 border border-gray-300 rounded text-sm text-center focus:ring-2 focus:ring-red-300 outline-none bg-white"
          />
        </div>
      </div>

      {/* Tabla de estudiantes */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-gray-500 uppercase text-[10px] border-b-2 border-gray-200 bg-white">
              <th className="text-left py-2 pr-3 font-semibold">Alumno</th>
              <th className="text-center py-2 px-2 font-semibold whitespace-nowrap">Nota Bruta</th>
              <th className="text-center py-2 px-2 font-semibold whitespace-nowrap">Ev. Par</th>
              <th className="text-center py-2 px-2 font-semibold whitespace-nowrap text-orange-600">
                Desc.<br />No Evaluó
              </th>
              <th className="text-center py-2 px-2 font-semibold whitespace-nowrap text-red-600">
                Desc.<br />Grupo Ajeno
              </th>
              <th className="text-center py-2 px-2 font-semibold whitespace-nowrap text-[#ce0019]">
                Nota Final
              </th>
              <th className="py-2 w-6" />
            </tr>
          </thead>
          <tbody>
            {draft.estudiantes.map((est, idx) => (
              <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-white/60">
                <td className="py-1.5 pr-3">
                  <input
                    value={est.identificacion}
                    onChange={(e) => setEst(idx, "identificacion", e.target.value)}
                    placeholder="Nombre o ID"
                    className="w-full p-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-red-300 outline-none bg-white min-w-[120px]"
                  />
                </td>
                {/* Nota bruta: heredada del grupo, solo lectura */}
                <td className="py-1.5 px-2 text-center">
                  <span className="text-xs text-gray-500 font-semibold bg-gray-100 px-2 py-1 rounded">
                    {draft.promedio_bruto ?? "—"}
                  </span>
                </td>
                {/* Nota par */}
                <td className="py-1.5 px-2">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max="7"
                    value={est.notaPar ?? ""}
                    onChange={(e) => setEst(idx, "notaPar", e.target.value)}
                    placeholder="—"
                    className="w-14 p-1 border border-gray-200 rounded text-xs text-center focus:ring-1 focus:ring-red-300 outline-none bg-white block mx-auto"
                  />
                </td>
                {/* Descuento No Evaluar */}
                <td className="py-1.5 px-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={est.factorCastigoNoEvaluo ?? ""}
                    onChange={(e) => setEst(idx, "factorCastigoNoEvaluo", e.target.value)}
                    placeholder="0"
                    className="w-14 p-1 border border-orange-200 rounded text-xs text-center focus:ring-1 focus:ring-orange-300 outline-none bg-white block mx-auto"
                  />
                </td>
                {/* Descuento Grupo Ajeno */}
                <td className="py-1.5 px-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={est.factorCastigoFueraGrupo ?? ""}
                    onChange={(e) => setEst(idx, "factorCastigoFueraGrupo", e.target.value)}
                    placeholder="0"
                    className="w-14 p-1 border border-red-200 rounded text-xs text-center focus:ring-1 focus:ring-red-300 outline-none bg-white block mx-auto"
                  />
                </td>
                {/* Nota final: calculada o heredada */}
                <td className="py-1.5 px-2 text-center">
                  {est.notaAjustada !== undefined ? (
                    <span className="text-xs font-bold text-white bg-[#ce0019] px-2 py-1 rounded">
                      {est.notaAjustada}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 italic">—</span>
                  )}
                </td>
                <td className="py-1.5 pl-1">
                  <BtnEliminar onClick={() => removeEst(idx)} title="Eliminar estudiante" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Añadir estudiante */}
      <button
        onClick={addEst}
        className="self-start flex items-center gap-1.5 text-xs text-[#ce0019] font-semibold hover:underline cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
        </svg>
        Añadir estudiante
      </button>

      {/* Acciones */}
      <div className="flex gap-2 pt-2 border-t border-red-200">
        <button
          onClick={() => onSave(draft)}
          className="px-4 py-1.5 bg-[#ce0019] text-white text-xs font-bold rounded hover:bg-[#a80014] transition cursor-pointer"
        >
          Guardar cambios
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 bg-white text-gray-600 text-xs font-semibold rounded border border-gray-300 hover:bg-gray-50 transition cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── App principal ─────────────────────────────────────────────────────────────

function App() {
  const { cursos, agregarCurso, actualizarCurso } = useAppStore();
  const [cursoActivo, setCursoActivo] = useState<Curso | null>(null);
  const [nombreCurso, setNombreCurso] = useState("");
  const [estadoCarga, setEstadoCarga] = useState("");
  const [notasBrutas, setNotasBrutas] = useState<
    Record<string, Record<string, string>>
  >({});
  const [config, setConfig] = useState<ConfigDescuentos>(DEFAULT_DESCUENTOS);
  const [gruposExpandidos, setGruposExpandidos] = useState<
    Record<string, Set<string>>
  >({});
  const [gruposEditando, setGruposEditando] = useState<
    Record<string, Set<string>>
  >({});

  // ── CRUD grupos ────────────────────────────────────────────────────────────

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

  const crearGrupoVacio = (cursoId: string) => {
    const cursoData = cursos.find((c) => c.id === cursoId)!;
    const grupo = nuevoGrupo(cursoData.grupos);
    const actualizado = { ...cursoData, grupos: [...cursoData.grupos, grupo] };
    actualizarCurso(actualizado);
    setCursoActivo(actualizado);
    setGruposEditando((prev) => {
      const set = new Set(prev[cursoId] ?? []);
      set.add(grupo.numero);
      return { ...prev, [cursoId]: set };
    });
    setGruposExpandidos((prev) => {
      const set = new Set(prev[cursoId] ?? []);
      set.add(grupo.numero);
      return { ...prev, [cursoId]: set };
    });
  };

  const eliminarGrupo = (cursoId: string, grupoNumero: string) => {
    if (!confirm(`¿Eliminar el Grupo ${grupoNumero}? Esta acción no se puede deshacer.`)) return;
    const cursoData = cursos.find((c) => c.id === cursoId)!;
    const actualizado = {
      ...cursoData,
      grupos: cursoData.grupos.filter((g) => g.numero !== grupoNumero),
    };
    actualizarCurso(actualizado);
    setCursoActivo(actualizado);
  };

  const guardarEdicionGrupo = (cursoId: string, grupoEditado: Grupo, grupoNumeroOriginal: string) => {
    const cursoData = cursos.find((c) => c.id === cursoId)!;
    const actualizado = {
      ...cursoData,
      grupos: cursoData.grupos.map((g) =>
        g.numero === grupoNumeroOriginal ? grupoEditado : g,
      ),
    };
    actualizarCurso(actualizado);
    setCursoActivo(actualizado);
    cerrarEdicion(cursoId, grupoNumeroOriginal);
  };

  // ── edición state helpers ──────────────────────────────────────────────────

  const abrirEdicion = (cursoId: string, grupoNumero: string) =>
    setGruposEditando((prev) => {
      const set = new Set(prev[cursoId] ?? []);
      set.add(grupoNumero);
      return { ...prev, [cursoId]: set };
    });

  const cerrarEdicion = (cursoId: string, grupoNumero: string) =>
    setGruposEditando((prev) => {
      const set = new Set(prev[cursoId] ?? []);
      set.delete(grupoNumero);
      return { ...prev, [cursoId]: set };
    });

  const estaEditando = (cursoId: string, grupoNumero: string) =>
    gruposEditando[cursoId]?.has(grupoNumero) ?? false;

  // ── notas brutas ──────────────────────────────────────────────────────────

  const aplicarNotasBrutas = () => {
    if (!cursoActivo) return;
    const cursoData = cursos.find((c) => c.id === cursoActivo.id) || cursoActivo;
    const notasCurso = notasBrutas[cursoData.id] ?? {};

    const gruposActualizados = cursoData.grupos.map((grupo) => {
      const valor = notasCurso[grupo.numero];
      const nota = valor !== undefined ? parseFloat(valor) : grupo.promedio_bruto;
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

  // ── expand/collapse ────────────────────────────────────────────────────────

  const toggleGrupo = (cursoId: string, grupoNumero: string) => {
    setGruposExpandidos((prev) => {
      const set = new Set(prev[cursoId] ?? []);
      if (set.has(grupoNumero)) set.delete(grupoNumero);
      else set.add(grupoNumero);
      return { ...prev, [cursoId]: set };
    });
  };

  const toggleTodos = (cursoId: string, grupos: Grupo[], expandir: boolean) => {
    setGruposExpandidos((prev) => ({
      ...prev,
      [cursoId]: expandir
        ? new Set(grupos.map((g) => g.numero))
        : new Set<string>(),
    }));
  };

  const estaExpandido = (cursoId: string, grupoNumero: string) =>
    gruposExpandidos[cursoId]?.has(grupoNumero) ?? false;

  const todosExpandidos = (cursoId: string, grupos: Grupo[]) =>
    grupos.every((g) => gruposExpandidos[cursoId]?.has(g.numero));

  // ── duplicados ─────────────────────────────────────────────────────────────

  const estudiantesDuplicados = (() => {
    if (!cursoActivo) return new Set<string>();
    const cursoData = cursos.find((c) => c.id === cursoActivo.id) || cursoActivo;
    const conteo: Record<string, number> = {};
    cursoData.grupos.forEach((g) =>
      g.estudiantes.forEach((e) => {
        conteo[e.identificacion] = (conteo[e.identificacion] || 0) + 1;
      }),
    );
    return new Set(
      Object.entries(conteo).filter(([, v]) => v > 1).map(([k]) => k),
    );
  })();

  // ── vista de curso activo ──────────────────────────────────────────────────

  if (cursoActivo) {
    const cursoData = cursos.find((c) => c.id === cursoActivo.id) || cursoActivo;
    const notasCurso = notasBrutas[cursoData.id] ?? {};
    const setNotaCurso = (grupoNumero: string, valor: string) =>
      setNotasBrutas((prev) => ({
        ...prev,
        [cursoData.id]: { ...(prev[cursoData.id] ?? {}), [grupoNumero]: valor },
      }));
    const allExpanded = todosExpandidos(cursoData.id, cursoData.grupos);

    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="w-full">
          {/* Top bar */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setCursoActivo(null)}
              className="text-[#ce0019] font-medium hover:underline flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
              </svg>
              Volver a Cursos
            </button>
            <span className="text-gray-300">|</span>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-widest">DIO</span>
          </div>

          {/* Header */}
          <div className="flex justify-between items-center bg-gradient-to-r from-[#ce0019] to-[#ff4d4d] p-6 rounded-xl shadow mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white">{cursoData.nombre}</h1>
              <p className="text-red-100 mt-1">{cursoData.grupos.length} grupos</p>
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
              className="px-5 py-3 bg-white text-[#ce0019] font-semibold rounded shadow hover:bg-red-50 transition cursor-pointer border border-white"
            >
              Exportar a Excel
            </button>
          </div>

          {/* Alerta duplicados */}
          {estudiantesDuplicados.size > 0 && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 mb-6 flex gap-3 items-start">
              <span className="text-yellow-500 text-xl">⚠️</span>
              <div>
                <p className="font-bold text-yellow-800">Estudiantes registrados en más de un grupo</p>
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
            <h2 className="text-lg font-bold text-[#ce0019] mb-1">Configuración de castigos</h2>
            <p className="text-xs text-gray-400 mb-4">
              Fracción máxima de reducción sobre la proporción del estudiante (0 a 1). Ej: 0.1 = hasta 10% menos.
            </p>
            <div className="flex gap-8 flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-red-500 uppercase">Máx. castigo por evaluar fuera del grupo</label>
                <input
                  type="number" step="0.01" min="0" max="1"
                  value={config.maxCastigoFueraGrupo}
                  onChange={(e) => setConfig((prev) => ({ ...prev, maxCastigoFueraGrupo: parseFloat(e.target.value) || 0 }))}
                  className="p-2 border border-gray-300 rounded text-sm w-28 focus:ring-2 focus:ring-red-300 outline-none"
                />
                <span className="text-[10px] text-gray-400">× cada evaluación inválida</span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-orange-500 uppercase">Máx. castigo por no evaluar compañeros</label>
                <input
                  type="number" step="0.01" min="0" max="1"
                  value={config.maxCastigoNoEvaluo}
                  onChange={(e) => setConfig((prev) => ({ ...prev, maxCastigoNoEvaluo: parseFloat(e.target.value) || 0 }))}
                  className="p-2 border border-gray-300 rounded text-sm w-28 focus:ring-2 focus:ring-orange-300 outline-none"
                />
                <span className="text-[10px] text-gray-400">× (no evaluados / compañeros totales)</span>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => toggleTodos(cursoData.id, cursoData.grupos, !allExpanded)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-600 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 transition text-sm shadow-sm cursor-pointer"
              >
                {allExpanded ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M3.75 7.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" /></svg>
                )}
                {allExpanded ? "Colapsar todos" : "Expandir todos"}
              </button>
              <button
                onClick={() => crearGrupoVacio(cursoData.id)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#ce0019] text-[#ce0019] font-medium rounded-lg hover:bg-red-50 transition text-sm shadow-sm cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" /></svg>
                Nuevo grupo
              </button>
            </div>
            <button
              onClick={aplicarNotasBrutas}
              className="px-5 py-2 bg-[#ce0019] text-white font-semibold rounded-lg hover:bg-[#a80014] transition cursor-pointer text-sm shadow"
            >
              Calcular notas finales
            </button>
          </div>

          {/* Grilla de grupos — 2 columnas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {cursoData.grupos.map((grupo) => {
              const expandido = estaExpandido(cursoData.id, grupo.numero);
              const editando = estaEditando(cursoData.id, grupo.numero);

              return (
                <div
                  key={grupo.numero}
                  className="bg-white rounded-xl shadow border border-gray-100 flex flex-col overflow-hidden"
                >
                  {/* Encabezado grupo */}
                  <div
                    className={`flex items-center gap-3 px-5 py-4 border-b border-gray-100 select-none transition-colors ${
                      editando ? "bg-red-50" : "cursor-pointer hover:bg-red-50"
                    }`}
                    onClick={() => !editando && toggleGrupo(cursoData.id, grupo.numero)}
                  >
                    {!editando && (
                      <span
                        className={`text-[#ce0019] text-sm font-bold transition-transform duration-200 ${expandido ? "rotate-90" : "rotate-0"}`}
                        style={{ display: "inline-block" }}
                      >
                        ▶
                      </span>
                    )}
                    <h4 className="font-bold text-lg text-[#ce0019] flex-1">
                      Grupo {grupo.numero}
                    </h4>

                    {/* Nota bruta (solo si no está editando) */}
                    {!editando && (
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">
                          Nota bruta
                        </label>
                        <input
                          type="number" step="0.1" min="1" max="7"
                          value={notasCurso[grupo.numero] ?? grupo.promedio_bruto ?? ""}
                          onChange={(e) => setNotaCurso(grupo.numero, e.target.value)}
                          className="w-16 p-1.5 border border-gray-200 rounded text-sm text-center focus:ring-2 focus:ring-red-300 outline-none bg-gray-50 font-semibold text-gray-700"
                        />
                      </div>
                    )}

                    {/* Botones Editar / Eliminar */}
                    <div
                      className="flex items-center gap-1.5 ml-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!editando && (
                        <button
                          onClick={() => {
                            abrirEdicion(cursoData.id, grupo.numero);
                            setGruposExpandidos((prev) => {
                              const set = new Set(prev[cursoData.id] ?? []);
                              set.add(grupo.numero);
                              return { ...prev, [cursoData.id]: set };
                            });
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474ZM4.75 14a2.25 2.25 0 0 1-2.25-2.25V5.5A2.25 2.25 0 0 1 4.75 3.25H7a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 0-.75.75v6.25c0 .414.336.75.75.75H11a.75.75 0 0 0 .75-.75V9a.75.75 0 0 1 1.5 0v2.75A2.25 2.25 0 0 1 11 14H4.75Z" />
                          </svg>
                          Editar
                        </button>
                      )}
                      <BtnEliminar onClick={() => eliminarGrupo(cursoData.id, grupo.numero)} title="Eliminar grupo" />
                    </div>
                  </div>

                  {/* Panel de edición */}
                  {editando && (
                    <EditGrupo
                      grupo={grupo}
                      onSave={(g) => guardarEdicionGrupo(cursoData.id, g, grupo.numero)}
                      onCancel={() => cerrarEdicion(cursoData.id, grupo.numero)}
                    />
                  )}

                  {/* Tabla de vista (solo si NO está editando) */}
                  {!editando && expandido && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="text-[10px] uppercase font-semibold text-gray-400 border-b border-gray-100 bg-gray-50">
                            <th className="text-left px-5 py-2">Alumno</th>
                            <th className="text-center px-3 py-2 whitespace-nowrap">Nota<br/>Bruta</th>
                            <th className="text-center px-3 py-2 whitespace-nowrap text-green-600">Ev.<br/>Par</th>
                            <th className="text-center px-3 py-2 whitespace-nowrap text-orange-500">Desc.<br/>No Evaluó</th>
                            <th className="text-center px-3 py-2 whitespace-nowrap text-red-500">Desc.<br/>Grupo Ajeno</th>
                            <th className="text-center px-3 py-2 whitespace-nowrap text-[#ce0019]">Nota<br/>Final</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grupo.estudiantes.map((est, idx) => (
                            <tr
                              key={idx}
                              className={`border-b border-gray-50 last:border-0 ${
                                estudiantesDuplicados.has(est.identificacion)
                                  ? "bg-yellow-50"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <td className="px-5 py-2.5">
                                <span className="font-medium text-gray-700 text-sm" title={est.identificacion}>
                                  {est.identificacion}
                                  {estudiantesDuplicados.has(est.identificacion) && (
                                    <span className="ml-1 text-yellow-600 text-[10px] font-bold">⚠</span>
                                  )}
                                </span>
                              </td>
                              {/* Nota bruta */}
                              <td className="px-3 py-2.5 text-center">
                                <span className="font-semibold text-gray-600 text-xs bg-gray-100 px-2 py-0.5 rounded">
                                  {grupo.promedio_bruto ?? "—"}
                                </span>
                              </td>
                              {/* Nota par */}
                              <td className="px-3 py-2.5 text-center">
                                {est.notaPar !== undefined ? (
                                  <span className="font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 text-xs">
                                    {est.notaPar}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </td>
                              {/* Desc. No Evaluar */}
                              <td className="px-3 py-2.5 text-center">
                                {est.factorCastigoNoEvaluo !== undefined ? (
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                    est.factorCastigoNoEvaluo > 0
                                      ? "text-orange-700 bg-orange-50 border border-orange-100"
                                      : "text-gray-300"
                                  }`}>
                                    {est.factorCastigoNoEvaluo > 0
                                      ? `-${(est.factorCastigoNoEvaluo * 100).toFixed(0)}%`
                                      : "0%"}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </td>
                              {/* Desc. Grupo Ajeno */}
                              <td className="px-3 py-2.5 text-center">
                                {est.factorCastigoFueraGrupo !== undefined ? (
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                    est.factorCastigoFueraGrupo > 0
                                      ? "text-red-700 bg-red-50 border border-red-100"
                                      : "text-gray-300"
                                  }`}>
                                    {est.factorCastigoFueraGrupo > 0
                                      ? `-${(est.factorCastigoFueraGrupo * 100).toFixed(0)}%`
                                      : "0%"}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </td>
                              {/* Nota Final */}
                              <td className="px-3 py-2.5 text-center">
                                {est.notaAjustada !== undefined ? (
                                  <span className="font-bold text-white bg-[#ce0019] px-2.5 py-0.5 rounded text-xs shadow-sm">
                                    {est.notaAjustada}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── vista principal (lista de cursos) ──────────────────────────────────────

  return (
    <div className="flex h-screen bg-gray-100 text-gray-800 font-sans">
      {/* Sidebar */}
      <div className="w-1/3 bg-gradient-to-b from-[#ce0019] to-[#a80014] p-8 shadow-lg flex flex-col gap-6 border-r border-red-900 z-10 text-white">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-16 h-8 rounded-full bg-white flex items-center justify-center shadow">
              <span className="text-[#ce0019] font-extrabold text-xs leading-none">UANDES</span>
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow">DIO</h1>
          <p className="text-sm text-red-200 font-medium">Plataforma de Evaluación Par</p>
        </div>

        <div className="flex flex-col gap-4 mt-4">
          <h2 className="text-xl font-semibold border-b border-red-300 pb-2 text-white">Nuevo Curso</h2>
          <input
            type="text"
            value={nombreCurso}
            onChange={(e) => setNombreCurso(e.target.value)}
            placeholder="Ej: Neuromecánica..."
            className="p-2 border border-red-300 rounded bg-white/10 text-white placeholder-red-200 focus:ring-2 focus:ring-white outline-none"
          />
          <button
            onClick={crearCurso}
            className="mt-2 px-4 py-3 bg-white text-[#ce0019] font-bold rounded hover:bg-red-50 transition cursor-pointer shadow"
          >
            Subir Excel de Evaluación Par
          </button>
          {estadoCarga && (
            <p className="text-sm text-center text-red-200 mt-2">{estadoCarga}</p>
          )}
        </div>

        <div className="mt-auto pt-6 border-t border-red-400">
          <p className="text-[10px] text-red-200 text-center leading-relaxed">
            <span className="font-semibold text-white">Universidad de los Andes</span>
          </p>
        </div>
      </div>

      {/* Main */}
      <div className="w-2/3 p-8 bg-gray-50 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-[#ce0019]">Cursos Creados</h2>
        <div className="grid grid-cols-1 gap-4">
          {cursos.map((curso) => (
            <div
              key={curso.id}
              onClick={() => setCursoActivo(curso)}
              className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-[#ce0019] transition cursor-pointer flex justify-between items-center group"
            >
              <h3 className="text-xl font-bold text-gray-800 group-hover:text-[#ce0019]">{curso.nombre}</h3>
              <span className="text-sm bg-red-50 text-[#ce0019] py-1 px-3 rounded-full border border-red-200">
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