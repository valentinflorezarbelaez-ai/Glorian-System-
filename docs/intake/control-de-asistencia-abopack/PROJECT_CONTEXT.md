# PROJECT CONTEXT & INTAKE: CONTROL DE ASISTENCIA AVO-PAK S.A.S.

## 1. Project Identification
- **Project ID**: `control-de-asistencia-abopack`
- **Company**: **Avo Pak S.A.S.** (NIT `901.557.939-1`, Planta La Ceja — Km 5 vía La Ceja – Abejorral, Antioquia, Colombia)
- **Application Name**: **CONTROL DE ASISTENCIA AVO-PAK**
- **Repository URL**: `https://github.com/valentinflorezarbelaez-ai/Control-De-Asistencia-Abopack.git`
- **Production URL**: `https://control-de-asistencia-abopack.vercel.app/`
- **Reference Access Portal**: `https://d-mazoavo.github.io/control-acceso/`
- **Intake Status**: `INTAKE_COMPLETE`
- **Date**: `2026-11-01`

---

## 2. Business Domain & Colombian Labor Legislation Requirements
1. **Jornada Laboral Semanal Colombiana (42 Horas — Ley 2101 de 2021)**:
   - La jornada laboral ordinaria máxima semanal es de **42 horas**.
   - La semana laboral inicia el **día lunes** (Lunes a Sábado/Domingo).
   - Todas las horas netas trabajadas que superen el límite de **42 horas semanales** se clasifican y liquidan como **Horas Extras**.
2. **Descuento de Tiempo de Alimentación (40 Minutos)**:
   - Entre la hora de ingreso y la hora de salida de labores se descuentan **40 minutos de alimentación**, los cuales no cuentan como parte del tiempo efectivo de trabajo.
   - El sistema permite registrar explícitamente:
     1. Hora de ingreso de labores (`horaIngreso`)
     2. Hora de salida a alimentación (`horaSalidaAlimentacion`)
     3. Hora de regreso de alimentación (`horaRegresoAlimentacion`)
     4. Hora de salida de labores (`horaSalida`)
   - Si solo se registra ingreso y salida de labores, el motor descuenta automáticamente los 40 minutos reglamentarios de alimentación en turnos ordinarios.
3. **Diferencial de Horas Extras Diurnas y Nocturnas (> 8:00 PM / 20:00)**:
   - Si en la semana de trabajo el colaborador excede las 42 horas ordinarias, el sistema registra la cantidad exacta de horas extras generadas.
   - Si parte o la totalidad de las horas extras se realizan **con posterioridad a las 8:00 de la noche (`20:00`)**, el sistema las separa de manera diferencial en:
     - **Horas Extras Diurnas (HED)**: Generadas antes de las 8:00 PM (Recargo legal +25%, factor `1.25`).
     - **Horas Extras Nocturnas (HEN)**: Generadas después de las 8:00 PM / entre 20:00 y 06:00 (Recargo legal +75%, factor `1.75`).
     - **Horas Extras Dominicales/Festivas Diurnas (HEDDF `2.00`) y Nocturnas (HENDF `2.50`)**.
4. **Registro Grupal por Área de Trabajo e Individual Flexible**:
   - Cada área de trabajo posee un horario base configurable que puede aplicarse grupalmente a todo el personal del área y ajustarse individualmente cuando sea necesario.
   - Horarios oficiales iniciales de planta:
     - **Destupe**: `07:00` a `14:40` (7h 40m permanencia - 40m alimentación = 7.0h netas/día = 42h/semana Lunes a Sábado).
     - **Sanitización día**: `07:30` a `15:10` (40m alimentación = 7.0h netas/día).
     - **Despulpe**: `08:30` a `16:10` (40m alimentación = 7.0h netas/día).
     - **Empaque T1**: `10:00` a `17:40` (40m alimentación = 7.0h netas/día).
     - **Empaque T2**: `10:30` a `18:10` (40m alimentación = 7.0h netas/día).
     - **Sanitización noche**: `20:00` a `03:40` (40m alimentación = 7.0h netas/día).
     - Áreas operativas adicionales: `Lavandería`, `Lavado canastillas`, `Residuos`, `Despachos`, `Cava`, `Dosificación`, `IQF`, `Maduración`, `Recepción`, `Selladora`, `Dirección de Operaciones`.
5. **Gestión de Permisos, Evidencia Fotográfica y Faltas No Justificadas**:
   - Cada día permite registrar **Permisos** anexando **Evidencia Fotográfica** (captura por cámara o archivo de imagen).
   - Clasificación de permisos:
     - **Remunerado** vs **No Remunerado**.
     - **Tiempo estipulado (minutos)** vs **Tiempo real tomado (minutos)**.
     - Configuración explícita de si el exceso sobre el tiempo estipulado (o el permiso no remunerado) **se descuenta o no de la nómina**.
   - **Faltas No Justificadas**: Permite registrar inasistencias no justificadas, descontando automáticamente las **horas laboradas programadas** del turno correspondiente (ej. 7.0 horas).
6. **Código QR Imprimible, Lector QR de Asistencia y Consulta de Horas**:
   - Generación e impresión de carnets con **Código QR** individual y grupal para los 44 colaboradores de la planta.
   - Lector QR integrado (cámara en vivo + pistola lectora USB + simulador rápido) que registra entradas, salidas a alimentación, regresos de alimentación y salidas de labores.
   - Módulo de **Consulta de Horas Laboradas** por empleado, documento o QR.
7. **Perfiles Compartibles y Control de Acceso por Área (RBAC — Federico y Coordinadores)**:
   - **Administrador General (`Federico` — Usuario: `8160032`, Contraseña temporal: `Avopak2026*.@`)**: Acceso global a toda la planta, reasignación flexible de grupos de trabajo a diferentes administradores y modificación de horarios.
   - **Administradores por Grupo/Área de Trabajo** (ej. `Empaque`, `Despulpe y Destupe`, `Sanitización y Lavandería`): Cada administrador solo visualiza, verifica y gestiona el grupo de personas asignado a sus áreas.
8. **Histórico Semanal y Descarga en Excel (`.xlsx`)**:
   - Almacenamiento por semanas (iniciando lunes) y exportación nativa en formato **Excel (`.xlsx`)** con múltiples hojas listas para liquidación de nómina.
