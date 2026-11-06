# SPEC-CRUD-SLACK-001: OMNICHANNEL AI TASK TRIAGE & CRUD WORKSPACE

## 1. Specification Metadata
- **Spec ID**: `SPEC-CRUD-SLACK-001`
- **Project**: `crud-slack` (`TaskFlow AI`)
- **Status**: `SPECIFICATION_APPROVED`
- **Standard**: IEEE 830 / ISO 29148, EOS Formal EARS & BDD Doctrine
- **Date**: `2026-10-30`
- **Owner Approval**: Valentín Flórez Arbeláez (Principal Architect)

---

## 2. Functional Requirements (Formal EARS Syntax)

### FR-CS-001: Unstructured Omnichannel Activity Extraction
- **Pattern (Event-Driven)**: CUANDO el usuario envía una solicitud de texto libre proveniente de correo o chat (Slack, Microsoft Teams, Correo/Outlook o WhatsApp) con longitud válida (`1..4000` caracteres), EL SISTEMA identificará y extraerá cada actividad accionable como una entidad de tarea independiente, ordenada lógicamente y vinculada a su cita textual exacta (`sourceQuote`) del mensaje original.

### FR-CS-002: Contextual & Dependency-Aware Priority Suggestion
- **Pattern (Event-Driven)**: CUANDO una actividad es identificada por el motor de análisis, EL SISTEMA sugerirá un nivel de prioridad determinista (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) acompañado de una justificación explícita basada en urgencia temporal, palabras clave de impacto y dependencias previas frente a otras tareas del mismo mensaje.

### FR-CS-003: Anti-Hallucination Temporal Resolution & Missing Information Detection
- **Pattern (Error / Unwanted Condition)**: SI una actividad carece de fecha límite explícita, hora exacta, responsable asignado o datos logísticos necesarios en el mensaje fuente, ENTONCES EL SISTEMA prohibirá inventar o inferir fechas inexistentes, clasificará el campo con estado `MISSING_INFO` o `PARTIAL_ANCHOR` y registrará una alerta específica en el panel de información faltante junto con un borrador automático de solicitud de aclaración.

### FR-CS-004: Grounding & Anti-Hallucination Neuro-Symbolic Verification
- **Pattern (Ubiquitous / Permanent)**: EL SISTEMA verificará cada salida generada por el modelo de inteligencia artificial contra el texto fuente mediante un validador determinista Layer-0 que compruebe correspondencia de citas (`sourceQuote`), sustento léxico de cualquier fecha emitida y porcentaje de cobertura de cláusulas accionables.

### FR-CS-005: Dual-Engine Circuit Breaker Resilience
- **Pattern (Error / Unwanted Condition)**: SI el proveedor externo de IA (`gemini-3.8-flash` en `/api/analyze`) no dispone de credencial configurada, supera el umbral de latencia (`8000 ms`) o retorna error de red/cuota, ENTONCES EL SISTEMA conmutará de forma transparente al motor NLP determinista Layer-0 en menos de `10 ms`, preservando el contrato de datos completo e informando el motor utilizado en la telemetría.

### FR-CS-006: Full Interactive CRUD & Multi-View Task Organization
- **Pattern (State-Driven)**: MIENTRAS existan tareas en el espacio de trabajo activo, EL SISTEMA permitirá Crear nuevas tareas manuales, Leerlas y filtrarlas en tres vistas sincronizadas (Tabla Ejecutiva, Tablero Kanban por estado y Matriz de Prioridades), Actualizar sus atributos (título, prioridad, estado, responsable y fecha límite faltante) con persistencia local inmutable y Eliminar tareas individuales o reiniciar el tablero.

### FR-CS-007: Enterprise Export & SharePoint / Slack Interoperability
- **Pattern (Event-Driven)**: CUANDO el usuario selecciona una acción de exportación, EL SISTEMA serializará la lista organizada de tareas en formato CSV compatible con Microsoft SharePoint Lists / Planner (con BOM UTF-8), resumen Markdown estructurado para Slack/Teams o contrato JSON verificable.

### FR-CS-008: Integrated Executive Presentation & Evaluation Guide
- **Pattern (Ubiquitous / Permanent)**: EL SISTEMA expondrá una vista interactiva dedicada ("Presentación del Reto") que documente de forma clara y verificable: (1) la solución propuesta, (2) las herramientas utilizadas y su justificación, (3) el funcionamiento paso a paso, (4) las dificultades encontradas y su resolución, (5) las oportunidades de mejora y las respuestas técnicas a las 5 preguntas de sustentación.

### FR-CS-009: Input Validation, Rate Limiting & XSS Immunity
- **Pattern (Error / Unwanted Condition)**: SI una petición excede `4000` caracteres, está vacía, contiene etiquetas HTML/scripts maliciosos o supera el límite de `30` solicitudes por minuto por IP en `/api/analyze`, ENTONCES EL SISTEMA rechazará o sanitizará la entrada de forma segura retornando códigos HTTP semánticos (`400` o `429`) sin exponer trazas internas ni secretos.

---

## 3. Non-Functional Requirements (NFR)
1. **NFR-001 (Layer-0 Purity)**: Zero external runtime npm dependencies (`dependencies: {}`).
2. **NFR-002 (Accessibility)**: WCAG 2.1 Level AA compliance (`skip-link`, semantic landmarks, `aria-live="polite"`, keyboard navigation, `<dialog closedby="any">`, contrast ratio >= 4.5:1).
3. **NFR-003 (Performance)**: Core Web Vitals budget — total initial JS + CSS < `90 KB` uncompressed, deterministic engine latency < `5 ms`, `content-visibility: auto`.
4. **NFR-004 (Security)**: Strict CSP, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, zero plaintext secrets.

---

## 4. Acceptance Criteria (BDD Gherkin Standard)

```gherkin
ESCENARIO: BDD-CS-001: Extracción exacta y sin alucinaciones del caso oficial de reunión del viernes
  DADO el mensaje "Hola, necesitamos preparar la reunión del equipo para el viernes. Hay que revisar los resultados del mes, actualizar la presentación y enviar la agenda a los participantes antes de la reunión." y una fecha de referencia conocida
  CUANDO el usuario ejecuta el análisis de tareas con IA
  ENTONCES el sistema identifica las 4 actividades ("Revisar los resultados del mes", "Actualizar la presentación", "Enviar la agenda a los participantes", "Preparar la reunión del equipo")
  Y asigna prioridades coherentes con el orden lógico de dependencia (revisar resultados -> actualizar presentación / enviar agenda antes de la reunión -> reunión del viernes)
  Y ancla el viernes para la reunión señalando explícitamente la información faltante (hora exacta, fechas intermedias, responsables y lista de participantes) sin inventar fechas falsas.

ESCENARIO: BDD-CS-002: Guardia Anti-Alucinación ante fechas inventadas por un modelo generativo
  DADO un mensaje que no menciona ninguna fecha ni referencia temporal ("Necesitamos auditar los permisos del sitio de SharePoint y actualizar la documentación del equipo")
  CUANDO una salida candidata de IA intenta asignar una fecha calendario arbitraria como "2026-11-15"
  ENTONCES el verificador determinista detecta ausencia de ancla temporal en el texto fuente
  Y revoca la fecha inventada marcando la tarea como "MISSING_INFO" ("Fecha límite no especificada en la solicitud").

ESCENARIO: BDD-CS-003: Ciclo completo CRUD y resolución de información faltante
  DADO un conjunto de tareas extraídas en el tablero activo
  CUANDO el usuario crea una tarea adicional, actualiza la fecha faltante y el estado de una tarea existente a "COMPLETED" y elimina una tarea descartada
  ENTONCES todas las vistas (Tabla, Kanban, Métricas) y la persistencia local reflejan el estado actualizado de forma atómica
  Y el contador de alertas de información faltante disminuye dinámicamente.

ESCENARIO: BDD-CS-004: Resiliencia Circuit-Breaker ante ausencia o fallo de API externa
  DADO el endpoint /api/analyze ejecutándose sin GEMINI_API_KEY o bajo fallo simulado de red
  CUANDO se solicita analizar un mensaje de correo o Slack
  ENTONCES el Circuit Breaker conmuta al motor determinista Layer-0 retornando HTTP 200 con tareas válidas y verificadas
  Y reporta transparentemente el modo de motor activo sin interrumpir la experiencia del usuario.

ESCENARIO: BDD-CS-005: Exportación interoperable a SharePoint Lists CSV y Slack Markdown
  DADO un tablero con tareas organizadas, prioridades y alertas de datos faltantes
  CUANDO el usuario acciona la exportación a CSV para SharePoint/Planner o resumen Markdown
  ENTONCES el sistema genera un artefacto bien formado con codificación UTF-8 segura contra CSV Injection (neutralizando prefijos =, +, -, @)
  Y conserva prioridades, estados, fechas resueltas y notas de información faltante.
```
