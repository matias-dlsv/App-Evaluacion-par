# EquiPar
**Plataforma de Evaluación Par - Universidad de los Andes**

EquiPar es una aplicación de escritorio para gestionar y calcular notas de evaluación entre pares en cursos universitarios. Permite cargar respuestas desde Excel o CSV, calcular notas ajustadas con penalizaciones configurables, y exportar resultados por grupo o curso completo.

---

## Instalación

Descarga el instalador correspondiente a tu sistema operativo desde la sección [Releases](../../releases):

| Sistema | Archivo |
|---------|---------|
| 🪟 Windows | `EquiPar_x.x.x_x64-setup.exe` |
| 🍎 Mac Apple Silicon (M1/M2/M3) | `EquiPar_x.x.x_aarch64.dmg` |
| 🍎 Mac Intel (pre-2020) | `EquiPar_x.x.x_x64.dmg` |
| 🐧 Linux (AppImage) | `EquiPar_x.x.x_amd64.AppImage` |
| 🐧 Linux (Debian/Ubuntu) | `EquiPar_x.x.x_amd64.deb` |

---

### 🪟 Windows

1. Descarga el archivo `EquiPar_x.x.x_x64-setup.exe` y ejecútalo.
2. Es probable que aparezca una **pantalla azul de Windows Defender SmartScreen** que diga _"Windows protegió su equipo"_. Esto ocurre porque la aplicación no está firmada con un certificado de pago — es normal en software de código abierto.
3. Haz clic en **"Más información"** (texto en azul, parte inferior del cuadro).
4. Aparecerá el botón **"Ejecutar de todas formas"** — haz clic en él.
5. Sigue el asistente de instalación normalmente.

> Si tu antivirus bloquea la descarga, marca el archivo como excepción o descárgalo desde un navegador diferente (Edge suele ser más permisivo con instaladores `.exe`).

---

### 🍎 Mac Apple Silicon (M1/M2/M3)

1. Descarga el archivo `EquiPar_x.x.x_aarch64.dmg` y ábrelo.
2. Arrastra el ícono de **EquiPar** a la carpeta **Aplicaciones**.
3. La primera vez que intentes abrir la app, macOS mostrará un mensaje _"No se puede abrir porque es de un desarrollador no identificado"_.
4. Ve a **Preferencias del Sistema → Privacidad y Seguridad**.
5. En la sección **Seguridad**, verás el mensaje _"Se bloqueó el uso de EquiPar"_ con un botón **"Abrir de todas formas"** — haz clic en él.
6. Confirma en el diálogo que aparece.

> En macOS Ventura o superior, el botón puede estar en **Configuración del Sistema → Privacidad y Seguridad → Seguridad**.

---

### 🍎 Mac Intel (pre-2020)

1. Descarga el archivo `EquiPar_x.x.x_x64.dmg` y ábrelo.
2. Arrastra el ícono de **EquiPar** a la carpeta **Aplicaciones**.
3. Los pasos para autorizar la app son idénticos a los de Apple Silicon (pasos 3–6 anteriores).

> Si no sabes qué chip tiene tu Mac, ve a **Menú Apple → Acerca de este Mac**. Si dice "Chip: Apple M1" (o M2, M3) descarga el `.dmg aarch64`. Si dice "Procesador: Intel" descarga el `.dmg x64`.

---

### 🐧 Linux

Tienes dos opciones según tu preferencia:

**Opción A — AppImage** (universal, sin instalación):

1. Descarga el archivo `EquiPar_x.x.x_amd64.AppImage`.
2. Dale permisos de ejecución:
   - **Desde el explorador de archivos:** clic derecho → Propiedades → Permisos → activar _"Permitir ejecutar el archivo como programa"_.
   - **Desde la terminal:**
     ```bash
     chmod +x EquiPar_*.AppImage
     ```
3. Ejecuta el archivo haciendo doble clic o desde la terminal:
   ```bash
   ./EquiPar_*.AppImage
   ```

> No requiere instalación ni permisos de administrador. Funciona en Ubuntu, Fedora, Arch y la mayoría de distribuciones modernas.

**Opción B — `.deb`** (Ubuntu, Debian y derivados):

1. Descarga el archivo `EquiPar_x.x.x_amd64.deb`.
2. Instálalo desde la terminal:
   ```bash
   sudo dpkg -i EquiPar_*.deb
   ```
3. Una vez instalado, la app aparecerá en el menú de aplicaciones como **EquiPar**.

> Para desinstalarla: `sudo dpkg -r equipar`

---

## Funcionalidades

- **Carga de datos desde Excel o CSV** — Procesa archivos `.xlsx` y `.csv` con respuestas de evaluación par, notas individuales y autoevaluaciones. Los CSV con separador `;` (formato europeo/español) también son compatibles.
- **Gestión de cursos y grupos** — Crea, edita y elimina cursos y grupos de trabajo manualmente o desde archivo
- **Cálculo de notas ajustadas** — Aplica proporcionalidad entre pares con dos penalizaciones configurables:
  - Por evaluar a compañeros fuera del propio grupo
  - Por no evaluar a todos los compañeros del grupo
- **Configuración de castigos** — El docente define el porcentaje máximo de descuento para cada tipo de penalización (0–100%)
- **Edición manual** — Permite sobrescribir notas brutas y factores de castigo por estudiante
- **Detección de duplicados** — Alerta si un estudiante aparece en más de un grupo
- **Exportación a Excel** con múltiples formatos:
  - Reporte completo del curso (3 hojas: notas ponderadas, evaluaciones par, verificación)
  - Un archivo por grupo
  - Todos los grupos en una carpeta
  - Comparativa autoevaluación vs nota par, ordenada por mayor discrepancia
- **Persistencia local** — Los cursos se guardan automáticamente entre sesiones

---

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Framework de escritorio | [Tauri](https://tauri.app/) (Rust + WebView) |
| Frontend | React 18 + TypeScript |
| Estilos | Tailwind CSS |
| Estado global | Zustand |
| Persistencia | `@tauri-apps/plugin-store` |
| Exportación Excel | ExcelJS |
| Backend (procesamiento) | Rust |

---

## Contexto

Este proyecto fue desarrollado en el marco del **CIIMTA — Concurso de Incentivos para la Innovación Metodológica – Tecnológica en las Asignaturas**, iniciativa de la Subdirección de Innovación y Tecnología del CID de la Universidad de los Andes. El concurso financia propuestas docentes que mejoran el aprendizaje estudiantil mediante cambios metodológicos con impacto en la comunidad universitaria.
