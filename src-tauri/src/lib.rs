use calamine::{open_workbook_auto, Data, Reader};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

// =====================================================================
// 1. ESTRUCTURAS DE DATOS
// =====================================================================

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
}

// =====================================================================
// 2. FUNCIONES AUXILIARES
// =====================================================================

fn limpiar_grupo_id(dato: &Data) -> String {
    let s = dato.to_string().trim().to_string();
    if s.ends_with(".0") {
        s.replace(".0", "")
    } else {
        s
    }
}

// =====================================================================
// 3. MÓDULO DE COMANDOS (ESTO SOLUCIONA EL ERROR E0255)
// =====================================================================
pub mod comandos {
    // Importamos todo lo que está arriba (estructuras, calamine, etc)
    use super::*;
    use tauri::command;

    #[command]
    pub fn procesar_excel(ruta: String) -> Result<Vec<Grupo>, String> {
        let mut workbook =
            open_workbook_auto(&ruta).map_err(|e| format!("Error al abrir el Excel: {:?}", e))?;

        let nombre_lista = workbook
            .sheet_names()
            .iter()
            .find(|&n| n.to_uppercase() == "LISTA")
            .cloned()
            .ok_or("No se encontró la pestaña 'Lista'")?;

        let range_lista = workbook
            .worksheet_range(&nombre_lista)
            .map_err(|e| format!("Error al leer 'Lista': {:?}", e))?;

        let mut grupos_map: HashMap<String, Vec<Estudiante>> = HashMap::new();
        let mut id_idx = None;
        let mut grupo_idx = None;

        for row in range_lista.rows() {
            if id_idx.is_none() || grupo_idx.is_none() {
                for (col_idx, celda) in row.iter().enumerate() {
                    let encabezado = celda
                        .to_string()
                        .trim()
                        .to_uppercase()
                        .replace("\n", " ")
                        .replace("\r", "");
                    if encabezado.contains("IDENTIFICACIÓN")
                        || encabezado.contains("IDENTIFICACION")
                    {
                        id_idx = Some(col_idx);
                    } else if encabezado == "GRUPO" {
                        grupo_idx = Some(col_idx);
                    }
                }
                continue;
            }

            if let (Some(id_col), Some(grupo_col)) = (id_idx, grupo_idx) {
                let nombre = row
                    .get(id_col)
                    .unwrap_or(&Data::Empty)
                    .to_string()
                    .trim()
                    .to_string();
                let grupo_id = limpiar_grupo_id(row.get(grupo_col).unwrap_or(&Data::Empty));

                if !nombre.is_empty()
                    && !grupo_id.is_empty()
                    && nombre.to_uppercase() != "IDENTIFICACIÓN"
                {
                    let nombre_limpio = nombre.replace("/", " ");
                    grupos_map
                        .entry(grupo_id)
                        .or_insert_with(Vec::new)
                        .push(Estudiante {
                            identificacion: nombre_limpio,
                        });
                }
            }
        }

        let mut notas_grupales: HashMap<String, f64> = HashMap::new();

        let nombre_tareas = workbook
            .sheet_names()
            .iter()
            .find(|&n| n.to_uppercase() == "TAREAS GRUPALES")
            .cloned();

        if let Some(name) = nombre_tareas {
            if let Ok(range_tareas) = workbook.worksheet_range(&name) {
                let mut tg_grupo_idx = None;
                let mut tg_prom_idx = None;

                for row in range_tareas.rows() {
                    if tg_grupo_idx.is_none() || tg_prom_idx.is_none() {
                        for (col_idx, celda) in row.iter().enumerate() {
                            let encabezado = celda
                                .to_string()
                                .trim()
                                .to_uppercase()
                                .replace("\n", " ")
                                .replace("\r", "");
                            if encabezado == "GRUPO" {
                                tg_grupo_idx = Some(col_idx);
                            } else if encabezado.contains("PROMEDIO")
                                && encabezado.contains("BRUTO")
                            {
                                tg_prom_idx = Some(col_idx);
                            }
                        }
                        continue;
                    }

                    if let (Some(g_col), Some(p_col)) = (tg_grupo_idx, tg_prom_idx) {
                        let grupo_id = limpiar_grupo_id(row.get(g_col).unwrap_or(&Data::Empty));
                        let prom_dato = row.get(p_col).unwrap_or(&Data::Empty);

                        if !grupo_id.is_empty() && grupo_id.to_uppercase() != "GRUPO" {
                            let nota_str = prom_dato.to_string().replace(",", ".");
                            if let Ok(nota) = nota_str.parse::<f64>() {
                                notas_grupales.insert(grupo_id, (nota * 10.0).round() / 10.0);
                            }
                        }
                    }
                }
            }
        }

        let mut grupos_finales: Vec<Grupo> = grupos_map
            .into_iter()
            .map(|(num, ests)| Grupo {
                promedio_bruto: notas_grupales.get(&num).copied(),
                numero: num,
                estudiantes: ests,
            })
            .collect();

        grupos_finales.sort_by(|a, b| {
            let num_a = a.numero.parse::<f64>().unwrap_or(0.0);
            let num_b = b.numero.parse::<f64>().unwrap_or(0.0);
            num_a.partial_cmp(&num_b).unwrap()
        });

        Ok(grupos_finales)
    }

    #[command]
    pub fn procesar_notas_excel(ruta: String) -> Result<Vec<NotaEstudiante>, String> {
        let mut workbook =
            open_workbook_auto(&ruta).map_err(|e| format!("Error al abrir el Excel: {:?}", e))?;

        let sheet_name = workbook
            .sheet_names()
            .first()
            .cloned()
            .ok_or("El Excel está vacío".to_string())?;

        let range = workbook
            .worksheet_range(&sheet_name)
            .map_err(|e| format!("Error al leer la pestaña: {:?}", e))?;

        let mut evaluado_idx = None;
        let mut evaluador_idx = None;
        let mut indices_criterios = Vec::new();

        let mut resumen_notas: HashMap<String, (f64, usize, Vec<f64>)> = HashMap::new();
        let mut a_quienes_evaluo: HashMap<String, Vec<String>> = HashMap::new();

        for (i, row) in range.rows().enumerate() {
            if i == 0 {
                for (col_idx, celda) in row.iter().enumerate() {
                    let encabezado = celda.to_string().to_uppercase();
                    if encabezado.contains("EVALUADO") {
                        evaluado_idx = Some(col_idx);
                    } else if encabezado.contains("EVALUADOR")
                        || encabezado.contains("CORREO")
                        || encabezado == "NOMBRE"
                    {
                        if evaluador_idx.is_none() {
                            evaluador_idx = Some(col_idx);
                        }
                    } else if encabezado.starts_with("HA ") {
                        indices_criterios.push(col_idx);
                    }
                }
                continue;
            }

            if let Some(e_idx) = evaluado_idx {
                let evaluado_crudo = row.get(e_idx).unwrap_or(&Data::Empty).to_string();
                let evaluado = evaluado_crudo.trim().replace("/", " ");

                let evaluador = if let Some(ev_idx) = evaluador_idx {
                    row.get(ev_idx)
                        .unwrap_or(&Data::Empty)
                        .to_string()
                        .trim()
                        .replace("/", " ")
                } else {
                    "".to_string()
                };

                if !evaluado.is_empty() {
                    let mut suma_fila = 0.0;
                    let mut cantidad_criterios = 0;

                    for &c_idx in &indices_criterios {
                        let celda = row.get(c_idx).unwrap_or(&Data::Empty).to_string();
                        let nota_limpia = celda.replace(",", ".");
                        if let Ok(nota) = nota_limpia.parse::<f64>() {
                            suma_fila += nota;
                            cantidad_criterios += 1;
                        }
                    }

                    if cantidad_criterios > 0 {
                        let promedio_fila = suma_fila / cantidad_criterios as f64;
                        let nota_redondeada = (promedio_fila * 10.0).round() / 10.0;

                        let entrada =
                            resumen_notas
                                .entry(evaluado.clone())
                                .or_insert((0.0, 0, Vec::new()));
                        entrada.0 += promedio_fila;
                        entrada.1 += 1;
                        entrada.2.push(nota_redondeada);
                    }

                    if !evaluador.is_empty() {
                        a_quienes_evaluo
                            .entry(evaluador)
                            .or_insert(Vec::new())
                            .push(evaluado);
                    }
                }
            }
        }

        let mut todos_los_estudiantes: HashSet<String> = HashSet::new();
        todos_los_estudiantes.extend(resumen_notas.keys().cloned());
        todos_los_estudiantes.extend(a_quienes_evaluo.keys().cloned());

        let mut resultados = Vec::new();
        for estudiante in todos_los_estudiantes {
            let (suma, cantidad, notas_individuales) = resumen_notas
                .get(&estudiante)
                .cloned()
                .unwrap_or((0.0, 0, Vec::new()));
            let nombres_evaluados = a_quienes_evaluo
                .get(&estudiante)
                .cloned()
                .unwrap_or(Vec::new());

            resultados.push(NotaEstudiante {
                identificacion: estudiante,
                nota_promedio: if cantidad > 0 {
                    (suma / cantidad as f64 * 10.0).round() / 10.0
                } else {
                    0.0
                },
                cantidad_evaluaciones: cantidad,
                notas_individuales,
                nombres_evaluados,
            });
        }

        Ok(resultados)
    }
}

// =====================================================================
// 4. REGISTRO DE COMANDOS EN TAURI
// =====================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Aquí llamamos a las funciones usando comandos::
            comandos::procesar_excel,
            comandos::procesar_notas_excel
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
