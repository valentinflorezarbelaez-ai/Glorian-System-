# SPEC-313 — Jepsen-Grade Distributed Network Partition & Chaos Simulator

- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: `APPROVED`
- **Milestone**: `v77.0.0`
- **TLA+ Companion**: `docs/formal/JepsenDistributedChaos.tla`

---

## 1. Functional Requirements (IEEE 830 EARS)

### FR-1: Deterministic Multi-Node Topology & PRNG Seed Initialization

- **Pattern**: Ubiquitous / Permanent
- **EARS**: THE SYSTEM SHALL initialize a discrete-event virtual network connecting $N$ autonomous nodes with an explicit pseudo-random seed to guarantee 100% deterministic reproducibility across chaos simulation runs.

### FR-2: Symmetric & Asymmetric Network Partition Injection

- **Pattern**: Event-Driven
- **EARS**: CUANDO a network partition is injected, EL SISTEMA SHALL partition the node graph into disjoint subsets or directed severed links, dropping or isolating any cross-partition inter-node communication.

### FR-3: Probabilistic Packet Loss & Latency Jitter

- **Pattern**: Event-Driven
- **EARS**: CUANDO messages traverse the virtual network, EL SISTEMA SHALL drop packets according to a configurable loss rate $p \in [0, 1]$ and inject simulated delivery latency and jitter without affecting deterministic simulation ordering.

### FR-4: Clock Skew & Drift Emulation

- **Pattern**: State-Driven
- **EARS**: MIENTRAS clock skew is active on target nodes, EL SISTEMA SHALL offset node-local wall timestamps and perturb vector clock ordering to evaluate anti-entropy conflict resolution resilience.

### FR-5: Cluster Partition Healing & Anti-Entropy State Convergence

- **Pattern**: Event-Driven
- **EARS**: CUANDO the cluster is healed via `healCluster()`, EL SISTEMA SHALL restore full network connectivity and execute anti-entropy gossip synchronization until all non-faulty nodes reach identical state ($\forall i, j: \text{state}_i = \text{state}_j$).

### FR-6: Knossos-Style Operation History & Invariant Auditing

- **Pattern**: Ubiquitous / Permanent
- **EARS**: EL SISTEMA SHALL maintain an immutable invocation/completion operation history, verify sequential consistency, and emit a signed SHA-256 evidence receipt at `docs/evidence/JEPSEN_DISTRIBUTED_CHAOS_RECEIPT.json`.

---

## 2. Acceptance Criteria (BDD / Gherkin)

### BDD-1653: Deterministic Topology Initialization & Seed Reproducibility

```gherkin
ESCENARIO: Validar inicialización determinista de topología con semilla
  DADO un cluster virtual configurado con 5 nodos y semilla numérica 42
  CUANDO se inicializa el cluster con createJepsenCluster
  ENTONCES se generan exactamente 5 nodos interconectados
  Y dos ejecuciones independientes con la misma semilla producen secuencias idénticas de eventos
  Y cada nodo inicia con vector clock vacío y estado consistente
```

### BDD-1654: Symmetric Network Partition & Cross-Partition Isolation

```gherkin
ESCENARIO: Inyección de partición simétrica y bloqueo de mensajes
  DADO un cluster de 5 nodos dividido en dos particiones disjoint {node-0, node-1} y {node-2, node-3, node-4}
  CUANDO un nodo en la primera partición envía un mensaje a un nodo en la segunda partición
  ENTONCES el mensaje es bloqueado y no entregado en el destinatario
  Y la comunicación intra-partición permanece operativa
```

### BDD-1655: Asymmetric Network Partition (Directed Blackhole)

```gherkin
ESCENARIO: Inyección de partición asimétrica unidireccional
  DADO un enlace dirigido bloqueado entre node-0 y node-1
  CUANDO node-0 envía un mensaje a node-1
  ENTONCES el mensaje de node-0 a node-1 es descartado
  Y CUANDO node-1 envía un mensaje a node-0 el mensaje es entregado exitosamente
```

### BDD-1656: Probabilistic Packet Loss & Latency Jitter

```gherkin
ESCENARIO: Simulación de pérdida de paquetes con tasa configurable
  DADO un cluster configurado con tasa de pérdida de paquetes p = 0.50
  CUANDO se transmiten 100 mensajes a través del canal virtual
  ENTONCES la cantidad de mensajes descartados coincide estadísticamente con la probabilidad configurada
  Y los mensajes entregados conservan integridad de carga útil
```

### BDD-1657: Partition Healing & Eventual Anti-Entropy Convergence

```gherkin
ESCENARIO: Sanación de red y convergencia anti-entropía de estado
  DADO un cluster particionado donde se ejecutan escrituras concurrentes en particiones aisladas
  CUANDO se invoca healCluster y se ejecuta la sincronización anti-entropía
  ENTONCES todas las particiones se disuelven y se restablecen los enlaces
  Y todos los nodos convergen al mismo estado determinista (estado_i == estado_j para todo i, j)
```

### BDD-1658: Operation History Auditing & Cryptographic Receipt Generation

```gherkin
ESCENARIO: Auditoría de historia de operaciones y generación de recibo SHA-256
  DADO un ciclo completo de operaciones concurrentes bajo caos de red y posterior sanación
  CUANDO se audita el registro de operaciones con auditJepsenHistory
  ENTONCES no se detectan violaciones de consistencia secuencial o estados corruptos
  Y se emite un recibo criptográfico firmado con SHA-256 en docs/evidence/JEPSEN_DISTRIBUTED_CHAOS_RECEIPT.json
```
