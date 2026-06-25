// src/App.tsx
import { useState, useEffect, useRef } from "react";
import { open, confirm } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import logoUandes from "./assets/logo-uandes.png";
import "./App.css";
import { Curso, Evaluacion, migrarCurso } from "./utils/notas";
import { useAppStore } from "./store/appStore";
import { procesarArchivoEvaluacion } from "./utils/helpers";
import { CursoView } from "./components/CursoView";
import { useTourInicio } from "./hooks/useTour";
import { tourStepsInicio } from "./config/tourSteps";
import { SimpleTour } from "./components/SimpleTour";

function App() {
  const { cursos, agregarCurso, eliminarCurso, setCursos } = useAppStore();
  const [cursoActivo, setCursoActivo] = useState<Curso | null>(null);
  const [nombreCurso, setNombreCurso] = useState("");
  const [estadoCarga, setEstadoCarga] = useState("");
  const [evalActivaId] = useState<Record<string, string>>({});
  const storeRef = useRef<Awaited<ReturnType<typeof load>> | null>(null);

  const { tourEnabled, completarTour, reiniciarTour } = useTourInicio();

  // ─── Store ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const store = await load("cursos.json", { defaults: { cursos: [] } });
        storeRef.current = store;
        const guardados = await store.get<any[]>("cursos");
        if (guardados && guardados.length > 0) {
          setCursos(guardados.map(migrarCurso));
        }
      } catch (e) {
        console.error("Error cargando store:", e);
      }
    })();
  }, []);

  const guardarEnStore = (lista: Curso[]) => {
    storeRef.current?.set("cursos", lista);
  };

  // ─── Crear curso ─────────────────────────────────────────────────────────────

  const crearCurso = async () => {
    if (!nombreCurso.trim()) return setEstadoCarga("Ingresa un nombre.");
    try {
      const file = await open({
        filters: [
          { name: "Evaluación Par", extensions: ["xls", "xlsx", "csv"] },
        ],
      });
      if (!file) return;
      setEstadoCarga("Procesando archivo...");

      const gruposConNotas = await procesarArchivoEvaluacion(file as string);
      const primeraEval: Evaluacion = {
        id: crypto.randomUUID(),
        nombre: "Evaluación 1",
        grupos: gruposConNotas,
      };
      const nuevoCurso: Curso = {
        id: crypto.randomUUID(),
        nombre: nombreCurso,
        evaluaciones: [primeraEval],
      };

      agregarCurso(nuevoCurso);
      guardarEnStore([...cursos, nuevoCurso]);
      setNombreCurso("");
      setEstadoCarga("");
    } catch (error) {
      setEstadoCarga(`Error: ${error}`);
    }
  };

  const handleEliminarCurso = async (e: React.MouseEvent, cursoId: string) => {
    e.stopPropagation();
    const confirmado = await confirm("Esta acción no se puede deshacer.", {
      title: "¿Eliminar este curso?",
      kind: "warning",
    });
    if (!confirmado) return;
    const restantes = cursos.filter((c) => c.id !== cursoId);
    eliminarCurso(cursoId);
    guardarEnStore(restantes);
    if (cursoActivo?.id === cursoId) setCursoActivo(null);
  };

  // ─── Vista de curso activo ───────────────────────────────────────────────────

  if (cursoActivo) {
    return (
      <CursoView
        cursoActivo={cursoActivo}
        onVolver={() => setCursoActivo(null)}
        guardarEnStore={guardarEnStore}
      />
    );
  }

  // ─── Vista principal ─────────────────────────────────────────────────────────

  return (
    <>
      <SimpleTour
        steps={tourStepsInicio}
        run={tourEnabled}
        onFinish={completarTour}
      />

      <div
        className="flex h-screen font-sans"
        style={{ backgroundColor: "#F7F5F3", color: "var(--color-navy)" }}
      >
        {/* Sidebar */}
        <div
          className="w-1/3 p-8 shadow-lg flex flex-col gap-6 z-10 text-white border-r"
          style={{
            background: `linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)`,
            borderColor: "var(--color-primary-dark)",
          }}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <img
                src={logoUandes}
                alt="Universidad de los Andes"
                className="h-20 w-auto"
              />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              EquiPar
            </h1>
            <p className="text-sm font-medium" style={{ color: "#FFAAAA" }}>
              Plataforma de Evaluación Par
            </p>
          </div>

          <div className="flex flex-col gap-4 mt-4">
            <h2
              className="text-xl font-semibold border-b pb-2 text-white"
              style={{ borderColor: "rgba(255,255,255,0.3)" }}
            >
              Nuevo Curso
            </h2>
            <input
              type="text"
              value={nombreCurso}
              onChange={(e) => setNombreCurso(e.target.value)}
              placeholder="Ej: Neuromecánica..."
              className="p-2 border rounded outline-none"
              data-tour="input-nombre-curso"
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                color: "white",
                borderColor: "rgba(255,255,255,0.3)",
              }}
            />
            <button
              onClick={crearCurso}
              className="mt-2 px-4 py-3 bg-white font-bold rounded transition cursor-pointer shadow"
              data-tour="btn-subir-excel"
              style={{ color: "var(--color-primary)" }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = "#FFF5F5")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = "white")
              }
            >
              Subir Excel de Evaluación Par
            </button>
            {estadoCarga && (
              <p
                className="text-sm text-center mt-2"
                style={{ color: "#FFAAAA" }}
              >
                {estadoCarga}
              </p>
            )}
            <button
              onClick={reiniciarTour}
              className="mt-4 self-start px-3 py-1.5 bg-transparent font-medium rounded transition cursor-pointer text-white text-sm border border-white flex items-center gap-1.5"
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "rgba(255,255,255,0.1)")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
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
          </div>

          <div
            className="mt-auto pt-6 border-t"
            style={{ borderColor: "rgba(255,255,255,0.25)" }}
          >
            <p
              className="text-[10px] text-center leading-relaxed"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              <span className="font-semibold text-white">
                Universidad de los Andes
              </span>
            </p>
          </div>
        </div>

        {/* Lista de cursos */}
        <div
          className="w-2/3 p-8 overflow-y-auto"
          style={{ backgroundColor: "#F7F5F3" }}
          data-tour="lista-cursos"
        >
          <h2
            className="text-2xl font-bold mb-6"
            style={{ color: "var(--color-primary)" }}
          >
            Cursos Creados
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {cursos.map((curso) => {
              const evalParaBadge =
                evalActivaId[curso.id] &&
                evalActivaId[curso.id] !== "seguimiento"
                  ? (curso.evaluaciones.find(
                      (e) => e.id === evalActivaId[curso.id],
                    ) ?? curso.evaluaciones[0])
                  : curso.evaluaciones[0];

              return (
                <div
                  key={curso.id}
                  onClick={() => setCursoActivo(curso)}
                  className="bg-white p-5 rounded-xl shadow-sm border transition cursor-pointer flex justify-between items-start group"
                  style={{ borderColor: "var(--color-warm-gray)" }}
                  onMouseOver={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "var(--color-primary)";
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      "0 4px 12px rgba(206,0,25,0.08)";
                  }}
                  onMouseOut={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "var(--color-warm-gray)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "";
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <h3
                      className="text-xl font-bold"
                      style={{ color: "var(--color-navy)" }}
                    >
                      {curso.nombre}
                    </h3>
                    {curso.evaluaciones.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {curso.evaluaciones.map((ev) => (
                          <span
                            key={ev.id}
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: "#FFF5F5",
                              color: "var(--color-primary)",
                              border: "1px solid #FECDD3",
                            }}
                          >
                            {ev.nombre}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <span
                      className="text-sm py-1 px-3 rounded-full border whitespace-nowrap"
                      style={{
                        color: "var(--color-primary)",
                        backgroundColor: "#FFF5F5",
                        borderColor: "#FECDD3",
                      }}
                    >
                      {evalParaBadge
                        ? `${evalParaBadge.grupos.length} grupos →`
                        : "0 grupos →"}
                    </span>
                    <button
                      onClick={(e) => handleEliminarCurso(e, curso.id)}
                      title="Eliminar curso"
                      className="flex items-center justify-center w-7 h-7 rounded-full transition cursor-pointer"
                      style={{ color: "var(--color-warm-gray)" }}
                      onMouseOver={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          "#FEE2E2";
                        (e.currentTarget as HTMLElement).style.color =
                          "var(--color-primary)";
                      }}
                      onMouseOut={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          "";
                        (e.currentTarget as HTMLElement).style.color =
                          "var(--color-warm-gray)";
                      }}
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
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
