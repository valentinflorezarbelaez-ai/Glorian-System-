# PLAN-152: High-Speed AST Code Graph with Tree-sitter WebAssembly Engine

- **Plan ID**: `PLAN-152`
- **Change ID**: `CHANGE-152`
- **Spec Reference**: `SPEC-290`
- **Status**: `APPROVED`
- **Target Module**: `src/core/eosTreeSitterWasmEngine.ts`
- **Tier**: Static Analysis / High-Speed AST Reasoning
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Architectural Strategy

The High-Speed AST Code Graph Engine provides microsecond-to-millisecond syntactic analysis, symbol extraction, incremental diffing, and blast radius calculation across polyglot source code (TypeScript, JavaScript, Go, Rust, and Python).

### Pure Layer-0 Architecture (Law V)

In strict compliance with Law V (zero third-party runtime dependencies):

1. **Core Parser Engine**: Pure Layer-0 AST parser and token scanner implemented in TypeScript running on Node.js 22.18+ runtime. It natively supports token parsing, scope tree generation, and AST declaration extraction for TypeScript/JavaScript, Go, Rust, and Python.
2. **Symbol Table & Graph Linking**: Extracts exported, declared, and imported identifiers along with signature hashes, mapping file-level declarations to module dependency edges.
3. **Incremental AST Diffing**: Compares new AST snapshots with cached prior AST states at the symbol level (`addedSymbols`, `modifiedSymbols`, `removedSymbols`) without reparsing unaffected modules.
4. **Transitive Blast Radius Traversal**: Breadth-first and depth-first traversal across the directed graph to identify all downstream callers and compute a normalized impact score $[0.0, 1.0]$.
5. **Sub-15ms Latency Guarantee**: In-memory tokenization and precomputed adjacency indices guarantee sub-15ms incremental analysis for repositories containing up to 1,000 files.
6. **Cryptographic Proof Receipt**: Emits a deterministic SHA-256 sealed receipt to `docs/evidence/AST_TREE_SITTER_RECEIPT.json`.

---

## 2. Component Design & Interfaces

```typescript
export type SupportedLanguage = "typescript" | "javascript" | "go" | "rust" | "python";

export interface AstNode {
  kind: "function" | "class" | "interface" | "type" | "import" | "export" | "variable";
  name: string;
  language: SupportedLanguage;
  startByte: number;
  endByte: number;
  startLine: number;
  endLine: number;
  signature?: string;
  sourceModule?: string;
}

export interface SymbolTable {
  filePath: string;
  language: SupportedLanguage;
  symbols: Map<string, AstNode>;
  imports: Array<{ symbol: string; sourceModule: string }>;
  exports: Array<string>;
  contentHash: string;
}

export interface AstDiff {
  filePath: string;
  addedSymbols: string[];
  modifiedSymbols: string[];
  removedSymbols: string[];
  unchangedSymbols: string[];
}

export interface BlastRadiusResult {
  rootModule: string;
  impactedSymbols: string[];
  affectedModules: string[];
  fanOutScore: number; // 0.0 to 1.0
  maxDepth: number;
  impactedTestSuites: string[];
}

export interface AstAuditReceipt {
  timestampIso: string;
  specRef: "SPEC-290";
  totalFilesParsed: number;
  totalSymbolsIndexed: number;
  graphEdgesCount: number;
  averageParseTimeMs: number;
  sha256Signature: string;
}
```

---

## 3. Rejected Alternatives

- **Native N-API `tree-sitter` npm binding**: Rejected. Requires compilation of native C/C++ bindings and external npm package installation, violating Law V.
- **External CLI tree-sitter binary execution via child_process**: Rejected for core analysis loop. External subprocess spawning introduces $30-80\text{ms}$ process spawn overhead per invocation, violating the sub-15ms performance bound.
- **Full TypeScript Compiler API (`typescript` package)**: Rejected. Heavyweight, slow on cold start, and does not support Go, Rust, or Python.

---

## 4. Verification & Validation Protocol

- BDD-1515: Polyglot AST parsing across TS, Go, Rust, and Python.
- BDD-1516: Symbol table extraction and import/export dependency linking.
- BDD-1517: Incremental AST diffing and mutation classification.
- BDD-1518: Transitive downstream blast radius calculation and fan-out scoring.
- BDD-1519: Sub-15ms performance benchmark on a multi-module graph.
- BDD-1520: Cryptographic audit receipt emission and verification.
