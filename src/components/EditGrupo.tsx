// src/components/EditGrupo.tsx
import { useState } from "react";
import { Grupo, Estudiante } from "../utils/notas";
import { BtnEliminar } from "./BtnEliminar";
import { nuevoEstudiante } from "../utils/helpers";

interface EditGrupoProps {
  grupo: Grupo;
  onSave: (g: Grupo) => void;
  onCancel: () => void;
}

export function EditGrupo({ grupo, onSave, onCancel }: EditGrupoProps) {
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
      const esDescuento =
        field === "factorCastigoFueraGrupo" ||
        field === "factorCastigoNoEvaluo";
      const numFields = ["notaPar", "evaluaciones"];
      const numFieldsPct = ["factorCastigoFueraGrupo", "factorCastigoNoEvaluo"];
      let parsedVal: string | number | undefined;
      if (numFieldsPct.includes(field as string)) {
        parsedVal = val === "" ? undefined : Math.round(parseFloat(val)) / 100;
      } else if (numFields.includes(field as string)) {
        parsedVal = val === "" ? undefined : parseFloat(val);
      } else {
        parsedVal = val;
      }
      ests[idx] = {
        ...ests[idx],
        [field]: parsedVal,
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
    <div
      className="flex flex-col gap-6 p-6 border-t"
      style={{ backgroundColor: "#FFF5F5", borderColor: "#D6D1CA" }}
    >
      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-bold uppercase"
            style={{ color: "var(--color-blue-mid)" }}
          >
            Nota bruta del grupo
          </label>
          <input
            type="number"
            step="0.1"
            min="1"
            max="7"
            value={draft.promedio_bruto ?? ""}
            onChange={(e) => setPromedio(e.target.value)}
            className="w-28 p-2 border rounded text-sm text-center outline-none bg-white"
            style={{ borderColor: "var(--color-warm-gray)" }}
            onFocus={(e) =>
              (e.target.style.boxShadow = "0 0 0 2px var(--color-primary)")
            }
            onBlur={(e) => (e.target.style.boxShadow = "")}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr
              className="uppercase text-xs border-b-2 bg-white"
              style={{
                color: "var(--color-blue-mid)",
                borderColor: "var(--color-warm-gray)",
              }}
            >
              <th className="text-left py-3 pr-3 font-semibold">Alumno</th>
              <th className="text-center py-3 px-2 font-semibold whitespace-nowrap">
                Nota Bruta
              </th>
              <th className="text-center py-3 px-2 font-semibold whitespace-nowrap">
                Ev. Par
              </th>
              <th
                className="text-center py-3 px-2 font-semibold whitespace-nowrap"
                style={{ color: "var(--color-blue-light)" }}
              >
                Auto
                <br />
                Eval.
              </th>
              <th
                className="text-center py-3 px-2 font-semibold whitespace-nowrap"
                style={{ color: "var(--color-primary-warm)" }}
              >
                Desc.
                <br />
                No Evaluó (%)
              </th>
              <th
                className="text-center py-3 px-2 font-semibold whitespace-nowrap"
                style={{ color: "var(--color-primary-mid)" }}
              >
                Desc.
                <br />
                Grupo Ajeno (%)
              </th>
              <th
                className="text-center py-3 px-2 font-semibold whitespace-nowrap"
                style={{ color: "var(--color-primary)" }}
              >
                Nota Final
              </th>
              <th className="py-3 w-6" />
            </tr>
          </thead>
          <tbody>
            {draft.estudiantes.map((est, idx) => (
              <tr
                key={idx}
                className="border-b last:border-0"
                style={{ borderColor: "#F3F0ED" }}
              >
                <td className="py-2 pr-3">
                  <input
                    value={est.identificacion}
                    onChange={(e) =>
                      setEst(idx, "identificacion", e.target.value)
                    }
                    placeholder="Nombre o ID"
                    className="w-full p-1.5 border rounded text-sm outline-none bg-white min-w-[140px]"
                    style={{ borderColor: "var(--color-warm-gray)" }}
                  />
                </td>
                <td className="py-2 px-2 text-center">
                  <span
                    className="text-sm font-semibold px-2 py-1 rounded"
                    style={{
                      color: "var(--color-blue-mid)",
                      backgroundColor: "#F3F0ED",
                    }}
                  >
                    {draft.promedio_bruto ?? "—"}
                  </span>
                </td>
                <td className="py-2 px-2">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max="7"
                    value={est.notaPar ?? ""}
                    onChange={(e) => setEst(idx, "notaPar", e.target.value)}
                    placeholder="—"
                    className="w-16 p-1.5 border rounded text-sm text-center outline-none bg-white block mx-auto"
                    style={{ borderColor: "var(--color-warm-gray)" }}
                  />
                </td>
                <td className="py-2 px-2 text-center">
                  {est.notaAuto !== undefined ? (
                    <span
                      className="text-sm font-semibold px-2 py-1 rounded border"
                      style={{
                        color: "var(--color-blue-dark)",
                        backgroundColor: "#EEF2F5",
                        borderColor: "var(--color-blue-light)",
                      }}
                    >
                      {est.notaAuto}
                    </span>
                  ) : (
                    <span
                      className="text-sm"
                      style={{ color: "var(--color-warm-gray)" }}
                    >
                      —
                    </span>
                  )}
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={
                        est.factorCastigoNoEvaluo !== undefined
                          ? Math.round(est.factorCastigoNoEvaluo * 100)
                          : ""
                      }
                      onChange={(e) =>
                        setEst(idx, "factorCastigoNoEvaluo", e.target.value)
                      }
                      placeholder="0"
                      className="w-20 p-1.5 border rounded text-sm text-center outline-none bg-white block mx-auto"
                      style={{ borderColor: "#CA3625" }}
                    />
                    <span
                      className="text-xs font-bold"
                      style={{ color: "#CA3625" }}
                    >
                      %
                    </span>
                  </div>
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={
                        est.factorCastigoFueraGrupo !== undefined
                          ? Math.round(est.factorCastigoFueraGrupo * 100)
                          : ""
                      }
                      onChange={(e) =>
                        setEst(idx, "factorCastigoFueraGrupo", e.target.value)
                      }
                      placeholder="0"
                      className="w-20 p-1.5 border rounded text-sm text-center outline-none bg-white block mx-auto"
                      style={{ borderColor: "var(--color-primary-mid)" }}
                    />
                    <span
                      className="text-xs font-bold"
                      style={{ color: "var(--color-primary-mid)" }}
                    >
                      %
                    </span>
                  </div>
                </td>
                <td className="py-2 px-2 text-center">
                  {est.notaConDescuento !== undefined ? (
                    <span
                      className="text-sm font-bold text-white px-2.5 py-1 rounded"
                      style={{ backgroundColor: "var(--color-primary)" }}
                    >
                      {est.notaConDescuento}
                    </span>
                  ) : (
                    <span
                      className="text-sm italic"
                      style={{ color: "var(--color-warm-gray)" }}
                    >
                      —
                    </span>
                  )}
                </td>
                <td className="py-2 pl-1">
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
        className="self-start flex items-center gap-2 text-sm font-semibold hover:underline cursor-pointer"
        style={{ color: "var(--color-primary)" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
        </svg>
        Añadir estudiante
      </button>

      <div
        className="flex gap-3 pt-3 border-t"
        style={{ borderColor: "var(--color-warm-gray)" }}
      >
        <button
          onClick={() => onSave(draft)}
          className="px-6 py-2.5 text-white text-sm font-bold rounded transition cursor-pointer shadow"
          style={{ backgroundColor: "var(--color-primary)" }}
          onMouseOver={(e) =>
            ((e.target as HTMLElement).style.backgroundColor =
              "var(--color-primary-hover)")
          }
          onMouseOut={(e) =>
            ((e.target as HTMLElement).style.backgroundColor =
              "var(--color-primary)")
          }
        >
          Guardar cambios
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2.5 bg-white text-sm font-semibold rounded border transition cursor-pointer"
          style={{
            color: "var(--color-blue-mid)",
            borderColor: "var(--color-warm-gray)",
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
