use calamine::{open_workbook_auto, Data, Reader};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::Read;

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
    pub nota_promedio: Option<f64>,
    pub cantidad_evaluaciones: usize,
    pub notas_individuales: Vec<f64>,
    pub nombres_evaluados: Vec<String>,
    pub grupo: String,
    pub evaluaciones_invalidas: usize,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AutoEvaluacion {
    pub identificacion: String,
    pub grupo: String,
    pub nota_auto: Option<f64>,
}

fn limpiar_grupo_id(dato: &Data) -> String {
    let s = dato.to_string().trim().to_string();
    if s.ends_with(".0") {
        s.replace(".0", "")
    } else {
        s
    }
}

/// Detecta los índices de las columnas clave (evaluador, evaluado, grupo) y marca
/// como reservadas todas las columnas que NO son criterios de puntaje, incluyendo
/// columnas de metadatos (timestamp, correo, comentarios) que en CSV se leen como
/// Float y confundirían a `detectar_columnas_criterio`.
struct IndicesColumnas {
    evaluado: Option<usize>,
    evaluador: Option<usize>,
    grupo: Option<usize>,
    reservadas: HashSet<usize>,
}

fn detectar_indices_columnas(header: &[Data]) -> IndicesColumnas {
    let mut evaluado = None;
    let mut evaluador = None;
    let mut grupo = None;
    let mut reservadas: HashSet<usize> = HashSet::new();

    for (col_idx, celda) in header.iter().enumerate() {
        let enc = celda
            .to_string()
            .trim()
            .to_uppercase()
            .replace('\n', " ")
            .replace('\r', "");

        if enc.contains("EVALUADO") && !enc.contains("EVALUADOR") {
            evaluado = Some(col_idx);
            reservadas.insert(col_idx);
        } else if enc.contains("EVALUADOR") {
            evaluador = Some(col_idx);
            reservadas.insert(col_idx);
        } else if enc == "GRUPO" {
            grupo = Some(col_idx);
            reservadas.insert(col_idx);
        } else if enc.contains("TEMPORAL")      // "Marca temporal" → Float en CSV
            || enc.contains("TIMESTAMP")
            || enc.contains("FECHA")
            || enc.contains("CORREO")           // "Dirección de correo electrónico"
            || enc.contains("EMAIL")
            || enc.contains("MAIL")
            || enc.contains("COMENTARIO")       // "¿Desea agregar algún comentario?"
            || enc.contains("COMMENT")
            || enc.contains("DESEA")
            || enc.contains("AGREGAR")
        {
            // Columnas de metadatos: en Excel pueden ser Date/String, pero en CSV
            // el timestamp llega como Float grande (p.ej. 45913.7…) y contaminaría
            // los cálculos de criterios si no se excluye explícitamente.
            reservadas.insert(col_idx);
        }
    }

    IndicesColumnas {
        evaluado,
        evaluador,
        grupo,
        reservadas,
    }
}

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

fn detectar_escala_max(rows: &[Vec<Data>], criterios: &[usize]) -> f64 {
    let mut max_val: f64 = 1.0;
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

/// Abre el archivo (xlsx, xls o csv) y devuelve todas las filas como Vec<Vec<Data>>.
/// Para CSV normaliza el separador ';' → ',' escribiendo un archivo temporal,
/// ya que open_workbook_auto detecta CSV por extensión y solo acepta coma.
fn abrir_como_rows(ruta: &str) -> Result<Vec<Vec<Data>>, String> {
    let extension = std::path::Path::new(ruta)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if extension == "csv" {
        let mut contenido = String::new();
        File::open(ruta)
            .map_err(|e| format!("Error al abrir CSV: {:?}", e))?
            .read_to_string(&mut contenido)
            .map_err(|e| format!("Error al leer CSV: {:?}", e))?;

        let usa_punto_coma = contenido
            .lines()
            .next()
            .map(|l| l.contains(';') && !l.contains(','))
            .unwrap_or(false);

        let contenido_normalizado = if usa_punto_coma {
            contenido.replace(';', ",")
        } else {
            contenido
        };

        let ruta_tmp = std::env::temp_dir().join("equipar_tmp_import.csv");
        std::fs::write(&ruta_tmp, contenido_normalizado.as_bytes())
            .map_err(|e| format!("Error al escribir CSV temporal: {:?}", e))?;

        let mut workbook =
            open_workbook_auto(&ruta_tmp).map_err(|e| format!("Error al parsear CSV: {:?}", e))?;
        let sheet_name = workbook.sheet_names().first().cloned().ok_or("CSV vacío")?;
        let range = workbook
            .worksheet_range(&sheet_name)
            .map_err(|e| format!("Error al leer CSV: {:?}", e))?;
        Ok(range.rows().map(|r| r.to_vec()).collect())
    } else {
        let mut workbook =
            open_workbook_auto(ruta).map_err(|e| format!("Error al abrir el archivo: {:?}", e))?;
        let sheet_name = workbook
            .sheet_names()
            .first()
            .cloned()
            .ok_or("El archivo está vacío")?;
        let range = workbook
            .worksheet_range(&sheet_name)
            .map_err(|e| format!("Error al leer la pestaña: {:?}", e))?;
        Ok(range.rows().map(|r| r.to_vec()).collect())
    }
}

pub mod comandos {
    use super::*;
    use tauri::command;

    #[command]
    pub fn procesar_respuestas(ruta: String) -> Result<Vec<Grupo>, String> {
        let rows = abrir_como_rows(&ruta)?;

        let idx = rows
            .first()
            .map(|h| detectar_indices_columnas(h))
            .ok_or("El archivo está vacío")?;

        let total_cols = rows.first().map(|r| r.len()).unwrap_or(0);
        let indices_criterios = detectar_columnas_criterio(&rows, &idx.reservadas, total_cols);

        let mut datos_por_grupo: HashMap<String, HashMap<String, (f64, usize, Vec<f64>)>> =
            HashMap::new();
        let mut estudiante_a_grupo: HashMap<String, String> = HashMap::new();

        for (i, row) in rows.iter().enumerate() {
            if i == 0 {
                continue;
            }

            let evaluado = idx
                .evaluado
                .and_then(|i| row.get(i))
                .map(|d| d.to_string().trim().replace('/', " "))
                .unwrap_or_default();

            let evaluador = idx
                .evaluador
                .and_then(|i| row.get(i))
                .map(|d| d.to_string().trim().replace('/', " "))
                .unwrap_or_default();

            let grupo = idx
                .grupo
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
                let redondeado = (prom_crudo * 10.0).round() / 10.0;
                let entrada = datos_por_grupo
                    .entry(grupo.clone())
                    .or_default()
                    .entry(evaluado.clone())
                    .or_insert((0.0, 0, Vec::new()));
                entrada.0 += prom_crudo;
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
        let rows = abrir_como_rows(&ruta)?;

        let idx = rows
            .first()
            .map(|h| detectar_indices_columnas(h))
            .ok_or("El archivo está vacío")?;

        let total_cols = rows.first().map(|r| r.len()).unwrap_or(0);
        let indices_criterios = detectar_columnas_criterio(&rows, &idx.reservadas, total_cols);
        let escala_max = detectar_escala_max(&rows, &indices_criterios);

        let mut persona_a_grupo: HashMap<String, String> = HashMap::new();

        for (i, row) in rows.iter().enumerate() {
            if i == 0 {
                continue;
            }
            let evaluado = idx
                .evaluado
                .and_then(|i| row.get(i))
                .map(|d| d.to_string().trim().replace('/', " "))
                .unwrap_or_default();
            let evaluador = idx
                .evaluador
                .and_then(|i| row.get(i))
                .map(|d| d.to_string().trim().replace('/', " "))
                .unwrap_or_default();
            let grupo = idx
                .grupo
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

        let mut resumen: HashMap<String, (f64, usize, Vec<f64>, String)> = HashMap::new();
        let mut evaluaciones_invalidas: HashMap<String, usize> = HashMap::new();
        let mut a_quienes_evaluo_validos: HashMap<String, Vec<String>> = HashMap::new();

        for (i, row) in rows.iter().enumerate() {
            if i == 0 {
                continue;
            }

            let evaluado = idx
                .evaluado
                .and_then(|i| row.get(i))
                .map(|d| d.to_string().trim().replace('/', " "))
                .unwrap_or_default();
            let evaluador = idx
                .evaluador
                .and_then(|i| row.get(i))
                .map(|d| d.to_string().trim().replace('/', " "))
                .unwrap_or_default();
            let grupo_evaluado = idx
                .grupo
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
                    let redondeado = (prom_crudo * 10.0).round() / 10.0;
                    let entrada = resumen.entry(evaluado.clone()).or_insert((
                        0.0,
                        0,
                        Vec::new(),
                        grupo_evaluado.clone(),
                    ));
                    entrada.0 += prom_crudo;
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
                    nota_promedio: if cantidad > 0 {
                        Some((suma / cantidad as f64 * 10.0).round() / 10.0)
                    } else {
                        Some(escala_max)
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

    #[command]
    pub fn obtener_autoevaluaciones(ruta: String) -> Result<Vec<super::AutoEvaluacion>, String> {
        let rows = abrir_como_rows(&ruta)?;

        let idx = rows
            .first()
            .map(|h| detectar_indices_columnas(h))
            .ok_or("El archivo está vacío")?;

        let total_cols = rows.first().map(|r| r.len()).unwrap_or(0);
        let indices_criterios = detectar_columnas_criterio(&rows, &idx.reservadas, total_cols);

        let mut autoevaluaciones: HashMap<String, (f64, String)> = HashMap::new();

        for (i, row) in rows.iter().enumerate() {
            if i == 0 {
                continue;
            }

            let evaluado = idx
                .evaluado
                .and_then(|i| row.get(i))
                .map(|d| d.to_string().trim().replace('/', " "))
                .unwrap_or_default();
            let evaluador = idx
                .evaluador
                .and_then(|i| row.get(i))
                .map(|d| d.to_string().trim().replace('/', " "))
                .unwrap_or_default();
            let grupo = idx
                .grupo
                .and_then(|i| row.get(i))
                .map(|d| limpiar_grupo_id(d))
                .unwrap_or_default();

            // Solo filas donde el evaluador se evaluó a sí mismo
            if evaluado.is_empty() || evaluador.is_empty() || evaluado != evaluador {
                continue;
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

            if count > 0 {
                let nota = (suma / count as f64 * 10.0).round() / 10.0;
                autoevaluaciones.insert(evaluado, (nota, grupo));
            }
        }

        let resultados = autoevaluaciones
            .into_iter()
            .map(|(id, (nota, grupo))| super::AutoEvaluacion {
                identificacion: id,
                grupo,
                nota_auto: Some(nota),
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
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            comandos::procesar_respuestas,
            comandos::obtener_notas_par,
            comandos::obtener_autoevaluaciones,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
