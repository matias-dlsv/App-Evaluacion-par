// src/utils/exportarExcel.ts
import ExcelJS from 'exceljs';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { Curso } from './notas';

export async function exportarResultados(curso: Curso) {
  try {
    const response = await fetch('/plantilla.xlsx');
    if (!response.ok) throw new Error("No se encontró la plantilla.xlsx.");
    
    const arrayBuffer = await response.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const sheet1 = workbook.getWorksheet('Lista y notas ponderadas');
    const sheet2 = workbook.getWorksheet('Notas evaluaciones par');
    const sheet3 = workbook.getWorksheet('Verificacion y castigos'); // HOJA 3
    
    if (!sheet1 || !sheet2 || !sheet3) {
      throw new Error("No se encontraron las hojas en la plantilla. Revisa los nombres.");
    }

    // --- MAPA PARA VERIFICAR GRUPOS RÁPIDAMENTE ---
    const mapaGrupos = new Map<string, number>();

    let todosLosEstudiantes: { nombre: string, grupo: number, notaGrupo: number, estCompleto: any }[] = [];
    
    curso.grupos.forEach(grupo => {
      const numeroGrupo = Number(grupo.numero) || 0; 
      
      grupo.estudiantes.forEach(est => {
        // Normalizamos el nombre (mayúsculas, sin espacios extra) para que la comparación sea perfecta
        const nombreNormalizado = est.identificacion.trim().toUpperCase();
        mapaGrupos.set(nombreNormalizado, numeroGrupo);

        todosLosEstudiantes.push({
          nombre: est.identificacion,
          grupo: numeroGrupo,
          notaGrupo: grupo.promedio_bruto || 0,
          estCompleto: est 
        });
      });
    });

    todosLosEstudiantes.sort((a, b) => a.grupo - b.grupo);

    // --- LLENAR HOJA 1 ---
    let filaSheet1 = 2; 
    todosLosEstudiantes.forEach(est => {
      sheet1.getCell(`A${filaSheet1}`).value = est.nombre;
      sheet1.getCell(`B${filaSheet1}`).value = est.grupo;
      sheet1.getCell(`C${filaSheet1}`).value = est.notaGrupo;
      filaSheet1++;
    });

    // --- LLENAR HOJA 2 ---
    let filaSheet2 = 3; 
    todosLosEstudiantes.forEach(est => {
      sheet2.getCell(`A${filaSheet2}`).value = est.nombre;
      sheet2.getCell(`B${filaSheet2}`).value = est.grupo;

      const datosEstudiante = est.estCompleto;
      if (datosEstudiante.notasIndividualesPar) {
        datosEstudiante.notasIndividualesPar.forEach((notaIndividual: number, indice: number) => {
          if (indice < 5) { 
            const letraColumna = String.fromCharCode(67 + indice); // C, D, E...
            sheet2.getCell(`${letraColumna}${filaSheet2}`).value = notaIndividual;
          }
        });
      }
      sheet2.getCell(`H${filaSheet2}`).value = datosEstudiante.notaPar || "";
      filaSheet2++;
    });

    // --- LLENAR HOJA 3: Verificación y castigos ---
    let filaSheet3 = 3; // Basado en tu imagen, empieza en fila 3
    todosLosEstudiantes.forEach(est => {
      sheet3.getCell(`A${filaSheet3}`).value = est.nombre;
      sheet3.getCell(`B${filaSheet3}`).value = est.grupo;

      const nombresEvaluados = est.estCompleto.nombresEvaluados || [];

      nombresEvaluados.forEach((nombreEvaluado: string, indice: number) => {
        if (indice < 5) {
          // Escribir el nombre del evaluado en C, D, E, F, G (Ascii 67 a 71)
          const letraColEvaluado = String.fromCharCode(67 + indice); 
          sheet3.getCell(`${letraColEvaluado}${filaSheet3}`).value = nombreEvaluado;

          // Escribir la validación en J, K, L, M, N (Ascii 74 a 78)
          const letraColAdecuado = String.fromCharCode(74 + indice);
          
          // Verificamos si pertenecen al mismo grupo consultando el Mapa
          const grupoDelEvaluado = mapaGrupos.get(nombreEvaluado.trim().toUpperCase());
          let validacion = "Inválido";
          
          if (grupoDelEvaluado !== undefined && grupoDelEvaluado === est.grupo) {
            validacion = "OK";
          }

          sheet3.getCell(`${letraColAdecuado}${filaSheet3}`).value = validacion;
        }
      });

      filaSheet3++;
    });

    // --- GUARDAR ---
    const bufferSalida = await workbook.xlsx.writeBuffer();
    const filePath = await save({
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
      defaultPath: `${curso.nombre} - Resultados.xlsx`
    });

    if (filePath) {
      await writeFile(filePath, new Uint8Array(bufferSalida));
      return true; 
    }
    return false; 
  } catch (error) {
    console.error("Error al exportar:", error);
    throw error;
  }
}