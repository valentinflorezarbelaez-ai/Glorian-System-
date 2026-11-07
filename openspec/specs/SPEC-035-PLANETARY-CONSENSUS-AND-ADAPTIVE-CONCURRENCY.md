# SPEC-035: PLANETARY DISTRIBUTED CONSENSUS, TRUETIME UNCERTAINTY BOUNDS & ADAPTIVE CONCURRENCY LIMITS

<!-- Formal OpenSpec Specification — EARS Syntax & BDD Acceptance Criteria -->

## 1. Specification Metadata

- **Specification ID**: `SPEC-035`
- **Feature Title**: Planetary Distributed Consensus, TrueTime Uncertainty Bounds & Adaptive Concurrency Limits
- **Version**: `42.0.0`
- **Status**: `APPROVED`
- **Author**: `Valentin Florez Arbelaez & EOS JARVIS`
- **Parent Specifications**: `SPEC-028`, `SPEC-030`, `SPEC-032`, `SPEC-034`

---

## 2. Formal Functional Requirements (EARS Syntax)

### FR-099: Google Spanner TrueTime Bounded Clock & Commit-Wait (Ubiquitous)

- `EL SISTEMA` proporcionará lecturas de tiempo con incertidumbre delimitada $[t_{earliest}, t_{latest}]$ calculando la dispersión del oscilador $\epsilon$, e impondrá una espera de confirmación (_commit-wait_) en las transacciones para garantizar que $t_{earliest} > t_{commit}$, logrando consistencia externa (linealizabilidad) sin comunicación entre nodos transcontinentales.

### FR-100: Planetary Raft/Paxos Quorum Consensus & Log Replication (State-Driven)

- `MIENTRAS` un cluster distribuido de $N$ nodos opera en la red, `EL SISTEMA` garantizará que solo un nodo con la mayoría absoluta de votos ($Q = \lfloor N/2 \rfloor + 1$) pueda actuar como Líder, replicando entradas de log de forma monotónica e impidiendo la bifurcación del estado (_split-brain_) ante particiones de red.

### FR-101: Netflix Vegas Adaptive Concurrency Limiter & Load-Shedding (Event-Driven)

- `CUANDO` se produce un pico abrupto de tráfico, `EL SISTEMA` recalculará dinámicamente el límite de concurrencia basándose en el algoritmo TCP Vegas ($queue = limit \times (1 - RTT_{min} / RTT)$), expandiendo el límite cuando no hay congestión y descartando tráfico excesivo proactivamente (_load-shedding_) antes de que el event loop o la latencia $p99$ se degraden.

### FR-102: Multi-Channel CLI & MCP Tool Dispatching (Event-Driven)

- `CUANDO` el usuario o un agente invoque los comandos `eos consensus`, `eos truetime`, `eos concurrency` o las herramientas MCP `eos_consensus_status`, `eos_truetime_now`, `eos_adaptive_concurrency_stats`, `EL SISTEMA` retornará diagnósticos estructurados en JSON y texto con sellos criptográficos SHA-256.

---

## 3. BDD Acceptance Criteria

```gherkin
ESCENARIO: BDD-090 Google Spanner TrueTime y Espera de Confirmación (Commit-Wait)
  DADO el reloj EosTrueTimeBoundedClock configurado con incertidumbre epsilon = 2ms
  CUANDO se consulta el tiempo actual now()
  ENTONCES el intervalo devuelto satisface [earliest, latest] con latest - earliest == 2 * epsilon
  Y CUANDO se ejecuta una transacción con commit-wait
  ENTONCES la función espera hasta que earliest supere el timestamp asignado
  Y dos transacciones secuenciales son estrictamente linealizables (T1.commit < T2.earliest).

ESCENARIO: BDD-091 Consenso Planetario Raft/Paxos con Mayoría de Quórum
  DADO un cluster de 5 nodos distribuidos de EosPlanetaryConsensusEngine
  CUANDO se convoca una elección de líder
  ENTONCES exactamente un nodo obtiene >= 3 votos y asume el rol de LEADER
  Y CUANDO el líder propone una entrada de log
  ENTONCES la entrada solo se marca como COMMITTED tras recibir acuse de recibo de la mayoría (>= 3 nodos)
  Y si una partición aísla a 2 nodos, la partición minoritaria no puede confirmar transacciones.

ESCENARIO: BDD-092 Límite de Concurrencia Adaptativo Netflix Vegas y Descarte Proactivo
  DADO el limitador EosAdaptiveConcurrencyLimiter inicializado con límite inicial de 20
  CUANDO las solicitudes completan con RTT bajo cercano a RTT_min
  ENTONCES el limitador incrementa progresivamente la concurrencia permitida
  Y CUANDO el RTT medido se triplica indicando congestión y encolamiento
  ENTONCES el limitador contrae el límite y rechaza solicitudes en exceso con estado "SHED_LOAD".

ESCENARIO: BDD-093 Exposición MCP y Comandos CLI del Motor de Consenso
  DADO el servidor EosMcpServer en ejecución
  CUANDO se invocan las herramientas "eos_consensus_status", "eos_truetime_now" y "eos_adaptive_concurrency_stats"
  ENTONCES retornan resultados válidos con telemetría en tiempo real, latencias RTT y sellos SHA-256.
```
