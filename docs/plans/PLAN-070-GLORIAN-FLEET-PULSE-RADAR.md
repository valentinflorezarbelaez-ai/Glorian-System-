# Architecture Plan: PLAN-070 — Glorian Fleet Pulse & Tactical Sovereignty Radar

**Status**: APPROVED  
**Date**: 2026-11-02  
**Target Milestone**: v90.0.0 (SPEC-132 / CHANGE-070)  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  

---

## 1. Architectural Topology & Clean Hexagonal Design (Law V)
```
         ┌────────────────────────────────────────────────────────┐
         │             CLI: glorian fleet:pulse / MCP Tool        │
         └──────────────────────────┬─────────────────────────────┘
                                    │
                                    ▼
         ┌────────────────────────────────────────────────────────┐
         │             EosFleetPulseEngine (Layer 0)              │
         ├────────────────────────────────────────────────────────┤
         │  1. Registry Parser (docs/projects/registry.json)      │
         │  2. Path Resolution & Git Porcelain Health Auditor     │
         │  3. Esoteric-Gnostic Archetype Binder                  │
         │  4. ANSI TUI Formatter & Soundcheck Fusion             │
         │  5. Monotonic WAL Attestation Ledger Seal              │
         └──────────────────────────┬─────────────────────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│  Git CLI / Porcelain Checks   │              │   EosDurableSqliteLedger     │
└──────────────────────────────┘              └──────────────────────────────┘
```

## 2. Alternatives Considered & Rejected (Law II)
1. **Calling External Web Services or Live Ping Endpoints synchronously on every CLI pulse (Rejected)**:
   - *Reason*: Network flakiness, latency degradation (>2s timeout), and offline breakage. The CLI pulse must evaluate local working trees, commit SHAs, and soundcheck metrics in <250ms, relying on registered endpoints without blocking.
2. **Hardcoding Repo Paths without registry.json (Rejected)**:
   - *Reason*: Violates single source of truth. All metadata must originate from `docs/projects/registry.json`.

## 3. Data Contracts
```typescript
export interface FleetProjectPulse {
  readonly id: string;
  readonly name: string;
  readonly localPath: string;
  readonly existsLocally: boolean;
  readonly workingTreeClean: boolean;
  readonly currentBranch: string;
  readonly headCommitShort: string;
  readonly headCommitFull: string;
  readonly productionUrl: string;
  readonly authorizationLevel: string;
  readonly soundcheckScore: number;
  readonly soundcheckGrade: string;
  readonly esotericArchetype: string;
  readonly pulseStatus: "PRISTINE" | "HEALTHY" | "NEEDS_ATTENTION" | "UNREGISTERED_LOCAL";
}

export interface FleetPulseReport {
  readonly totalProjects: number;
  readonly localProjectsFound: number;
  readonly pristineProjectsCount: number;
  readonly fleetHealthQuorumPercentage: number;
  readonly projects: readonly FleetProjectPulse[];
  readonly sha256Receipt: string;
  readonly durationMs: number;
  readonly timestampIso: string;
}
```
