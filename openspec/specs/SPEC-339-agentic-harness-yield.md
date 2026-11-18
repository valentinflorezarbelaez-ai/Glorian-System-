# SPEC-339: Agentic Harness Engineering, First-Pass PR Yield & Token Rework Telemetry Engine

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Error / Unwanted Condition)**: SI una tarea o solicitud carece de requisitos EARS suficientes ($\ge 1$), escenarios BDD ($\ge 1$), ADRs ($\ge 1$), o presenta una puntuación de ambigüedad $> 0.15$ (o puntaje compuesto de preparación $< 80$), ENTONCES EL SISTEMA bloquea la ejecución de forma fail-closed con el código `HARNESS_SPEC_INCOMPLETE` antes de iniciar etapas de generación o validación.
- **FR-2 (Event-Driven)**: CUANDO se ejecuta el bucle de validación del arnés multi-etapa (`TYPECHECK` $\to$ `LINT_FORMAT` $\to$ `UNIT_BDD` $\to$ `FORMAL_TLC` $\to$ `SECURITY_HYGIENE`) sobre una especificación aprobada, EL SISTEMA ejecuta cada etapa en orden determinista, contabilizando tokens de primer pase, tokens de retrabajo por reparación y promoviendo el estado a `prReady = true` únicamente cuando todas las etapas aprueban.
- **FR-3 (Error / Unwanted Condition)**: SI las iteraciones acumuladas de auto-reparación superan el presupuesto máximo `maxRetries`, ENTONCES EL SISTEMA activa el disyuntor fail-closed con el código `HARNESS_MAX_RETRIES_EXCEEDED` antes de escalar a revisión humana.
- **FR-4 (Event-Driven)**: CUANDO se evalúa una cohorte de Pull Requests agénticos, EL SISTEMA calcula la Tasa de Éxito al Primer Intento (`firstPassYieldRatio`), el Factor de Amplificación de Retrabajo ($\text{RAF} = \text{totalTokens} / \text{firstPassTokens}$), el total de tokens desperdiciados en retrabajo y el costo medio en USD por PR verificado.
- **FR-5 (State-Driven)**: MIENTRAS se comparan cohortes gobernadas por Desarrollo Guiado por Especificaciones (SDD + Harness) frente a cohortes sin restricciones ("Vibe Coding"), EL SISTEMA demuestra una mayor tasa de éxito al primer intento, menor RAF y ahorro neto de tokens (`tokenSavingsRatio > 0`).
- **FR-6 (Ubiquitous)**: EL SISTEMA expone una auditoría determinista que ejecuta todas las autopruebas estructurales del arnés y emite un recibo criptográfico firmado con SHA-256 en `docs/evidence/AGENTIC_HARNESS_YIELD_RECEIPT.json`.

---

## 2. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1809 Puerta de Preparación Spec-Driven (SDD) y Rechazo Fail-Closed de Prompts Ambiguos
  DADO un motor EosAgenticHarnessYieldCore inicializado
  CUANDO se evalúa una entrada sin especificación ("vibe prompt" con 0 EARS, 0 BDD y ambigüedad > 0.15) frente a una entrada SDD completa
  ENTONCES assertSpecReadiness rechaza la entrada incompleta con el código HARNESS_SPEC_INCOMPLETE
  Y aprueba la especificación completa con readinessScore >= 80.

ESCENARIO: BDD-1810 Bucle de Validación de Arnés Multi-Etapa y Convergencia con Auto-Reparación Acotada
  DADO una especificación aprobada sometida al arnés de 5 etapas (TYPECHECK, LINT_FORMAT, UNIT_BDD, FORMAL_TLC, SECURITY_HYGIENE)
  CUANDO una etapa intermedia requiere una iteración acotada de auto-reparación dentro de maxRetries
  ENTONCES el arnés registra el fallo inicial, contabiliza los tokens de reparación y converge a prReady = true tras superar todas las etapas
  Y refleja con exactitud firstPassTokens, reworkTokens y reworkAmplificationFactor >= 1.0.

ESCENARIO: BDD-1811 Disyuntor Fail-Closed al Exceder el Presupuesto de Reintentos
  DADO un escenario con fallos persistentes de etapa que requieren más reparaciones que maxRetries
  CUANDO se ejecuta runHarnessLoop
  ENTONCES el disyuntor detiene el bucle inmediatamente al agotar el presupuesto con el código HARNESS_MAX_RETRIES_EXCEEDED
  Y previene bucles infinitos de gasto de tokens.

ESCENARIO: BDD-1812 Contabilidad FinOps de First-Pass PR Yield (FPY) y Rework Amplification Factor (RAF)
  DADO una cohorte de registros de telemetría de Pull Requests con métricas de tokens de primer pase y retrabajo
  CUANDO se invoca evaluateCohortTelemetry
  ENTONCES el motor calcula con precisión firstPassYieldRatio, meanReworkAmplificationFactor, wastedReworkTokens y meanCostPerMergedPrUsd.

ESCENARIO: BDD-1813 Comparativa de Cohorte: Spec-Driven Harness vs Vibe Coding Sin Restricciones
  DADO dos cohortes equivalentes ejecutadas bajo flujo Spec-Driven Harness y flujo Vibe Coding
  CUANDO se invoca compareSddVsVibeCohorts
  ENTONCES la cohorte Spec-Driven obtiene un firstPassYieldRatio superior y un RAF significativamente menor
  Y logra un tokenSavingsRatio positivo con menor costo total por PR verificado.

ESCENARIO: BDD-1814 Auditoría Determinista y Recibo Criptográfico SHA-256
  DADO el motor EosAgenticHarnessYieldCore
  CUANDO se ejecuta audit()
  ENTONCES todas las verificaciones (specGateEnforced, harnessLoopConverged, retryCeilingEnforced, firstPassYieldComputed, sddOutperformsVibe) son true
  Y se emite el recibo firmado en docs/evidence/AGENTIC_HARNESS_YIELD_RECEIPT.json.
```
