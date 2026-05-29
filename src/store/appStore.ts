// src/store/appStore.ts
import { create } from "zustand";
import { Curso } from "../utils/notas";

interface AppState {
  cursos: Curso[];
  agregarCurso: (curso: Curso) => void;
  actualizarCurso: (cursoActualizado: Curso) => void;
  eliminarCurso: (id: string) => void;
  setCursos: (cursos: Curso[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  cursos: [],
  agregarCurso: (curso) =>
    set((state) => ({ cursos: [...state.cursos, curso] })),
  actualizarCurso: (cursoActualizado) =>
    set((state) => ({
      cursos: state.cursos.map((c) =>
        c.id === cursoActualizado.id ? cursoActualizado : c,
      ),
    })),
  eliminarCurso: (id) =>
    set((state) => ({
      cursos: state.cursos.filter((c) => c.id !== id),
    })),
  setCursos: (cursos) => set({ cursos }),
}));