# SPEC-129: Tier S-0 Tactical Apex — Palantir/Anduril Bento HUD, Raycast Command Palette (Ctrl+K), Fleet Synapse Radar & 129 OpenSpec Explorer

## Status

- **Status**: APPROVED
- **Date**: 2026-11-02
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

To elevate EOS System to the pinnacle of defense-grade and hyperscale platforms (Palantir Foundry, Anduril Lattice, Linear, Raycast, and FoundationDB), EOS requires a unified, high-density tactical interface that eliminates navigation friction and provides instantaneous observability over the sovereign fleet.

Currently, EOS provides rich capabilities distributed across 2,600+ lines of HTML and 132 test suites. However, accessing tools, inspecting the 9 fleet repositories, exploring formal specifications, and auditing compliance required manual scrolling or CLI invocations.

SPEC-129 unifies the user experience into four tightly integrated pillars:

1. **Tier S-0 Hero Bento HUD**: High-density tactical grid (Geist Sans, JetBrains Mono, Obsidian Deep Dark `#050505` to `#09090b`, 1px borders `rgba(255,255,255,0.08)`, micro-dot matrix).
2. **Global Command Palette (`Ctrl+K` / `Cmd+K`)**: Keyboard-driven modal providing sub-millisecond fuzzy search and direct execution across all 9 fleet projects, 46 MCP tools, CLI shortcuts, and 129 formal OpenSpecs.
3. **Real-Time Fleet Synapse Radar**: Interactive visual telemetry showing live HTTP response codes, latency in milliseconds, SLO error budget consumption, and direct one-click navigation to the 9 fleet deployments.
4. **129 OpenSpecs Interactive Explorer**: Filterable, structured specification browser allowing operators to view any OpenSpec, its EARS requirements, BDD scenarios, and cryptographic SHA-256 evidence seals.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-409 (Ubiquitous - Hero Bento HUD)**:
  `THE SYSTEM SHALL render a Tier S-0 Hero Bento Grid on the primary viewport conforming to the 4px rigid grid, using Obsidian Deep Dark tokens (--surface-base: #050505, --border-hairline: rgba(255,255,255,0.08)), displaying live telemetry counters (Registered Fleet Repos: 9, Test Suites: 132, OpenSpecs: 129, TLA+ Models: 41, Perfection Index: 100%).`

- **FR-410 (Event-Driven - Global Command Palette Hotkey)**:
  `WHEN the user presses Ctrl+K, Cmd+K, or clicks the floating tactical command button, THE SYSTEM SHALL open the Tier S-0 Command Palette dialog, trap focus within the input search box, and provide instantaneous fuzzy matching across actions, fleet repositories, and OpenSpecs.`

- **FR-411 (State-Driven - Fleet Synapse Radar Telemetry)**:
  `WHILE viewing the Fleet Synapse Radar, THE SYSTEM SHALL display real-time status indicators (HTTP 200, Latency in ms, Authorization Tier LEVEL_3, Verified Clean Secrets) for all 9 registered fleet targets (Avo Pack, ATP Strength, Biblioteca Gnóstica, Crud Slack, Aberamentho, PTG, Portafolio, Donaciones, EOS System).`

- **FR-412 (Ubiquitous - 129 OpenSpecs Interactive Explorer)**:
  `THE SYSTEM SHALL provide an interactive, filterable catalog of all 129 formal architectural specifications, allowing filtering by epistemic state (PRODUCTION_READY, VERIFIED, LEVEL_3_AUTHORIZED) and instant search by spec ID or keyword.`

- **FR-413 (Ubiquitous - Zero-Dependency Hexagonal Purity)**:
  `THE SYSTEM SHALL implement all command indexing, fuzzy searching, and UI interactions with zero external runtime dependencies, preserving 100% compliance with EOS Constitutional Law V.`

- **FR-414 (Ubiquitous - Subresource Integrity & Visual Governor Conformance)**:
  `THE SYSTEM SHALL ensure all CSS and JS modifications maintain valid SHA-384 Subresource Integrity hashes in index.html and pass the Tier S-0 Design System Governor (scripts/eos-design-system-govern.mjs) with a 100% Perfection Index.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-388 Tactical Command Engine Fuzzy Indexing
  GIVEN the EosTacticalCommandEngine initialized with project root
  WHEN query matches "avo", "slack", "spec 128", or "verify"
  THEN the engine returns prioritized matching results with category, title, shortcut, and action payload
  AND execution latency is under 5 milliseconds.

SCENARIO: BDD-389 Command Palette Keyboard Navigation and Execution
  GIVEN the user is on the EOS control plane landing page
  WHEN the user presses "Ctrl+K" or "Cmd+K"
  THEN the #eos-command-palette modal dialog opens with focus on the input
  AND pressing "Escape" closes the palette smoothly.

SCENARIO: BDD-390 Real-Time Fleet Synapse Radar Telemetry
  GIVEN the 9 registered fleet repositories in docs/projects/registry.json
  WHEN the operator views the Fleet Synapse Radar
  THEN each project card renders its verified production URL, authorization badge, and synthetic latency metrics
  AND zero plaintext secrets or unmasked tokens are exposed.

SCENARIO: BDD-391 129 OpenSpecs Explorer Filtering and Rendering
  GIVEN the complete catalog of 129 OpenSpecs
  WHEN the user searches for a spec ID or filters by status
  THEN the catalog displays matching specs with EARS requirement count and BDD scenario count
  AND deep links to the markdown specification files are provided.

SCENARIO: BDD-392 Tier S-0 Visual Governor 100% Compliance
  GIVEN the updated index.html, css/eos.css, and js/eos.js
  WHEN scripts/eos-design-system-govern.mjs is executed
  THEN the audit reports 0 blocking violations, 0 warnings, and a Perfection Index of 100%.
```

---

## 4. Architecture Decision Records (ADRs)

- **ADR-129-1: Native Zero-Dependency Command Palette Engine vs Third-Party Component**

  - _Context_: Command palettes typically rely on libraries like `cmdk` or `ninja-keys`, which would introduce external runtime dependencies violating Law V.
  - _Decision_: Implement a pure standard-library TypeScript/JavaScript command indexer with an in-memory Trie/Levenshtein fuzzy scorer and a native HTML5 `<dialog>` component with keyboard trap and ARIA combobox accessibility.
  - _Consequence_: 0 bytes of vendor overhead, sub-millisecond execution, complete architectural independence.

- **ADR-129-2: Build-Time OpenSpec Index Generation for Zero-Latency Client Browsing**
  - _Context_: Parsing 129 markdown specifications synchronously on every client page load would incur redundant CPU cycles and potential CLS.
  - _Decision_: Extract the lightweight metadata index (ID, title, status, FR count, BDD count) into a structured JSON dataset `docs/specs/openspec-catalog-index.json`, embedded into the client bundle and auditable by the CI/CD pipeline.
  - _Consequence_: Instantaneous search without network requests or layout shifts.

---

## 5. Atomic Task DAG

1. [x] **TASK-129-1**: Write formal specification `openspec/specs/SPEC-129-TIER-S0-TACTICAL-APEX-COMMAND-SUITE.md`.
2. [ ] **TASK-129-2**: Record Level 2 Implementation Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
3. [ ] **TASK-129-3**: Build `src/core/eosTacticalCommandEngine.ts` (fuzzy search, command dispatcher, spec catalog extractor).
4. [ ] **TASK-129-4**: Write comprehensive unit tests in `test/eosTacticalCommandEngine.test.mjs`.
5. [ ] **TASK-129-5**: Enhance `index.html`, `css/eos.css`, and `js/eos.js` with Bento Grid Hero, `Ctrl+K` Command Palette, Fleet Synapse Radar, and OpenSpec Explorer.
6. [ ] **TASK-129-6**: Run `scripts/eos-design-system-govern.mjs` and update SRI integrity via `scripts/verify-sri-integrity.mjs --fix`.
7. [ ] **TASK-129-7**: Verify all 7 CI/CD stages via `node scripts/verify-cicd-pipeline.mjs` and generate `docs/evidence/EVD-SPEC-129.json`.
8. [ ] **TASK-129-8**: Git commit and push to `origin/main`.
