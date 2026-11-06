# Architecture Plan: PLAN-071 — Glorian Nocturnal Darwinian Evolution & Dead-Code Eradication Engine

**Status**: APPROVED  
**Date**: 2026-11-02  
**Target Milestone**: v91.0.0 (SPEC-133 / CHANGE-071)  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  

---

## 1. Architectural Topology & Clean Hexagonal Design (Law V)
```
       ┌────────────────────────────────────────────────────────┐
       │     CLI: glorian night:evolve / MCP Tool Dispatcher    │
       └──────────────────────────┬─────────────────────────────┘
                                  │
                                  ▼
       ┌────────────────────────────────────────────────────────┐
       │           EosNocturnalEvolutionEngine (Layer 0)        │
       ├────────────────────────────────────────────────────────┤
       │  1. Sweep Planner & Scope Selector                     │
       │  2. Continuous Refactor Bridge (EosContinuousRefactor) │
       │  3. AlphaEvolve Multivariate Fitness Calculator        │
       │  4. ANSI TUI Nocturnal Dashboard Formatter             │
       │  5. SQLite WAL Monotonic Ledger Attestation            │
       └──────────────────────────┬─────────────────────────────┘
                                  │
          ┌───────────────────────┴───────────────────────┐
          ▼                                               ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│ EosContinuousRefactorEngine  │              │   EosDurableSqliteLedger     │
└──────────────────────────────┘              └──────────────────────────────┘
```

## 2. Alternatives Considered & Rejected (Law II)
1. **Blind File Deletions during Nightly Sweep (Rejected)**:
   - *Reason*: Violates safety. The nocturnal engine must operate non-destructively in audit/proposal mode, computing exact debt metrics and potential line reductions without deleting source files unless explicitly authorized.
2. **Heavy Python/ML Dependencies (Rejected)**:
   - *Reason*: Violates Layer-0 pure Node.js constraint (Law V). AlphaEvolve multivariate scoring runs deterministically on in-memory AST and token stream metrics.

## 3. Data Contracts
```typescript
export interface NocturnalEvolutionOptions {
  readonly targetDir?: string;
  readonly dryRun?: boolean;
  readonly maxFiles?: number;
}

export interface NocturnalSweepReport {
  readonly sweepId: string;
  readonly status: "EVOLUTION_CYCLE_COMPLETED" | "AUDIT_FAILED";
  readonly targetDir: string;
  readonly scannedFilesCount: number;
  readonly totalLinesAnalyzed: number;
  readonly totalDuplicationsFound: number;
  readonly totalDeadCodeFound: number;
  readonly totalComplexityBottlenecks: number;
  readonly potentialLinesReduction: number;
  readonly compositeFitnessScore: number; // 0..100
  readonly sha256Receipt: string;
  readonly durationMs: number;
  readonly timestampIso: string;
}
```
