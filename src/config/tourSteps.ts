// src/config/tourSteps.ts
import { Step } from "react-joyride";

export const tourSteps: Step[] = [
  {
    target: "body",
    content: "¡Bienvenido a EquiPar! Te guiaremos a través de los pasos básicos.",
    placement: "center",
    title: "Bienvenida",
  },
  {
    target: "[data-tour='input-nombre-curso']",
    content: "Aquí debes ingresar el nombre de tu curso. Ej: Neuromecánica, Biología, etc.",
    placement: "bottom",
    title: "Paso 1: Nombre del Curso",
  },
  {
    target: "[data-tour='btn-subir-excel']",
    content: "Haz clic aquí para seleccionar un archivo Excel con la evaluación par.",
    placement: "bottom",
    title: "Paso 2: Subir Archivo",
  },
  {
    target: "[data-tour='lista-cursos']",
    content: "Después de crear el curso, aparecerá aquí. Haz clic para entrar al curso.",
    placement: "left",
    title: "Paso 3: Acceder al Curso",
  },
  {
    target: "[data-tour='grupo-card']",
    content: "Aquí verás los grupos. Haz clic para añadir notas a los estudiantes.",
    placement: "right",
    title: "Paso 4: Trabajar con Grupos",
  },
];