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

        let mut evaluado_idx: Option<usize> = None;
        let mut evaluador_idx: Option<usize> = None;
        let mut grupo_idx: Option<usize> = None;
        let mut indices_criterios: Vec<usize> = Vec::new();

        let mut datos_por_grupo: HashMap<String, HashMap<String, (f64, usize, Vec<f64>)>> =
            HashMap::new();
        let mut estudiante_a_grupo: HashMap<String, String> = HashMap::new();

        for (i, row) in range.rows().enumerate() {
            if i == 0 {
                for (col_idx, celda) in row.iter().enumerate() {
                    let enc = celda
                        .to_string()
                        .trim()
                        .to_uppercase()
                        .replace('\n', " ")
                        .replace('\r', "");

                    if enc.contains("EVALUADO") && !enc.contains("EVALUADOR") {
                        evaluado_idx = Some(col_idx);
                    } else if enc.contains("EVALUADOR") {
                        evaluador_idx = Some(col_idx);
                    } else if enc == "GRUPO" {
                        grupo_idx = Some(col_idx);
                    } else if enc.starts_with("HA ") {
                        indices_criterios.push(col_idx);
                    }
                }
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

            // Evitar filas vacías, pero permitir que uno de los dos nombres falte temporalmente
            if (evaluado.is_empty() && evaluador.is_empty()) || grupo.is_empty() {
                continue;
            }

            // CORRECCIÓN 1: Registrar TANTO al evaluado COMO al evaluador en el mapa de grupos
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

            if count > 0 && !evaluado.is_empty() {
                let prom = suma / count as f64;
                let redondeado = (prom * 10.0).round() / 10.0;
                let entrada = datos_por_grupo
                    .entry(grupo.clone())
                    .or_default()
                    .entry(evaluado.clone())
                    .or_insert((0.0, 0, Vec::new()));
                entrada.0 += prom;
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

        let mut evaluado_idx = None;
        let mut evaluador_idx = None;
        let mut grupo_idx = None;
        let mut indices_criterios = Vec::new();

        let mut persona_a_grupo: HashMap<String, String> = HashMap::new();
        let rows: Vec<_> = range.rows().collect();

        // Pasada 1: encabezados + mapa persona->grupo
        for (i, row) in rows.iter().enumerate() {
            if i == 0 {
                for (col_idx, celda) in row.iter().enumerate() {
                    let enc = celda.to_string().trim().to_uppercase().replace('\n', " ");
                    if enc.contains("EVALUADO") && !enc.contains("EVALUADOR") {
                        evaluado_idx = Some(col_idx);
                    } else if enc.contains("EVALUADOR") {
                        evaluador_idx = Some(col_idx);
                    } else if enc == "GRUPO" {
                        grupo_idx = Some(col_idx);
                    } else if enc.starts_with("HA ") {
                        indices_criterios.push(col_idx);
                    }
                }
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

            // CORRECCIÓN 2: Llenar el mapa de grupos incluyendo al evaluador
            if !grupo.is_empty() {
                if !evaluado.is_empty() {
                    persona_a_grupo.entry(evaluado).or_insert(grupo.clone());
                }
                if !evaluador.is_empty() {
                    persona_a_grupo.entry(evaluador).or_insert(grupo.clone());
                }
            }
        }

        // Pasada 2: calcular notas filtrando inválidas
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
                    let val = row.get(c).map(|d| d.to_string()).unwrap_or_default();
                    if let Ok(n) = val.replace(',', ".").parse::<f64>() {
                        suma += n;
                        count += 1;
                    }
                }

                if count > 0 {
                    let prom = suma / count as f64;
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

                // CORRECCIÓN 3: Sacar el grupo siempre de `persona_a_grupo`, no del resumen
                let grupo_real = persona_a_grupo.get(&est).cloned().unwrap_or_default();

                super::NotaEstudiante {
                    identificacion: est,
                    nota_promedio: if cantidad > 0 {
                        (suma / cantidad as f64 * 10.0).round() / 10.0
                    } else {
                        4.0
                    },
                    cantidad_evaluaciones: cantidad,
                    notas_individuales: notas,
                    nombres_evaluados,
                    grupo: grupo_real, // Ahora nunca quedará vacío si validó su grupo
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
