// src/components/SimpleTour.tsx
import { useEffect, useState, useRef } from "react";

export interface TourStep {
  title: string;
  content: string;
  target?: string;
  placement?: "auto" | "right";
}

interface Props {
  steps: TourStep[];
  run: boolean;
  onFinish: () => void;
}

// ── Constantes de layout ──────────────────────────────────────────────────────
const CARD_W = 320;
const CARD_H_EST = 210;
const MARGIN = 14;
const HIGHLIGHT_PADDING = 6; // px extra alrededor del elemento destacado

// ── Estilos de animación inyectados una sola vez ──────────────────────────────
const CSS_ID = "simple-tour-styles";
function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement("style");
  style.id = CSS_ID;
  style.textContent = `
    @keyframes tourRingPulse {
      0%   { box-shadow: 0 0 0 0px rgba(206,0,25,0.55), 0 0 0 0px rgba(206,0,25,0.25); }
      60%  { box-shadow: 0 0 0 5px rgba(206,0,25,0.35), 0 0 0 12px rgba(206,0,25,0.10); }
      100% { box-shadow: 0 0 0 6px rgba(206,0,25,0.0),  0 0 0 14px rgba(206,0,25,0.0); }
    }
    .tour-highlight-ring {
      outline: 2.5px solid #ce0019 !important;
      outline-offset: ${HIGHLIGHT_PADDING}px !important;
      border-radius: 8px !important;
      animation: tourRingPulse 1.4s ease-out infinite !important;
      position: relative;
      z-index: 9999 !important;
    }
  `;
  document.head.appendChild(style);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function computePos(
  rect: DOMRect,
  placement: "auto" | "right" = "auto",
): { top: number; left: number } {
  if (placement === "right") {
    const top = Math.min(
      Math.max(MARGIN, rect.top),
      window.innerHeight - CARD_H_EST - MARGIN,
    );
    // Intenta poner a la derecha; si no cabe, pone a la izquierda
    const leftRight = rect.right + MARGIN;
    const leftLeft = rect.left - CARD_W - MARGIN;
    const left =
      leftRight + CARD_W + MARGIN <= window.innerWidth ? leftRight : leftLeft;
    return { top, left };
  }

  // "auto": arriba o abajo
  const spaceBelow = window.innerHeight - rect.bottom;
  const top =
    spaceBelow >= CARD_H_EST + MARGIN
      ? rect.bottom + MARGIN
      : Math.max(MARGIN, rect.top - CARD_H_EST - MARGIN);
  const left = Math.min(
    Math.max(MARGIN, rect.left),
    window.innerWidth - CARD_W - MARGIN,
  );
  return { top, left };
}

// ── Componente ────────────────────────────────────────────────────────────────
export function SimpleTour({ steps, run, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const prevElRef = useRef<Element | null>(null);

  // Inyectar estilos una vez
  useEffect(() => {
    injectStyles();
  }, []);

  // Reiniciar al activar
  useEffect(() => {
    if (run) setIndex(0);
  }, [run]);

  // Posicionar tooltip y aplicar highlight al elemento target
  useEffect(() => {
    // Quitar highlight anterior
    if (prevElRef.current) {
      prevElRef.current.classList.remove("tour-highlight-ring");
      prevElRef.current = null;
    }

    if (!run) return;

    const step = steps[index];
    if (!step.target) {
      setPos(null);
      return;
    }

    const el = document.querySelector(`[data-tour='${step.target}']`);
    if (!el) {
      setPos(null);
      return;
    }

    // Aplicar highlight
    el.classList.add("tour-highlight-ring");
    prevElRef.current = el;

    // Hacer scroll para asegurarse de que el elemento sea visible
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Calcular posición del tooltip
    // Esperar un tick por si scrollIntoView cambió las coordenadas
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      setPos(computePos(rect, step.placement ?? "auto"));
    });
  }, [index, run, steps]);

  // Limpiar highlight al desmontar o al terminar
  useEffect(() => {
    return () => {
      if (prevElRef.current) {
        prevElRef.current.classList.remove("tour-highlight-ring");
        prevElRef.current = null;
      }
    };
  }, []);

  if (!run) return null;

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const isCentered = !step.target || !pos;

  const finish = () => {
    if (prevElRef.current) {
      prevElRef.current.classList.remove("tour-highlight-ring");
      prevElRef.current = null;
    }
    setIndex(0);
    onFinish();
  };

  const cardStyle: React.CSSProperties = isCentered
    ? {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10000,
        width: CARD_W,
      }
    : {
        position: "fixed",
        top: pos!.top,
        left: pos!.left,
        zIndex: 10000,
        width: CARD_W,
      };

  return (
    <>
      {/* Overlay semi-transparente — clic cierra */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.42)",
          zIndex: 9997,
        }}
        onClick={finish}
      />

      {/* Tooltip */}
      <div
        style={{
          ...cardStyle,
          backgroundColor: "white",
          borderRadius: 12,
          padding: "20px 22px",
          boxShadow:
            "0 4px 6px rgba(0,0,0,0.07), 0 12px 36px rgba(206,0,25,0.15)",
          fontFamily: "sans-serif",
          border: "1.5px solid #fecdd3",
        }}
        // Evitar que el clic en el card cierre el tour
        onClick={(e) => e.stopPropagation()}
      >
        {/* Contador */}
        <p
          style={{
            fontSize: 11,
            color: "#ce0019",
            fontWeight: 700,
            marginBottom: 6,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Paso {index + 1} de {steps.length}
        </p>

        {/* Barra de progreso */}
        <div
          style={{
            height: 3,
            backgroundColor: "#fecdd3",
            borderRadius: 99,
            marginBottom: 14,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${((index + 1) / steps.length) * 100}%`,
              backgroundColor: "#ce0019",
              borderRadius: 99,
              transition: "width 0.3s ease",
            }}
          />
        </div>

        <h3
          style={{
            margin: "0 0 8px",
            color: "#1a1a2e",
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.3,
          }}
        >
          {step.title}
        </h3>
        <p
          style={{
            margin: "0 0 18px",
            color: "#555",
            fontSize: 13.5,
            lineHeight: 1.55,
          }}
        >
          {step.content}
        </p>

        {/* Acciones */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            onClick={finish}
            style={{
              background: "none",
              border: "none",
              color: "#aaa",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
              padding: 0,
            }}
          >
            Saltar tutorial
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => i - 1)}
                style={{
                  background: "none",
                  border: "1.5px solid #ce0019",
                  color: "#ce0019",
                  borderRadius: 7,
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                ← Atrás
              </button>
            )}
            <button
              onClick={() => {
                if (isLast) finish();
                else setIndex((i) => i + 1);
              }}
              style={{
                backgroundColor: "#ce0019",
                color: "white",
                border: "none",
                borderRadius: 7,
                padding: "6px 16px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                boxShadow: "0 2px 8px rgba(206,0,25,0.25)",
              }}
            >
              {isLast ? "Finalizar ✓" : "Siguiente →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
