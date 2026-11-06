# SPEC-110: Multi-Window Multi-Burn-Rate SLO & Error Budget Governor

## Metadata
* **Specification ID**: `SPEC-110`
* **Title**: Multi-Window Multi-Burn-Rate SLO & Error Budget Governor (Google Site Reliability Engineering Standard)
* **Status**: `APPROVED`
* **Lifecycle Phase**: `Core Infrastructure / Site Reliability Engineering (Layer 0)`
* **Governing Laws**: `Law I (Spec Truth)`, `Law III (Epistemic Evidence)`, `Law IV (Write Barrier)`, `Law V (Hexagonal Isolation)`
* **Functional Requirements**: `FR-293`, `FR-294`, `FR-295`, `FR-296`
* **BDD Scenarios**: `BDD-282`, `BDD-283`, `BDD-284`
* **Architecture Decision Record**: `ADR-110`
* **Mathematical Invariants**: `ErrorBudgetNonNegativeHeadroom`, `MultiBurnRateTriggerSoundness`, `DeploymentFreezeInvariant`

---

## 1. Context & Business Domain

Traditional threshold alerting ("5xx > 1%") suffers from alert storms during brief transients and catastrophic delay during slow, bleeding outages.

Google SRE formalized **Multi-Window Multi-Burn-Rate Alerting on Service Level Objectives (SLOs)**:
* **Availability SLO**: Target percentage of successful events over a 30-day compliance rolling window (e.g. $99.9\%$).
* **Error Budget ($EB$)**: Total allowable unreliability ($EB = 1.0 - \text{SLO} = 0.001$).
* **Burn Rate ($B$)**: Multiplier of normal budget consumption ($B = \frac{\text{observed\_error\_rate}}{EB}$).
  * $B \ge 14.4$: Burns $2\%$ of budget in 1 hour $\rightarrow$ Emergency Rollback & Paging Alert.
  * $B \ge 6.0$: Burns $5\%$ of budget in 6 hours $\rightarrow$ Canary Freeze & Warning.
* **Dual-Window Correlation**: Alerts trigger only if both long-window ($1\text{h}$) and short-window ($5\text{m}$) burn rates exceed the critical multiplier, eliminating false positives after spikes subside.
* **Deployment Freeze Gate**: When $EB_{remaining} \le 0$ or critical burn rate is sustained, automated deployments across all fleet repositories are frozen until budget regenerates.

SPEC-110 implements `EosMultiWindowSloGovernor` as a pure Layer 0 engine with zero runtime dependencies.

---

## 2. Requirements Engineering (IEEE 830 / ISO 29148 Standard in EARS Syntax)

### FR-293: Multi-Window Error Budget Accounting (Ubiquitous Pattern)
* **EARS**: `EL SISTEMA mantendrá la contabilidad continua del presupuesto de error (Error Budget) sobre ventanas temporales deslizantes para cada servicio de la flota, calculando en tiempo real la fracción de presupuesto consumida y el saldo disponible con precisión de coma flotante de 64 bits.`

### FR-294: Dual-Window Burn Rate Alerting (Event-Driven Pattern)
* **EARS**: `CUANDO se ingiera una ventana de eventos de telemetría, EL SISTEMA calculará la tasa de consumo (Burn Rate) en ventanas largas (1h y 6h) y ventanas cortas correlacionadas (5m y 30m), emitiendo una alerta crítica de Nivel 1 únicamente si ambas ventanas confirman que B >= 14.4.`

### FR-295: Autonomous Fleet Deployment Freeze (State-Driven Pattern)
* **EARS**: `MIENTRAS el saldo de presupuesto de error de un servicio sea inferior o igual a cero (EB_remaining <= 0) o se mantenga una alerta crítica de Nivel 1 (B >= 14.4), EL SISTEMA activará el estado de congelación de despliegues (DEPLOYMENT_FROZEN), bloqueando de forma autónoma cualquier promoción o liberación de código en la flota.`

### FR-296: Error Budget Depletion Recovery & Thawing (Error / Unwanted Condition Pattern)
* **EARS**: `SI un servicio con despliegues congelados mantiene una tasa de error nominal (B <= 1.0) durante un período de enfriamiento continuo y su presupuesto disponible supera el umbral de regeneración segura, ENTONCES EL SISTEMA descongelará el despliegue (DEPLOYMENT_THAWED) y emitirá un recibo criptográfico SHA-256 de restablecimiento de fiabilidad.`

---

## 3. BDD Acceptance Criteria (Gherkin Syntax)

```gherkin
ESCENARIO: BDD-282 Cálculo Determinista de Presupuesto de Error y Tasa de Consumo (Burn Rate)
  DADO un gobernador EosMultiWindowSloGovernor configurado con un SLO de disponibilidad del 99.9%
  CUANDO se ingieren 10,000 eventos con 10 errores 5xx (tasa de error = 0.1%)
  ENTONCES la tasa de consumo de presupuesto (Burn Rate) calculada es exactamente 1.0
  Y el presupuesto de error restante se deduce de forma determinista
  Y el estado del servicio permanece en NOMINAL_HEALTHY

ESCENARIO: BDD-283 Correlación de Ventana Dual y Supresión de Falsas Alarmas
  DADO un servicio con operación nominal
  CUANDO se presenta un pico transitorio aislado de 30 segundos que eleva la tasa de error a 5%
  PERO la ventana corta subsecuente de 5 minutos vuelve a 0% de errores
  ENTONCES el gobernador evalúa la correlación de ventana dual
  Y suprime la alerta crítica de Nivel 1 por ausencia de consumo sostenido
  Y previene la fatiga de alertas y falsos bloqueos de despliegue

ESCENARIO: BDD-284 Congelación Autónoma de Despliegues por Agotamiento Crítico de Presupuesto
  DADO un servicio que experimenta una tasa de error sostenida de 1.5% durante 1 hora
  CUANDO el gobernador calcula un Burn Rate de 15.0 (superior al umbral crítico de 14.4)
  ENTONCES el gobernador activa inmediatamente el estado DEPLOYMENT_FROZEN
  Y cualquier intento de promoción o liberación de código hacia la flota es rechazado fail-closed
  Y se emite una orden de estabilización y rollback con firma criptográfica SHA-256
```

---

## 4. Mathematical Invariants

1. **Error Budget Headroom**:
   $$EB_{\text{remaining}} = 1.0 - \frac{\sum \text{Errors}}{\text{TotalEvents} \cdot (1.0 - SLO)} \in (-\infty, 1.0]$$
2. **Multi-Burn-Rate Trigger Soundness**:
   $$\text{AlertTier1} \iff (B_{\text{1h}} \ge 14.4) \land (B_{\text{5m}} \ge 14.4)$$
   $$\text{AlertTier2} \iff (B_{\text{6h}} \ge 6.0) \land (B_{\text{30m}} \ge 6.0)$$
3. **Deployment Freeze Invariant**:
   $$\text{DeploymentAllowed} \iff (EB_{\text{remaining}} > 0) \land \neg \text{AlertTier1}$$
