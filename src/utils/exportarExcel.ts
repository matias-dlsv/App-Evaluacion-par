// src/utils/exportarExcel.ts
import ExcelJS from 'exceljs';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeFile, mkdir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
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

    curso.grupos.forEach(grupo => {
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
        curso.grupos.find(g => Number(g.numero) === item.grupo)
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
      defaultPath: `${curso.nombre} - Resultados.xlsx`,
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

export async function exportarXLSXGrupo(curso: Curso, grupoNumero: string) {
  const grupo = curso.grupos.find(g => g.numero === grupoNumero);
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

  // Estilo del encabezado
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
    defaultPath: `${curso.nombre} - Grupo ${grupoNumero}.xlsx`,
  });

  if (filePath) {
    await writeFile(filePath, new Uint8Array(bufferSalida));
    return true;
  }
  return false;
}

export async function exportarTodosXLSXGrupos(curso: Curso) {
  const folder = await open({
    directory: true,
    title: "Selecciona dónde guardar la carpeta de resultados",
  });

  if (!folder) return false;

  const nombreCarpeta = `${curso.nombre.replace(/[\\/:*?"<>|]/g, '_')} - Grupos`;
  const rutaCarpeta = await join(folder as string, nombreCarpeta);

  await mkdir(rutaCarpeta, { recursive: true });

  for (const grupo of curso.grupos) {
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

export async function exportarAutoevaluaciones(curso: Curso) {
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

  const todosLosEstudiantes = curso.grupos.flatMap(g =>
    g.estudiantes.map(est => ({ est, grupo: g }))
  );

  // Ordenar de mayor a menor diferencia (Auto - Par).
  // Alumnos sin ambas notas quedan al final.
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
    defaultPath: `${curso.nombre} - Autoevaluaciones.xlsx`,
  });

  if (filePath) {
    await writeFile(filePath, new Uint8Array(bufferSalida));
    return true;
  }
  return false;
}