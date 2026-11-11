# TASKS-099: Layer-0 Zero-Knowledge Rank-1 Constraint System (R1CS) & QAP Arithmetic Circuit Core DAG

## Task Checklist

- [ ] **TASK-099-1: Type Definitions & Circuit Contracts**
  - Create `src/core/eosZeroKnowledgeR1csCore.types.ts`.
  - Define `FieldElement`, `LinearCombination`, `R1csConstraint`, `R1csSystem`, `WitnessAssignment`, `QapSystem`, `ZkProof`, `ZkReceipt`.

- [ ] **TASK-099-2: Core R1CS & QAP Engine Implementation**
  - Implement `src/core/eosZeroKnowledgeR1csCore.ts`.
  - Implement field arithmetic over BN254 scalar field ($+$, $-$, $\times$, $\div$ via Extended Euclidean Algorithm).
  - Implement polynomial algebra (addition, scalar multiplication, polynomial multiplication, polynomial long division with remainder).
  - Implement Lagrange interpolation over evaluation roots $r_j = j$.
  - Implement R1CS constraint builder and witness satisfaction evaluator.
  - Implement QAP polynomial transformer ($A(x), B(x), C(x)$ and $T(x)$).
  - Implement quotient polynomial computation $H(x) = \frac{A(x)B(x) - C(x)}{T(x)}$.
  - Implement Fiat-Shamir evaluation proof generator and sub-millisecond verifier.

- [ ] **TASK-099-3: Module Exports & Package Subpath**
  - Add subpath export `"./zk-r1cs"` in `package.json`.
  - Re-export in `src/core/index.ts`.

- [ ] **TASK-099-4: CLI & MCP Integration**
  - Wire CLI commands `r1cs:synthesize`, `r1cs:prove`, `r1cs:verify` in `bin/commands/cliFrontierMesh.mjs`.
  - Update help in `bin/commands/cliKernel.mjs`.
  - Wire MCP actions `r1cs_synthesize`, `r1cs_prove`, `r1cs_verify` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts`.

- [ ] **TASK-099-5: Unit & Integration Test Suite**
  - Author `test/eosZeroKnowledgeR1csCore.test.mjs` (BDD-1089..BDD-1093).
  - Add step #26 to `test/eosEnterpriseFacade.test.mjs`.

- [ ] **TASK-099-6: Documentation & Catalog Index Update**
  - Document Módulo 29 in `docs/DEVELOPER_GUIDE.md`.
  - Update `docs/specs/openspec-catalog-index.json` to 209 specs.
  - Refresh tip and run 15-gate repo health verification.
