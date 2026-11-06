# SPEC-050 — CONTRACT EVOLUTION GOVERNANCE & BREAKING-CHANGE DETECTOR
**Version**: 56.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-043  
**Architecture Decision Record**: ADR-056  
**Domain Layer**: Layer-0 System Core (`src/core/eosContractEvolutionGovernor.ts`)

---

## 1. Executive Summary
Inspired by Nubank Sachem schema evolution and Buf Protobuf compatibility rules, SPEC-050 formalizes the EOS Contract Evolution Governor. The engine parses schema definitions across JSON Schemas, TypeScript interfaces, and SQL DDL tables, evaluates backward-compatibility invariants, flags breaking contractions or migration hazards, and enforces pre-merge gates with zero external runtime npm dependencies.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-165: Semantic Contract Differencing
**Event-Driven**: CUANDO el gobernador recibe un contrato base (vCurrent) y un contrato candidato (vNext), EL SISTEMA calculará una diferencia semántica (AST diff) campo por campo identificando adiciones, eliminaciones, modificaciones de tipo y cambios de nulabilidad.

### FR-166: Clasificación Determinista de Compatibilidad Hacia Atrás
**Ubiquitous / Permanent**: EL SISTEMA clasificará cada cambio en una de tres categorías canónicas: `COMPATIBLE_EXPANSION`, `BREAKING_CONTRACTION` o `DANGEROUS_MUTATION`.

### FR-167: Compuerta de Bloqueo Pre-Merge (Fail-Closed)
**Error / Unwanted Condition**: SI el análisis detecta al menos un cambio clasificado como `BREAKING_CONTRACTION` sin bandera de ruptura autorizada (`allowBreakingChanges: true`), ENTONCES EL SISTEMA rechazará el contrato con estado `BREAKING_CHANGE_REJECTED` y código de salida 1.

### FR-168: Validación de Peligros en Migraciones SQL
**State-Driven**: MIENTRAS se evalúa una migración de esquema relacional SQL, EL SISTEMA analizará el DDL para detectar bloqueos de tabla excesivos, eliminación de columnas (`DROP COLUMN`), o adición de columnas no nulas sin valor por defecto (`NOT NULL` sin `DEFAULT`).

### FR-169: Atestación Criptográfica de Evolución
**Ubiquitous / Permanent**: EL SISTEMA generará un recibo SHA-256 inmutable derivado del hash del contrato base, el hash del contrato candidato y el vector de diferencias.

### FR-170: Registro en Ledger SQLite WAL
**Event-Driven**: CUANDO la auditoría de evolución finaliza, EL SISTEMA registrará la atestación y el diagnóstico en `EosDurableSqliteLedger` bajo la categoría `ARCHITECTURE_DECISION` o `SECURITY_AUDIT`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-161: Backward-Compatible Expansion Acceptance
```gherkin
ESCENARIO: Aprobación de Expansión Compatible hacia Atrás
  DADO un esquema de usuario v1 con campos "id: string" y "name: string"
  CUANDO el esquema candidato añade el campo opcional "email?: string"
  ENTONCES la evaluación clasifica la mutación como "COMPATIBLE_EXPANSION"
  Y el resultado de la compuerta es "APPROVED"
```

### BDD-162: Breaking Field Deletion Rejection
```gherkin
ESCENARIO: Rechazo Estricto de Eliminación de Campo sin Deprecación
  DADO un esquema de pago v1 con campos "transactionId: string", "amount: number", "currency: string"
  CUANDO el esquema candidato elimina el campo "currency"
  ENTONCES la evaluación clasifica la mutación como "BREAKING_CONTRACTION"
  Y la compuerta rechaza el contrato con "BREAKING_CHANGE_REJECTED"
```

### BDD-163: Type Mutation and Nullability Tightening
```gherkin
ESCENARIO: Detección de Mutación de Tipo y Conversión de Opcional a Requerido
  DADO un contrato con campo "age?: number"
  CUANDO el esquema candidato cambia el campo a "age: string" (requerido y string)
  ENTONCES el motor reporta 2 violaciones de incompatibilidad
  Y lista las reglas "FIELD_TYPE_CHANGED" y "OPTIONAL_BECOMES_REQUIRED"
```

### BDD-164: SQL Migration DDL Hazard Detection
```gherkin
ESCENARIO: Detección de Peligros de Migración DDL en Base de Datos
  DADO un script DDL con instrucción "ALTER TABLE orders ADD COLUMN vat_rate NUMERIC NOT NULL;"
  CUANDO el validador analiza el script
  ENTONCES detecta el riesgo "NOT_NULL_WITHOUT_DEFAULT_HAZARD"
  Y recomienda aplicar "DEFAULT" para evitar bloqueo de tabla y fallos de inserción
```

### BDD-165: Cryptographic Contract Attestation & Ledger
```gherkin
ESCENARIO: Generación de Recibo SHA-256 y Registro en SQLite WAL
  DADO un análisis de evolución de contrato completado
  CUANDO se emite el informe de atestación
  ENTONCES el recibo SHA-256 tiene 64 caracteres
  Y se persiste la entrada en el ledger durable
```

### BDD-166: MCP Dispatch of eos_contract_governor
```gherkin
ESCENARIO: Invocación MCP de eos_contract_governor
  DADO un servidor EosMcpServer en perfil "core"
  CUANDO se invoca "eos_contract_governor" con acción "diff"
  ENTONCES retorna el análisis estructurado de diferencias y veredicto de compatibilidad
```
