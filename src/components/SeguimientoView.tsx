// src/components/SeguimientoView.tsx
import { useState } from "react";
import { Curso } from "../utils/notas";
import { construirSeguimiento } from "../utils/notas";

interface SeguimientoViewProps {
  cursoData: Curso;
}

export function SeguimientoView({ cursoData }: SeguimientoViewProps) {
  const [busqueda, setBusqueda] = useState("");

  const seguimientoCompleto = construirSeguimiento(cursoData);
  const seguimientoFiltrado = busqueda.trim()
    ? seguimientoCompleto.filter((est) =>
        est.identificacion.toLowerCase().includes(busqueda.toLowerCase()),
      )
    : seguimientoCompleto;

  return (
    <div className="flex flex-col gap-4">
      {/* Searchbar */}
      {/* Leyenda */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0.4rem 0.75rem",
          backgroundColor: "#F7F5F3",
          borderRadius: 8,
          border: "0.5px solid var(--color-warm-gray)",
          width: "fit-content",
          fontSize: 12,
        }}
      >
        <span
          style={{
            color: "var(--color-blue-light)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Leyenda
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              background: "#C6EFCE",
              color: "#276221",
              fontWeight: "bold",
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            4.0
          </span>
          <span style={{ color: "var(--color-blue-light)" }}>
            Nota más alta
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              background: "#FFC7CE",
              color: "#9C0006",
              fontWeight: "bold",
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            3.1
          </span>
          <span style={{ color: "var(--color-blue-light)" }}>
            Nota más baja
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              background: "#F3F0ED",
              color: "var(--color-blue-mid)",
              fontWeight: "bold",
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            3.5
          </span>
          <span style={{ color: "var(--color-blue-light)" }}>
            Nota intermedia
          </span>
        </div>
      </div>
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
          placeholder="Buscar por estudiante..."
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

      <div
        className="bg-white rounded-xl shadow border overflow-x-auto"
        style={{ borderColor: "var(--color-warm-gray)" }}
      >
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr
              className="text-[10px] uppercase font-semibold"
              style={{
                backgroundColor: "#F7F5F3",
                color: "var(--color-blue-light)",
              }}
            >
              <th
                className="text-left px-5 py-3 border-b"
                style={{ borderColor: "var(--color-warm-gray)" }}
              >
                Alumno
              </th>
              {cursoData.evaluaciones.map((ev) => (
                <th
                  key={ev.id}
                  className="text-center px-4 py-3 border-b whitespace-nowrap"
                  style={{
                    borderColor: "var(--color-warm-gray)",
                    color: "var(--color-primary)",
                  }}
                >
                  {ev.nombre}
                  <br />
                  <span
                    className="font-normal"
                    style={{ color: "var(--color-blue-light)" }}
                  >
                    Nota Final
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seguimientoFiltrado.map((est, idx) => {
              const notas = est.evaluaciones
                .map((e) => e.notaFinal)
                .filter((n): n is number => n !== undefined);
              const maxNota = notas.length >= 2 ? Math.max(...notas) : null;
              const minNota = notas.length >= 2 ? Math.min(...notas) : null;

              return (
                <tr
                  key={idx}
                  className="border-b last:border-0"
                  style={{ borderColor: "#F3F0ED" }}
                >
                  <td className="px-5 py-2.5">
                    <span
                      className="font-medium text-sm"
                      style={{ color: "var(--color-navy)" }}
                    >
                      {est.identificacion}
                    </span>
                  </td>
                  {cursoData.evaluaciones.map((ev) => {
                    const datos = est.evaluaciones.find(
                      (e) => e.evalId === ev.id,
                    );
                    const nota = datos?.notaFinal;
                    const esMax =
                      nota !== undefined &&
                      nota === maxNota &&
                      maxNota !== minNota;
                    const esMin =
                      nota !== undefined &&
                      nota === minNota &&
                      maxNota !== minNota;
                    return (
                      <td key={ev.id} className="px-4 py-2.5 text-center">
                        {nota !== undefined ? (
                          <span
                            className="font-bold text-xs px-2 py-0.5 rounded"
                            style={
                              esMax
                                ? {
                                    backgroundColor: "#C6EFCE",
                                    color: "#276221",
                                  }
                                : esMin
                                  ? {
                                      backgroundColor: "#FFC7CE",
                                      color: "#9C0006",
                                    }
                                  : {
                                      backgroundColor: "#F3F0ED",
                                      color: "var(--color-blue-mid)",
                                    }
                            }
                          >
                            {nota}
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-warm-gray)" }}>
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {seguimientoFiltrado.length === 0 && (
              <tr>
                <td
                  colSpan={cursoData.evaluaciones.length + 1}
                  className="px-5 py-8 text-center text-sm"
                  style={{ color: "var(--color-blue-light)" }}
                >
                  No se encontraron estudiantes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
