# PLAN-107: Architecture Plan & ADR-107 — Sovereign Cross-Fleet Telemetry, Real-Time Soundcheck & Canary Observability

## Status
`APPROVED` — Governed by SPEC-107, Level 2+ Implementation Authorization.

---

## 1. Context & Problem Statement
EOS controls a sovereign multi-repo fleet across heterogeneous hosting platforms (Vercel, Cloudflare, local execution daemons).
Manual promotion of progressive canary stages carries operational risk without Automated Canary Analysis (ACA).
Furthermore, fleet health audits previously used static deductions for external workspaces, masking actual clean states (e.g. Performance Talent Group).

## 2. Decision: Pure Hexagonal Layer-0 Telemetry & ACA Engine
We introduce `EosVercelCanaryObservability` alongside a dynamic elevation of `EosFleetSoundcheckMesh`:
1. `EosFleetSoundcheckMesh` performs dynamic porcelain git inspection using `node:child_process.execFileSync` with non-blocking timeouts and pure fallback guards.
2. `EosVercelCanaryObservability` models ACA telemetry with mathematical score weighting:
   - Error Rate Penalty: Exponential drop when $e > 0.005$.
   - P99 Latency Factor: Score dampening when $P99 > 800\text{ms}$.
   - Sample Size Confidence: Bayesian confidence scaling for small batches ($N < 50$).
3. All data contracts and state outputs are frozen (`deepFreeze`) and cryptographically receipted with SHA-256.

## 3. Rejected Alternatives
* **Alternative A (Direct Vercel SDK NPM Dependency)**:
  - *Rejected*: Violates Law V (Hexagonal Isolation) and Layer-0 runtime dependency restrictions (zero npm packages in Layer 0).
* **Alternative B (Manual CLI Approval for Every Canary Step)**:
  - *Rejected*: Lacks autonomous resilience; cannot respond in sub-second timelines to critical error rate spikes (e.g. 5xx cascades).
* **Alternative C (Polling Vercel Dashboard via Puppeteer/Browser)**:
  - *Rejected*: Extremely heavy, non-deterministic, high CPU and memory overhead; violates sub-millisecond execution invariants.

## 4. Architectural Boundaries
```
[External Platforms: Vercel MCP / Git Worktrees]
                     │
                     ▼
  [Layer 1 Adapters: MCP Server & CLI Handlers]
                     │
                     ▼
  [Layer 0 Domain: EosVercelCanaryObservability & EosFleetSoundcheckMesh]
                     │
                     ▼
         [Mathematical Invariants & SHA-256 Receipts]
```
