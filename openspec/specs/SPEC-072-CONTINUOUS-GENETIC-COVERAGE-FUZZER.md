# SPEC-072 — CONTINUOUS GENETIC COVERAGE-GUIDED FUZZING DAEMON
**Version**: 68.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-060  
**Architecture Decision Record**: ADR-077  
**Domain Layer**: Layer-0 System Core (`src/core/eosGeneticCoverageFuzzer.ts`)

---

## 1. Executive Summary
Inspired by Google OSS-Fuzz, LibFuzzer, and Meta Sapienz, SPEC-072 formalizes the EOS Continuous Genetic Coverage-Guided Fuzzing Daemon. Operating with zero external runtime npm dependencies, the engine generates stochastic mutations over seed corpora (boundary values, byte flips, AST permutations, type confusions), measures execution state transitions and branch coverage fingerprints, preserves high-entropy corpus discoveries, and isolates reproducible crash artifacts for autonomous self-healing via `EosSapFixAutoshipper`.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-250: Mutaciones Genéticas Polimórficas de Entradas
**Ubiquitous / Permanent**: EL SISTEMA aplicará operadores estocásticos de mutación (inversión de bits, enteros en los límites de coma flotante, desbordamientos de enteros, caracteres nulos y secuencias recursivas) sobre el corpus de semillas.

### FR-251: Expansión de Corpus Guiada por Novedad de Cobertura
**State-Driven**: MIENTRAS una mutación genere un nuevo hash de estado o una ruta de ejecución no observada previamente, EL SISTEMA incorporará la muestra mutada al corpus de semillas activo para exploración evolutiva posterior.

### FR-252: Aislamiento Automático de Fallos (Crash Artifact Capture)
**Error / Unwanted Condition**: SI la ejecución de una mutación desencadena una excepción no controlada, un fallo de aserción o un desbordamiento, ENTONCES EL SISTEMA capturará la semilla mínima reproducible, calculará su digest SHA-256 y lo registrará en el Ledger como incidente crítico.

### FR-253: Despacho FDIR hacia Meta SapFix
**Event-Driven**: CUANDO se identifique un fallo reproducible, EL SISTEMA emitirá un evento para que el módulo de auto-reparación AST sintetice un parche sin intervención humana.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-219: Corpus Evolution on Novel Execution Fingerprint Discovery
```gherkin
ESCENARIO: Descubrimiento y Conservación de Semillas con Alta Novedad
  DADO un fuzzer inicializado con un corpus base de 2 semillas
  CUANDO ejecuta 100 ciclos de mutación estocástica sobre una función objetivo
  ENTONCES el corpus se expande automáticamente al encontrar huellas de ejecución únicas
  Y el fuzzer emite estadísticas de cobertura sin fugas de memoria
```

### BDD-220: Deterministic Crash Capture and SHA-256 Incident Receipt
```gherkin
ESCENARIO: Captura de Excepción Provocada por Inyección Límite
  DADO una función objetivo que falla ante un valor entero específico (-999999)
  CUANDO el fuzzer muta el input y golpea la condición de fallo
  ENTONCES captura el payload exacto del fallo con su stack trace
  Y emite un recibo criptográfico SHA-256 registrado en SQLite WAL
```
