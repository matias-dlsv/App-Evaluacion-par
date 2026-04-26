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
    pub nota_promedio: Option<f64>, // None = sin evaluaciones válidas recibidas
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

/// Devuelve índices de columnas que tienen al menos un valor Data::Float o Data::Int
/// en las filas de datos, excluyendo las columnas reservadas (evaluado/evaluador/grupo).
fn detectar_columnas_criterio(
    rows: &[Vec<Data>],
    reservadas: &HashSet<usize>,
    total_cols: usize,
) -> Vec<usize> {
    let mut conteo: Vec<usize> = vec![0; total_cols];
    for row in rows.iter().skip(1) {
        for col_idx in 0..total_cols {
            if reservadas.contains(&col_idx) {
                continue;
            }
            if let Some(celda) = row.get(col_idx) {
                if matches!(celda, Data::Float(_) | Data::Int(_)) {
                    conteo[col_idx] += 1;
                }
            }
        }
    }
    let mut criterios: Vec<usize> = conteo
        .iter()
        .enumerate()
        .filter(|&(idx, &cnt)| !reservadas.contains(&idx) && cnt > 0)
        .map(|(idx, _)| idx)
        .collect();
    criterios.sort();
    criterios
}

/// Detecta el valor máximo presente en las columnas criterio.
/// Ese valor es el techo de la escala del formulario (ej: 4, 8, 10…).
/// Así el mapeo a escala 1–7 es flexible sin configuración manual.
fn detectar_escala_max(rows: &[Vec<Data>], criterios: &[usize]) -> f64 {
    let mut max_val: f64 = 1.0; // fallback seguro
    for row in rows.iter().skip(1) {
        for &col in criterios {
            if let Some(celda) = row.get(col) {
                let v = match celda {
                    Data::Float(n) => Some(*n),
                    Data::Int(n) => Some(*n as f64),
                    _ => None,
                };
                if let Some(val) = v {
                    if val > max_val {
                        max_val = val;
                    }
                }
            }
        }
    }
    max_val
}

/// Mapea un valor crudo de la escala del formulario a la escala 1–7.
/// escala_max es el techo detectado (ej: 4.0, 8.0, 10.0…).
#[inline]
fn a_escala_7(valor: f64, escala_max: f64) -> f64 {
    1.0 + (valor / escala_max) * 6.0
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

        let mut evaluado_idx: Option<usize> = None;
        let mut evaluador_idx: Option<usize> = None;
        let mut grupo_idx: Option<usize> = None;
        let mut reservadas: HashSet<usize> = HashSet::new();

        if let Some(header) = rows.first() {
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
                }
            }
        }

        let total_cols = rows.first().map(|r| r.len()).unwrap_or(0);
        let indices_criterios = detectar_columnas_criterio(&rows, &reservadas, total_cols);
        let escala_max = detectar_escala_max(&rows, &indices_criterios);

        let mut datos_por_grupo: HashMap<String, HashMap<String, (f64, usize, Vec<f64>)>> =
            HashMap::new();
        let mut estudiante_a_grupo: HashMap<String, String> = HashMap::new();

        for (i, row) in rows.iter().enumerate() {
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
                if let Some(celda) = row.get(c) {
                    match celda {
                        Data::Float(n) => {
                            suma += n;
                            count += 1;
                        }
                        Data::Int(n) => {
                            suma += *n as f64;
                            count += 1;
                        }
                        _ => {}
                    }
                }
            }

            if count > 0 && !evaluado.is_empty() {
                let prom_crudo = suma / count as f64;
                let prom_7 = a_escala_7(prom_crudo, escala_max);
                let redondeado = (prom_7 * 10.0).round() / 10.0;
                let entrada = datos_por_grupo
                    .entry(grupo.clone())
                    .or_default()
                    .entry(evaluado.clone())
                    .or_insert((0.0, 0, Vec::new()));
                entrada.0 += prom_7;
                entrada.1 += 1;
                entrada.2.push(redondeado);
            }
        }

        for (estudiante, grupo) in &estudiante_a_grupo {
            datos_por_grupo
                .entry(grupo.clone())
                .or_default()
                .entry(estudiante.clone())
                .or_insert((0.0, 0, Vec::new()));
        }

        let mut grupos: Vec<Grupo> = datos_por_grupo
            .into_iter()
            .map(|(numero, estudiantes_map)| {
                let mut estudiantes: Vec<Estudiante> = estudiantes_map
                    .into_iter()
                    .map(|(id, _)| Estudiante { identificacion: id })
                    .collect();
                estudiantes.sort_by(|a, b| a.identificacion.cmp(&b.identificacion));
                Grupo {
                    numero,
                    promedio_bruto: None,
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

        let mut evaluado_idx = None;
        let mut evaluador_idx = None;
        let mut grupo_idx = None;
        let mut reservadas: HashSet<usize> = HashSet::new();

        if let Some(header) = rows.first() {
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
                }
            }
        }

        let total_cols = rows.first().map(|r| r.len()).unwrap_or(0);
        let indices_criterios = detectar_columnas_criterio(&rows, &reservadas, total_cols);
        let escala_max = detectar_escala_max(&rows, &indices_criterios);

        let mut persona_a_grupo: HashMap<String, String> = HashMap::new();

        // Pasada 1: mapa persona->grupo
        for (i, row) in rows.iter().enumerate() {
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

        // Pasada 2: calcular notas filtrando evaluaciones inválidas
        // Las sumas se acumulan ya en escala 1–7 para que el promedio final
        // también quede en esa escala sin conversión adicional.
        let mut resumen: HashMap<String, (f64, usize, Vec<f64>, String)> = HashMap::new();
        let mut evaluaciones_invalidas: HashMap<String, usize> = HashMap::new();
        let mut a_quienes_evaluo_validos: HashMap<String, Vec<String>> = HashMap::new();

        for (i, row) in rows.iter().enumerate() {
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
                    if let Some(celda) = row.get(c) {
                        match celda {
                            Data::Float(n) => {
                                suma += n;
                                count += 1;
                            }
                            Data::Int(n) => {
                                suma += *n as f64;
                                count += 1;
                            }
                            _ => {}
                        }
                    }
                }

                if count > 0 {
                    let prom_crudo = suma / count as f64;
                    let prom_7 = a_escala_7(prom_crudo, escala_max);
                    let redondeado = (prom_7 * 10.0).round() / 10.0;
                    let entrada = resumen.entry(evaluado.clone()).or_insert((
                        0.0,
                        0,
                        Vec::new(),
                        grupo_evaluado.clone(),
                    ));
                    entrada.0 += prom_7;  // acumular en escala 7
                    entrada.1 += 1;
                    entrada.2.push(redondeado);
                }
            }
        }

        let todos: HashSet<String> = resumen
            .keys()
            .cloned()
            .chain(persona_a_grupo.keys().cloned())
            .collect();

        let resultados = todos
            .into_iter()
            .map(|est| {
                let (suma, cantidad, notas, _) =
                    resumen
                        .get(&est)
                        .cloned()
                        .unwrap_or((0.0, 0, vec![], String::new()));

                let nombres_evaluados = a_quienes_evaluo_validos
                    .get(&est)
                    .cloned()
                    .unwrap_or_default();

                let invalidas = evaluaciones_invalidas.get(&est).copied().unwrap_or(0);
                let grupo_real = persona_a_grupo.get(&est).cloned().unwrap_or_default();

                super::NotaEstudiante {
                    identificacion: est,
                    // suma ya está en escala 7, solo dividir por cantidad
                    nota_promedio: if cantidad > 0 {
                        Some((suma / cantidad as f64 * 10.0).round() / 10.0)
                    } else {
                        None
                    },
                    cantidad_evaluaciones: cantidad,
                    notas_individuales: notas,
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