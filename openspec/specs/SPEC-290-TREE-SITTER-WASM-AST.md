# SPEC-290: High-Speed AST Code Graph with Tree-sitter WebAssembly Engine

- **Specification ID**: `SPEC-290`
- **Change ID**: `CHANGE-152`
- **Status**: `APPROVED`
- **Module**: `src/core/eosTreeSitterWasmEngine.ts`
- **Tier**: Static Analysis / High-Speed AST Reasoning
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-290-01 (Event-Driven Polyglot Source Parsing)**: WHEN a source file (TypeScript, JavaScript, Go, Rust, or Python) is submitted, THE SYSTEM SHALL parse its syntactic structure into typed AST nodes (functions, classes, interfaces, imports, exports) with exact byte ranges and line spans.
- **FR-290-02 (State-Driven Symbol Table Indexing)**: WHILE constructing an AST representation, THE SYSTEM SHALL maintain an index of declared, exported, and imported symbols along with their dependency signatures.
- **FR-290-03 (Incremental AST Mutation Diffing)**: WHEN an updated file buffer is compared against a previous AST snapshot, THE SYSTEM SHALL compute the precise delta of added, modified, and removed symbols without reparsing unaffected files.
- **FR-290-04 (Directed Code Graph Traversal & Blast Radius)**: WHEN one or more symbols change, THE SYSTEM SHALL traverse the directed symbol dependency graph to determine the transitive downstream blast radius and impacted test suites.
- **FR-290-05 (Sub-15ms Latency Bound)**: SI an incremental AST diff and blast radius calculation is requested on a codebase with under 1,000 source files, ENTONCES EL SISTEMA SHALL complete the evaluation within 15 milliseconds.
- **FR-290-06 (Cryptographic Proof Receipt)**: WHEN an AST repository audit completes, THE SYSTEM SHALL emit a cryptographic receipt at `docs/evidence/AST_TREE_SITTER_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1515 Polyglot AST Parsing across TypeScript, Go, Rust, and Python
  GIVEN source code snippets in TypeScript, Go, Rust, and Python
  WHEN the AST engine parses each snippet
  THEN it returns typed AST nodes identifying declarations, functions, classes, and imports
  AND correct byte ranges and line spans are preserved.

SCENARIO: BDD-1516 Symbol Table Extraction and Dependency Linking
  GIVEN a module with multiple exports, internal helper functions, and foreign imports
  WHEN getSymbolTable is invoked
  THEN all exported and internal symbols are indexed
  AND external imported symbols are linked to their source modules.

SCENARIO: BDD-1517 Incremental AST Diffing and Mutation Classification
  GIVEN an initial AST snapshot of a TypeScript module
  WHEN the module source is modified (e.g., a function signature altered, an export removed, a new type added)
  THEN diffAst produces exact addedSymbols, modifiedSymbols, and removedSymbols lists.

SCENARIO: BDD-1518 Transitive Downstream Blast Radius Calculation
  GIVEN a directed symbol graph where Module A depends on Module B, which depends on Module C
  WHEN a symbol in Module C is modified
  THEN calculateBlastRadius identifies both Module B and Module A in the downstream impact
  AND returns an accurate blast radius score (0.0 to 1.0).

SCENARIO: BDD-1519 Sub-15ms Incremental Processing Performance Benchmark
  GIVEN a multi-file project graph with 100 modules and 500 symbol dependencies
  WHEN an incremental AST diff and transitive impact query is executed
  THEN execution completes in under 15 milliseconds.

SCENARIO: BDD-1520 Cryptographic Code Graph Audit Receipt Verification
  GIVEN an AST audit executed via toolchain:ast:audit
  WHEN the audit completes
  THEN docs/evidence/AST_TREE_SITTER_RECEIPT.json is written
  AND contains totalFilesParsed, totalSymbolsIndexed, graphEdgesCount, and a valid sha256Signature.
```
