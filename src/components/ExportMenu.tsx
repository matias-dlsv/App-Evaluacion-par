// src/components/ExportMenu.tsx
import { Curso, Evaluacion } from "../utils/notas";
import {
  exportarResultados,
  exportarXLSXGrupo,
  exportarTodosXLSXGrupos,
  exportarAutoevaluaciones,
  exportarSeguimiento,
} from "../utils/exportarExcel";

interface ExportMenuProps {
  cursoData: Curso;
  evalActiva: Evaluacion | null;
  tieneAutoevaluaciones: boolean;
  onClose: () => void;
}

export function ExportMenu({
  cursoData,
  evalActiva,
  tieneAutoevaluaciones,
  onClose,
}: ExportMenuProps) {
  if (!evalActiva) return null;

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div
        className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border z-20 overflow-hidden"
        style={{ borderColor: "var(--color-warm-gray)" }}
      >
        {/* Excel completo */}
        <button
          onClick={async () => {
            onClose();
            try {
              await exportarResultados(cursoData, evalActiva);
              alert("¡Excel exportado con éxito!");
            } catch (e) {
              alert("Error al exportar: " + String(e));
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
            style={{ color: "#16A34A" }}
          >
            <path d="M2 2.75A2.75 2.75 0 0 1 4.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237V13.25A2.75 2.75 0 0 1 12.25 16H4.75A2.75 2.75 0 0 1 2 13.25V2.75Z" />
          </svg>
          <div>
            <p className="font-semibold">Excel completo</p>
            <p className="text-[11px]" style={{ color: "var(--color-blue-light)" }}>
              {evalActiva.nombre} — todos los grupos
            </p>
          </div>
        </button>

        <div className="border-t" style={{ borderColor: "var(--color-warm-gray)" }} />

        {/* Excel todos los grupos */}
        <button
          onClick={async () => {
            onClose();
            try {
              const ok = await exportarTodosXLSXGrupos(cursoData, evalActiva);
              if (ok) alert("¡Excel de todos los grupos exportado con éxito!");
            } catch (e) {
              alert("Error al exportar: " + String(e));
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
            style={{ color: "var(--color-blue-mid)" }}
          >
            <path d="M2 2.75A2.75 2.75 0 0 1 4.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237V13.25A2.75 2.75 0 0 1 12.25 16H4.75A2.75 2.75 0 0 1 2 13.25V2.75Z" />
          </svg>
          <div>
            <p className="font-semibold">Excel todos los grupos</p>
            <p className="text-[11px]" style={{ color: "var(--color-blue-light)" }}>
              Un archivo por grupo en carpeta
            </p>
          </div>
        </button>

        {/* Excel seguimiento — solo si ≥2 evaluaciones */}
        {cursoData.evaluaciones.length >= 2 && (
          <>
            <div className="border-t" style={{ borderColor: "var(--color-warm-gray)" }} />
            <button
              onClick={async () => {
                onClose();
                try {
                  const ok = await exportarSeguimiento(cursoData);
                  if (ok) alert("¡Seguimiento exportado con éxito!");
                } catch (e) {
                  alert("Error al exportar: " + String(e));
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
                <p className="text-[11px]" style={{ color: "var(--color-blue-light)" }}>
                  Tendencia longitudinal por alumno
                </p>
              </div>
            </button>
          </>
        )}

        {/* Autoevaluaciones */}
        {tieneAutoevaluaciones && (
          <>
            <div className="border-t" style={{ borderColor: "var(--color-warm-gray)" }} />
            <button
              onClick={async () => {
                onClose();
                try {
                  const ok = await exportarAutoevaluaciones(cursoData, evalActiva);
                  if (ok) alert("¡Autoevaluaciones exportadas con éxito!");
                } catch (e) {
                  alert("Error al exportar: " + String(e));
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
                  d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0Zm-5-2a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 9c-1.825 0-3.422.977-4.295 2.437A5.49 5.49 0 0 0 8 13.5a5.49 5.49 0 0 0 4.294-2.063A4.997 4.997 0 0 0 8 9Z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-semibold">Excel autoevaluaciones</p>
                <p className="text-[11px]" style={{ color: "var(--color-blue-light)" }}>
                  Auto vs nota par por alumno
                </p>
              </div>
            </button>
          </>
        )}

        <div className="border-t" style={{ borderColor: "var(--color-warm-gray)" }} />

        {/* Excel por grupo individual */}
        <div className="px-4 py-2">
          <p
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--color-blue-light)" }}
          >
            Excel por grupo
          </p>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {evalActiva.grupos.map((grupo) => (
            <button
              key={grupo.numero}
              onClick={async () => {
                onClose();
                try {
                  await exportarXLSXGrupo(cursoData, evalActiva, grupo.numero);
                } catch (e) {
                  alert("Error al exportar: " + String(e));
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition text-left"
              style={{ color: "var(--color-navy)" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-4 h-4 shrink-0"
                style={{ color: "var(--color-blue-mid)" }}
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
  );
}
