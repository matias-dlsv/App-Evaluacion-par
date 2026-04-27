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

export async function exportarCSVGrupo(curso: Curso, grupoNumero: string) {
  const grupo = curso.grupos.find(g => g.numero === grupoNumero);
  if (!grupo) throw new Error("Grupo no encontrado");

  const filas: string[][] = [
    ["Nombre", "Nota Bruta", "Ev. Par", "Desc. No Evaluó", "Desc. Grupo Ajeno", "Nota Final"]
  ];

  grupo.estudiantes.forEach(est => {
    filas.push([
      est.identificacion,
      grupo.promedio_bruto?.toString() ?? "",
      est.notaPar?.toString() ?? "",
      est.factorCastigoNoEvaluo?.toString() ?? "",
      est.factorCastigoFueraGrupo?.toString() ?? "",
      est.notaConDescuento?.toString() ?? "",
    ]);
  });

  const csv = filas.map(f => f.map(c => `"${c}"`).join(",")).join("\n");
  const filePath = await save({
    filters: [{ name: "CSV", extensions: ["csv"] }],
    defaultPath: `${curso.nombre} - Grupo ${grupoNumero}.csv`,
  });

  if (filePath) {
    const encoder = new TextEncoder();
    await writeFile(filePath, encoder.encode(csv));
    return true;
  }
  return false;
}

export async function exportarTodosCSVGrupos(curso: Curso) {
  const folder = await open({
    directory: true,
    title: "Selecciona dónde guardar la carpeta de resultados",
  });

  if (!folder) return false;

  const nombreCarpeta = `${curso.nombre.replace(/[\\/:*?"<>|]/g, '_')} - Grupos`;
  const rutaCarpeta = await join(folder as string, nombreCarpeta);

  await mkdir(rutaCarpeta, { recursive: true });

  const encoder = new TextEncoder();

  for (const grupo of curso.grupos) {
    const filas: string[][] = [
      ["Nombre", "Nota Bruta", "Ev. Par", "Desc. No Evaluó", "Desc. Grupo Ajeno", "Nota Final"]
    ];

    grupo.estudiantes.forEach(est => {
      filas.push([
        est.identificacion,
        grupo.promedio_bruto?.toString() ?? "",
        est.notaPar?.toString() ?? "",
        est.factorCastigoNoEvaluo?.toString() ?? "",
        est.factorCastigoFueraGrupo?.toString() ?? "",
        est.notaConDescuento?.toString() ?? "",
      ]);
    });

    const csv = filas.map(f => f.map(c => `"${c}"`).join(",")).join("\n");
    const rutaArchivo = await join(rutaCarpeta, `Grupo ${grupo.numero}.csv`);
    await writeFile(rutaArchivo, encoder.encode(csv));
  }

  return true;
}

export async function exportarAutoevaluaciones(curso: Curso) {
  const filas: string[][] = [
    ["Nombre", "Grupo", "Nota Autoevaluación", "Nota Par", "Diferencia (Auto - Par)"]
  ];

  const todosLosEstudiantes = curso.grupos.flatMap(g =>
    g.estudiantes.map(est => ({ est, grupo: g }))
  );

  todosLosEstudiantes.sort((a, b) =>
    a.est.identificacion.localeCompare(b.est.identificacion, 'es')
  );

  todosLosEstudiantes.forEach(({ est, grupo }) => {
    const notaAuto = est.notaAuto ?? null;
    const notaPar = est.notaPar ?? null;
    const diff =
      notaAuto !== null && notaPar !== null
        ? (Math.round((notaAuto - notaPar) * 100) / 100).toString()
        : "";

    filas.push([
      est.identificacion,
      grupo.numero,
      notaAuto !== null ? notaAuto.toString() : "Sin autoevaluación",
      notaPar !== null ? notaPar.toString() : "—",
      diff,
    ]);
  });

  const csv = filas.map(f => f.map(c => `"${c}"`).join(",")).join("\n");
  const filePath = await save({
    filters: [{ name: "CSV", extensions: ["csv"] }],
    defaultPath: `${curso.nombre} - Autoevaluaciones.csv`,
  });

  if (filePath) {
    const encoder = new TextEncoder();
    await writeFile(filePath, encoder.encode(csv));
    return true;
  }
  return false;
}