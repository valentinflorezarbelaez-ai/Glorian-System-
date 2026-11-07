# SPEC-111: Distributed Adaptive Hedged Requests & Deadline Propagation Mesh

## 1. Overview & Objective

This specification establishes the architectural standard for tail latency mitigation across the EOS microservice and fleet network. Implementing the Google Research _"The Tail at Scale"_ doctrine (Jeff Dean & Luiz André Barroso), this mesh provides speculative hedged request dispatching, distributed deadline budget propagation, and token-bucket storm suppression with 100% Layer 0 purity.

---

## 2. Functional Requirements (IEEE 830 / Formal EARS)

### FR-297: Running Percentile Reservoir & Adaptive Hedging Delay

- **Ubiquitous**: EL SISTEMA mantendrá un reservorio deslizante acotado de latencias observadas por servicio y endpoint, recalculando de forma determinista los percentiles $P50$, $P95$ y $P99$.
- **State-Driven**: MIENTRAS el número de muestras sea inferior al umbral mínimo de calentamiento (e.g. 20 muestras), EL SISTEMA utilizará una latencia por defecto configurable antes de habilitar el despacho de réplicas especulativas.

### FR-298: Speculative Hedged Duplicate Dispatch & Cancellation

- **Event-Driven**: CUANDO una solicitud primaria despachada a una réplica no haya retornado respuesta transcurrido el tiempo $P95$ observado, EL SISTEMA despachará automáticamente una solicitud duplicada especulativa (hedged request) a una réplica o celda alternativa.
- **Event-Driven**: CUANDO cualquiera de las solicitudes (primaria o especulativa) retorne una respuesta exitosa, EL SISTEMA completará inmediatamente la promesa del llamador y abortará de forma cooperativa la solicitud restante mediante `AbortController`.

### FR-299: Contextual Deadline Budget Propagation & Early Shedding

- **Ubiquitous**: EL SISTEMA propagará un contexto de presupuesto de plazo estricto ($\Delta t_{\text{budget}}$) en cada invocación entre servicios.
- **Error / Unwanted Condition**: SI el presupuesto de plazo restante antes de despachar una operación es menor o igual a cero ($\Delta t_{\text{remaining}} \le 0$), ENTONCES EL SISTEMA descartará inmediatamente la ejecución (fail-fast shedding) retornando un error `DEADLINE_EXCEEDED` sin saturar la infraestructura downstream.

### FR-300: Anti-Storm Hedging Token Bucket & Headroom Cap

- **Ubiquitous**: EL SISTEMA regulará el volumen global de solicitudes especulativas mediante un algoritmo de Token Bucket adaptativo con una tasa máxima de consumo del 5% ($\le 0.05 \times \text{TotalRequests}$).
- **Error / Unwanted Condition**: SI el acumulador de hedging excede el 5% de las solicitudes totales en la ventana móvil, ENTONCES EL SISTEMA suprimirá temporalmente el despacho de solicitudes especulativas, evitando cascadas de sobrecarga y colapso sistémico.

---

## 3. Acceptance Criteria (BDD / Gherkin)

```gherkin
ESCENARIO: BDD-285 Mitigación de Latencia de Cola Mediante Réplica Especulativa Hedged
  DADO un servicio con percentil P95 histórico de 40ms y réplicas disponibles [R1, R2]
  CUANDO se despacha una solicitud primaria a R1 y esta sufre un retraso transitorio de 150ms
  ENTONCES el gobernador despacha una réplica especulativa a R2 al cumplirse los 40ms
  Y R2 responde en 15ms (tiempo total acumulado: 55ms)
  Y el llamador recibe la respuesta en 55ms en lugar de 150ms (reducción > 60% de latencia de cola)
  Y la solicitud rezagada en R1 es cancelada cooperativamente

ESCENARIO: BDD-286 Descarte Temprano por Agotamiento de Presupuesto de Plazo (Deadline Shedding)
  DADO un llamador con un presupuesto de plazo total de 100ms
  CUANDO el procesamiento intermedio local consume 105ms antes de invocar el siguiente nodo
  ENTONCES el gobernador detecta un presupuesto restante negativo (-5ms)
  Y descarta la llamada downstream inmediatamente con código DEADLINE_EXCEEDED
  Y previene el consumo de ciclos de CPU y saturación inútil en el servicio downstream

ESCENARIO: BDD-287 Supresión de Tormenta de Hedging ante Degradación Global
  DADO un sistema donde el 100% de las réplicas sufren degradación simultánea
  CUANDO se despachan solicitudes y la cuota de hedging alcanza el límite de seguridad del 5%
  ENTONCES el token bucket bloquea el despacho de nuevas solicitudes hedged
  Y las solicitudes subsecuentes continúan solo con su canal primario
  Y se evita el colapso por tormenta de réplicas redundantes (anti-storm guarantee)
```

---

## 4. Mathematical Invariants

1. **Hedging Rate Invariant**:
   $$\frac{\sum \text{HedgedRequests}}{\sum \text{TotalRequests}} \le 0.05 \quad (\text{Hedging Storm Prevention})$$
2. **Effective Latency Invariant**:
   $$L_{\text{effective}} = \min(L_{\text{primary}}, P95 + L_{\text{hedged}}) \le L_{\text{primary}}$$
3. **Deadline Monotonicity Invariant**:
   $$\forall \text{ hop } i \in [1..k], \quad \Delta t_{\text{remaining}}^{(i)} = \Delta t_{\text{remaining}}^{(i-1)} - \Delta t_{\text{hop}}^{(i)} \le \Delta t_{\text{remaining}}^{(i-1)}$$
