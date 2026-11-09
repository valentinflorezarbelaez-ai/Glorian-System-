# SPEC-114: Predictive Failure Correlator & Closed-Loop Auto-Remediation Engine

## 1. Overview & Objective

This specification establishes the architectural standard for autonomous failure correlation and closed-loop self-remediation across the EOS fleet. Modeled after the Google Autonomous SRE and Meta Sherlock/Aegis production engineering doctrines, this engine bridges telemetry signals across SLO burn rates, adaptive concurrency gradients, tail-sampled trace error densities, and hedged request rates. When system degradation is detected, the engine matches incident signatures to known failure archetypes and deterministically dispatches targeted, safe, and reversible mitigation playbooks within milliseconds, preventing cascading regional collapses.

---

## 2. Functional Requirements (IEEE 830 / Formal EARS)

### FR-309: Multi-Signal Health Vector Ingestion & Correlation

- **Ubiquitous**: EL SISTEMA recopilará continuamente vectores de telemetría multidimensionales que incluyen:
  - Tasa de consumo de presupuesto de error en 5 minutos y 1 hora ($BurnRate_{5m}$, $BurnRate_{1h}$).
  - Gradiente de congestión adaptativa ($\text{Gradient}_{\text{Vegas}}$) y ocupación de ranuras concurrentes ($\text{InFlight} / \text{Limit}$).
  - Tasa de tramos con error y latencia de cola retenidos por el muestreador de trazas.
  - Tasa de solicitudes duplicadas (_hedged requests_) y descarte por expiración de plazo útil.
- **State-Driven**: MIENTRAS el sistema evalúe el vector de telemetría consolidado, EL SISTEMA calculará el índice compuesto de degradación sistémica ($\text{HealthScore} \in [0, 100]$).

### FR-310: Deterministic Failure Archetype Pattern Matching

- **Event-Driven**: CUANDO el vector de salud indique degradación sistémica ($\text{HealthScore} < 70$ o $BurnRate_{5m} > 14.4$), EL SISTEMA evaluará de forma determinista la concordancia con los siguientes arquetipos:
  - **`ARCHETYPE_CASCADE_TIMEOUT`**: Si la latencia $P99$ supera el umbral SLA, el gradiente de congestión cae por debajo de $0.40$ y el consumo de presupuesto es crítico.
  - **`ARCHETYPE_RETRY_STORM`**: Si el volumen de solicitudes duplicadas/reintentos excede el $5\%$ y la tasa de error 5xx es elevada.
  - **`ARCHETYPE_CONCURRENCY_COLLAPSE`**: Si las solicitudes en vuelo saturan el límite actual y las colas de espera experimentan demoras superiores a 15ms.
  - **`ARCHETYPE_RELEASE_REGRESSION`**: Si se observa un salto discontinuo en la tasa de fallas tras un evento reciente de despliegue o cambio de versión.

### FR-311: Closed-Loop Playbook Execution & Anti-Flapping Hysteresis

- **State-Driven**: MIENTRAS se identifique un arquetipo de falla activo, EL SISTEMA ejecutará el playbook de remediación correspondiente:
  - Ante `ARCHETYPE_CASCADE_TIMEOUT`: Disparar `ACTION_CONCURRENCY_THROTTLE` para contraer el límite concurrente e iniciar el descarte inmediato de niveles no críticos.
  - Ante `ARCHETYPE_RETRY_STORM`: Disparar `ACTION_SUPPRESS_SPECULATIVE_HEDGING` para detener de inmediato la amplificación upstream de tráfico redundante.
  - Ante `ARCHETYPE_CONCURRENCY_COLLAPSE`: Disparar `ACTION_SHED_BEST_EFFORT` para liberar presión de cola.
  - Ante `ARCHETYPE_RELEASE_REGRESSION`: Disparar `ACTION_CANARY_ROLLBACK` o `ACTION_DEPLOYMENT_FREEZE`.
- **Ubiquitous**: EL SISTEMA impondrá un período obligatorio de enfriamiento (_cooldown_, por defecto 30 segundos) entre acciones automáticas sucesivas para evitar oscilaciones destructivas o aleteo (_flapping_).

### FR-312: Reversibility & Automatic Health Restoration

- **Error / Unwanted Condition**: SI tras la ejecución de una remediación el vector de telemetría retorna a un estado saludable y estable durante el período de evaluación ($\text{HealthScore} \ge 90$ y $BurnRate_{5m} \le 1.0$), ENTONCES EL SISTEMA restaurará progresivamente la configuración operativa nominal (`ACTION_REVERT_TO_NOMINAL`), emitiendo un recibo criptográfico SHA-256 de auditoría del ciclo de recuperación cerrado.

---

## 3. Acceptance Criteria (BDD / Gherkin)

```gherkin
ESCENARIO: BDD-295 Remediación Automática de Cascada de Timeouts Downstream (Throttle & Shed)
  DADO un sistema donde la latencia downstream se cuadruplica y el gradiente Vegas cae a 0.25
  CUANDO el correlacionador predictivo detecta un consumo crítico de error budget (BurnRate > 14.4)
  ENTONCES clasifica el incidente como ARCHETYPE_CASCADE_TIMEOUT
  Y ejecuta de forma autónoma el playbook ACTION_CONCURRENCY_THROTTLE
  Y contrae el límite de concurrencia salvaguardando los recursos del sistema

ESCENARIO: BDD-296 Mitigación Autónoma de Tormenta de Reintentos (Thundering Herd)
  DADO un repunte de errores aguas abajo acompañado de un volumen excesivo de solicitudes hedged (> 5%)
  CUANDO el correlacionador evalúa el vector de telemetría consolidado
  ENTONCES identifica el arquetipo ARCHETYPE_RETRY_STORM
  Y ejecuta inmediatamente ACTION_SUPPRESS_SPECULATIVE_HEDGING
  Y suprime la amplificación de carga evitando el colapso del cluster

ESCENARIO: BDD-297 Bloqueo por Cooldown Anti-Flapping y Restauración Progresiva Nominal
  DADO un playbook de remediación recién ejecutado en el sistema
  CUANDO arriba una nueva señal de alerta dentro de la ventana de enfriamiento de 30 segundos
  ENTONCES el motor suprime la ejecución redundante (SUPPRESSED_COOLDOWN_ACTIVE)
  Y cuando los indicadores retornan a la normalidad tras el enfriamiento
  Y emite la orden ACTION_REVERT_TO_NOMINAL restaurando el estado nominal con recibo SHA-256
```

---

## 4. Mathematical Invariants

1. **Anti-Flapping Hysteresis Invariant**:
   $$\forall a_1, a_2 \in \text{MitigationActions}, \quad a_1 \neq a_2 \implies |t(a_2) - t(a_1)| \ge \text{CooldownWindowMs}$$

2. **Archetype Soundness Invariant**:
   $$\text{HealthScore} \ge 90 \land BurnRate_{5m} \le 1.0 \implies \text{ActiveArchetype} = \text{ARCHETYPE_NOMINAL}$$

3. **Conservation of Evaluated Incidents**:
   $$\text{TotalEvaluations} = \text{RemediationsExecuted} + \text{RemediationsSuppressedCooldown} + \text{NominalEvaluations}$$
