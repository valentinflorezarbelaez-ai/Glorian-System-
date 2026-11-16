# PLAN-153: Meta SapFix-Style Closed-Loop Autonomous Healer & Mutation Testing Engine

- **Plan ID**: `PLAN-153`
- **Change ID**: `CHANGE-153`
- **Spec Reference**: `SPEC-291`
- **Status**: `APPROVED`
- **Target Module**: `src/core/eosSapFixAutoRemediator.ts`
- **Tier**: Autonomous Self-Healing / AST Mutation Testing
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Architectural Strategy

The SapFix Closed-Loop Autonomous Healer combines mutation analysis with automated patch generation to verify that proposed fixes are non-trivial, robust against subtle logic flaws, and free from regression.

### Pure Layer-0 Architecture (Law V)

1. **AstMutationSaboteur**: Pure TypeScript scanner locating binary expressions and unary operators in source lines. Systematically generates mutated variants using standard mutation operators:
   - Arithmetic: `+` $\to$ `-`, `-` $\to$ `+`, `*` $\to$ `/`.
   - Relational: `>` $\to$ `<=`, `<` $\to$ `>=`, `>=` $\to$ `<`, `<=` $\to$ `>`.
   - Equality: `===` $\to$ `!==`, `!==` $\to$ `===`, `==` $\to$ `!=`.
   - Logical: `&&` $\to$ `||`, `||` $\to$ `&&`.
   - Boolean: `true` $\to$ `false`, `false` $\to$ `true`.
2. **MutationRunner**: Runs provided test predicates or assertions against mutated code buffers, verifying whether tests catch the mutation (Killed) or let it pass undetected (Surviving).
3. **SapFixSynthesizer**: Given a diagnosis or failing line, produces multiple candidates:
   - Boundary condition adjustment (`>` $\to$ `>=`, `<` $\to$ `<=`, etc.).
   - Null/undefined safeguard wrapper (`x ? x.val : fallback`).
   - Inverse conditional / guard return (`if (!cond) return;`).
4. **ClosedLoopRemediator**: Runs candidates through validation filters, scoring candidates based on test pass rate, mutation resistance, and minimal edit distance.
5. **Approval Hash & Diff**: Generates a unified git-style diff and a SHA-256 approval hash for auditability before applying.
6. **Cryptographic Proof Receipt**: Emits `docs/evidence/SAPFIX_HEAL_RECEIPT.json`.

---

## 2. Component Design & Interfaces

```typescript
export interface AstMutant {
  id: string;
  filePath: string;
  line: number;
  column: number;
  originalOperator: string;
  mutatedOperator: string;
  mutatedSource: string;
  category: "arithmetic" | "relational" | "equality" | "logical" | "boolean";
}

export interface MutationScoreReport {
  filePath: string;
  totalMutants: number;
  killedMutants: number;
  survivingMutants: number;
  mutationScore: number; // 0.0 to 1.0
  mutants: Array<{ id: string; status: "KILLED" | "SURVIVED"; line: number }>;
}

export interface PatchCandidate {
  id: string;
  filePath: string;
  description: string;
  originalSnippet: string;
  replacementSnippet: string;
  fullPatchedSource: string;
  confidenceScore: number;
}

export interface RemediationResult {
  status: "HEALED" | "NO_VIABLE_PATCH";
  winningPatch?: PatchCandidate;
  evaluatedCandidatesCount: number;
  rejectedCandidates: Array<{ id: string; reason: string }>;
  unifiedDiff?: string;
  approvalHash?: string;
}

export interface SapFixAuditReceipt {
  timestampIso: string;
  specRef: "SPEC-291";
  totalMutantsEvaluated: number;
  totalPatchesSynthesized: number;
  winningPatchesCount: number;
  averageMutationScore: number;
  sha256Signature: string;
}
```
