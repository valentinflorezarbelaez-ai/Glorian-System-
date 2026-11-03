# Architecture Plan: PLAN-069 — Glorian Neuro-Symbolic Fleet LSC & Closed-Loop Autonomous Healing Control Plane

**Status**: APPROVED  
**Date**: 2026-11-02  
**Target Milestone**: v89.0.0 (SPEC-131 / CHANGE-069)  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  

---

## 1. Architectural Topology & Clean Hexagonal Design (Law V)
```
       ┌────────────────────────────────────────────────────────┐
       │             EOS MCP Server / CLI Dispatcher            │
       └──────────────────────────┬─────────────────────────────┘
                                  │ (JSON-RPC / CLI args)
                                  ▼
       ┌────────────────────────────────────────────────────────┐
       │        EosNeuroSymbolicFleetHealingEngine (Layer 0)    │
       ├────────────────────────────────────────────────────────┤
       │  1. Invariant SMT Gate: DPLL CNF Theorem Solving       │
       │  2. Closed-Loop Healer: AST Patch Synthesis            │
       │  3. Fleet LSC Planner: Sharding & Campaign Engine      │
       │  4. Proof Attestation: SHA-256 Monotonic Receipts      │
       └──────────────────────────┬─────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│ EosSmtAutomated  │    │ EosSurgicalSelf  │    │ EosDurableSqlite    │
│ ReasoningProver  │    │ HealingKernel    │    │ Ledger (WAL DB)     │
└──────────────────┘    └──────────────────┘    └─────────────────────┘
```

## 2. Alternatives Considered & Rejected (Law II)
1. **Relying Exclusively on LLM Suggestions (Rejected)**:
   - *Reason*: Violates Law I (Zero Vibe Coding). Without mathematical proof from a SAT/SMT engine, mutations can introduce silent edge-case violations.
2. **External Z3 / Python subprocess bindings (Rejected)**:
   - *Reason*: Violates Law V (Layer-0 Pure Node.js zero-dependency constraint). The engine must execute entirely in-process using the native TypeScript DPLL/CDCL logic engine (`EosSmtAutomatedReasoningProver`).
3. **Monolithic Fleet Commits (Rejected)**:
   - *Reason*: Violates isolation principles. Large scale changes must be partitioned into atomic, independent module shards with isolated validation and individual rollback capability (Google Rosie standard).

## 3. Data Contracts
```typescript
export interface InvariantProofRequest {
  readonly theoremName: string;
  readonly clauses: readonly (readonly string[])[];
  readonly safetyNegationClause: readonly string[];
}

export interface ClosedLoopFaultRequest {
  readonly faultId: string;
  readonly targetFilePath: string;
  readonly failingLine: number;
  readonly errorMessage: string;
  readonly offendingExpression?: string;
  readonly mockOriginalContent?: string;
}

export interface LscCampaignRequest {
  readonly campaignId: string;
  readonly description: string;
  readonly targetModules: readonly string[];
  readonly transformationRule: string;
  readonly invariantClauses: readonly (readonly string[])[];
}
```
