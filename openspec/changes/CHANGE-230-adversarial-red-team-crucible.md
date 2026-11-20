# CHANGE-230: Adversarial Red-Team Crucible & Minimax Exploit-Patch Game

**Change ID**: `CHANGE-230-adversarial-red-team-crucible`  
**Specification Target**: `SPEC-368`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `PROPOSED`  
**Author**: `user:valentin-florez-arbelaez` & Antigravity  
**Date**: `2026-11-19`

---

## 1. Description

Introduces the Adversarial Red-Team Crucible & Minimax Exploit-Patch Game to the Glorian System Control Plane. This provides an automated adversarial framework where Red-Team agent personas discover exploits and invariant breaks, while Blue-Team agent personas synthesize CEGIS patches to harden code and agent prompts in a zero-sum tournament until safety convergence.

## 2. Delta Specification

- **Added Capabilities**:
  - `RedTeamAttackGenerator`: Generates pathological inputs, prompt injections, race windows, and boundary excursions.
  - `BlueTeamPatchSynthesizer`: Synthesizes defensive guards, input sanitizers, and state invariants against counterexamples.
  - `MinimaxTournamentEngine`: Orchestrates rounds, evaluates attack penetration vs defensive neutralization, and computes Nash equilibrium metrics.
  - `EosAdversarialRedTeamCrucible`: Main facade coordinating tournaments, recording attack receipts, and publishing telemetry.
  - CLI commands: `toolchain:crucible:attack`, `toolchain:crucible:patch`, `toolchain:crucible:tournament`, `toolchain:crucible:audit`.
  - Phase 8 MCP tool: `eos_adversarial_red_team_crucible_audit`.
  - TLA+ Model 111: `docs/formal/AdversarialRedTeamCrucible.tla`.

## 3. Impact Assessment

- Zero breaking changes to existing APIs.
- Exported under pure Layer-0 modules in `src/core/`.
- No new runtime npm dependencies.
