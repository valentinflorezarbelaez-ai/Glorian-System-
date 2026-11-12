# SPEC-225: Layer-0 Universal Federated Cross-Fleet Sync & Health Healing Core

## 1. Specification Metadata

- **Specification ID**: `SPEC-225`
- **Change ID**: `CHANGE-110`
- **Title**: Layer-0 Universal Federated Cross-Fleet Sync & Health Healing Core (`eos fleet:sync-all`)
- **Status**: `APPROVED`
- **Target Subsystem**: `src/core/eosUniversalFleetSyncCore.ts`
- **Related Specs**: `SPEC-042` (Fleet Sync & Canary), `SPEC-100` (Fleet Topology), `SPEC-124` (Fleet Mission Control), `SPEC-193` (Universal Project Doctor)

## 2. Mathematical Foundation & Protocol Design

- **Fleet Topology & Registry Invariants**:
  - The fleet comprises $N = 9$ registered repositories specified in `docs/projects/registry.json`.
  - For each project $P_k$ ($k \in [1, N]$), project metadata includes $id, name, resolvedLocalDir, remoteUrl, productionUrl, status, cicdGateScript$.
  - Resolution strategy:
    $\text{path}(P_k) = \text{env}(P_k) \parallel \text{workspaceCandidates}(P_k) \parallel \text{federatedMock}(P_k)$.
- **Multi-Pillar Soundcheck Health Scoring**:
  - Each repository is evaluated across 4 orthogonal pillars, each bounded strictly in $[0, 25]$:
    - $S_{\text{git}} \in [0, 25]$: Working tree cleanliness, branch tracking, commit validity.
    - $S_{\text{arch}} \in [0, 25]$: Package markers (`package.json`, `vercel.json`), structure compliance, Golden Path.
    - $S_{\text{sec}} \in [0, 25]$: Secret detection, lockfile presence, license / compliance metadata.
    - $S_{\text{ops}} \in [0, 25]$: Production URL availability, CI/CD gate script execution readiness, owner sign-off.
  - Individual project score:
    $S(P_k) = S_{\text{git}} + S_{\text{arch}} + S_{\text{sec}} + S_{\text{ops}} \in [0, 100]$.
  - Spotify Soundcheck Grade mapping:
    $\text{Grade}(S) = \begin{cases} \text{A+} & \text{if } S \ge 90 \\ \text{A} & \text{if } 80 \le S < 90 \\ \text{B} & \text{if } 70 \le S < 80 \\ \text{C} & \text{if } 60 \le S < 70 \\ \text{F} & \text{if } S < 60 \end{cases}$
  - Global Fleet Health Index:
    $\mathcal{H}_{\text{fleet}} = \frac{1}{N} \sum_{k=1}^N S(P_k) \in [0, 100]$.
- **Cryptographic Merkle Root Attestation**:
  - Leaf hash for project $P_k$:
    $h_k = \text{SHA-256}(P_k.id \parallel S(P_k) \parallel P_k.headCommitSha \parallel P_k.status)$.
  - Fleet Merkle Root $\mathcal{R}_{\text{fleet}}$ computed by pairwise balanced folding of $\{h_1, \dots, h_N\}$.
  - Guaranteed tamper-evident receipt logged to SQLite WAL Ledger under category `FLEET_SYNC`.

## 3. Functional Requirements (IEEE 830 EARS)

### FR-1144: Federated Fleet Registry Resolution

- **Requirement**: The system SHALL parse the canonical registry (`docs/projects/registry.json`), validating all 9 projects, resolving local directories via environment variables, sibling checkouts, or federated virtual profiles without throwing uncaught errors.

### FR-1145: Cross-Fleet State Synchronization Engine

- **Requirement**: The system SHALL evaluate the synchronization status of each registered fleet repository (`IN_SYNC`, `LOCAL_AHEAD`, `REMOTE_AHEAD`, `DIVERGED`, or `FEDERATED_ATTESTED`), validating HEAD commit SHAs and remote references.

### FR-1146: Autonomous Remediation & Manifest Healing

- **Requirement**: When invoked with `--heal` or in automated remediation mode, the system SHALL heal drift across the fleet by repairing missing directory markers, synchronizing configuration files, and updating registry SHA-256 integrity checksums.

### FR-1147: 4-Pillar Soundcheck Health & Grade Calculation

- **Requirement**: The system SHALL compute 4-pillar Soundcheck scores ($S_{\text{git}}, S_{\text{arch}}, S_{\text{sec}}, S_{\text{ops}}$) for each project, assign standard Spotify Soundcheck letter grades, and calculate the global Fleet Health Index $\mathcal{H}_{\text{fleet}}$.

### FR-1148: Cryptographic Merkle Root Ledger Attestation & CLI/MCP Interface

- **Requirement**: The system SHALL compute a SHA-256 Merkle root across all project health digests, expose CLI subcommands `fleet:sync-all`, `fleet:audit-all`, `fleet:heal-all`, register MCP actions `fleet_sync_all` and `fleet_audit_all`, and record immutable receipts.

## 4. Behavior-Driven Development Scenarios (Gherkin)

```gherkin
Feature: Layer-0 Universal Federated Cross-Fleet Sync & Health Healing Core

  Scenario: BDD-1144 Registry Parsing and Deterministic Path Resolution
    Given the canonical fleet registry with 9 declared projects
    When resolving local paths across the fleet
    Then all 9 projects are resolved with valid IDs, names, and assigned local or federated paths.

  Scenario: BDD-1145 Cross-Fleet Git Synchronization and Divergence Detection
    Given the 9 fleet projects
    When evaluating working tree cleanliness, branch heads, and remote tracking
    Then each project returns a determinate sync status and the primary control plane is confirmed IN_SYNC.

  Scenario: BDD-1146 Autonomous Healing of Manifest Drift and Directory Markers
    Given a fleet project with missing local structure or configuration drift
    When executing autonomous healing via healProject
    Then missing markers are created, drift is remediated, and a healing receipt is emitted.

  Scenario: BDD-1147 4-Pillar Spotify Soundcheck Scoring and Fleet Health Index
    Given the fleet health evaluation across git, architecture, security, and ops
    When computing Soundcheck scores
    Then each project receives a score between 0 and 100, a valid grade (A+, A, B, C, or F), and fleet average is computed.

  Scenario: BDD-1148 SHA-256 Merkle Root Attestation and CLI/MCP Dispatch
    Given the Glorian CLI and MCP control plane
    When invoking fleet:sync-all and fleet:audit-all
    Then a cryptographic SHA-256 Merkle root is produced, validated, and logged to the ledger.
```

## 5. Architecture Decision Record (ADR-225)

- **Context**: The Glorian System consists of 9 interrelated repositories across different domains. Sibling checkouts may not always be mounted in the same execution container or remote environment. A unified Layer-0 engine is needed to inspect, sync, heal, and attest the entire fleet with zero external dependencies.
- **Decision**: Implement `EosUniversalFleetSyncCore` in pure TypeScript using Node.js built-ins (`node:fs`, `node:path`, `node:child_process`, `node:crypto`). The engine operates hermetically whether all 9 repositories are physically checked out or federated via signed manifests.
- **Alternatives Discarded**:
  - _Git Submodules_: Fragile across CI runners, causes detached HEAD nightmares, and leaks absolute paths.
  - _Monorepo Hard Merge_: Destroys independent Vercel deployment pipelines and repository autonomy for the 9 distinct products.
  - _External Orchestrator (e.g. Jenkins / GitHub Actions matrix only)_: Fails offline sovereign execution and violates EOS Law I.
- **Consequences**: Complete fleet-wide visibility, autonomous healing, unified Spotify Soundcheck grade tracking, and cryptographic Merkle root ledger attestations.
