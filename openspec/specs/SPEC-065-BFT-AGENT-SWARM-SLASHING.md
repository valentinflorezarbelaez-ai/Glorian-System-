# SPEC-065 — BYZANTINE FAULT TOLERANT (BFT) AGENT SWARM & SLASHING HYPERVISOR
**Version**: 66.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-058  
**Architecture Decision Record**: ADR-070  
**Domain Layer**: Layer-0 System Core (`src/core/eosBftAgentSwarmSlashing.ts`)

---

## 1. Executive Summary
Inspired by Google DeepMind multi-agent debate protocols, PBFT (Practical Byzantine Fault Tolerance), and Proof-of-Stake cryptographic slashing mechanisms, SPEC-065 formalizes the EOS BFT Agent Swarm & Slashing Hypervisor. Operating under strict Layer-0 purity with zero external runtime npm dependencies, the engine coordinates swarms of autonomous agents ($N \ge 4$), enforces a $3f + 1$ supermajority Byzantine consensus quorum before code modifications are certified, slashes reputation stakes of agents that propose unconstitutional or hallucinated mutations, and records tamper-evident attestations in the durable SQLite WAL ledger.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-221: Formación de Enjambre con Quórum Bizantino (3f + 1)
**Ubiquitous / Permanent**: EL SISTEMA organizará la votación de propuestas de código entre $N \ge 4$ subagentes independientes, exigiendo un quórum de supermayoría de $\ge \lceil (2N + 1) / 3 \rceil$ para declarar una propuesta aprobada (`CONSENSUS_REACHED`).

### FR-222: Penalización Quirúrgica por Slashing Criptográfico
**Error / Unwanted Condition**: SI un subagente emite un voto que aprueba una violación de la Constitución o una mutación alucinada sin evidencia (`CONSTITUTIONAL_BREACH_DETECTED`), ENTONCES EL SISTEMA deducirá inmediatamente el 50% de su reputación staked (`SLASHED`), revocando su derecho de voto y enviándolo a cuarentena.

### FR-223: Incentivo de Reputación por Validación Conforme
**State-Driven**: MIENTRAS un subagente emita votos alineados con la verdad matemática y las 7 Aduanas de verificación, EL SISTEMA incrementará su reputación en +5 unidades, fortaleciendo su peso en el consenso.

### FR-224: Veto Inviolable de Mesa de Seguridad y Verificación
**Ubiquitous / Permanent**: EL SISTEMA garantizará que cualquier voto negativo fundamentado en una vulnerabilidad de seguridad o ruptura de pruebas ejercerá poder de VETO instantáneo, independientemente del número de votos a favor.

### FR-225: Persistencia en Ledger SQLite WAL
**Ubiquitous / Permanent**: EL SISTEMA registrará las actas de votación del enjambre, las penalizaciones de slashing y los hashes SHA-256 en `EosDurableSqliteLedger` bajo la categoría `CONSENSUS_AUDIT`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-196: Supermajority BFT Consensus Voting
```gherkin
ESCENARIO: Aprobación por Supermayoría Bizantina de 4 Agentes
  DADO un enjambre de 4 agentes (Architecture, Security, Quality, Verifier)
  CUANDO se somete a votación un parche legítimo verificado con exit code 0
  ENTONCES al menos 3 de 4 agentes votan a favor (quórum 75% >= 67%)
  Y el hipervisor declara "CONSENSUS_REACHED" con recibo SHA-256
```

### BDD-197: Malicious Mutation Detection and Slashing Execution
```gherkin
ESCENARIO: Slashing Inmediato de Agente por Voto Inconstitucional
  DADO un agente corrupto o alucinado que vota a favor de omitir pruebas
  CUANDO el hipervisor detecta la violación del Mandamiento II
  ENTONCES aplica un slashing de -50 puntos sobre su stake de reputación
  Y cambia su estado a "SLASHED_QUARANTINED"
```
