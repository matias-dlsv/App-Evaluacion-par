use calamine::{open_workbook_auto, Data, Reader};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Serialize, Deserialize, Debug)]
pub struct Estudiante {
    pub identificacion: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Grupo {
    pub numero: String,
    pub promedio_bruto: Option<f64>,
    pub estudiantes: Vec<Estudiante>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NotaEstudiante {
    pub identificacion: String,
    pub nota_promedio: f64,
    pub cantidad_evaluaciones: usize,
    pub notas_individuales: Vec<f64>,
    pub nombres_evaluados: Vec<String>,
    pub grupo: String,
    pub evaluaciones_invalidas: usize,
}

fn limpiar_grupo_id(dato: &Data) -> String {
    let s = dato.to_string().trim().to_string();
    if s.ends_with(".0") {
        s.replace(".0", "")
    } else {
        s
    }
}

/// Dado el encabezado de una columna, determina si debe excluirse del cálculo de criterios.
/// Se excluyen las columnas reservadas (EVALUADO, EVALUADOR, GRUPO) y cualquier columna
/// cuyo encabezado no sea vacío pero tampoco sea parseable como número en los datos reales.
/// La detección real de columnas numéricas se hace en una pasada sobre los datos.
fn es_columna_reservada(enc: &str) -> bool {
    let enc = enc.trim().to_uppercase();
    enc.contains("EVALUADO") || enc.contains("EVALUADOR") || enc == "GRUPO"
}

/// Recorre las filas de datos (saltando la cabecera) y devuelve los índices de columnas
/// que tienen al menos un valor numérico válido, excluyendo las columnas reservadas.
fn detectar_columnas_numericas(
    rows: &[&[Data]],
    reservadas: &HashSet<usize>,
    total_cols: usize,
) -> Vec<usize> {
    let mut candidatas: HashSet<usize> = HashSet::new();
    for row in rows.iter().skip(1) {
        // skip header
        for col_idx in 0..total_cols {
            if reservadas.contains(&col_idx) {
                continue;
            }
            if let Some(celda) = row.get(col_idx) {
                let s = celda.to_string();
                if s.replace(',', ".").trim().parse::<f64>().is_ok() {
                    candidatas.insert(col_idx);
                }
            }
        }
    }
    let mut v: Vec<usize> = candidatas.into_iter().collect();
    v.sort();
    v
}

pub mod comandos {
    use super::*;
    use tauri::command;

    #[command]
    pub fn procesar_respuestas(ruta: String) -> Result<Vec<Grupo>, String> {
        let mut workbook =
            open_workbook_auto(&ruta).map_err(|e| format!("Error al abrir el Excel: {:?}", e))?;

        let sheet_name = workbook
            .sheet_names()
            .first()
            .cloned()
            .ok_or("El Excel está vacío")?;

        let range = workbook
            .worksheet_range(&sheet_name)
            .map_err(|e| format!("Error al leer la pestaña: {:?}", e))?;

        let rows: Vec<Vec<Data>> = range.rows().map(|r| r.to_vec()).collect();
        let rows_ref: Vec<&[Data]> = rows.iter().map(|r| r.as_slice()).collect();

        let mut evaluado_idx: Option<usize> = None;
        let mut evaluador_idx: Option<usize> = None;
        let mut grupo_idx: Option<usize> = None;
        let mut reservadas: HashSet<usize> = HashSet::new();

        // Pasada 1: detectar columnas reservadas por encabezado
        if let Some(header) = rows_ref.first() {
            for (col_idx, celda) in header.iter().enumerate() {
                let enc = celda
                    .to_string()
                    .trim()
                    .to_uppercase()
                    .replace('\n', " ")
                    .replace('\r', "");

                if enc.contains("EVALUADO") && !enc.contains("EVALUADOR") {
                    evaluado_idx = Some(col_idx);
                    reservadas.insert(col_idx);
                } else if enc.contains("EVALUADOR") {
                    evaluador_idx = Some(col_idx);
                    reservadas.insert(col_idx);
                } else if enc == "GRUPO" {
                    grupo_idx = Some(col_idx);
                    reservadas.insert(col_idx);
                } else if es_columna_reservada(&enc) {
                    reservadas.insert(col_idx);
                }
            }
        }

        let total_cols = rows_ref.first().map(|r| r.len()).unwrap_or(0);
        let indices_criterios = detectar_columnas_numericas(&rows_ref, &reservadas, total_cols);

        let mut datos_por_grupo: HashMap<String, HashMap<String, (f64, usize, Vec<f64>)>> =
            HashMap::new();
        let mut estudiante_a_grupo: HashMap<String, String> = HashMap::new();

        // Pasada 2: acumular sumas y encontrar el máximo por fila
        let mut max_posible: f64 = 0.0; // máximo acumulado observado en una sola fila

        for (i, row) in rows_ref.iter().enumerate() {
            if i == 0 {
                continue;
            }

            let evaluado = evaluado_idx
                .and_then(|i| row.get(i))
                .map(|d| d.to_string().trim().replace('/', " "))
                .unwrap_or_default();

            let evaluador = evaluador_idx
                .and_then(|i| row.get(i))
                .map(|d| d.to_string().trim().replace('/', " "))
                .unwrap_or_default();

            let grupo = grupo_idx
                .and_then(|i| row.get(i))
                .map(|d| limpiar_grupo_id(d))
                .unwrap_or_default();

            if (evaluado.is_empty() && evaluador.is_empty()) || grupo.is_empty() {
                continue;
            }

            if !evaluado.is_empty() {
                estudiante_a_grupo
                    .entry(evaluado.clone())
                    .or_insert_with(|| grupo.clone());
            }
            if !evaluador.is_empty() {
                estudiante_a_grupo
                    .entry(evaluador.clone())
                    .or_insert_with(|| grupo.clone());
            }

            let mut suma = 0.0;
            let mut count = 0;
            for &c in &indices_criterios {
                let val = row.get(c).map(|d| d.to_string()).unwrap_or_default();
                if let Ok(n) = val.replace(',', ".").parse::<f64>() {
                    suma += n;
                    count += 1;
                }
            }

            if count > 0 {
                // Rastrear el máximo promedio observado (sin normalizar aún)
                let prom_fila = suma / count as f64;
                if prom_fila > max_posible {
                    max_posible = prom_fila;
                }

                if !evaluado.is_empty() {
                    let redondeado = (prom_fila * 10.0).round() / 10.0;
                    let entrada = datos_por_grupo
                        .entry(grupo.clone())
                        .or_default()
                        .entry(evaluado.clone())
                        .or_insert((0.0, 0, Vec::new()));
                    entrada.0 += prom_fila;
                    entrada.1 += 1;
                    entrada.2.push(redondeado);
                }
            }
        }

        // Asegurar que todos los estudiantes conocidos aparezcan en su grupo
        for (estudiante, grupo) in &estudiante_a_grupo {
            datos_por_grupo
                .entry(grupo.clone())
                .or_default()
                .entry(estudiante.clone())
                .or_insert((0.0, 0, Vec::new()));
        }

        // max_posible nunca debe ser 0 para evitar división por cero
        let escala = if max_posible > 0.0 { max_posible } else { 1.0 };

        let mut grupos: Vec<Grupo> = datos_por_grupo
            .into_iter()
            .map(|(numero, estudiantes_map)| {
                // Calcular promedio bruto del grupo normalizado al máximo observado
                let promedios: Vec<f64> = estudiantes_map
                    .values()
                    .filter(|(_, cant, _)| *cant > 0)
                    .map(|(suma, cant, _)| (suma / *cant as f64) / escala * 5.0)
                    .collect();

                let promedio_bruto = if promedios.is_empty() {
                    None
                } else {
                    let p = promedios.iter().sum::<f64>() / promedios.len() as f64;
                    Some((p * 10.0).round() / 10.0)
                };

                let mut estudiantes: Vec<Estudiante> = estudiantes_map
                    .into_iter()
                    .map(|(id, _)| Estudiante { identificacion: id })
                    .collect();
                estudiantes.sort_by(|a, b| a.identificacion.cmp(&b.identificacion));
                Grupo {
                    numero,
                    promedio_bruto,
                    estudiantes,
                }
            })
            .collect();

        grupos.sort_by(|a, b| {
            let na = a.numero.parse::<f64>().unwrap_or(0.0);
            let nb = b.numero.parse::<f64>().unwrap_or(0.0);
            na.partial_cmp(&nb).unwrap()
        });

        Ok(grupos)
    }

    #[command]
    pub fn obtener_notas_par(ruta: String) -> Result<Vec<super::NotaEstudiante>, String> {
        let mut workbook =
            open_workbook_auto(&ruta).map_err(|e| format!("Error al abrir: {:?}", e))?;

        let sheet_name = workbook
            .sheet_names()
            .first()
            .cloned()
            .ok_or("Excel vacío")?;

        let range = workbook
            .worksheet_range(&sheet_name)
            .map_err(|e| format!("Error: {:?}", e))?;

        let rows: Vec<Vec<Data>> = range.rows().map(|r| r.to_vec()).collect();
        let rows_ref: Vec<&[Data]> = rows.iter().map(|r| r.as_slice()).collect();

        let mut evaluado_idx = None;
        let mut evaluador_idx = None;
        let mut grupo_idx = None;
        let mut reservadas: HashSet<usize> = HashSet::new();

        // Pasada 1: encabezados
        if let Some(header) = rows_ref.first() {
            for (col_idx, celda) in header.iter().enumerate() {
                let enc = celda.to_string().trim().to_uppercase().replace('\n', " ");
                if enc.contains("EVALUADO") && !enc.contains("EVALUADOR") {
                    evaluado_idx = Some(col_idx);
                    reservadas.insert(col_idx);
                } else if enc.contains("EVALUADOR") {
                    evaluador_idx = Some(col_idx);
                    reservadas.insert(col_idx);
                } else if enc == "GRUPO" {
                    grupo_idx = Some(col_idx);
                    reservadas.insert(col_idx);
                } else if es_columna_reservada(&enc) {
                    reservadas.insert(col_idx);
                }
            }
        }

        let total_cols = rows_ref.first().map(|r| r.len()).unwrap_or(0);
        let indices_criterios = detectar_columnas_numericas(&rows_ref, &reservadas, total_cols);

        let mut persona_a_grupo: HashMap<String, String> = HashMap::new();

        // Pasada 1b: mapa persona->grupo
        for (i, row) in rows_ref.iter().enumerate() {
            if i == 0 {
                continue;
            }
            let evaluado = evaluado_idx
                .and_then(|i| row.get(i))
                .map(|d| d.to_string().trim().replace('/', " "))
                .unwrap_or_default();
            let evaluador = evaluador_idx
                .and_then(|i| row.get(i))
                .map(|d| d.to_string().trim().replace('/', " "))
                .unwrap_or_default();
            let grupo = grupo_idx
                .and_then(|i| row.get(i))
                .map(|d| limpiar_grupo_id(d))
                .unwrap_or_default();

            if !grupo.is_empty() {
                if !evaluado.is_empty() {
                    persona_a_grupo.entry(evaluado).or_insert(grupo.clone());
                }
                if !evaluador.is_empty() {
                    persona_a_grupo.entry(evaluador).or_insert(grupo.clone());
                }
            }
        }

        // Pasada 2: calcular notas filtrando inválidas y rastrear máximo
        let mut resumen: HashMap<String, (f64, usize, Vec<f64>, String)> = HashMap::new();
        let mut evaluaciones_invalidas: HashMap<String, usize> = HashMap::new();
        let mut a_quienes_evaluo_validos: HashMap<String, Vec<String>> = HashMap::new();
        let mut max_promedio_fila: f64 = 0.0;

        for (i, row) in rows_ref.iter().enumerate() {
            if i == 0 {
                continue;
            }

            let evaluado = evaluado_idx
                .and_then(|i| row.get(i))
                .map(|d| d.to_string().trim().replace('/', " "))
                .unwrap_or_default();
            let evaluador = evaluador_idx
                .and_then(|i| row.get(i))
                .map(|d| d.to_string().trim().replace('/', " "))
                .unwrap_or_default();
            let grupo_evaluado = grupo_idx
                .and_then(|i| row.get(i))
                .map(|d| limpiar_grupo_id(d))
                .unwrap_or_default();

            if evaluado.is_empty() {
                continue;
            }

            let grupo_evaluador = persona_a_grupo.get(&evaluador).cloned().unwrap_or_default();
            let es_valida = !evaluador.is_empty()
                && !grupo_evaluador.is_empty()
                && grupo_evaluador == grupo_evaluado;

            if !evaluador.is_empty()
                && !grupo_evaluador.is_empty()
                && grupo_evaluador != grupo_evaluado
            {
                *evaluaciones_invalidas.entry(evaluador.clone()).or_insert(0) += 1;
            }

            if es_valida {
                a_quienes_evaluo_validos
                    .entry(evaluador.clone())
                    .or_default()
                    .push(evaluado.clone());

                let mut suma = 0.0;
                let mut count = 0;
                for &c in &indices_criterios {
                    let val = row.get(c).map(|d| d.to_string()).unwrap_or_default();
                    if let Ok(n) = val.replace(',', ".").parse::<f64>() {
                        suma += n;
                        count += 1;
                    }
                }

                if count > 0 {
                    let prom = suma / count as f64;
                    // Rastrear el máximo promedio por fila observado
                    if prom > max_promedio_fila {
                        max_promedio_fila = prom;
                    }
                    let redondeado = (prom * 10.0).round() / 10.0;
                    let entrada = resumen.entry(evaluado.clone()).or_insert((
                        0.0,
                        0,
                        Vec::new(),
                        grupo_evaluado.clone(),
                    ));
                    entrada.0 += prom;
                    entrada.1 += 1;
                    entrada.2.push(redondeado);
                }
            }
        }

        // El puntaje máximo es el mayor promedio de criterios observado entre todas las filas
        // válidas. Si no hubo ninguna fila válida, evitamos división por cero con 1.0.
        let escala = if max_promedio_fila > 0.0 {
            max_promedio_fila
        } else {
            1.0
        };

        let todos: HashSet<String> = resumen
            .keys()
            .cloned()
            .chain(persona_a_grupo.keys().cloned())
            .collect();

        let resultados = todos
            .into_iter()
            .map(|est| {
                let (suma, cantidad, notas_brutas, _) =
                    resumen
                        .get(&est)
                        .cloned()
                        .unwrap_or((0.0, 0, vec![], String::new()));

                // Normalizar notas individuales al máximo observado, escalado a 5.0
                let notas_normalizadas: Vec<f64> = notas_brutas
                    .iter()
                    .map(|&n| ((n / escala * 5.0) * 10.0).round() / 10.0)
                    .collect();

                let nombres_evaluados = a_quienes_evaluo_validos
                    .get(&est)
                    .cloned()
                    .unwrap_or_default();

                let invalidas = evaluaciones_invalidas.get(&est).copied().unwrap_or(0);

                let grupo_real = persona_a_grupo.get(&est).cloned().unwrap_or_default();

                let nota_final = if cantidad > 0 {
                    // Promedio de sumas brutas normalizado al máximo, en escala 0-5
                    ((suma / cantidad as f64) / escala * 5.0 * 10.0).round() / 10.0
                } else {
                    // Sin evaluaciones: nota neutra en escala 0-5
                    0.0
                };

                super::NotaEstudiante {
                    identificacion: est,
                    nota_promedio: nota_final,
                    cantidad_evaluaciones: cantidad,
                    notas_individuales: notas_normalizadas,
                    nombres_evaluados,
                    grupo: grupo_real,
                    evaluaciones_invalidas: invalidas,
                }
            })
            .collect();

        Ok(resultados)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            comandos::procesar_respuestas,
            comandos::obtener_notas_par,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
