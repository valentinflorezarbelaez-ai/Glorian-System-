# SPEC-068 — BITEMPORAL TIME-TRAVEL STATE REPLAY & COUNTERFACTUAL ENGINE
**Version**: 67.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-059  
**Architecture Decision Record**: ADR-073  
**Domain Layer**: Layer-0 System Core (`src/core/eosLedgerTimeTravelEngine.ts`)

---

## 1. Executive Summary
Inspired by Datomic bitemporal databases, Stripe event-sourcing ledgers, and FoundationDB deterministic time-travel debuggers, SPEC-068 formalizes the EOS Ledger Time-Travel Engine. Operating with zero external runtime npm dependencies, the engine enables state replay back to any past sequence receipt `seq = K` in the append-only SQLite WAL ledger, rebuilding materialized projections deterministically and supporting isolated counterfactual branching to evaluate "what-if" architectural hypotheses.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-234: Reconstrucción Determinista de Estado en Secuencia K
**Ubiquitous / Permanent**: EL SISTEMA permitirá consultar y materializar el estado del plano de control en cualquier secuencia histórica $1 \le K \le \text{currentSeq}$, aplicando secuencialmente los eventos del ledger hasta la altura solicitada sin mutar el ledger principal.

### FR-235: Verificación Criptográfica Inversa de la Cadena Hash
**State-Driven**: MIENTRAS se realiza el replay temporal hacia el pasado, EL SISTEMA verificará la integridad criptográfica SHA-256 de cada entrada respecto a su predecesora (`prevHash === entryHash[i-1]`), alertando inmediatamente si se detecta cualquier manipulación retroactiva.

### FR-236: Ramificación Contrafactual en Memoria (Counterfactual Sandbox)
**Event-Driven**: CUANDO un arquitecto o agente solicite simular un escenario hipotético alternativo a partir de la secuencia $K$, EL SISTEMA creará una instancia aislada en memoria (`:memory:`) del ledger, bifurcando el historial y permitiendo la ejecución de eventos especulativos.

### FR-237: Emisión de Recibo de Viaje Temporal
**Ubiquitous / Permanent**: EL SISTEMA registrará la atestación de la consulta o simulación contrafactual con su hash SHA-256 en el Ledger.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-211: Deterministic Historical State Replay at Sequence K
```gherkin
ESCENARIO: Replay Exacto de Estado Histórico en Secuencia K = 2
  DADO un ledger con 5 eventos secuenciales registrados
  CUANDO el motor de viaje temporal realiza el replay hasta la secuencia K = 2
  ENTONCES el estado materializado contiene exactamente los datos de las secuencias 1 y 2
  Y la cadena hash entre la secuencia 1 y 2 es validada con éxito
```

### BDD-212: Counterfactual Speculative Ledger Branching
```gherkin
ESCENARIO: Bifurcación Especulativa Contrafactual en Memoria
  DADO un punto de partida en la secuencia K = 3
  CUANDO se inyecta un evento especulativo de reparación en la rama contrafactual
  ENTONCES la rama aislada produce una secuencia 4 alternativa sin alterar el ledger durable principal
  Y el hash de la rama alternativa diverge deterministamente del ledger principal
```
