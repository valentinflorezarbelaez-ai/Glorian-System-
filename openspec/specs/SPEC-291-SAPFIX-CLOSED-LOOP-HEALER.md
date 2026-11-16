# SPEC-291: Meta SapFix-Style Closed-Loop Autonomous Healer & Mutation Testing Engine

- **Specification ID**: `SPEC-291`
- **Change ID**: `CHANGE-153`
- **Status**: `APPROVED`
- **Module**: `src/core/eosSapFixAutoRemediator.ts`
- **Tier**: Autonomous Self-Healing / AST Mutation Testing
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-291-01 (Event-Driven AST Mutation Injection)**: WHEN a source file buffer is submitted for mutation testing, THE SYSTEM SHALL generate syntactic mutant variants across arithmetic (`+`, `-`, `*`), relational (`>`, `<`, `>=`, `<=`), equality (`===`, `!==`), logical (`&&`, `||`), and boolean literals (`true`, `false`).
- **FR-291-02 (State-Driven Mutation Score Assessment)**: WHILE executing test suites against generated mutants, THE SYSTEM SHALL record surviving vs killed mutants and compute the mutation score as $\frac{\text{killed}}{\text{total}}$.
- **FR-291-03 (Candidate Patch Synthesis)**: WHEN a test failure or regression finding is supplied, THE SYSTEM SHALL synthesize multiple candidate source code patches targeting the failing AST expressions.
- **FR-291-04 (Closed-Loop Candidate Verification)**: WHILE validating candidate patches, THE SYSTEM SHALL execute test suites in isolated sandboxes and reject any candidate that fails unit tests or decreases baseline code coverage.
- **FR-291-05 (Deterministic Approval Hash & Diff)**: WHEN a candidate patch passes all validation criteria, THE SYSTEM SHALL compute a deterministic unified diff and an approval hash formatted for `eos flow apply`.
- **FR-291-06 (Cryptographic Proof Receipt)**: WHEN an autonomous healing audit completes, THE SYSTEM SHALL emit a cryptographic receipt at `docs/evidence/SAPFIX_HEAL_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1521 AST Operator Mutation Generation
  GIVEN a TypeScript source file containing arithmetic, relational, and boolean operators
  WHEN generateMutants is invoked
  THEN distinct mutant variants are produced with exact line spans, original tokens, and mutated tokens
  AND each mutant alters exactly one syntactic operator.

SCENARIO: BDD-1522 Automated Mutation Score Evaluation
  GIVEN a module with 10 generated mutants and a test suite
  WHEN evaluateMutants runs the test suite against each mutant
  THEN it accurately tallies killedMutants and survivingMutants
  AND returns a mutationScore between 0.0 and 1.0.

SCENARIO: BDD-1523 Multi-Candidate Patch Synthesis
  GIVEN a failing condition or diagnostic error with source location
  WHEN synthesizeCandidates is invoked
  THEN at least 3 distinct candidate replacement patches are synthesized
  AND ranked by syntactic similarity and semantic fit.

SCENARIO: BDD-1524 Closed-Loop Candidate Selection and Regression Rejection
  GIVEN 3 candidate patches where Candidate 1 fails tests, Candidate 2 passes tests with regressions, and Candidate 3 passes all tests cleanly
  WHEN remediateClosedLoop is executed
  THEN Candidate 1 and Candidate 2 are rejected
  AND Candidate 3 is selected as the winning verified patch.

SCENARIO: BDD-1525 Deterministic Unified Diff and Approval Hash
  GIVEN a winning patch selected by the remediator
  WHEN formatPatchBundle is invoked
  THEN it generates a standard unified diff
  AND computes a deterministic SHA-256 approvalHash suitable for eos flow apply.

SCENARIO: BDD-1526 Cryptographic SapFix Healing Audit Receipt
  GIVEN an autonomous healing audit executed via toolchain:sapfix:audit
  WHEN the audit completes
  THEN docs/evidence/SAPFIX_HEAL_RECEIPT.json is written
  AND contains totalMutantsEvaluated, totalPatchesSynthesized, winningPatchesCount, and a valid sha256Signature.
```
