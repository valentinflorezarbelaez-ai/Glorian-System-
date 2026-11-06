# SPEC-062 — CONTENT-ADDRESSABLE STORAGE (CAS) & TEST ACTION CACHE ENGINE
**Version**: 66.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-055  
**Architecture Decision Record**: ADR-067  
**Domain Layer**: Layer-0 System Core (`src/core/eosContentAddressableCache.ts`)

---

## 1. Executive Summary
Inspired by Google Bazel Remote Execution API (REAPI), Content-Addressable Storage (CAS), and Turborepo/Nx deterministic action caching, SPEC-062 formalizes the EOS Content-Addressable Storage & Test Action Cache Engine. Operating under strict Layer-0 purity with zero external runtime npm dependencies, the engine hashes AST nodes and environment parameters into immutable 64-character SHA-256 action keys, retrieves previous verification results in $O(1)$ (<2ms), avoids redundant re-execution of unchanged suites, and persists cryptographic attestations into the durable SQLite WAL ledger.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-206: Content-Addressable Storage (CAS) Blob Management
**Ubiquitous / Permanent**: EL SISTEMA almacenará artefactos y buffers indexados exclusivamente por su digest criptográfico SHA-256 (`casKey = sha256(content)`), garantizando inmutabilidad y deduplicación bit a bit.

### FR-207: Deterministic Action Key Computation (AST + Env + Command)
**Event-Driven**: CUANDO se programa la ejecución de una prueba o compilación, EL SISTEMA calculará el `ActionKey` combinando el hash AST de los archivos fuente, las variables del entorno y el comando de ejecución.

### FR-208: O(1) Cache Hit & Instant Replay
**State-Driven**: MIENTRAS el `ActionKey` exista en el Action Cache (AC), EL SISTEMA retornará el resultado memorizado (`exitCode`, `stdout`, `durationUs: 0`) en menos de 2 milisegundos sin re-ejecutar el subproceso.

### FR-209: Invalidation on Source Mutation
**Error / Unwanted Condition**: SI cualquier archivo fuente o dependencia transitiva es modificado, ENTONCES el hash resultante no coincidirá con la entrada anterior, forzando la re-ejecución limpia y actualizando el CAS.

### FR-210: Persistencia en Ledger SQLite WAL
**Ubiquitous / Permanent**: EL SISTEMA registrará las estadísticas de ahorro de tiempo y aciertos de caché en `EosDurableSqliteLedger` bajo la categoría `PERFORMANCE_AUDIT`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-190: Deterministic CAS Blob Storage and Deduplication
```gherkin
ESCENARIO: Almacenamiento y Recuperación Inmutable en CAS
  DADO un buffer de código fuente con hash SHA-256 conocido
  CUANDO se guarda en el motor EosContentAddressableCache
  ENTONCES retorna la clave CAS exacta de 64 caracteres
  Y guardar el mismo contenido dos veces resulta en 100% de deduplicación
```

### BDD-191: Action Cache Hit and Redundant Execution Avoidance
```gherkin
ESCENARIO: Acierto de Caché O(1) y Omisión de Ejecución Redundante
  DADO un resultado de test previo asociado a un ActionKey
  CUANDO se consulta el Action Cache con el mismo ActionKey
  ENTONCES retorna un acierto (cacheHit: true) en menos de 2 ms
  Y omite la re-ejecución del proceso
```
