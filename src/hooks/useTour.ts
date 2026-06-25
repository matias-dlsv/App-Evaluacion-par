// src/hooks/useTour.ts
import { useState } from "react";

export const useTour = () => {
  const [tourEnabled, setTourEnabled] = useState(() => {
    // Verificar si ya completó el tour
    return localStorage.getItem("equipar-tour-completed") !== "true";
  });

  const [tourIndex, setTourIndex] = useState(0);

  const completarTour = () => {
    localStorage.setItem("equipar-tour-completed", "true");
    setTourEnabled(false);
  };

  const reiniciarTour = () => {
    localStorage.removeItem("equipar-tour-completed");
    setTourEnabled(true);
    setTourIndex(0);
  };

  // Usamos 'any' aquí para saltarnos las discrepancias de versión de la librería
  const handleTourCallback = (data: any) => {
    if (!data) return;
    
    const { status, index } = data;
    
    if (status === "finished" || status === "skipped") {
      completarTour();
    } else {
      setTourIndex(index);
    }
  };

  return {
    tourEnabled,
    tourIndex,
    setTourIndex,
    handleTourCallback,
    reiniciarTour,
    completarTour,
  };
};