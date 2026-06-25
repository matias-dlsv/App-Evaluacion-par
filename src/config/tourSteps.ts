export interface TourStep {
  title: string;
  content: string;
  target?: string;
  placement?: "auto" | "right"; // nuevo
}
// ── Tour 1: Vista de inicio (4 pasos) ────────────────────────────────────────
export const tourStepsInicio: TourStep[] = [
  {
    title: "Bienvenido a EquiPar",
    content:
      "Te guiaremos por los pasos básicos para comenzar a usar la plataforma. Haz clic en Siguiente para continuar.",
  },
  {
    title: "Paso 1 — Nombre del curso",
    content:
      "Escribe aquí el nombre de tu curso, por ejemplo: Neuromecánica, Biología, Cálculo…",
    target: "input-nombre-curso",
  },
  {
    title: "Paso 2 — Subir archivo",
    content:
      "Haz clic aquí para seleccionar el archivo Excel (.xls / .xlsx / .csv) con los datos de evaluación par.",
    target: "btn-subir-excel",
  },
  {
    title: "Paso 3 — Lista de cursos",
    content:
      "Los cursos que crees aparecerán aquí. Haz clic en cualquiera para abrirlo y gestionar sus evaluaciones.",
    target: "lista-cursos",
  },
];
export const tourStepsCurso: TourStep[] = [
  {
    title: "Vista del curso",
    content:
      "Aquí gestionas todo lo relacionado con un curso. Te explicamos las secciones principales.",
  },
  {
    title: "Evaluaciones",
    content:
      'Aquí aparecen las evaluaciones del curso. Puedes agregar más subiendo nuevos archivos Excel con el botón "+ Agregar Evaluación".',
    target: "tour-tabs-evaluaciones",
  },
  {
    title: "Configuración de castigos",
    content:
      "Ajusta los porcentajes de castigo por evaluar fuera del grupo o por no haber evaluado.",
    target: "tour-config-castigos",
  },
  {
    title: "Calcular notas",
    content:
      "Despúes de hacer cambios, presiona este botón para re-calcular las notas finales ajustadas por los criterios configurados.",
    target: "tour-btn-calcular",
  },
  {
    title: "Nota Bruta Rápida",
    content:
      "Desde aquí puedes asignar o modificar la nota bruta global de este grupo rápidamente sin abrir el desglose.",
    target: "tour-nota-rapida",
  },
  {
    title: "Ingresar al Editor Detallado",
    content:
      "Haz clic en 'Editar' para desplegar el formulario avanzado de alumnos, notas individuales y descuentos.",
    target: "tour-btn-editar",
    placement: "right", // nuevo
  },
  {
    title: "Vista de Seguimiento",
    content:
      "Cuando tienes 2 o más evaluaciones, aparece la pestaña \"Seguimiento\". Muestra la evolución de cada alumno a lo largo de todas las evaluaciones.",
    target: "tour-seguimiento",
  },
  {
    title: "Exportar resultados",
    content:
      "Desde aquí puedes exportar las notas calculadas a Excel. Desde la vista de Seguimiento puedes exportar el resumen de evolucion de los alumnos.",
    target: "tour-btn-exportar",
  },
];