// src/components/GrupoCard.tsx
import { Grupo, Evaluacion, Curso } from "../utils/notas";
import { BtnEliminar } from "./BtnEliminar";
import { EditGrupo } from "./EditGrupo";

interface GrupoCardProps {
  grupo: Grupo;
  cursoData: Curso;
  evalActiva: Evaluacion;
  expandido: boolean;
  editando: boolean;
  notaBrutaInput: string | undefined;
  estudiantesDuplicados: Set<string>;
  onToggle: () => void;
  onSetNota: (valor: string) => void;
  onAbrirEdicion: () => void;
  onEliminar: () => void;
  onSaveEdicion: (g: Grupo) => void;
  onCancelEdicion: () => void;
}

export function GrupoCard({
  grupo,
  expandido,
  editando,
  notaBrutaInput,
  estudiantesDuplicados,
  onToggle,
  onSetNota,
  onAbrirEdicion,
  onEliminar,
  onSaveEdicion,
  onCancelEdicion,
}: GrupoCardProps) {
  return (
    <div
      className="bg-white rounded-xl shadow border flex flex-col overflow-hidden"
      style={{ borderColor: "var(--color-warm-gray)" }}
    >
      {/* Header del grupo */}
      <div
        className={`flex items-center gap-3 px-5 py-4 border-b select-none transition-colors ${editando ? "" : "cursor-pointer"}`}
        style={{
          borderColor: "var(--color-warm-gray)",
          backgroundColor: editando ? "#FFF5F5" : undefined,
        }}
        onClick={() => !editando && onToggle()}
        onMouseOver={(e) => {
          if (!editando) (e.currentTarget as HTMLElement).style.backgroundColor = "#FFF5F5";
        }}
        onMouseOut={(e) => {
          if (!editando) (e.currentTarget as HTMLElement).style.backgroundColor = "";
        }}
      >
        {!editando && (
          <span
            className="text-sm font-bold transition-transform duration-200"
            style={{
              display: "inline-block",
              color: "var(--color-primary)",
              transform: expandido ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            ▶
          </span>
        )}
        <h4 className="font-bold text-lg flex-1" style={{ color: "var(--color-primary)" }}>
          Grupo {grupo.numero}
        </h4>

        {!editando && (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <label
              className="text-[10px] font-bold uppercase whitespace-nowrap"
              style={{ color: "var(--color-blue-mid)" }}
            >
              Nota bruta
            </label>
            <input
              type="number"
              step="0.1"
              min="1"
              max="7"
              value={notaBrutaInput ?? grupo.promedio_bruto ?? ""}
              onChange={(e) => onSetNota(e.target.value)}
              className="w-16 p-1.5 border rounded text-sm text-center outline-none font-semibold"
              style={{
                borderColor: "var(--color-warm-gray)",
                color: "var(--color-navy)",
                backgroundColor: "#F7F5F3",
              }}
            />
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-2" onClick={(e) => e.stopPropagation()}>
          {!editando && (
            <button
              onClick={onAbrirEdicion}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold border rounded transition cursor-pointer"
              style={{
                backgroundColor: "#F3F0ED",
                color: "var(--color-blue-mid)",
                borderColor: "var(--color-warm-gray)",
              }}
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
          <BtnEliminar onClick={onEliminar} title="Eliminar grupo" />
        </div>
      </div>

      {/* Editor */}
      {editando && (
        <EditGrupo
          grupo={grupo}
          onSave={onSaveEdicion}
          onCancel={onCancelEdicion}
        />
      )}

      {/* Tabla expandida (solo lectura) */}
      {!editando && expandido && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr
                className="text-[10px] uppercase font-semibold border-b"
                style={{
                  color: "var(--color-blue-light)",
                  borderColor: "var(--color-warm-gray)",
                  backgroundColor: "#F7F5F3",
                }}
              >
                <th className="text-left px-5 py-2">Alumno</th>
                <th className="text-center px-3 py-2 whitespace-nowrap">
                  Nota<br />Bruta
                </th>
                <th className="text-center px-3 py-2 whitespace-nowrap" style={{ color: "#16A34A" }}>
                  Ev.<br />Par
                </th>
                <th className="text-center px-3 py-2 whitespace-nowrap" style={{ color: "var(--color-blue-mid)" }}>
                  Auto<br />Eval.
                </th>
                <th className="text-center px-3 py-2 whitespace-nowrap" style={{ color: "var(--color-primary-warm)" }}>
                  Desc.<br />No Evaluó
                </th>
                <th className="text-center px-3 py-2 whitespace-nowrap" style={{ color: "var(--color-primary-mid)" }}>
                  Desc.<br />Grupo Ajeno
                </th>
                <th className="text-center px-3 py-2 whitespace-nowrap" style={{ color: "var(--color-primary)" }}>
                  Nota<br />Final
                </th>
              </tr>
            </thead>
            <tbody>
              {grupo.estudiantes.map((est, idx) => (
                <tr
                  key={idx}
                  className="border-b last:border-0"
                  style={{
                    borderColor: "#F3F0ED",
                    backgroundColor: estudiantesDuplicados.has(est.identificacion)
                      ? "#FFFBEB"
                      : undefined,
                  }}
                >
                  <td className="px-5 py-2.5">
                    <span
                      className="font-medium text-sm"
                      style={{ color: "var(--color-navy)" }}
                      title={est.identificacion}
                    >
                      {est.identificacion}
                      {estudiantesDuplicados.has(est.identificacion) && (
                        <span className="ml-1 text-[10px] font-bold" style={{ color: "#B45309" }}>
                          ⚠
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className="font-semibold text-xs px-2 py-0.5 rounded"
                      style={{ color: "var(--color-blue-mid)", backgroundColor: "#F3F0ED" }}
                    >
                      {grupo.promedio_bruto ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {est.notaPar !== undefined ? (
                      <span
                        className="font-bold text-xs px-2 py-0.5 rounded border"
                        style={{ color: "#15803D", backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }}
                      >
                        {est.notaPar}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--color-warm-gray)" }}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {est.notaAuto !== undefined ? (
                      <span
                        className="font-semibold text-xs px-2 py-0.5 rounded border"
                        style={{
                          color: "var(--color-blue-dark)",
                          backgroundColor: "#EEF2F5",
                          borderColor: "var(--color-blue-light)",
                        }}
                      >
                        {est.notaAuto}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--color-warm-gray)" }}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {est.factorCastigoNoEvaluo !== undefined ? (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={
                          est.factorCastigoNoEvaluo > 0
                            ? { color: "var(--color-primary-warm)", backgroundColor: "#FEF3EE", border: "1px solid #FBCAB4" }
                            : { color: "var(--color-warm-gray)" }
                        }
                      >
                        {est.factorCastigoNoEvaluo > 0
                          ? `-${(est.factorCastigoNoEvaluo * 100).toFixed(0)}%`
                          : "0%"}
                        {est.descuentoManual && (
                          <span className="ml-1 text-[9px] opacity-60">✎</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--color-warm-gray)" }}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {est.factorCastigoFueraGrupo !== undefined ? (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={
                          est.factorCastigoFueraGrupo > 0
                            ? { color: "var(--color-primary-mid)", backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }
                            : { color: "var(--color-warm-gray)" }
                        }
                      >
                        {est.factorCastigoFueraGrupo > 0
                          ? `-${(est.factorCastigoFueraGrupo * 100).toFixed(0)}%`
                          : "0%"}
                        {est.descuentoManual && (
                          <span className="ml-1 text-[9px] opacity-60">✎</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--color-warm-gray)" }}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {est.notaConDescuento !== undefined ? (
                      <span
                        className="font-bold text-white text-xs px-2.5 py-0.5 rounded shadow-sm"
                        style={{ backgroundColor: "var(--color-primary)" }}
                      >
                        {est.notaConDescuento}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--color-warm-gray)" }}>—</span>
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
}
