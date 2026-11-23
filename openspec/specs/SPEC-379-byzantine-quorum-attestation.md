# SPEC-379: Byzantine Quorum Attestation, Cross-Fleet Deterministic Snapshot & Idempotent Verification Gate Governor

## Metadata

- **Specification ID**: `SPEC-379`
- **Change Reference**: `CHANGE-241`
- **Version**: `1.0.0`
- **Status**: APPROVED
- **Domain**: Byzantine Fault Tolerance / Quorum Certificates / Equivocation Slashing / WASM Linear Memory / Idempotent Verification
- **Author**: Valentin Florez Arbelaez & Google Antigravity (Glorian Core Architects)
- **Compliance**: IEEE 830 EARS Requirements, BDD Acceptance Criteria, Zero Third-Party Dependencies (Law V)

---

## 1. Executive Summary & Architectural Invariants

`SPEC-379` defines Glorian System's **Byzantine Quorum Attestation & Cross-Fleet Deterministic Snapshot Governor** (`EosByzantineQuorumGovernorCore`), completing Phase 5 (`SPEC-305` through `SPEC-379`). Modeled after HotStuff/Tendermint Byzantine Quorum Certificates and Google Borg/Spanner epoch checkpointing, it seals converged Merkle-CRDT fleet states (`SPEC-308`) and autonomous reconciliation cycles (`SPEC-307`) into tamper-evident epoch snapshots verified by a $2f + 1$ supermajority validator quorum.

Additionally, `SPEC-379` enforces **Idempotent Verification Gate Hygiene** across `scripts/run-tlc.mjs` and `scripts/verify-cicd-pipeline.mjs`, guaranteeing that verification runs neither downgrade verified receipts nor dirty the working tree on unchanged state.

---

## 2. IEEE 830 Functional Requirements (EARS Syntax)

### FR-379-01: Cálculo de Umbral Supermayoritario Bizantino y Propuesta de Época (Ubiquitous)

EL SISTEMA calculará determinísticamente para un conjunto de $N \ge 4$ validadores la tolerancia máxima a fallos bizantinos $f = \lfloor (N - 1) / 3 \rfloor$ y el umbral de quórum supermayoritario $Q = \lfloor 2N / 3 \rfloor + 1$, generando propuestas de época inmutables identificadas por `proposalId` (SHA-256 sobre altura de época, raíz Merkle de flota y hash de convergencia CRDT).

### FR-379-02: Atestación Criptográfica y Síntesis de Certificado de Quórum (Event-Driven)

CUANDO los validadores registrados emiten votos firmados criptográficamente sobre una propuesta de época, EL SISTEMA verificará la autenticidad de cada firma y, al alcanzar al menos $Q$ votos válidos de actores honestos no penalizados, sellará un Certificado de Quórum (`QuorumCertificate`) con estado `QUORUM_COMMITTED`.

### FR-379-03: Detección de Equivocación (Doble Firma) y Slashing Bizantino (Error / Unwanted Condition)

SI un mismo validador emite dos votos con firmas válidas para raíces de estado distintas en la misma altura de época (`epochHeight`), ENTONCES EL SISTEMA detectará inmediatamente la equivocación, generará una prueba criptográfica de penalización (`EquivocationSlashProof`), aislará al validador en estado `SLASHED_QUARANTINED` y revocará sus votos del conteo de quórum.

### FR-379-04: Aceleración de Máscara de Bits de Quórum en Memoria Lineal WASM (Event-Driven)

CUANDO se agreguen los votos de participación de un comité de validadores, EL SISTEMA codificará el mapa de bits de votantes en memoria lineal (`WebAssembly.Memory` / `Uint32Array`) y ejecutará el conteo de bits activos (popcount de Hamming) y el resumen de compromiso en tiempo sub-microsegundo con cero asignaciones de heap externas.

### FR-379-05: Preservación Idempotente de Recibos de Verificación y Anti-Degradación (Ubiquitous)

EL SISTEMA preservará la idempotencia de los recibos criptográficos de verificación (`TLC_RECEIPT.json` y recibos de auditoría) evitando sobrescribir marcas de tiempo cuando el estado material verificado no ha cambiado y prohibiendo la degradación de un recibo `LIVE_LOCAL_TLC` (`VERIFIED`) durante ejecuciones en entornos diferidos o de solo lectura.

### FR-379-06: Emisión de Recibo Criptográfico de Quórum Bizantino de Flota (Event-Driven)

CUANDO se ejecute la auditoría integral del gobernador de quórum bizantino (`toolchain:quorum:audit`), EL SISTEMA verificará la convergencia de época de los 9 proyectos de la flota y emitirá un recibo criptográfico en `docs/evidence/BYZANTINE_QUORUM_RECEIPT.json`.

---

## 3. BDD Acceptance Criteria

### BDD-2065: Byzantine Supermajority Threshold Calculation and Deterministic Epoch Proposal

```gherkin
ESCENARIO: Creación de propuesta de época y cálculo de umbral BFT (N = 3f + 1)
  DADO un comité de 7 validadores registrados en EosByzantineQuorumGovernorCore
  CUANDO se calcula la geometría de quórum y se propone el snapshot de la época 1
  ENTONCES la tolerancia bizantina máxima f es igual a 2 y el umbral de quórum Q es igual a 5
  Y la propuesta generada posee un proposalId SHA-256 determinista de 64 caracteres hexadecimales.
```

### BDD-2066: Supermajority Quorum Certificate Formation on Honest Attestations

```gherkin
ESCENARIO: Sellado de Certificado de Quórum al alcanzar 2f + 1 votos honestos
  DADO una propuesta activa en la época 1 con umbral de quórum Q = 5 sobre 7 validadores
  CUANDO 5 validadores honestos emiten votos firmados criptográficamente para la misma raíz de estado
  ENTONCES el gobernador sintetiza un QuorumCertificate con estado QUORUM_COMMITTED
  Y registra exactamente 5 firmas válidas verificadas.
```

### BDD-2067: Byzantine Equivocation Detection, Slashing Proof, and Vote Exclusion

```gherkin
ESCENARIO: Detección de doble firma en la misma época y aislamiento del validador bizantino
  DADO un validador registrado que vota por la raíz de estado A en la época 2
  CUANDO el mismo validador emite un segundo voto por una raíz de estado conflictiva B en la época 2
  ENTONCES el sistema detecta la anomalía de equivocación y emite un EquivocationSlashProof verificable
  Y el validador queda marcado como SLASHED_QUARANTINED y sus votos son excluidos del quórum.
```

### BDD-2068: WASM Linear Memory Voter Bitmask Aggregation and Popcount Acceleration

```gherkin
ESCENARIO: Agregación de máscara de bits de quórum en memoria lineal tipada
  DADO un conjunto de índices de validadores participantes en un comité BFT
  CUANDO se ejecuta aggregateQuorumBitmaskLinearMemory() sobre un buffer de memoria lineal
  ENTONCES el conteo de bits activos (popcount) coincide exactamente con el número de votantes únicos
  Y la operación completa su ejecución con 0 dependencias externas.
```

### BDD-2069: Idempotent Receipt Preservation and Non-Downgrade Deferred Verification

```gherkin
ESCENARIO: Preservación idempotente de recibos y modo DEFERRED_TO_CI hermético
  DADO un recibo auditByzantineQuorumPipeline con firma SHA-256 sin cambios materiales y una ejecución runTlcVerification en modo diferido
  CUANDO se re-ejecuta la auditoría de quórum sobre el mismo recibo y runTlcVerification({ forceMock: true }) en un archivo temporal
  ENTONCES el sistema preserva timestampIso y linearMemoryDurationNs sin ensuciar el árbol Git
  Y emite executionMode = DEFERRED_TO_CI con reproducibleByMergeGate = false sin alterar docs/evidence/TLC_RECEIPT.json.
```

### BDD-2070: End-to-End Cross-Fleet Byzantine Quorum Audit Receipt Generation

```gherkin
ESCENARIO: Auditoría integral del gobernador de quórum bizantino en los 9 proyectos de flota
  DADO el plano de control Glorian con los 9 repositorios registrados
  CUANDO se invoca auditByzantineQuorumPipeline()
  ENTONCES se emite el recibo docs/evidence/BYZANTINE_QUORUM_RECEIPT.json con estado VERIFIED
  Y certifica los 9 proyectos de flota, la formación de quórum, el slashing bizantino y la firma SHA-256.
```
