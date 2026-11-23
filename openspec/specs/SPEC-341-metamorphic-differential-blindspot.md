# SPEC-341: Metamorphic, Differential & Structural-Shrinking Blind-Spot Hunter Engine

**Status**: `APPROVED`

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Event-Driven)**: CUANDO se invoca `checkStructuralProperty` con un predicado y una semilla determinista, EL SISTEMA genera valores JSON estructurales arbitrarios (`generateArbitraryJsonValue`) mediante un PRNG Mulberry32 sin dependencias externas y, ante cualquier contraejemplo que viole la propiedad, ejecuta _shrinking_ estructural recursivo (`shrinkJsonValue`) reduciendo arreglos, objetos, cadenas y números hasta obtener el contraejemplo mínimo reproducible.
- **FR-2 (Event-Driven)**: CUANDO se ejecuta `runDifferentialCampaign(referenceFn, candidateFn)`, EL SISTEMA somete ambas implementaciones a entradas generadas deterministamente y compara sus salidas serializadas canonizadas; SI detecta divergencia semántica o excepción inesperada en el candidato, reduce la entrada discrepante a su forma mínima y reporta `equivalent: false`.
- **FR-3 (Event-Driven)**: CUANDO se invoca `verifyMetamorphicRelation` con una relación metamórfica registrada (`SORT_PERMUTATION_IDEMPOTENCE`, `FILTER_SUBSET_MONOTONICITY` o `JSON_ROUNDTRIP_INVERTIBILITY`), EL SISTEMA evalúa si se preserva el invariante relacional $R(f(x), f(T(x)))$ en todas las corridas sin requerir etiquetas exactas precalculadas.
- **FR-4 (Event-Driven)**: CUANDO se ejecuta `runBoundaryFuzzCampaign` sobre un manejador HTTP/JSON-RPC con `iterations` (por defecto `500`, acotado `1..5000`), EL SISTEMA bombardea el manejador con cargas útiles arbitrarias y malformadas, exige cero excepciones no capturadas y cero códigos de estado `>= 500`, reduce cualquier carga fallida y calcula `stabilityScore`.
- **FR-5 (Error / Unwanted Condition)**: SI los parámetros de semilla, conteo de corridas, profundidad máxima o manejadores incumplen los contratos válidos (no finitos, fuera de rango o tipos inválidos), ENTONCES EL SISTEMA falla de forma fail-closed lanzando `BlindSpotError` con el código correspondiente (`BLINDSPOT_INVALID_PARAMETERS`, `BLINDSPOT_EXECUTION_FAILED`, `BLINDSPOT_INVARIANT_BREACH`).
- **FR-6 (Ubiquitous)**: EL SISTEMA expone `audit()` con recibo determinista firmado por SHA-256 en `docs/evidence/BLINDSPOT_HUNTER_RECEIPT.json` (cuando se invoca vía CLI), comandos `toolchain:blindspot:*` y la herramienta MCP nativa `eos_blindspot_hunter_audit`.

---

## 2. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1821 Generación Estructural Recursiva y Shrinking de Contraejemplos
  DADO una propiedad de ordenamiento numérico evaluada sobre la ordenación lexicográfica ingenua `[...arr].sort()`
  CUANDO se ejecuta checkStructuralProperty sobre arreglos de enteros generados por Mulberry32
  ENTONCES el motor descubre el punto ciego lexicográfico y reduce la falla mediante shrinkJsonValue a un contraejemplo mínimo de 2 elementos
  Y también reduce árboles de objetos/arreglos anidados manteniendo la determinicidad de la semilla.

ESCENARIO: BDD-1822 Oráculo de Pruebas Diferenciales (Reference vs Candidate)
  DADO una función de referencia y una implementación candidata con o sin defecto sutil
  CUANDO se ejecuta runDifferentialCampaign
  ENTONCES detecta discrepancias semánticas o excepciones no controladas con su contraejemplo mínimo reducido
  Y certifica divergenceCount === 0 y equivalent === true cuando ambas implementaciones coinciden bit a bit.

ESCENARIO: BDD-1823 Verificación de Relaciones Metamórficas sin Etiquetas Exactas
  DADO las relaciones SORT_PERMUTATION_IDEMPOTENCE, FILTER_SUBSET_MONOTONICITY y JSON_ROUNDTRIP_INVERTIBILITY
  CUANDO se invoca verifyMetamorphicRelation sobre implementaciones válidas y defectuosas
  ENTONCES aprueba con passed === true todas las transformaciones conformes
  Y detecta violaciones cuando un candidato rompe la monotonicidad de subconjuntos o idempotencia.

ESCENARIO: BDD-1824 Campaña de Fuzzing de Frontera con 500+ Payloads sobre /api/mcp.js y EosMcpServer
  DADO 500 cargas útiles arbitrarias y malformadas (objetos, arreglos, primitivos, cadenas límite, claves __proto__)
  CUANDO runBoundaryFuzzCampaign bombardea /api/mcp.js y EosMcpServer.handleRequest
  ENTONCES registra unhandledExceptionCount === 0 y http5xxCount === 0 en los 500 casos
  Y obtiene stabilityScore === 1.0.

ESCENARIO: BDD-1825 Regresión Adversarial Judgment Day (31 Hallazgos Aceptados)
  DADO los 31 puntos ciegos confirmados ALPHA-01..09, ALPHA-11..18 y BETA-01..14
  CUANDO se ejercitan EosClosedLoopRepoAutopilotCore, EosAgenticHarnessYieldCore, EosCausalStructuralModelCore, EosPropertyBasedShrinkingFuzzerCore, createPhase8AgiHandlers y api/mcp.js
  ENTONCES todas las entradas adversariales (NaN, Infinity, padres colgantes, muestras vacías, Origins comodín, strings en blanco) fallan de forma controlada o se normalizan sin corrupción silenciosa.

ESCENARIO: BDD-1826 Auditoría Determinista SPEC-341, CLI, MCP Nativo y Límites Fail-Closed
  DADO parámetros inválidos o la ejecución completa de audit()
  CUANDO se ejecuta toolchain:blindspot:audit --json y eos_blindspot_hunter_audit
  ENTONCES parámetros fuera de rango lanzan BlindSpotError fail-closed y audit() retorna allPassed === true con sha256Digest determinista de 64 caracteres hexadecimales.
```
