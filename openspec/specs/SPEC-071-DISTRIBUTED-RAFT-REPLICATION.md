# SPEC-071 — DISTRIBUTED RAFT REPLICATION & MULTI-NODE WAL SYNCHRONIZER
**Version**: 68.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-060  
**Architecture Decision Record**: ADR-076  
**Domain Layer**: Layer-0 System Core (`src/core/eosRaftWalReplicator.ts`)

---

## 1. Executive Summary
Inspired by Google Spanner, Fly.io LiteFS, and the Ongaro-Ousterhout Raft Consensus Protocol, SPEC-071 formalizes the EOS Distributed Raft WAL Replicator. Operating with zero external runtime npm dependencies, the engine coordinates distributed multi-node clusters ($N \ge 3$) maintaining replicated SQLite WAL log entries. It guarantees leader election safety, term monotonicity, log matching invariants, and commit quorum ($\lfloor N/2 \rfloor + 1$), eliminating single-point-of-failure risks without external distributed storage dependencies.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-246: Elección de Líder con Quórum Estricto
**Event-Driven**: CUANDO un nodo seguidor experimenta un tiempo de espera de latido (`electionTimeout`), EL SISTEMA incrementará su término actual, transicionará a `CANDIDATE` y solicitará votos; si y solo si recibe la mayoría de votos afirmativos ($\lfloor N/2 \rfloor + 1$), transicionará a `LEADER`.

### FR-247: Invariante de Término Monotónico y Rechazo de Términos Obsoletos
**State-Driven**: MIENTRAS un nodo reciba cualquier mensaje con un término inferior a su término local, EL SISTEMA rechazará el voto o la entrada de log (`TERM_OBSOLETE`), y si recibe un término superior, actualizará inmediatamente su estado local a `FOLLOWER`.

### FR-248: Replicación de Entradas de Log y Latido Periódico
**Ubiquitous / Permanent**: EL SISTEMA replicará nuevas transacciones del SQLite WAL a través de mensajes `AppendEntries`, exigiendo acuse de recibo de quórum antes de avanzar el índice de confirmación (`commitIndex`).

### FR-249: Integridad de Coincidencia de Logs (Log Matching Property)
**Error / Unwanted Condition**: SI dos logs en nodos distintos contienen una entrada con el mismo índice y término, ENTONCES EL SISTEMA garantiza que ambos logs son idénticos en todas las entradas anteriores.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-217: Raft Leader Election and Majority Quorum
```gherkin
ESCENARIO: Elección de Líder con 3 Nodos en Quórum
  DADO un clúster Raft de 3 nodos (node-1, node-2, node-3) en término 0
  CUANDO node-1 inicia una elección y solicita votos
  ENTONCES recibe 2 votos (el suyo y el de node-2, quórum 2/3)
  Y node-1 es promovido a LEADER en término 1
```

### BDD-218: Multi-Node Replicated Log Commits on Quorum ACK
```gherkin
ESCENARIO: Confirmación Replicada de Transacción SQLite WAL
  DADO un líder establecido en el término 1
  CUANDO el líder envía una entrada AppendEntries con datos de transacción
  ENTONCES al recibir acuse de 1 seguidor (quórum 2 de 3)
  Y el commitIndex del líder y de los seguidores se actualiza a la nueva altura
```
