# SPEC-122: CONTROL DE ASISTENCIA AVO-PAK — MOTOR DE JORNADA LABORAL COLOMBIANA (42H), LECTOR QR, PERMISOS Y NÓMINA EXCEL

## 1. Metadata
- **Specification ID**: `SPEC-122`
- **Project ID**: `control-de-asistencia-abopack`
- **Standard**: IEEE 830 / ISO 29148 / Ley 2101 de 2021 & CST Colombia
- **Status**: `SPECIFICATION_APPROVED`
- **Layer**: Clean / Hexagonal Layer-0 Architecture (`dependencies: {}`)
- **Date**: `2026-11-01`

---

## 2. Formal Functional Requirements (EARS Syntax)

- **FR-353 [Ubiquitous / Permanent]**:
  `EL SISTEMA estructurará cada semana laboral iniciando el día lunes y calculará las horas netas trabajadas descontando 40 minutos de tiempo de alimentación por jornada ordinaria, estableciendo el tope de jornada ordinaria semanal en 42.0 horas conforme a la legislación laboral colombiana.`

- **FR-354 [Event-Driven]**:
  `CUANDO las horas netas acumuladas por un colaborador en la semana superen las 42.0 horas ordinarias, EL SISTEMA clasificará el tiempo excedente como Horas Extras, separando diferencialmente las Horas Extras Diurnas (antes de las 20:00 / 8:00 PM) y las Horas Extras Nocturnas (posteriores a las 20:00 / 8:00 PM hasta las 06:00 AM).`

- **FR-355 [Event-Driven]**:
  `CUANDO un administrador ejecute el registro de horarios de manera grupal por área de trabajo (Destupe, Sanitización día, Despulpe, Empaque T1, Empaque T2, Sanitización noche, etc.), EL SISTEMA asignará las marcaciones de ingreso, salida a alimentación, regreso de alimentación y salida de labores a todos los integrantes del área, permitiendo ajustes individuales posteriores sobre cualquier trabajador.`

- **FR-356 [Event-Driven]**:
  `CUANDO un colaborador escanee su código QR en la terminal (o se ingrese su documento), EL SISTEMA registrará automáticamente la marcación correspondiente en la secuencia del día (Ingreso de Labores -> Salida a Alimentación -> Regreso de Alimentación -> Salida de Labores) y recalculará en tiempo real sus horas netas y extras de la semana.`

- **FR-357 [Event-Driven]**:
  `CUANDO se registre un permiso diario para un colaborador, EL SISTEMA permitirá definir si es remunerado o no remunerado, el tiempo estipulado en minutos, el tiempo real utilizado, si el exceso o permiso se descuenta de la nómina, y anexar evidencia fotográfica verificable.`

- **FR-358 [Error / Unwanted Condition]**:
  `SI un colaborador presenta una falta no justificada en un día programado, ENTONCES EL SISTEMA registrará 0 horas laboradas en esa jornada y descontará de la liquidación semanal las horas laboradas programadas del turno correspondiente (7.0 horas netas por defecto).`

- **FR-359 [State-Driven]**:
  `MIENTRAS una sesión esté autenticada bajo un perfil de Administrador de Área (ej. Empaque, Despulpe, Sanitización), EL SISTEMA restringirá la visualización, verificación y edición exclusivamente al grupo de trabajadores asignado a dicho administrador; MIENTRAS la sesión pertenezca al Administrador General Federico (Usuario 8160032), EL SISTEMA habilitará el control global de toda la planta y la reasignación flexible de grupos y horarios.`

- **FR-360 [Event-Driven]**:
  `CUANDO el usuario solicite descargar el reporte semanal en Excel (.xlsx) o consultar las horas laboradas de un trabajador, EL SISTEMA generará un libro de Excel nativo multi-hoja (Resumen Semanal 42h, Detalle Diario, Permisos/Faltas y Maestro de Personal) libre de inyección de fórmulas.`

---

## 3. Acceptance Criteria (BDD Gherkin Standard)

```gherkin
ESCENARIO: BDD-335 Cálculo Exacto de Jornada Semanal de 42 Horas y Descuento de 40 Minutos de Alimentación
  DADO un operario del área "Despulpe" con horario de 08:30 a 16:10 de lunes a sábado (7h 40m de permanencia diaria)
  CUANDO el sistema registra su asistencia completa los 6 días con 40 minutos de alimentación diarios
  ENTONCES descuenta exactamente 40 minutos por día (7.0 horas netas diarias)
  Y acumula 42.0 horas ordinarias en la semana con 0.0 horas extras

ESCENARIO: BDD-336 Liquidación Diferencial de Horas Extras Diurnas y Nocturnas Posteriores a las 8:00 PM (20:00)
  DADO un operario que ya acumuló 42.0 horas ordinarias en la semana
  CUANDO labora un turno o extensión adicional desde las 18:00 hasta las 22:00 (sin alimentación adicional)
  ENTONCES el sistema registra 4.0 horas extras totales en la semana
  Y clasifica 2.0 horas (18:00 a 20:00) como Horas Extras Diurnas (HED < 8:00 PM)
  Y clasifica 2.0 horas (20:00 a 22:00) como Horas Extras Nocturnas (HEN >= 8:00 PM) con pago diferencial

ESCENARIO: BDD-337 Registro Grupal por Área de Trabajo con Ajuste Individual Flexible
  DADO el grupo de trabajo "Empaque T2" con horario base 10:30 a 18:10 y 40 min de alimentación
  CUANDO el administrador aplica el registro grupal del área y luego ajusta individualmente la salida de un operario a las 21:10
  ENTONCES todos los demás operarios de "Empaque T2" conservan 7.0 horas netas
  Y el operario ajustado registra 10.0 horas netas (7.0h ordinarias + 3.0h adicionales con corte nocturno a las 20:00)

ESCENARIO: BDD-338 Gestión de Permisos (Remunerados/No Remunerados), Exceso de Tiempo, Evidencia Fotográfica y Faltas No Justificadas
  DADO un operario con un permiso estipulado de 60 minutos que tarda 90 minutos en regresar y anexa evidencia fotográfica
  CUANDO se marca el permiso como remunerado pero con descuento del exceso (30 min) y otro día registra una falta no justificada
  ENTONCES el sistema conserva la evidencia fotográfica vinculada al registro diario
  Y descuenta 0.5 horas por exceso de permiso más 7.0 horas programadas por la falta no justificada

ESCENARIO: BDD-339 Lectura de Código QR de Asistencia y Generación de Carnets Imprimibles
  DADO el carnet QR generado para un colaborador de Avo Pak (ej. Documento "1013346073")
  CUANDO el colaborador escanea su QR secuencialmente en el día
  ENTONCES el sistema registra en orden: Ingreso de Labores, Salida a Alimentación, Regreso de Alimentación y Salida de Labores

ESCENARIO: BDD-340 Control de Acceso Basado en Roles (RBAC) para Federico (8160032) y Administradores de Área
  DADO el inicio de sesión con Usuario "8160032" y contraseña "[REDACTED_PASSWORD]" (Federico - Administrador General)
  CUANDO Federico asigna el área "Empaque T1" y "Empaque T2" al perfil "Admin Empaque"
  ENTONCES el "Admin Empaque" solo visualiza y verifica a los operarios de Empaque T1/T2
  Y Federico conserva visibilidad y edición sobre los 44 trabajadores y todas las áreas de la planta

ESCENARIO: BDD-341 Exportación Nativa a Excel (.xlsx) y Consulta Interactiva de Horas Laboradas
  DADO los registros semanales de asistencia de la planta Avo Pak
  CUANDO el administrador descarga el reporte en Excel o consulta las horas de un trabajador
  ENTONCES el sistema entrega la estructura completa multi-hoja con horas ordinarias, extras diurnas/nocturnas, alimentación, permisos y faltas
```
