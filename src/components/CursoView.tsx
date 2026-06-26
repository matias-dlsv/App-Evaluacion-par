// src/components/CursoView.tsx
import { useState, useEffect, useRef } from "react";
import { open, confirm } from "@tauri-apps/plugin-dialog";
import {
  Curso,
  Evaluacion,
  Grupo,
  ConfigDescuentos,
  DEFAULT_DESCUENTOS,
  calcularNotasAjustadas,
} from "../utils/notas";
import { procesarArchivoEvaluacion } from "../utils/helpers";
import { useAppStore } from "../store/appStore";
import { ExportMenu } from "./ExportMenu";
import { exportarSeguimiento } from "../utils/exportarExcel";
import { message } from "@tauri-apps/plugin-dialog";
import { SeguimientoView } from "./SeguimientoView";
import { GrupoCard } from "./GrupoCard";
import { nuevoGrupo } from "../utils/helpers";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTourCurso } from "../hooks/useTour";
import { SimpleTour } from "./SimpleTour";
import { tourStepsCurso } from "../config/tourSteps";
import { readFile } from "@tauri-apps/plugin-fs";
import { resourceDir } from "@tauri-apps/api/path";

interface CursoViewProps {
  cursoActivo: Curso;
  onVolver: () => void;
  guardarEnStore: (lista: Curso[]) => void;
  tourDesdeCreacion?: boolean;
  onTourFinish?: () => void;
}

function SortableTab({
  ev,
  isActive,
  menuAbierto,
  onSelect,
  onToggleMenu,
  onRenombrar,
  onEliminar,
  renombrandoId,
  nuevoNombre,
  onChangeNombre,
  onConfirmarRenombre,
  onCancelarRenombre,
}: {
  ev: Evaluacion;
  isActive: boolean;
  menuAbierto: boolean;
  onSelect: () => void;
  onToggleMenu: () => void;
  onRenombrar: () => void;
  onEliminar: () => void;
  renombrandoId: string | null;
  nuevoNombre: string;
  onChangeNombre: (v: string) => void;
  onConfirmarRenombre: () => void;
  onCancelarRenombre: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ev.id });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonWidth, setButtonWidth] = useState<number | null>(null);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
      }}
    >
      {isActive && renombrandoId === ev.id ? (
        <input
          autoFocus
          value={nuevoNombre}
          onChange={(e) => onChangeNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirmarRenombre();
            if (e.key === "Escape") onCancelarRenombre();
          }}
          onBlur={onConfirmarRenombre}
          style={{
            backgroundColor: "var(--color-primary)",
            color: "white",
            border: "2px solid rgba(255,255,255,0.6)",
            borderRadius: 12,
            padding: "10px 24px",
            fontSize: 16,
            fontWeight: 700,
            outline: "none",
            width: buttonWidth ? `${buttonWidth}px` : "auto",
            minWidth: 120,
            boxSizing: "border-box",
          }}
        />
      ) : (
        <button
          ref={buttonRef}
          onClick={
            isActive
              ? () => {
                  setButtonWidth(buttonRef.current?.offsetWidth ?? null);
                  onToggleMenu();
                }
              : onSelect
          }
          {...attributes}
          className="flex items-center gap-1.5 border cursor-pointer transition-all"
          style={
            isActive
              ? {
                  backgroundColor: "var(--color-primary)",
                  color: "white",
                  borderColor: "var(--color-primary)",
                  padding: "10px 24px",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 700,
                }
              : {
                  backgroundColor: "white",
                  color: "var(--color-blue-mid)",
                  borderColor: "var(--color-warm-gray)",
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                }
          }
        >
          <span
            ref={setActivatorNodeRef}
            {...listeners}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              cursor: isDragging ? "grabbing" : "grab",
              display: "flex",
              alignItems: "center",
              marginRight: 2,
              opacity: isActive ? 0.7 : 0.4,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              style={{ width: 12, height: 12 }}
            >
              <path d="M5.5 3.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0ZM5.5 8a1 1 0 1 1 2 0 1 1 0 0 1-2 0ZM5.5 12.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0ZM8.5 3.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0ZM8.5 8a1 1 0 1 1 2 0 1 1 0 0 1-2 0ZM8.5 12.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z" />
            </svg>
          </span>

          {ev.nombre}

          {isActive && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              style={{
                width: 14,
                height: 14,
                marginLeft: 2,
                transform: menuAbierto ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s",
              }}
            >
              <path
                fillRule="evenodd"
                d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      )}

      {/* Desplegable */}
      {isActive && menuAbierto && renombrandoId !== ev.id && (
        <div
          className="absolute top-full mt-1 left-0 bg-white rounded-lg shadow-lg border overflow-hidden z-50"
          style={{ borderColor: "var(--color-warm-gray)", minWidth: 160 }}
        >
          <button
            onClick={onRenombrar}
            className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50 cursor-pointer"
            style={{ color: "var(--color-navy)" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-4 h-4"
              style={{ color: "var(--color-blue-light)" }}
            >
              <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
              <path d="M4.75 3.5A2.25 2.25 0 0 0 2.5 5.75v5.5A2.25 2.25 0 0 0 4.75 13.5h5.5A2.25 2.25 0 0 0 12.5 11.25V9a.75.75 0 0 0-1.5 0v2.25a.75.75 0 0 1-.75.75h-5.5a.75.75 0 0 1-.75-.75v-5.5a.75.75 0 0 1 .75-.75H7A.75.75 0 0 0 7 2H4.75Z" />
            </svg>
            Renombrar
          </button>
          <button
            onClick={onEliminar}
            className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-red-50 cursor-pointer border-t"
            style={{ color: "#9C0006", borderColor: "#F3F0ED" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z"
                clipRule="evenodd"
              />
            </svg>
            Eliminar evaluación
          </button>
        </div>
      )}
    </div>
  );
}

export function CursoView({
  cursoActivo,
  onVolver,
  guardarEnStore,
}: CursoViewProps) {
  const { cursos, actualizarCurso } = useAppStore();
  const { tourEnabled, completarTour, reiniciarTour } = useTourCurso();

  const [evalActivaId, setEvalActivaId] = useState<string>(() => {
    return cursoActivo.evaluaciones[0]?.id ?? "";
  });
  const [notasBrutas, setNotasBrutas] = useState<
    Record<string, Record<string, string>>
  >({});
  const [config, setConfig] = useState<ConfigDescuentos>(DEFAULT_DESCUENTOS);
  const [rawFueraGrupo, setRawFueraGrupo] = useState(
    String(Math.round(DEFAULT_DESCUENTOS.maxCastigoFueraGrupo * 100)),
  );
  const [rawNoEvaluo, setRawNoEvaluo] = useState(
    String(Math.round(DEFAULT_DESCUENTOS.maxCastigoNoEvaluo * 100)),
  );
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(
    new Set(),
  );
  const [gruposEditando, setGruposEditando] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [menuExportAbierto, setMenuExportAbierto] = useState(false);
  const [menuEvalAbierto, setMenuEvalAbierto] = useState(false);
  const [renombrandoId, setRenombrandoId] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const [mostrarVideo, setMostrarVideo] = useState(false);
  const [videoSrc, setVideoSrc] = useState("");

  const cursoData = cursos.find((c) => c.id === cursoActivo.id) ?? cursoActivo;
  const modoSeguimiento = evalActivaId === "seguimiento";
  const menuRef = useRef<HTMLDivElement>(null);

  // ─── Inicializar video ──────────────────────────────────────────────────────
  useEffect(() => {
    const isDev = window.location.hostname === "localhost";
    if (isDev) {
      setVideoSrc("/videos/Tutorial.webm");
    } else {
      (async () => {
        try {
          const dir = await resourceDir();
          const path = `${dir}resources\\videos\\Tutorial.webm`;
          const bytes = await readFile(path);
          const blob = new Blob([bytes], { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          setVideoSrc(url);
        } catch (e) {
          console.error("Error cargando video:", e);
        }
      })();
    }
  }, []);

  useEffect(() => {
    if (!menuEvalAbierto) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuEvalAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuEvalAbierto]);

  const evalActiva: Evaluacion | null = modoSeguimiento
    ? null
    : (cursoData.evaluaciones.find((e) => e.id === evalActivaId) ??
      cursoData.evaluaciones[0] ??
      null);

  const notasEval = evalActiva ? (notasBrutas[evalActiva.id] ?? {}) : {};

  const setNotaCurso = (grupoNumero: string, valor: string) => {
    if (!evalActiva) return;
    setNotasBrutas((prev) => ({
      ...prev,
      [evalActiva.id]: { ...(prev[evalActiva.id] ?? {}), [grupoNumero]: valor },
    }));
  };

  const tieneAutoevaluaciones = evalActiva
    ? evalActiva.grupos.some((g) =>
        g.estudiantes.some((e) => e.notaAuto !== undefined),
      )
    : false;

  const estudiantesDuplicados = (() => {
    if (!evalActiva) return new Set<string>();
    const conteo: Record<string, number> = {};
    evalActiva.grupos.forEach((g) =>
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

  const gruposFiltrados = evalActiva
    ? busqueda.trim() === ""
      ? evalActiva.grupos
      : evalActiva.grupos.filter((g) => {
          const q = busqueda.toLowerCase().trim();
          const matchGrupo =
            g.numero.toLowerCase().includes(q) ||
            `grupo ${g.numero}`.toLowerCase().includes(q);
          const matchEstudiante = g.estudiantes.some((e) =>
            e.identificacion.toLowerCase().includes(q),
          );
          return matchGrupo || matchEstudiante;
        })
    : [];

  const allExpanded = evalActiva
    ? evalActiva.grupos.every((g) => gruposExpandidos.has(g.numero))
    : false;

  // ─── CRUD helpers ──────────────────────────────────────────────────────────

  const updateCurso = (actualizado: Curso) => {
    actualizarCurso(actualizado);
    guardarEnStore(
      cursos.map((c) => (c.id === actualizado.id ? actualizado : c)),
    );
  };

  const crearGrupoVacio = () => {
    if (!evalActiva) return;
    const grupo = nuevoGrupo(evalActiva.grupos);
    const evalActualizada: Evaluacion = {
      ...evalActiva,
      grupos: [...evalActiva.grupos, grupo],
    };
    const actualizado: Curso = {
      ...cursoData,
      evaluaciones: cursoData.evaluaciones.map((e) =>
        e.id === evalActiva.id ? evalActualizada : e,
      ),
    };
    updateCurso(actualizado);
    setGruposEditando((prev) => new Set([...prev, grupo.numero]));
    setGruposExpandidos((prev) => new Set([...prev, grupo.numero]));
  };

  const eliminarGrupo = async (grupoNumero: string) => {
    if (!evalActiva) return;
    const confirmado = await confirm("Esta acción no se puede deshacer.", {
      title: `¿Eliminar el Grupo ${grupoNumero}?`,
      kind: "warning",
    });
    if (!confirmado) return;
    const evalActualizada: Evaluacion = {
      ...evalActiva,
      grupos: evalActiva.grupos.filter((g) => g.numero !== grupoNumero),
    };
    const actualizado: Curso = {
      ...cursoData,
      evaluaciones: cursoData.evaluaciones.map((e) =>
        e.id === evalActiva.id ? evalActualizada : e,
      ),
    };
    updateCurso(actualizado);
  };

  const guardarEdicionGrupo = (
    grupoEditado: Grupo,
    grupoNumeroOriginal: string,
  ) => {
    if (!evalActiva) return;
    const evalActualizada: Evaluacion = {
      ...evalActiva,
      grupos: evalActiva.grupos.map((g) =>
        g.numero === grupoNumeroOriginal ? grupoEditado : g,
      ),
    };
    const actualizado: Curso = {
      ...cursoData,
      evaluaciones: cursoData.evaluaciones.map((e) =>
        e.id === evalActiva.id ? evalActualizada : e,
      ),
    };
    updateCurso(actualizado);
    setGruposEditando((prev) => {
      const s = new Set(prev);
      s.delete(grupoNumeroOriginal);
      return s;
    });
  };

  const aplicarNotasBrutas = () => {
    if (!evalActiva) return;
    const gruposActualizados = evalActiva.grupos.map((grupo) => {
      const valor = notasEval[grupo.numero];
      const nota =
        valor !== undefined ? parseFloat(valor) : grupo.promedio_bruto;
      return {
        ...grupo,
        promedio_bruto: isNaN(nota as number) ? grupo.promedio_bruto : nota,
      };
    });
    const evalConBrutas: Evaluacion = {
      ...evalActiva,
      grupos: gruposActualizados,
    };
    const evalFinal = calcularNotasAjustadas(evalConBrutas, config);
    const cursoFinal: Curso = {
      ...cursoData,
      evaluaciones: cursoData.evaluaciones.map((e) =>
        e.id === evalActiva.id ? evalFinal : e,
      ),
    };
    updateCurso(cursoFinal);
  };

  const agregarEvaluacion = async () => {
    try {
      const file = await open({
        filters: [
          { name: "Evaluación Par", extensions: ["xls", "xlsx", "csv"] },
        ],
      });
      if (!file) return;
      const gruposConNotas = await procesarArchivoEvaluacion(file as string);
      const numEval = cursoData.evaluaciones.length + 1;
      const nuevaEval: Evaluacion = {
        id: crypto.randomUUID(),
        nombre: `Evaluación ${numEval}`,
        grupos: gruposConNotas,
      };
      const actualizado: Curso = {
        ...cursoData,
        evaluaciones: [...cursoData.evaluaciones, nuevaEval],
      };
      updateCurso(actualizado);
      setEvalActivaId(nuevaEval.id);
    } catch (error) {
      alert(`Error al agregar evaluación: ${error}`);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const reordenarEvaluaciones = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = cursoData.evaluaciones.findIndex(
      (ev) => ev.id === active.id,
    );
    const newIndex = cursoData.evaluaciones.findIndex(
      (ev) => ev.id === over.id,
    );
    updateCurso({
      ...cursoData,
      evaluaciones: arrayMove(cursoData.evaluaciones, oldIndex, newIndex),
    });
  };

  const eliminarEvaluacion = async (id: string) => {
    const confirmado = await confirm("Esta acción no se puede deshacer.", {
      title: "¿Eliminar esta evaluación?",
      kind: "warning",
    });
    if (!confirmado) return;
    const filtradas = cursoData.evaluaciones.filter((ev) => ev.id !== id);
    updateCurso({ ...cursoData, evaluaciones: filtradas });
    setEvalActivaId(filtradas[0]?.id ?? "");
    setMenuEvalAbierto(false);
  };

  const renombrarEvaluacion = (id: string) => {
    const actual =
      cursoData.evaluaciones.find((ev) => ev.id === id)?.nombre ?? "";
    setNuevoNombre(actual);
    setRenombrandoId(id);
    setMenuEvalAbierto(false);
  };

  const confirmarRenombre = () => {
    if (!renombrandoId || !nuevoNombre.trim()) return;
    updateCurso({
      ...cursoData,
      evaluaciones: cursoData.evaluaciones.map((ev) =>
        ev.id === renombrandoId ? { ...ev, nombre: nuevoNombre.trim() } : ev,
      ),
    });
    setRenombrandoId(null);
  };

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: "#F7F5F3" }}>
      {/* Tour de la vista de curso */}
      <SimpleTour
        steps={tourStepsCurso}
        run={tourEnabled}
        onFinish={completarTour}
      />

      {/* Video Modal */}
      {mostrarVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={() => setMostrarVideo(false)}
        >
          <div
            className="relative rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <video width="800" height="450" controls autoPlay>
              <source
                src={videoSrc.replace(".mp4", ".webm")}
                type="video/webm"
              />
            </video>
            <button
              onClick={() => setMostrarVideo(false)}
              className="absolute top-2 right-2 bg-black text-white rounded-full w-8 h-8"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onVolver}
            className="font-medium hover:underline flex items-center gap-1"
            style={{ color: "var(--color-primary)" }}
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
          <span style={{ color: "var(--color-warm-gray)" }}>|</span>
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-blue-light)" }}
          >
            EquiPar
          </span>
        </div>

        {/* Header del curso */}
        <div
          className="flex justify-between items-center p-6 rounded-xl shadow mb-6"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          <div>
            <h1 className="text-3xl font-bold text-white">
              {cursoData.nombre}
            </h1>
            <p className="mt-1" style={{ color: "#FFAAAA" }}>
              {modoSeguimiento
                ? (() => {
                    const totalAlumnos = new Set(
                      cursoData.evaluaciones.flatMap((ev) =>
                        ev.grupos.flatMap((g) =>
                          g.estudiantes.map((e) => e.identificacion),
                        ),
                      ),
                    ).size;
                    return `${totalAlumnos} alumno${totalAlumnos !== 1 ? "s" : ""}`;
                  })()
                : `${evalActiva?.grupos.length ?? 0} grupo${(evalActiva?.grupos.length ?? 0) !== 1 ? "s" : ""}`}{" "}
              · {cursoData.evaluaciones.length} evaluación
              {cursoData.evaluaciones.length !== 1 ? "es" : ""}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Dropdown Ayuda - Simple */}
            <div className="relative">
              <button
                onClick={() => setMostrarMenu(!mostrarMenu)}
                title="Ver guía de uso"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer border"
                style={{
                  color: "white",
                  borderColor: "rgba(255,255,255,0.4)",
                  backgroundColor: "rgba(255,255,255,0.12)",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "rgba(255,255,255,0.22)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "rgba(255,255,255,0.12)")
                }
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    d="M11.95 18q.525 0 .888-.363t.362-.887t-.362-.888t-.888-.362t-.887.363t-.363.887t.363.888t.887.362m-.9-3.85h1.85q0-.825.188-1.3t1.062-1.3q.65-.65 1.025-1.238T15.55 8.9q0-1.4-1.025-2.15T12.1 6q-1.425 0-2.312.75T8.55 8.55l1.65.65q.125-.45.563-.975T12.1 7.7q.8 0 1.2.438t.4.962q0 .5-.3.938t-.75.812q-1.1.975-1.35 1.475t-.25 1.825M12 22q-2.075 0-3.9-.787t-3.175-2.138T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8"
                  />
                </svg>
                Ayuda
              </button>

              {/* Dropdown Menu */}
              {mostrarMenu && (
                <>
                  {/* Backdrop para cerrar */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMostrarMenu(false)}
                  />

                  {/* Menu Items */}
                  <div
                    className="absolute top-full right-0 mt-2 bg-white rounded shadow-lg z-20"
                    style={{ minWidth: "200px", borderRadius: "8px" }}
                  >
                    <button
                      onClick={() => {
                        if (
                          modoSeguimiento &&
                          cursoData.evaluaciones.length > 0
                        ) {
                          setEvalActivaId(cursoData.evaluaciones[0].id);
                        }
                        setTimeout(reiniciarTour, 50);
                        setMostrarMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 first:rounded-t last:rounded-b transition"
                      style={{ color: "var(--color-navy)" }}
                    >
                      Iniciar Tour
                    </button>
                    <div
                      style={{ height: "1px", backgroundColor: "#E5E5E5" }}
                    />
                    <button
                      onClick={() => {
                        setMostrarVideo(true);
                        setMostrarMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 last:rounded-b transition"
                      style={{ color: "var(--color-navy)" }}
                    >
                      Ver Video Tutorial
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Menú exportar */}
            <div className="relative">
              <button
                data-tour="tour-btn-exportar"
                onClick={() => setMenuExportAbierto((v) => !v)}
                className="px-5 py-3 bg-white font-semibold rounded shadow transition cursor-pointer border border-white flex items-center gap-2"
                style={{ color: "var(--color-primary)" }}
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

              {menuExportAbierto &&
                (modoSeguimiento ? (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuExportAbierto(false)}
                    />
                    <div
                      className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border z-20 overflow-hidden"
                      style={{ borderColor: "var(--color-warm-gray)" }}
                    >
                      <button
                        onClick={async () => {
                          setMenuExportAbierto(false);
                          try {
                            const ok = await exportarSeguimiento(cursoData);
                            if (ok)
                              await message(
                                "¡Seguimiento exportado con éxito!",
                                {
                                  title: "Exportación exitosa",
                                  kind: "info",
                                },
                              );
                          } catch (e) {
                            await message("Error al exportar: " + String(e), {
                              title: "Error",
                              kind: "error",
                            });
                          }
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 transition text-left"
                        style={{ color: "var(--color-navy)" }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className="w-4 h-4 shrink-0"
                          style={{ color: "var(--color-blue-dark)" }}
                        >
                          <path
                            fillRule="evenodd"
                            d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM9.5 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-.5 3a3.5 3.5 0 0 0-2.986 1.691A5.476 5.476 0 0 0 8 13.5a5.476 5.476 0 0 0 1.986-.309A3.5 3.5 0 0 0 9 8.5Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div>
                          <p className="font-semibold">Excel seguimiento</p>
                          <p
                            className="text-[11px]"
                            style={{ color: "var(--color-blue-light)" }}
                          >
                            Tendencia longitudinal por alumno
                          </p>
                        </div>
                      </button>
                    </div>
                  </>
                ) : (
                  evalActiva && (
                    <ExportMenu
                      cursoData={cursoData}
                      evalActiva={evalActiva}
                      tieneAutoevaluaciones={tieneAutoevaluaciones}
                      onClose={() => setMenuExportAbierto(false)}
                    />
                  )
                ))}
            </div>
          </div>
        </div>

        {/* Tabs de evaluaciones — data-tour aquí */}
        <div data-tour="tour-tabs-evaluaciones">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={reordenarEvaluaciones}
          >
            <SortableContext
              items={cursoData.evaluaciones.map((ev) => ev.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                {cursoData.evaluaciones.map((ev) => (
                  <SortableTab
                    key={ev.id}
                    ev={ev}
                    isActive={evalActivaId === ev.id && !modoSeguimiento}
                    menuAbierto={menuEvalAbierto}
                    onSelect={() => setEvalActivaId(ev.id)}
                    onToggleMenu={() => setMenuEvalAbierto((v) => !v)}
                    onRenombrar={() => renombrarEvaluacion(ev.id)}
                    onEliminar={() => eliminarEvaluacion(ev.id)}
                    renombrandoId={renombrandoId}
                    nuevoNombre={nuevoNombre}
                    onChangeNombre={setNuevoNombre}
                    onConfirmarRenombre={confirmarRenombre}
                    onCancelarRenombre={() => setRenombrandoId(null)}
                  />
                ))}

                {/* + Agregar evaluación */}
                <button
                  onClick={agregarEvaluacion}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border-2 border-dashed transition cursor-pointer"
                  style={{
                    color: "var(--color-primary)",
                    borderColor: "var(--color-primary)",
                    backgroundColor: "#FFF5F5",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="w-3.5 h-3.5"
                  >
                    <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
                  </svg>
                  Agregar evaluación
                </button>

                {/* Tab Seguimiento */}
                {cursoData.evaluaciones.length >= 2 && (
                  <button
                    data-tour="tour-seguimiento"
                    onClick={() => {
                      setEvalActivaId("seguimiento");
                      setMenuEvalAbierto(false);
                    }}
                    className="ml-2 px-4 py-2 rounded-lg text-sm font-semibold transition border cursor-pointer flex items-center gap-1.5"
                    style={
                      modoSeguimiento
                        ? {
                            backgroundColor: "var(--color-blue-mid)",
                            color: "white",
                            borderColor: "var(--color-blue-mid)",
                          }
                        : {
                            backgroundColor: "white",
                            color: "var(--color-blue-mid)",
                            borderColor: "var(--color-blue-light)",
                          }
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13ZM11 8a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm1 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM3 9a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm1 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm3-3a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm1 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
                    </svg>
                    Seguimiento
                  </button>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Advertencia duplicados */}
        {!modoSeguimiento && estudiantesDuplicados.size > 0 && (
          <div
            className="border rounded-xl p-4 mb-6 flex gap-3 items-start"
            style={{ backgroundColor: "#FFFBEB", borderColor: "#FCD34D" }}
          >
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold" style={{ color: "#92400E" }}>
                Estudiantes registrados en más de un grupo
              </p>
              <ul
                className="mt-1 text-sm list-disc list-inside"
                style={{ color: "#B45309" }}
              >
                {[...estudiantesDuplicados].map((nombre) => (
                  <li key={nombre}>{nombre}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ─── Modo Seguimiento ─────────────────────────────────────────────── */}
        {modoSeguimiento ? (
          <SeguimientoView cursoData={cursoData} />
        ) : (
          /* ─── Modo normal ───────────────────────────────────────────────── */
          <>
            {/* Configuración de castigos — data-tour aquí */}
            <div
              data-tour="tour-config-castigos"
              className="bg-white p-6 rounded-xl shadow-sm border mb-6"
              style={{ borderColor: "var(--color-warm-gray)" }}
            >
              <h2
                className="text-lg font-bold mb-1"
                style={{ color: "var(--color-primary)" }}
              >
                Configuración de castigos
              </h2>
              <p
                className="text-xs mb-1"
                style={{ color: "var(--color-blue-light)" }}
              >
                Fracción máxima de reducción sobre la proporción del estudiante
                (0 a 100%).
              </p>
              <p
                className="text-xs mb-4"
                style={{ color: "var(--color-blue-light)" }}
              >
                Se aplica individualmente al calcular cada evaluación.
              </p>
              <div className="flex gap-8 flex-wrap">
                <div className="flex flex-col gap-1">
                  <label
                    className="text-xs font-semibold uppercase"
                    style={{ color: "var(--color-primary-mid)" }}
                  >
                    Máx. castigo por evaluar fuera del grupo
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={rawFueraGrupo}
                      onChange={(e) => setRawFueraGrupo(e.target.value)}
                      onBlur={() => {
                        const n = Math.min(
                          100,
                          Math.max(0, parseFloat(rawFueraGrupo) || 0),
                        );
                        setRawFueraGrupo(String(n));
                        setConfig((prev) => ({
                          ...prev,
                          maxCastigoFueraGrupo: n / 100,
                        }));
                      }}
                      className="p-2 border rounded text-sm w-28 outline-none pr-7"
                      style={{ borderColor: "var(--color-warm-gray)" }}
                    />
                    <span
                      className="text-xs font-bold"
                      style={{ color: "var(--color-primary-mid)" }}
                    >
                      %
                    </span>
                  </div>
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--color-blue-light)" }}
                  >
                    × cada evaluación inválida
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    className="text-xs font-semibold uppercase"
                    style={{ color: "var(--color-primary-warm)" }}
                  >
                    Máx. castigo por no evaluar compañeros
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={rawNoEvaluo}
                      onChange={(e) => setRawNoEvaluo(e.target.value)}
                      onBlur={() => {
                        const n = Math.min(
                          100,
                          Math.max(0, parseFloat(rawNoEvaluo) || 0),
                        );
                        setRawNoEvaluo(String(n));
                        setConfig((prev) => ({
                          ...prev,
                          maxCastigoNoEvaluo: n / 100,
                        }));
                      }}
                      className="p-2 border rounded text-sm w-28 outline-none pr-7"
                      style={{ borderColor: "var(--color-warm-gray)" }}
                    />
                    <span
                      className="text-xs font-bold"
                      style={{ color: "var(--color-primary-warm)" }}
                    >
                      %
                    </span>
                  </div>
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--color-blue-light)" }}
                  >
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
                      setGruposExpandidos(
                        allExpanded
                          ? new Set()
                          : new Set(
                              evalActiva?.grupos.map((g) => g.numero) ?? [],
                            ),
                      )
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-white border font-medium rounded-lg transition text-sm shadow-sm cursor-pointer"
                    style={{
                      color: "var(--color-blue-mid)",
                      borderColor: "var(--color-warm-gray)",
                    }}
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
                    onClick={crearGrupoVacio}
                    className="flex items-center gap-2 px-4 py-2 bg-white border font-medium rounded-lg transition text-sm shadow-sm cursor-pointer"
                    style={{
                      color: "var(--color-primary)",
                      borderColor: "var(--color-primary)",
                    }}
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

                {/* Botón calcular — data-tour aquí */}
                <button
                  data-tour="tour-btn-calcular"
                  onClick={aplicarNotasBrutas}
                  className="px-5 py-2 text-white font-semibold rounded-lg transition cursor-pointer text-sm shadow"
                  style={{ backgroundColor: "var(--color-primary)" }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--color-primary-hover)")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--color-primary)")
                  }
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
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--color-blue-light)" }}
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
                  placeholder="Buscar por integrante o grupo..."
                  className="w-full pl-9 pr-10 py-2 bg-white border rounded-lg text-sm outline-none shadow-sm"
                  style={{
                    borderColor: "var(--color-warm-gray)",
                    color: "var(--color-navy)",
                  }}
                />
                {busqueda && (
                  <button
                    onClick={() => setBusqueda("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                    style={{ color: "var(--color-blue-light)" }}
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
                <p
                  className="text-xs"
                  style={{ color: "var(--color-blue-light)" }}
                >
                  {gruposFiltrados.length === 0
                    ? "Sin resultados"
                    : `${gruposFiltrados.length} grupo${gruposFiltrados.length !== 1 ? "s" : ""} con "${busqueda}"`}
                </p>
              )}
            </div>

            {/* Grid de grupos */}
            {evalActiva && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {gruposFiltrados.map((grupo) => (
                  <GrupoCard
                    key={grupo.numero}
                    grupo={grupo}
                    cursoData={cursoData}
                    evalActiva={evalActiva}
                    expandido={gruposExpandidos.has(grupo.numero)}
                    editando={gruposEditando.has(grupo.numero)}
                    notaBrutaInput={notasEval[grupo.numero]}
                    estudiantesDuplicados={estudiantesDuplicados}
                    onToggle={() =>
                      setGruposExpandidos((prev) => {
                        const s = new Set(prev);
                        s.has(grupo.numero)
                          ? s.delete(grupo.numero)
                          : s.add(grupo.numero);
                        return s;
                      })
                    }
                    onSetNota={(v) => setNotaCurso(grupo.numero, v)}
                    onAbrirEdicion={() => {
                      setGruposEditando(
                        (prev) => new Set([...prev, grupo.numero]),
                      );
                      setGruposExpandidos(
                        (prev) => new Set([...prev, grupo.numero]),
                      );
                    }}
                    onEliminar={() => eliminarGrupo(grupo.numero)}
                    onSaveEdicion={(g) => guardarEdicionGrupo(g, grupo.numero)}
                    onCancelEdicion={() =>
                      setGruposEditando((prev) => {
                        const s = new Set(prev);
                        s.delete(grupo.numero);
                        return s;
                      })
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
