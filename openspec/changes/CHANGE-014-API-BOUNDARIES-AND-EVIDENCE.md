# OPENSPEC CHANGE PROPOSAL: API BOUNDARIES AND EVIDENCE (CHANGE-014)

## 1. Metadata
- **Status**: `PROPOSED_AND_AUTHORIZED`
- **Authorization**: `LEVEL_3_PRODUCTION_AUTHORIZED`
- **Impacted Specs**: `SPEC-001`, `SPEC-008`, `SPEC-021`
- **Modules Targeted**:
  - `api/eval.js`
  - `api/jarvis.js`
  - `api/cicd.js`
  - `api/fleet.js`
  - `api/health.js`
  - `api/bigtech.js`
  - `api/kernel.js`
  - `api/memory.js`
  - `js/eos.js`
  - `index.html`
  - `README.md`

## 2. Description
Constrain file-based cognitive evaluation to regular files under the project root after resolving symlinks, bound raw source input to 100 KiB, disable shared caching for evaluation requests, and return a service-unavailable response instead of a fabricated passing result when the evaluator fails. Make CI/CD output explicit about simulation, make the Big Tech route read-only and fixture-only, and distinguish kernel/Omega fingerprints from kernel telemetry or cryptographic proofs. Report JARVIS as heuristic classification without execution, consensus, or health probing. Remove fabricated browser command output and 21-step completion claims; label generated text as unverified drafts. Make fleet responses omit local host paths and distinguish registered projects from unprobed health, CI, and hook status. Make health telemetry distinguish handler liveness from unprobed subsystem claims and unmeasured SLO values. Document the actual command and API boundaries.

## 3. Acceptance Criteria
- **BDD-051**: External and symlink-escaped paths are rejected, oversized code is rejected, and evaluator failure never produces a passing score.
- **BDD-052**: A simulated SAST block reports stage 1 `BLOCKED`, stages 2–7 `NOT_RUN`, and no deployment eligibility.
- Clean demonstration output is labeled simulated and makes no claim that checks or deployments executed.
- Fleet responses and UI do not expose local Windows paths or claim unprobed status as healthy.
- Health responses identify their process-only verification scope and do not claim measured availability.
- JARVIS responses and browser views report only heuristic classification and mark all unperformed actions as not run.
- Kernel, Omega, Big Tech, memory, and scaffold panels label fixtures and drafts without claiming unperformed verification.
- Browser command previews never present canned output as a completed command result.
