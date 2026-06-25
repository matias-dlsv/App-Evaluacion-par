// src/hooks/useTour.ts
import { useState, useEffect } from "react";

const TOUR_INICIO_KEY = "equipar_tour_inicio_done";
const TOUR_CURSO_KEY = "equipar_tour_curso_done";

export function useTourInicio() {
  const [tourEnabled, setTourEnabled] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_INICIO_KEY);
    if (!done) setTourEnabled(true);
  }, []);

  const completarTour = () => {
    localStorage.setItem(TOUR_INICIO_KEY, "1");
    setTourEnabled(false);
  };

  const reiniciarTour = () => setTourEnabled(true);

  return { tourEnabled, completarTour, reiniciarTour };
}

export function useTourCurso() {
  const [tourEnabled, setTourEnabled] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_CURSO_KEY);
    if (!done) {
      // Pequeño delay para que el DOM del CursoView esté montado
      const t = setTimeout(() => setTourEnabled(true), 300);
      return () => clearTimeout(t);
    }
  }, []);

  const completarTour = () => {
    localStorage.setItem(TOUR_CURSO_KEY, "1");
    setTourEnabled(false);
  };

  const reiniciarTour = () => setTourEnabled(true);

  return { tourEnabled, completarTour, reiniciarTour };
}