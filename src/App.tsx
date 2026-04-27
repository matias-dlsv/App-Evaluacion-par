// src/App.tsx
import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
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
import {
  exportarResultados,
  exportarCSVGrupo,
  exportarTodosCSVGrupos,
  exportarAutoevaluaciones,
} from "./utils/exportarExcel";

interface NotaExtraida {
  identificacion: string;
  nota_promedio: number | null;
  cantidad_evaluaciones: number;
  notas_individuales: number[];
  nombres_evaluados: string[];
  grupo: string;
  evaluaciones_invalidas: number;
}

interface AutoEvaluacion {
  identificacion: string;
  grupo: string;
  nota_auto: number | null;
}

interface AppState {
  cursos: Curso[];
  agregarCurso: (curso: Curso) => void;
  actualizarCurso: (cursoActualizado: Curso) => void;
  eliminarCurso: (id: string) => void;
  setCursos: (cursos: Curso[]) => void;
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
  eliminarCurso: (id) =>
    set((state) => ({
      cursos: state.cursos.filter((c) => c.id !== id),
    })),
  setCursos: (cursos) => set({ cursos }),
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

function BtnEliminar({
  onClick,
  title = "Eliminar",
}: {
  onClick: () => void;
  title?: string;
}) {
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
      const numFields = [
        "notaPar",
        "evaluaciones",
        "factorCastigoFueraGrupo",
        "factorCastigoNoEvaluo",
      ];
      const esDescuento =
        field === "factorCastigoFueraGrupo" ||
        field === "factorCastigoNoEvaluo";
      ests[idx] = {
        ...ests[idx],
        [field]: numFields.includes(field as string)
          ? val === ""
            ? undefined
            : parseFloat(val)
          : val,
        ...(esDescuento && { descuentoManual: true }),
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

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-gray-500 uppercase text-[10px] border-b-2 border-gray-200 bg-white">
              <th className="text-left py-2 pr-3 font-semibold">Alumno</th>
              <th className="text-center py-2 px-2 font-semibold whitespace-nowrap">
                Nota Bruta
              </th>
              <th className="text-center py-2 px-2 font-semibold whitespace-nowrap">
                Ev. Par
              </th>
              <th className="text-center py-2 px-2 font-semibold whitespace-nowrap text-purple-600">
                Auto
                <br />
                Eval.
              </th>
              <th className="text-center py-2 px-2 font-semibold whitespace-nowrap text-orange-600">
                Desc.
                <br />
                No Evaluó
              </th>
              <th className="text-center py-2 px-2 font-semibold whitespace-nowrap text-red-600">
                Desc.
                <br />
                Grupo Ajeno
              </th>
              <th className="text-center py-2 px-2 font-semibold whitespace-nowrap text-[#ce0019]">
                Nota Final
              </th>
              <th className="py-2 w-6" />
            </tr>
          </thead>
          <tbody>
            {draft.estudiantes.map((est, idx) => (
              <tr
                key={idx}
                className="border-b border-gray-100 last:border-0 hover:bg-white/60"
              >
                <td className="py-1.5 pr-3">
                  <input
                    value={est.identificacion}
                    onChange={(e) =>
                      setEst(idx, "identificacion", e.target.value)
                    }
                    placeholder="Nombre o ID"
                    className="w-full p-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-red-300 outline-none bg-white min-w-[120px]"
                  />
                </td>
                <td className="py-1.5 px-2 text-center">
                  <span className="text-xs text-gray-500 font-semibold bg-gray-100 px-2 py-1 rounded">
                    {draft.promedio_bruto ?? "—"}
                  </span>
                </td>
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
                <td className="py-1.5 px-2 text-center">
                  {est.notaAuto !== undefined ? (
                    <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded border border-purple-100">
                      {est.notaAuto}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="py-1.5 px-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={est.factorCastigoNoEvaluo ?? ""}
                      onChange={(e) =>
                        setEst(idx, "factorCastigoNoEvaluo", e.target.value)
                      }
                      placeholder="0"
                      className="w-14 p-1 border border-orange-200 rounded text-xs text-center focus:ring-1 focus:ring-orange-300 outline-none bg-white block mx-auto"
                    />
                    {est.descuentoManual && (
                      <button
                        onClick={() =>
                          setDraft((p) => {
                            const ests = [...p.estudiantes];
                            ests[idx] = {
                              ...ests[idx],
                              descuentoManual: false,
                              factorCastigoNoEvaluo: undefined,
                            };
                            return { ...p, estudiantes: ests };
                          })
                        }
                        className="text-[9px] text-orange-400 hover:text-orange-600 underline cursor-pointer leading-none"
                        title="Volver al cálculo automático"
                      >
                        manual · resetear
                      </button>
                    )}
                  </div>
                </td>
                <td className="py-1.5 px-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={est.factorCastigoFueraGrupo ?? ""}
                      onChange={(e) =>
                        setEst(idx, "factorCastigoFueraGrupo", e.target.value)
                      }
                      placeholder="0"
                      className="w-14 p-1 border border-red-200 rounded text-xs text-center focus:ring-1 focus:ring-red-300 outline-none bg-white block mx-auto"
                    />
                    {est.descuentoManual && (
                      <button
                        onClick={() =>
                          setDraft((p) => {
                            const ests = [...p.estudiantes];
                            ests[idx] = {
                              ...ests[idx],
                              descuentoManual: false,
                              factorCastigoFueraGrupo: undefined,
                            };
                            return { ...p, estudiantes: ests };
                          })
                        }
                        className="text-[9px] text-red-400 hover:text-red-600 underline cursor-pointer leading-none"
                        title="Volver al cálculo automático"
                      >
                        manual · resetear
                      </button>
                    )}
                  </div>
                </td>
                <td className="py-1.5 px-2 text-center">
                  {est.notaConDescuento !== undefined ? (
                    <span className="text-xs font-bold text-white bg-[#ce0019] px-2 py-1 rounded">
                      {est.notaConDescuento}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 italic">—</span>
                  )}
                </td>
                <td className="py-1.5 pl-1">
                  <BtnEliminar
                    onClick={() => removeEst(idx)}
                    title="Eliminar estudiante"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addEst}
        className="self-start flex items-center gap-1.5 text-xs text-[#ce0019] font-semibold hover:underline cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="w-3.5 h-3.5"
        >
          <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
        </svg>
        Añadir estudiante
      </button>

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
  const { cursos, agregarCurso, actualizarCurso, eliminarCurso, setCursos } =
    useAppStore();
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
  const [busqueda, setBusqueda] = useState("");
  const [menuExportAbierto, setMenuExportAbierto] = useState(false);
  const storeRef = useRef<Awaited<ReturnType<typeof load>> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const store = await load("cursos.json", { defaults: { cursos: [] } });
        storeRef.current = store;
        const guardados = await store.get<Curso[]>("cursos");
        if (guardados && guardados.length > 0) {
          setCursos(guardados);
        }
      } catch (e) {
        console.error("Error cargando store:", e);
      }
    })();
  }, []);

  const guardarEnStore = (lista: Curso[]) => {
    storeRef.current?.set("cursos", lista);
  };

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
      const autoevaluaciones: AutoEvaluacion[] = await invoke(
        "obtener_autoevaluaciones",
        { ruta: file },
      );

      // Mapa rápido de autoevaluaciones por identificación
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
              notaAuto !== null && notaAuto !== undefined
                ? notaAuto
                : undefined,
          };
        }),
      }));

      const nuevoCurso: Curso = {
        id: crypto.randomUUID(),
        nombre: nombreCurso,
        grupos: gruposConNotas,
      };

      agregarCurso(nuevoCurso);
      guardarEnStore([...cursos, nuevoCurso]);
      setNombreCurso("");
      setEstadoCarga("");
    } catch (error) {
      setEstadoCarga(`Error: ${error}`);
    }
  };

  const handleEliminarCurso = (e: React.MouseEvent, cursoId: string) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar este curso? Esta acción no se puede deshacer."))
      return;
    const restantes = cursos.filter((c) => c.id !== cursoId);
    eliminarCurso(cursoId);
    guardarEnStore(restantes);
    if (cursoActivo?.id === cursoId) setCursoActivo(null);
  };

  const crearGrupoVacio = (cursoId: string) => {
    const cursoData = cursos.find((c) => c.id === cursoId)!;
    const grupo = nuevoGrupo(cursoData.grupos);
    const actualizado = { ...cursoData, grupos: [...cursoData.grupos, grupo] };
    actualizarCurso(actualizado);
    guardarEnStore(cursos.map((c) => (c.id === cursoId ? actualizado : c)));
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
    if (
      !confirm(
        `¿Eliminar el Grupo ${grupoNumero}? Esta acción no se puede deshacer.`,
      )
    )
      return;
    const cursoData = cursos.find((c) => c.id === cursoId)!;
    const actualizado = {
      ...cursoData,
      grupos: cursoData.grupos.filter((g) => g.numero !== grupoNumero),
    };
    actualizarCurso(actualizado);
    guardarEnStore(cursos.map((c) => (c.id === cursoId ? actualizado : c)));
    setCursoActivo(actualizado);
  };

  const guardarEdicionGrupo = (
    cursoId: string,
    grupoEditado: Grupo,
    grupoNumeroOriginal: string,
  ) => {
    const cursoData = cursos.find((c) => c.id === cursoId)!;
    const actualizado = {
      ...cursoData,
      grupos: cursoData.grupos.map((g) =>
        g.numero === grupoNumeroOriginal ? grupoEditado : g,
      ),
    };
    actualizarCurso(actualizado);
    guardarEnStore(cursos.map((c) => (c.id === cursoId ? actualizado : c)));
    setCursoActivo(actualizado);
    cerrarEdicion(cursoId, grupoNumeroOriginal);
  };

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

  const aplicarNotasBrutas = () => {
    if (!cursoActivo) return;
    const cursoData =
      cursos.find((c) => c.id === cursoActivo.id) || cursoActivo;
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
    guardarEnStore(
      cursos.map((c) => (c.id === cursoFinal.id ? cursoFinal : c)),
    );
    setCursoActivo(cursoFinal);
  };

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

  // ─── Vista de curso activo ───────────────────────────────────────────────────

  if (cursoActivo) {
    const cursoData =
      cursos.find((c) => c.id === cursoActivo.id) || cursoActivo;
    const notasCurso = notasBrutas[cursoData.id] ?? {};
    const setNotaCurso = (grupoNumero: string, valor: string) =>
      setNotasBrutas((prev) => ({
        ...prev,
        [cursoData.id]: { ...(prev[cursoData.id] ?? {}), [grupoNumero]: valor },
      }));
    const allExpanded = todosExpandidos(cursoData.id, cursoData.grupos);

    const gruposFiltrados =
      busqueda.trim() === ""
        ? cursoData.grupos
        : cursoData.grupos.filter((grupo) =>
            grupo.estudiantes.some((est) =>
              est.identificacion.toLowerCase().includes(busqueda.toLowerCase()),
            ),
          );

    // ¿Hay al menos un estudiante con autoevaluación en este curso?
    const tieneAutoevaluaciones = cursoData.grupos.some((g) =>
      g.estudiantes.some((e) => e.notaAuto !== undefined),
    );

    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="w-full">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setCursoActivo(null)}
              className="text-[#ce0019] font-medium hover:underline flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path
                  fillRule="evenodd"
                  d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z"
                  clipRule="evenodd"
                />
              </svg>
              Volver a Cursos
            </button>
            <span className="text-gray-300">|</span>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-widest">
              DIO
            </span>
          </div>

          {/* Header del curso */}
          <div className="flex justify-between items-center bg-gradient-to-r from-[#ce0019] to-[#ff4d4d] p-6 rounded-xl shadow mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white">
                {cursoData.nombre}
              </h1>
              <p className="text-red-100 mt-1">
                {cursoData.grupos.length} grupos
              </p>
            </div>

            {/* Menú exportar */}
            <div className="relative">
              <button
                onClick={() => setMenuExportAbierto((v) => !v)}
                className="px-5 py-3 bg-white text-[#ce0019] font-semibold rounded shadow hover:bg-red-50 transition cursor-pointer border border-white flex items-center gap-2"
              >
                Exportar
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {menuExportAbierto && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuExportAbierto(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden">
                    {/* Excel completo */}
                    <button
                      onClick={async () => {
                        setMenuExportAbierto(false);
                        try {
                          await exportarResultados(cursoData);
                          alert("¡Excel exportado con éxito!");
                        } catch (e) {
                          alert("Error al exportar: " + String(e));
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="w-4 h-4 text-green-600 shrink-0"
                      >
                        <path d="M2 2.75A2.75 2.75 0 0 1 4.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237V13.25A2.75 2.75 0 0 1 12.25 16H4.75A2.75 2.75 0 0 1 2 13.25V2.75Z" />
                      </svg>
                      <div>
                        <p className="font-semibold">Excel completo</p>
                        <p className="text-[11px] text-gray-400">
                          Todos los grupos
                        </p>
                      </div>
                    </button>

                    <div className="border-t border-gray-100" />

                    {/* CSV todos los grupos en carpeta */}
                    <button
                      onClick={async () => {
                        setMenuExportAbierto(false);
                        try {
                          const ok = await exportarTodosCSVGrupos(cursoData);
                          if (ok)
                            alert(
                              "¡CSV de todos los grupos exportados con éxito!",
                            );
                        } catch (e) {
                          alert("Error al exportar: " + String(e));
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="w-4 h-4 text-blue-500 shrink-0"
                      >
                        <path d="M2 2.75A2.75 2.75 0 0 1 4.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237V13.25A2.75 2.75 0 0 1 12.25 16H4.75A2.75 2.75 0 0 1 2 13.25V2.75Z" />
                      </svg>
                      <div>
                        <p className="font-semibold">CSV todos los grupos</p>
                        <p className="text-[11px] text-gray-400">
                          Un archivo por grupo en una carpeta
                        </p>
                      </div>
                    </button>

                    {/* Autoevaluaciones — solo si hay datos */}
                    {tieneAutoevaluaciones && (
                      <>
                        <div className="border-t border-gray-100" />
                        <button
                          onClick={async () => {
                            setMenuExportAbierto(false);
                            try {
                              const ok =
                                await exportarAutoevaluaciones(cursoData);
                              if (ok)
                                alert(
                                  "¡Autoevaluaciones exportadas con éxito!",
                                );
                            } catch (e) {
                              alert("Error al exportar: " + String(e));
                            }
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className="w-4 h-4 text-purple-500 shrink-0"
                          >
                            <path
                              fillRule="evenodd"
                              d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0Zm-5-2a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 9c-1.825 0-3.422.977-4.295 2.437A5.49 5.49 0 0 0 8 13.5a5.49 5.49 0 0 0 4.294-2.063A4.997 4.997 0 0 0 8 9Z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <div>
                            <p className="font-semibold">
                              CSV autoevaluaciones
                            </p>
                            <p className="text-[11px] text-gray-400">
                              Auto vs nota par por alumno
                            </p>
                          </div>
                        </button>
                      </>
                    )}

                    <div className="border-t border-gray-100" />
                    <div className="px-4 py-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        CSV por grupo
                      </p>
                    </div>

                    <div className="max-h-60 overflow-y-auto">
                      {cursoData.grupos.map((grupo) => (
                        <button
                          key={grupo.numero}
                          onClick={async () => {
                            setMenuExportAbierto(false);
                            try {
                              await exportarCSVGrupo(cursoData, grupo.numero);
                            } catch (e) {
                              alert("Error al exportar: " + String(e));
                            }
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className="w-4 h-4 text-blue-500 shrink-0"
                          >
                            <path
                              fillRule="evenodd"
                              d="M2 2.75A2.75 2.75 0 0 1 4.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237V13.25A2.75 2.75 0 0 1 12.25 16H4.75A2.75 2.75 0 0 1 2 13.25V2.75Zm7.25 1.5v-1l3.5 3.5h-1a2.5 2.5 0 0 1-2.5-2.5Z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Grupo {grupo.numero}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

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

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
            <h2 className="text-lg font-bold text-[#ce0019] mb-1">
              Configuración de castigos
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Fracción máxima de reducción sobre la proporción del estudiante (0
              a 1). Ej: 0.1 = hasta 10% menos.
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

          {/* Barra de controles + searchbar */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    toggleTodos(cursoData.id, cursoData.grupos, !allExpanded)
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-600 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 transition text-sm shadow-sm cursor-pointer"
                >
                  {allExpanded ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path d="M3.75 7.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
                    </svg>
                  )}
                  {allExpanded ? "Colapsar todos" : "Expandir todos"}
                </button>
                <button
                  onClick={() => crearGrupoVacio(cursoData.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-[#ce0019] text-[#ce0019] font-medium rounded-lg hover:bg-red-50 transition text-sm shadow-sm cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
                  </svg>
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

            {/* Searchbar */}
            <div className="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              >
                <path
                  fillRule="evenodd"
                  d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por integrante..."
                className="w-full pl-9 pr-10 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-red-300 focus:border-red-300 outline-none shadow-sm"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                </button>
              )}
            </div>
            {busqueda && (
              <p className="text-xs text-gray-400">
                {gruposFiltrados.length === 0
                  ? "Sin resultados"
                  : `${gruposFiltrados.length} grupo${gruposFiltrados.length !== 1 ? "s" : ""} con "${busqueda}"`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {gruposFiltrados.map((grupo) => {
              const expandido = estaExpandido(cursoData.id, grupo.numero);
              const editando = estaEditando(cursoData.id, grupo.numero);

              return (
                <div
                  key={grupo.numero}
                  className="bg-white rounded-xl shadow border border-gray-100 flex flex-col overflow-hidden"
                >
                  <div
                    className={`flex items-center gap-3 px-5 py-4 border-b border-gray-100 select-none transition-colors ${editando ? "bg-red-50" : "cursor-pointer hover:bg-red-50"}`}
                    onClick={() =>
                      !editando && toggleGrupo(cursoData.id, grupo.numero)
                    }
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

                    {!editando && (
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">
                          Nota bruta
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="7"
                          value={
                            notasCurso[grupo.numero] ??
                            grupo.promedio_bruto ??
                            ""
                          }
                          onChange={(e) =>
                            setNotaCurso(grupo.numero, e.target.value)
                          }
                          className="w-16 p-1.5 border border-gray-200 rounded text-sm text-center focus:ring-2 focus:ring-red-300 outline-none bg-gray-50 font-semibold text-gray-700"
                        />
                      </div>
                    )}

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
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className="w-3 h-3"
                          >
                            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474ZM4.75 14a2.25 2.25 0 0 1-2.25-2.25V5.5A2.25 2.25 0 0 1 4.75 3.25H7a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 0-.75.75v6.25c0 .414.336.75.75.75H11a.75.75 0 0 0 .75-.75V9a.75.75 0 0 1 1.5 0v2.75A2.25 2.25 0 0 1 11 14H4.75Z" />
                          </svg>
                          Editar
                        </button>
                      )}
                      <BtnEliminar
                        onClick={() =>
                          eliminarGrupo(cursoData.id, grupo.numero)
                        }
                        title="Eliminar grupo"
                      />
                    </div>
                  </div>

                  {editando && (
                    <EditGrupo
                      grupo={grupo}
                      onSave={(g) =>
                        guardarEdicionGrupo(cursoData.id, g, grupo.numero)
                      }
                      onCancel={() => cerrarEdicion(cursoData.id, grupo.numero)}
                    />
                  )}

                  {!editando && expandido && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="text-[10px] uppercase font-semibold text-gray-400 border-b border-gray-100 bg-gray-50">
                            <th className="text-left px-5 py-2">Alumno</th>
                            <th className="text-center px-3 py-2 whitespace-nowrap">
                              Nota
                              <br />
                              Bruta
                            </th>
                            <th className="text-center px-3 py-2 whitespace-nowrap text-green-600">
                              Ev.
                              <br />
                              Par
                            </th>
                            <th className="text-center px-3 py-2 whitespace-nowrap text-purple-500">
                              Auto
                              <br />
                              Eval.
                            </th>
                            <th className="text-center px-3 py-2 whitespace-nowrap text-orange-500">
                              Desc.
                              <br />
                              No Evaluó
                            </th>
                            <th className="text-center px-3 py-2 whitespace-nowrap text-red-500">
                              Desc.
                              <br />
                              Grupo Ajeno
                            </th>
                            <th className="text-center px-3 py-2 whitespace-nowrap text-[#ce0019]">
                              Nota
                              <br />
                              Final
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {grupo.estudiantes.map((est, idx) => (
                            <tr
                              key={idx}
                              className={`border-b border-gray-50 last:border-0 ${estudiantesDuplicados.has(est.identificacion) ? "bg-yellow-50" : "hover:bg-gray-50"}`}
                            >
                              <td className="px-5 py-2.5">
                                <span
                                  className="font-medium text-gray-700 text-sm"
                                  title={est.identificacion}
                                >
                                  {est.identificacion}
                                  {estudiantesDuplicados.has(
                                    est.identificacion,
                                  ) && (
                                    <span className="ml-1 text-yellow-600 text-[10px] font-bold">
                                      ⚠
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className="font-semibold text-gray-600 text-xs bg-gray-100 px-2 py-0.5 rounded">
                                  {grupo.promedio_bruto ?? "—"}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {est.notaPar !== undefined ? (
                                  <span className="font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 text-xs">
                                    {est.notaPar}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {est.notaAuto !== undefined ? (
                                  <span className="font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 text-xs">
                                    {est.notaAuto}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {est.factorCastigoNoEvaluo !== undefined ? (
                                  <span
                                    className={`text-xs font-semibold px-2 py-0.5 rounded ${est.factorCastigoNoEvaluo > 0 ? "text-orange-700 bg-orange-50 border border-orange-100" : "text-gray-300"}`}
                                  >
                                    {est.factorCastigoNoEvaluo > 0
                                      ? `-${(est.factorCastigoNoEvaluo * 100).toFixed(0)}%`
                                      : "0%"}
                                    {est.descuentoManual && (
                                      <span className="ml-1 text-[9px] opacity-60">
                                        ✎
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {est.factorCastigoFueraGrupo !== undefined ? (
                                  <span
                                    className={`text-xs font-semibold px-2 py-0.5 rounded ${est.factorCastigoFueraGrupo > 0 ? "text-red-700 bg-red-50 border border-red-100" : "text-gray-300"}`}
                                  >
                                    {est.factorCastigoFueraGrupo > 0
                                      ? `-${(est.factorCastigoFueraGrupo * 100).toFixed(0)}%`
                                      : "0%"}
                                    {est.descuentoManual && (
                                      <span className="ml-1 text-[9px] opacity-60">
                                        ✎
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {est.notaConDescuento !== undefined ? (
                                  <span className="font-bold text-white bg-[#ce0019] px-2.5 py-0.5 rounded text-xs shadow-sm">
                                    {est.notaConDescuento}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs">
                                    —
                                  </span>
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

  // ─── Vista principal (lista de cursos) ───────────────────────────────────────

  return (
    <div className="flex h-screen bg-gray-100 text-gray-800 font-sans">
      <div className="w-1/3 bg-[#ce0019] p-8 shadow-lg flex flex-col gap-6 border-r border-red-900 z-10 text-white">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-16 h-8 rounded-full bg-white flex items-center justify-center shadow">
              <span className="text-[#ce0019] font-extrabold text-xs leading-none">
                UANDES
              </span>
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow">
            DIO
          </h1>
          <p className="text-sm text-red-200 font-medium">
            Plataforma de Evaluación Par
          </p>
        </div>

        <div className="flex flex-col gap-4 mt-4">
          <h2 className="text-xl font-semibold border-b border-red-300 pb-2 text-white">
            Nuevo Curso
          </h2>
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
            <p className="text-sm text-center text-red-200 mt-2">
              {estadoCarga}
            </p>
          )}
        </div>

        <div className="mt-auto pt-6 border-t border-red-400">
          <p className="text-[10px] text-red-200 text-center leading-relaxed">
            <span className="font-semibold text-white">
              Universidad de los Andes
            </span>
          </p>
        </div>
      </div>

      <div className="w-2/3 p-8 bg-gray-50 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-[#ce0019]">
          Cursos Creados
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {cursos.map((curso) => (
            <div
              key={curso.id}
              onClick={() => setCursoActivo(curso)}
              className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-[#ce0019] transition cursor-pointer flex justify-between items-center group"
            >
              <h3 className="text-xl font-bold text-gray-800 group-hover:text-[#ce0019]">
                {curso.nombre}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm bg-red-50 text-[#ce0019] py-1 px-3 rounded-full border border-red-200">
                  {curso.grupos.length} grupos →
                </span>
                <button
                  onClick={(e) => handleEliminarCurso(e, curso.id)}
                  title="Eliminar curso"
                  className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-red-100 text-gray-300 hover:text-red-500 transition cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
