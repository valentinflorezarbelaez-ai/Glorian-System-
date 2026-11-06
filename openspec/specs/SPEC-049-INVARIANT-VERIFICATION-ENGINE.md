# SPEC-049 — INVARIANT VERIFICATION ENGINE & EXHAUSTIVE PROPERTY-BASED STATE EXPLORATION
**Version**: 55.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-042  
**Architecture Decision Record**: ADR-055  
**Domain Layer**: Layer-0 System Core (`src/core/eosInvariantVerificationEngine.ts`)

---

## 1. Executive Summary
Inspired by AWS TLA+ in production, FoundationDB / Antithesis Deterministic Simulation Testing (DST), and property-based verification (QuickCheck / Fast-Check), SPEC-049 formalizes the EOS Invariant Verification Engine. The engine provides exhaustive state exploration, pseudo-random fault injection, minimal reproducible failure shrinking, and tamper-evident cryptographic WAL ledger recording with zero external runtime npm dependencies.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-159: Deterministic Seeded State Exploration
**Event-Driven**: CUANDO el motor de verificación recibe un modelo de máquina de estados y una semilla numérica entera, EL SISTEMA ejecutará una exploración determinista donde cada decisión pseudo-aleatoria reproduce la secuencia exacta de transiciones.

### FR-160: Verificación Continua de Invariantes de Seguridad
**Ubiquitous / Permanent**: EL SISTEMA verificará la totalidad de los predicados de invariante registrados (`SafetyInvariant`) después de cada transición de estado ejecutada, abortando la exploración inmediatamente si un predicado evalúa a falso (`INVARIANT_VIOLATION_DETECTED`).

### FR-161: Inyección Hipervisora de Fallos y Caos
**State-Driven**: MIENTRAS la simulación esté en modo de inyección de fallos (`faultInjectionRate > 0`), EL SISTEMA inyectará de forma determinista omisión de mensajes, desorden de eventos y fallos de nodo simulados.

### FR-162: Reducción Mínima de Trazas de Fallo (Shrinking)
**Error / Unwanted Condition**: SI se detecta una violación de invariante durante la simulación, ENTONCES EL SISTEMA ejecutará un algoritmo de reducción (shrinking) que descarte pasos redundantes hasta aislar la secuencia mínima de acciones que reproduce la violación.

### FR-163: Hash Chain de Estados y Atestación Criptográfica
**Ubiquitous / Permanent**: EL SISTEMA calculará un hash SHA-256 acumulativo de la secuencia de estados visitados, produciendo un recibo verificable de exploración exhaustiva.

### FR-164: Registro Duradero en SQLite WAL Ledger
**Event-Driven**: CUANDO la exploración finaliza (sea exitosa o con hallazgo de violación reducida), EL SISTEMA registrará la atestación y la traza en `EosDurableSqliteLedger` bajo la categoría `STATE_MACHINE_VERIFIED` o `INVARIANT_VIOLATION`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-155: Deterministic Exploration Reproducibility
```gherkin
ESCENARIO: Reproducibilidad Exacta de Exploración de Estados con Semilla Determinista
  DADO un modelo de estado de transferencia monetaria con 3 cuentas y una semilla fijada S=1337
  CUANDO el motor ejecuta 1,000 pasos de exploración estocástica en dos ejecuciones independientes
  ENTONCES ambas ejecuciones deben producir exactamente la misma secuencia de estados
  Y el hash SHA-256 acumulado de estados debe ser idéntico bit a bit
```

### BDD-156: Invariant Violation Detection
```gherkin
ESCENARIO: Detección Inmediata de Violación de Invariante de Saldo No Negativo
  DADO un modelo de cuenta con balance inicial 100 y una regla de retiro sin límite
  CUANDO el motor simula retiros concurrentes
  ENTONCES el motor detecta la violación del invariante "balance >= 0"
  Y el resultado reporta "INVARIANT_VIOLATION_DETECTED" con el estado infractor
```

### BDD-157: Fault Injection Tolerance
```gherkin
ESCENARIO: Simulación con Inyección de Fallos de Red y Caos Determinista
  DADO un modelo de consenso de 3 nodos con tasa de pérdida de paquetes del 20%
  CUANDO el motor ejecuta 500 pasos bajo inyección de fallos con semilla fija
  ENTONCES la simulación contabiliza los paquetes descartados
  Y el invariante de consistencia de quórum se mantiene intacto
```

### BDD-158: Minimal Reproducible Trace Shrinking
```gherkin
ESCENARIO: Reducción Automática de Traza de Fallo a Pasos Mínimos
  DADO una traza original de 50 pasos que desencadena una violación en el paso 48
  CUANDO el motor aplica el algoritmo de reducción (shrinking)
  ENTONCES el motor devuelve una traza reducida con sustancialmente menos pasos
  Y la traza reducida reproduce deterministamente la violación del invariante
```

### BDD-159: Cryptographic State Hash Chain & Attestation
```gherkin
ESCENARIO: Generación de Recibo Criptográfico SHA-256 de Espacio de Estados
  DADO una exploración exitosa de 200 estados sin violaciones
  CUANDO el motor compila el informe de atestación
  ENTONCES el recibo SHA-256 tiene una longitud exacta de 64 caracteres hexadecimales
  Y el estado epistémico es "VERIFIED"
```

### BDD-160: MCP Dispatch of eos_invariant_engine
```gherkin
ESCENARIO: Invocación de Herramienta MCP eos_invariant_engine
  DADO un servidor EosMcpServer en perfil "core"
  CUANDO un cliente solicita "tools/call" con nombre "eos_invariant_engine" y acción "explore"
  ENTONCES el servidor ejecuta la exploración de invariantes y retorna el resultado estructurado
  Y la herramienta está disponible en "tools/list"
```
