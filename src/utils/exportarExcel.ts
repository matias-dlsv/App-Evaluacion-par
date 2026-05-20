// src/utils/exportarExcel.ts
import ExcelJS from 'exceljs';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeFile, mkdir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { Curso, Evaluacion, construirSeguimiento } from './notas';

export async function exportarResultados(curso: Curso, evaluacion: Evaluacion) {
  try {
    const response = await fetch('/plantilla.xlsx');
    if (!response.ok) throw new Error("No se encontró la plantilla.xlsx.");

    const arrayBuffer = await response.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const sheet1 = workbook.getWorksheet('Lista y notas ponderadas');
    const sheet2 = workbook.getWorksheet('Notas evaluaciones par');
    const sheet3 = workbook.getWorksheet('Verificacion y castigos');

    if (!sheet1 || !sheet2 || !sheet3) {
      throw new Error("No se encontraron las hojas en la plantilla. Revisa los nombres.");
    }

    const mapaGrupos = new Map<string, number>();
    const todosLosEstudiantes: {
      nombre: string;
      grupo: number;
      notaGrupo: number;
      est: any;
    }[] = [];

    evaluacion.grupos.forEach(grupo => {
      const numeroGrupo = Number(grupo.numero) || 0;
      grupo.estudiantes.forEach(est => {
        mapaGrupos.set(est.identificacion.trim().toUpperCase(), numeroGrupo);
        todosLosEstudiantes.push({
          nombre: est.identificacion,
          grupo: numeroGrupo,
          notaGrupo: grupo.promedio_bruto || 0,
          est,
        });
      });
    });

    todosLosEstudiantes.sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base', numeric: true })
    );

    todosLosEstudiantes.forEach((item, i) => {
      const fila = i + 2;
      const est = item.est;
      sheet1.getCell(`A${fila}`).value = item.nombre;
      sheet1.getCell(`B${fila}`).value = item.grupo;
      sheet1.getCell(`C${fila}`).value = item.notaGrupo || null;
      sheet1.getCell(`D${fila}`).value = est.notaPar ?? null;
      sheet1.getCell(`E${fila}`).value = est.proporcionBase ?? null;
      sheet1.getCell(`F${fila}`).value = est.factorCastigoTotal ?? null;
      sheet1.getCell(`G${fila}`).value = est.proporcionConCastigo ?? null;
      sheet1.getCell(`H${fila}`).value = est.notaConDescuento ?? null;
    });

    todosLosEstudiantes.forEach((item, i) => {
      const fila = i + 3;
      const est = item.est;
      sheet2.getCell(`A${fila}`).value = item.nombre;
      sheet2.getCell(`B${fila}`).value = item.grupo;
      const notas: number[] = est.notasIndividualesPar || [];
      notas.forEach((nota, idx) => {
        if (idx < 5) {
          const col = String.fromCharCode(67 + idx);
          sheet2.getCell(`${col}${fila}`).value = nota;
        }
      });
      sheet2.getCell(`H${fila}`).value = est.notaPar ?? null;
    });

    todosLosEstudiantes.forEach((item, i) => {
      const fila = i + 3;
      const est = item.est;
      const nombresEvaluados: string[] = est.nombresEvaluados || [];

      const companerosTotales =
        evaluacion.grupos.find(g => Number(g.numero) === item.grupo)
          ?.estudiantes.length ?? 1;
      const companerosSinElMismo = Math.max(companerosTotales - 1, 0);

      sheet3.getCell(`A${fila}`).value = item.nombre;
      sheet3.getCell(`B${fila}`).value = item.grupo;

      nombresEvaluados.forEach((nombre, idx) => {
        if (idx < 6) {
          const col = String.fromCharCode(67 + idx);
          sheet3.getCell(`${col}${fila}`).value = nombre;
        }
      });

      const noEvaluados = Math.max(0, companerosSinElMismo - nombresEvaluados.length);
      sheet3.getCell(`I${fila}`).value = noEvaluados;
      sheet3.getCell(`J${fila}`).value = est.factorCastigoNoEvaluo ?? null;

      nombresEvaluados.forEach((nombre, idx) => {
        if (idx < 5) {
          const col = String.fromCharCode(75 + idx);
          const grupoEvaluado = mapaGrupos.get(nombre.trim().toUpperCase());
          const esValido = grupoEvaluado !== undefined && grupoEvaluado === item.grupo;
          sheet3.getCell(`${col}${fila}`).value = esValido ? "OK" : "Inválido";
        }
      });

      sheet3.getCell(`P${fila}`).value = est.factorCastigoFueraGrupo ?? null;
      sheet3.getCell(`Q${fila}`).value = est.factorCastigoTotal ?? null;
    });

    const bufferSalida = await workbook.xlsx.writeBuffer();
    const filePath = await save({
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
      defaultPath: `${curso.nombre} - ${evaluacion.nombre} - Resultados.xlsx`,
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

export async function exportarXLSXGrupo(
  curso: Curso,
  evaluacion: Evaluacion,
  grupoNumero: string
) {
  const grupo = evaluacion.grupos.find(g => g.numero === grupoNumero);
  if (!grupo) throw new Error("Grupo no encontrado");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Grupo ${grupoNumero}`);

  sheet.columns = [
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Nota Bruta', key: 'notaBruta', width: 14 },
    { header: 'Ev. Par', key: 'evPar', width: 12 },
    { header: 'Desc. No Evaluó', key: 'descNoEvaluo', width: 18 },
    { header: 'Desc. Grupo Ajeno', key: 'descGrupoAjeno', width: 20 },
    { header: 'Nota Final', key: 'notaFinal', width: 14 },
  ];

  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    cell.alignment = { horizontal: 'center' };
  });

  grupo.estudiantes.forEach(est => {
    sheet.addRow({
      nombre: est.identificacion,
      notaBruta: grupo.promedio_bruto ?? null,
      evPar: est.notaPar ?? null,
      descNoEvaluo: est.factorCastigoNoEvaluo ?? null,
      descGrupoAjeno: est.factorCastigoFueraGrupo ?? null,
      notaFinal: est.notaConDescuento ?? null,
    });
  });

  const bufferSalida = await workbook.xlsx.writeBuffer();
  const filePath = await save({
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    defaultPath: `${curso.nombre} - ${evaluacion.nombre} - Grupo ${grupoNumero}.xlsx`,
  });

  if (filePath) {
    await writeFile(filePath, new Uint8Array(bufferSalida));
    return true;
  }
  return false;
}

export async function exportarTodosXLSXGrupos(curso: Curso, evaluacion: Evaluacion) {
  const folder = await open({
    directory: true,
    title: "Selecciona dónde guardar la carpeta de resultados",
  });

  if (!folder) return false;

  const nombreCarpeta = `${curso.nombre.replace(/[\\/:*?"<>|]/g, '_')} - ${evaluacion.nombre} - Grupos`;
  const rutaCarpeta = await join(folder as string, nombreCarpeta);

  await mkdir(rutaCarpeta, { recursive: true });

  for (const grupo of evaluacion.grupos) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Grupo ${grupo.numero}`);

    sheet.columns = [
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Nota Bruta', key: 'notaBruta', width: 14 },
      { header: 'Ev. Par', key: 'evPar', width: 12 },
      { header: 'Desc. No Evaluó', key: 'descNoEvaluo', width: 18 },
      { header: 'Desc. Grupo Ajeno', key: 'descGrupoAjeno', width: 20 },
      { header: 'Nota Final', key: 'notaFinal', width: 14 },
    ];

    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, name: 'Arial' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      cell.alignment = { horizontal: 'center' };
    });

    grupo.estudiantes.forEach(est => {
      sheet.addRow({
        nombre: est.identificacion,
        notaBruta: grupo.promedio_bruto ?? null,
        evPar: est.notaPar ?? null,
        descNoEvaluo: est.factorCastigoNoEvaluo ?? null,
        descGrupoAjeno: est.factorCastigoFueraGrupo ?? null,
        notaFinal: est.notaConDescuento ?? null,
      });
    });

    const bufferSalida = await workbook.xlsx.writeBuffer();
    const rutaArchivo = await join(rutaCarpeta, `Grupo ${grupo.numero}.xlsx`);
    await writeFile(rutaArchivo, new Uint8Array(bufferSalida));
  }

  return true;
}

export async function exportarAutoevaluaciones(curso: Curso, evaluacion: Evaluacion) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Autoevaluaciones');

  sheet.columns = [
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Grupo', key: 'grupo', width: 10 },
    { header: 'Nota Autoevaluación', key: 'notaAuto', width: 22 },
    { header: 'Nota Par', key: 'notaPar', width: 14 },
    { header: 'Diferencia (Auto - Par)', key: 'diferencia', width: 24 },
  ];

  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    cell.alignment = { horizontal: 'center' };
  });

  const todosLosEstudiantes = evaluacion.grupos.flatMap(g =>
    g.estudiantes.map(est => ({ est, grupo: g }))
  );

  todosLosEstudiantes.sort((a, b) => {
    const difA =
      a.est.notaAuto != null && a.est.notaPar != null
        ? a.est.notaAuto - a.est.notaPar
        : -Infinity;
    const difB =
      b.est.notaAuto != null && b.est.notaPar != null
        ? b.est.notaAuto - b.est.notaPar
        : -Infinity;
    return difB - difA;
  });

  todosLosEstudiantes.forEach(({ est, grupo }) => {
    const notaAuto = est.notaAuto ?? null;
    const notaPar = est.notaPar ?? null;
    const diferencia =
      notaAuto !== null && notaPar !== null
        ? Math.round((notaAuto - notaPar) * 100) / 100
        : null;

    sheet.addRow({
      nombre: est.identificacion,
      grupo: grupo.numero,
      notaAuto: notaAuto !== null ? notaAuto : 'Sin autoevaluación',
      notaPar: notaPar !== null ? notaPar : '—',
      diferencia: diferencia !== null ? diferencia : '',
    });
  });

  const bufferSalida = await workbook.xlsx.writeBuffer();
  const filePath = await save({
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    defaultPath: `${curso.nombre} - ${evaluacion.nombre} - Autoevaluaciones.xlsx`,
  });

  if (filePath) {
    await writeFile(filePath, new Uint8Array(bufferSalida));
    return true;
  }
  return false;
}

/**
 * Exporta el seguimiento longitudinal.
 *
 * Estructura:
 *   Fila 1: "NOMBRE Y APELLIDO" (rowspan 2) | por cada evaluación: nombre mergeado
 *           en 4 columnas | "PROMEDIO EVALUACIONES" (rowspan 2, al final)
 *   Fila 2: subencabezados por evaluación: "NOTA GRUPO", "NOTA EVALUACION PAR",
 *            "FACTOR CASTIGO", "NOTA FINAL"
 *   Filas 3+: datos, ordenados alfabéticamente.
 */
export async function exportarSeguimiento(curso: Curso) {
  const seguimiento = construirSeguimiento(curso);
  const numEvals = curso.evaluaciones.length;
  // 1 col nombre + 4 cols × nEvals + 1 col promedio
  const totalCols = 1 + numEvals * 4 + 1;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Seguimiento');

  // ── Estilos reutilizables ───────────────────────────────────────────────────
  const styleHeader = (cell: ExcelJS.Cell, opts?: { bold?: boolean; color?: string }) => {
  cell.font = { bold: opts?.bold ?? true, name: 'Arial', size: 9, color: { argb: opts?.color ?? 'FF374151' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = {
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  };
};

  // ── Fila 1: cabeceras agrupadas por evaluación ──────────────────────────────
  // Col A queda vacía en fila 1 (rowSpan 2 se aplica abajo via merge)
  curso.evaluaciones.forEach((ev, idx) => {
    const startCol = 2 + idx * 4;
    const endCol = startCol + 3;
    const cell = sheet.getRow(1).getCell(startCol);
    cell.value = ev.nombre.toUpperCase();
    styleHeader(cell);
    sheet.mergeCells(1, startCol, 1, endCol);
  });

  // ── Fila 2: subencabezados ──────────────────────────────────────────────────
  const fila2 = sheet.getRow(2);
  const subHeaders = ['NOTA GRUPO', 'NOTA EV. PAR', 'FACTOR CASTIGO', 'NOTA FINAL'];
  const subColors = ['FF6B7280', 'FF6B7280', 'FF6B7280', 'FFCE0019'];

  curso.evaluaciones.forEach((_ev, idx) => {
    const startCol = 2 + idx * 4;
    subHeaders.forEach((h, hIdx) => {
      const cell = fila2.getCell(startCol + hIdx);
      cell.value = h;
      styleHeader(cell, { color: subColors[hIdx] });
    });
  });

  // ── Merge rowspan para "NOMBRE Y APELLIDO" (col A, filas 1-2) ──────────────
  sheet.mergeCells(1, 1, 2, 1);
  const cellNombre = sheet.getRow(1).getCell(1);
  cellNombre.value = 'NOMBRE Y APELLIDO';
  styleHeader(cellNombre);
cellNombre.alignment = { horizontal: 'left', vertical: 'middle' };
  cellNombre.alignment = { horizontal: 'left', vertical: 'middle' };

  // ── Columna Promedio (última columna, merge filas 1-2) ─────────────────────
  const promedioCol = totalCols;
  sheet.mergeCells(1, promedioCol, 2, promedioCol);
  const cellPromedio = sheet.getRow(1).getCell(promedioCol);
  cellPromedio.value = 'PROMEDIO\nEVALUACIONES';
  styleHeader(cellPromedio);
  cellPromedio.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  // Altura de las dos filas de cabecera
  sheet.getRow(1).height = 28;
  sheet.getRow(2).height = 28;

  // ── Anchos de columna ───────────────────────────────────────────────────────
  sheet.getColumn(1).width = 38; // Nombre
  for (let i = 2; i <= totalCols - 1; i++) {
    const posEnBloque = (i - 2) % 4;
    // 0=nota grupo, 1=nota par, 2=factor castigo, 3=nota final
    sheet.getColumn(i).width = posEnBloque === 1 ? 18 : 14;
  }
  sheet.getColumn(totalCols).width = 16; // Promedio

  // ── Filas de datos ──────────────────────────────────────────────────────────
  seguimiento.forEach((est, rowIdx) => {
    const filaNum = 3 + rowIdx;
    const fila = sheet.getRow(filaNum);

    // Nombre
    const cNombre = fila.getCell(1);
    cNombre.value = est.identificacion;
    cNombre.font = { name: 'Arial', size: 9 };
    cNombre.alignment = { horizontal: 'left', vertical: 'middle' };
    cNombre.border = { right: { style: 'thin', color: { argb: 'FFD1D5DB' } } };

    // Datos por evaluación
    curso.evaluaciones.forEach((ev, idx) => {
      const startCol = 2 + idx * 4;
      const datos = est.evaluaciones.find((e) => e.evalId === ev.id);

      const vals = [
        datos?.notaGrupo ?? null,
        datos?.notaPar ?? null,
        datos?.factorCastigoTotal ?? null,
        datos?.notaFinal ?? null,
      ];

      vals.forEach((val, vIdx) => {
  const cell = fila.getCell(startCol + vIdx);
  cell.value = val;
  cell.font = { name: 'Arial', size: 9, bold: vIdx === 3 };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  if (vIdx === 3) {
    cell.border = { right: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
  }
});
    });

    // Calcular promedio de notas finales disponibles
    const notasFinales = est.evaluaciones
      .map((e) => e.notaFinal)
      .filter((n): n is number => n !== undefined);
    const promedio =
      notasFinales.length > 0
        ? Math.round((notasFinales.reduce((a, b) => a + b, 0) / notasFinales.length) * 10) / 10
        : null;

    const cProm = fila.getCell(promedioCol);
    cProm.value = promedio;
cProm.font = { name: 'Arial', size: 9, bold: true };
cProm.alignment = { horizontal: 'center', vertical: 'middle' };
cProm.border = { left: { style: 'thin', color: { argb: 'FFC3D3E8' } } };

    fila.height = 16;
  });

  // ── Guardar ─────────────────────────────────────────────────────────────────
  const bufferSalida = await workbook.xlsx.writeBuffer();
  const filePath = await save({
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    defaultPath: `${curso.nombre} - Seguimiento.xlsx`,
  });

  if (filePath) {
    await writeFile(filePath, new Uint8Array(bufferSalida));
    return true;
  }
  return false;
}