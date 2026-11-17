# SPEC-342: Verification Honesty, Evidence Hermeticity & Measured Telemetry

**Status**: `APPROVED`

## 0. Intent

A verification gate is only as trustworthy as its weakest `PASS`. This specification removes every
path in which the system reports success without having executed the corresponding verification
(fail-open), replaces hardcoded telemetry with measured telemetry carrying explicit provenance, and
makes evidence emission hermetic so that committed receipts change only when their content changes.

Doctrine: **Law III (Evidence Over Claims)**. Any result that was not actually verified MUST be
reported as `NOT_VERIFIED`, `INCONCLUSIVE`, `TIMEOUT`, or `UNREACHABLE` — never as `PASS`.

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Error / Unwanted Condition)**: SI el runtime Java o `tools/tla2tools.jar` no están disponibles, ENTONCES EL SISTEMA reports the TLC result with `status: "NOT_VERIFIED"`, `verified: false`, `generatedStates: 0`, `distinctStates: 0`, and a human-readable `reason`; it MUST NOT fabricate state counts or report `PASS`.
- **FR-2 (Event-Driven)**: CUANDO TLC runs live, EL SISTEMA reports `PASS` only if the process exits with code `0`, the output contains the completion marker `Model checking completed. No error has been found.`, and both state counters are parsed; an invariant violation yields `INVARIANT_VIOLATION`, a deadlock yields `DEADLOCK`, a process timeout yields `TIMEOUT`, and any other outcome yields `INCONCLUSIVE`. TLC metadata MUST be written to an isolated temporary `-metadir`, never to the repository.
- **FR-3 (Ubiquitous)**: EL SISTEMA exposes `EosIntervalConstraintSolver`, a decision procedure that is sound and complete for conjunctions of single-variable integer bound constraints (`<`, `<=`, `>`, `>=`, `==`, `!=`) and boolean equalities, with unbounded default domains. Constraints outside this fragment (variable-to-variable comparisons, non-finite constants, unsupported operators) yield `UNKNOWN`. Every `SAT` model is re-checked against all constraints before being returned. `EosZ3SmtSolver` remains as a deprecated alias and MUST NOT be described as Z3.
- **FR-4 (State-Driven)**: MIENTRAS the enumerated domain of an inductive-invariant check is not closed under the transition relation, EL SISTEMA reports `HOLDS_ON_SAMPLED_DOMAIN` instead of `INDUCTIVE_INVARIANT_PROVEN`; `INDUCTIVE_INVARIANT_PROVEN` is reserved for domains closed under the transition relation.
- **FR-5 (Ubiquitous)**: EL SISTEMA's formal-prover audit receipt distinguishes `totalTlaSpecsInventoried` (files present) from `totalTlaSpecsChecked` (specs actually model-checked live with `PASS`), and its `sha256Signature` is computed over content fields only (excluding timestamps), so identical content yields an identical signature.
- **FR-6 (Event-Driven)**: CUANDO the fleet blind-spot audit runs in live mode, EL SISTEMA issues bounded, read-only HTTP `GET` probes with adversarial query strings and paths against each registered `productionUrl` through the SSRF-guarded transport, and classifies each project as `VERIFIED` (all probes answered with status `< 500`), `FINDINGS` (at least one `5xx`), or `UNREACHABLE` (transport failure). `allPassed` is `true` only when every project is `VERIFIED`.
- **FR-7 (Error / Unwanted Condition)**: SI the fleet blind-spot audit runs without a live transport (offline / hermetic mode), ENTONCES EL SISTEMA reports every project as `NOT_VERIFIED`, sets `allPassed: false`, and sets `mode: "OFFLINE_NOT_VERIFIED"`; it MUST NOT report synthetic stub results as fleet verification.
- **FR-8 (Ubiquitous)**: EL SISTEMA derives the closed-loop autopilot causal evidence (`SPEC_CLARITY`, `CODE_CHURN`, `TASK_COMPLEXITY`, `PR_FIRST_PASS_YIELD`, `MUTATION_SCORE`) from repository history and governed artifacts, attaching per-variable provenance `MEASURED` or `PRIOR`; `PRIOR` values are used only when the measurement source is unavailable and are reported as such.
- **FR-9 (Ubiquitous)**: EL SISTEMA resolves the evidence output directory through a single resolver that honors `EOS_EVIDENCE_DIR`; the test runners set `EOS_EVIDENCE_DIR` to an isolated temporary directory so that test execution never mutates tracked files under `docs/evidence/`.
- **FR-10 (Ubiquitous)**: EL SISTEMA runs strict wall-clock performance thresholds in a dedicated benchmark lane (`npm run bench`); correctness suites retain only generous sanity ceilings and correctness assertions.

## 2. Non-Functional Requirements

- **NFR-1**: Layer-0 purity preserved (`dependencies: {}`).
- **NFR-2**: Every touched module stays `<= 800` lines with `>= 12` lines of headroom (SPEC-250).
- **NFR-3**: No network access from the default test suites; live probes are injected through a transport seam.
- **NFR-4**: Live fleet probes are bounded (`<= 25` requests per project, sequential, per-request timeout) and read-only.

## 3. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1828 TLC Unavailable Is Reported As NOT_VERIFIED
  DADO a valid TLA+ specification and a jar path that does not exist
  CUANDO EosTlcModelChecker.runTlc executes
  ENTONCES status === "NOT_VERIFIED" and verified === false
  Y generatedStates === 0 and distinctStates === 0 and reason is non-empty.

ESCENARIO: BDD-1829 Live TLC Detects A Seeded Invariant Violation
  DADO java and tools/tla2tools.jar are available and a temporary spec whose invariant is violated
  CUANDO EosTlcModelChecker.runTlc executes
  ENTONCES status === "INVARIANT_VIOLATION" and verified === true
  Y no TLC metadata directory is created inside the repository.

ESCENARIO: BDD-1830 Interval Constraint Solver Soundness And Completeness
  DADO constraints x > 2000 (outside the former [-1000, 1000] window), x != 0 with x >= 0, and x > 2.5
  CUANDO EosIntervalConstraintSolver.solve executes
  ENTONCES each result is SAT with a model satisfying every constraint (x = 2001, x = 1, x = 3)
  Y x >= 0, x <= 2, x != 0, x != 1, x != 2 is UNSAT, and a variable-to-variable constraint is UNKNOWN.

ESCENARIO: BDD-1831 Inductive Proof Requires Transition-Closed Domain
  DADO an invariant that holds on a domain not closed under the transition
  CUANDO proveInductiveInvariant executes
  ENTONCES status === "HOLDS_ON_SAMPLED_DOMAIN"
  Y on a modular counter domain closed under the transition the status is "INDUCTIVE_INVARIANT_PROVEN".

ESCENARIO: BDD-1832 Formal Audit Receipt Honesty And Determinism
  DADO the repository formal directory
  CUANDO auditFormalProver runs twice
  ENTONCES totalTlaSpecsInventoried >= 50 and totalTlaSpecsChecked <= 1
  Y both receipts share the same sha256Signature.

ESCENARIO: BDD-1833 Fleet Audit Offline Mode Never Reports PASS
  DADO no live transport
  CUANDO auditFleetProjects executes
  ENTONCES mode === "OFFLINE_NOT_VERIFIED", allPassed === false, and every project verdict is "NOT_VERIFIED".

ESCENARIO: BDD-1834 Fleet Audit Live Mode Classifies Findings
  DADO an injected transport returning 200, 503, and a transport error for three projects
  CUANDO auditFleetProjects executes in live mode
  ENTONCES verdicts are VERIFIED, FINDINGS, and UNREACHABLE respectively
  Y allPassed === false and every request is a GET bounded by the per-project budget.

ESCENARIO: BDD-1835 Autopilot Causal Evidence Carries Provenance
  DADO a git repository with commit history
  CUANDO diagnoseCausalRootCause executes
  ENTONCES every evidence variable reports provenance MEASURED or PRIOR
  Y SPEC_CLARITY and PR_FIRST_PASS_YIELD are MEASURED from commit history.

ESCENARIO: BDD-1836 Evidence Emission Is Hermetic Under Test
  DADO EOS_EVIDENCE_DIR points to a temporary directory
  CUANDO a module emits a receipt
  ENTONCES the receipt is written under EOS_EVIDENCE_DIR and docs/evidence/ is unchanged.
```

## 4. Traceability

| Requirement      | Module                                            | Test                                                                     |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| FR-1, FR-2       | `src/core/eosZ3WasmProver.ts`                     | `test/eosZ3WasmProver.test.mjs` (BDD-1828, BDD-1829)                     |
| FR-3, FR-4, FR-5 | `src/core/eosZ3WasmProver.ts`                     | `test/eosZ3WasmProver.test.mjs` (BDD-1830..1832)                         |
| FR-6, FR-7       | `src/core/eosMetamorphicDifferentialBlindSpot.ts` | `test/eosMetamorphicDifferentialBlindSpot.test.mjs` (BDD-1833, BDD-1834) |
| FR-8             | `src/core/eosClosedLoopRepoAutopilot.ts`          | `test/eosClosedLoopRepoAutopilot.test.mjs` (BDD-1835)                    |
| FR-9             | `src/core/eosEvidencePaths.ts`                    | `test/eosEvidencePaths.test.mjs` (BDD-1836)                              |
| FR-10            | `scripts/bench.mjs`                               | `npm run bench`                                                          |
