# OPENSPEC BASE SPECIFICATION: NUBANK INSTITUTIONAL ENGINEERING CODEX (SPEC-023)

<!-- Standard: ISO 29148 / IEEE 830 EARS Syntax -->

## 1. Scope

Governs the institutional assimilation of Nubank's engineering doctrine (`https://building.nu.com/`) into EOS System:

- Fighting Complexity and Functional Programming Purity.
- Datomic Bitemporal Immutable Ledgers (`[entity, attribute, value, tx, added?]`).
- Consumer-Driven Contract Verification (Sachem pattern for schemas).
- Kafka Partitioning, At-Least-Once Delivery, and Banking-Grade Idempotency.
- Blameless Incident Management & Postmortems.
- Autonomous Squad Governance, Service Charters, and RFC consensus.

## 2. Requirements (EARS)

- **UBIQUITOUS (EARS-064)**: THE SYSTEM SHALL evaluate architectural conformance against the 6 Pillars of Nubank Engineering (`building.nu.com`), computing an institutional health score (0 to 100) and identifying mutability violations, lack of contract tests, or broken hexagonal isolation.
- **STATE-DRIVEN (EARS-065)**: WHILE validating schema evolution across microservice boundaries, THE SACHEM GUARD SHALL approve additive non-breaking evolutions (such as adding optional fields) and REJECT breaking mutations (such as removing existing fields or altering required field types).
- **EVENT-DRIVEN (EARS-066)**: WHEN processing transactions in the Datomic simulator, THE SYSTEM SHALL record immutable datom tuples (`entity`, `attribute`, `value`, `tx`, `op`), preserving monotonic transaction timestamps and supporting point-in-time `as-of` historical queries without data mutation.
- **ERROR/UNWANTED (EARS-067)**: IF an operational incident occurs, THEN THE SYSTEM SHALL synthesize a certified blameless postmortem report containing an executive summary, chronological timeline, 5 Whys causal root analysis, systemic cognitive ergonomics evaluation, and actionable remediation items with explicit squad ownership.
- **UBIQUITOUS (EARS-068)**: THE SYSTEM SHALL export Nubank institutional tools via the Model Context Protocol (MCP) and EOS CLI, enabling autonomous agents to execute audits, contract checks, and postmortem synthesis on demand.

## 3. Acceptance Criteria (BDD-053)

```gherkin
ESCENARIO: Nubank Architecture Health Evaluation (Pillar Conformance)
  DADO un conjunto de métricas de arquitectura de un microservicio
  CUANDO se ejecuta evaluateNubankArchitectureHealth
  ENTONCES el sistema calcula el puntaje institucional de 0 a 100
  Y desglosa los 6 pilares de Building Nu con sus recomendaciones específicas.

ESCENARIO: Sachem Consumer-Driven Contract Evolution Verification
  DADO un esquema previo con campos requeridos y opcionales
  CUANDO se evalúa un esquema propuesto que agrega campos opcionales
  ENTONCES la verificación aprueba el cambio como compatible (isCompatible: true)
  Y CUANDO el esquema propuesto remueve un campo requerido
  ENTONCES la verificación rechaza el cambio como incompatible (isCompatible: false) con la lista de violaciones.

ESCENARIO: Datomic Bitemporal Transaction and Time-Travel Simulation
  DADO una base de datos Datomic en estado inicial
  CUANDO se aplican transacciones con aserciones y retracciones de datoms
  ENTONCES el historial conserva todos los hechos pasados de forma inmutable
  Y la consulta asOf retorna exactamente el estado de la entidad en el instante t histórico.

ESCENARIO: Institutional Blameless Postmortem Synthesis
  DADO los datos de un incidente SEV1 con impacto en clientes
  CUANDO se invoca synthesizeNubankBlamelessPostmortem
  ENTONCES el reporte generado incluye análisis de 5 Whys, factores sistémicos y cero atribución de culpa individual.
```
