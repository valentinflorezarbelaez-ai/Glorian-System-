# Glorian Dual-Stack System Rebranding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand EOS System to Glorian System across the public Web landing page, Studio Console, documentation, and fleet catalog while adding `glorian` as a primary CLI binary command in `package.json` with backward-compatible `eos` aliasing.

**Architecture:** Maintain a dual-stack approach where presentation and CLI entrypoints are elevated to "Glorian" while internal Node.js modules and MCP protocols maintain seamless backward-compatible aliases. All Subresource Integrity (SRI) SHA-384 hashes in `index.html` are systematically recalculated and verified against CI/CD test gates.

**Tech Stack:** Node.js (ESM), HTML5, CSS3, JSON, Bash/PowerShell test harnesses.

**Spec:** `docs/superpowers/specs/2026-11-02-glorian-system-rebrand-design.md`

## Global Constraints
- Layer-0 Purity: Zero new npm runtime dependencies.
- Zero Breaking Changes: Existing CLI scripts or external integrations invoking `eos` must continue to function without modification.
- Cryptographic Integrity: SRI SHA-384 hashes on `<link>` and `<script>` tags in `index.html` must match exact file content digests.
- Professional Technical English: All commit messages, task outputs, and source code comments must use standard technical English.

## Review Focus
1. `package.json` binary alias: Running `npx .` or executing via `bin/eos.mjs` directly must recognize `glorian` alongside `eos`.
2. `index.html` title & meta parity: Verify all `<title>`, `<meta name="application-name">`, and Schema.org JSON-LD tags correctly display "Glorian System" without leftover broken strings.
3. SRI Integrity check: Verify `node scripts/verify-sri-integrity.mjs` passes with exit code 0.
4. Studio Console UI: Ensure `src/ui/eosStudioConsole.html` reflects "GLORIAN SYSTEM // MATRIX" cleanly.
5. Fleet Registry: Verify `docs/projects/registry.json` maintains valid JSON schema and correct SHA-256 hash if validated by fleet tools.

---

### Task 1: Add `glorian` CLI Binary Entry to `package.json`

**Files:**
- Modify: `package.json:12-15`
- Test: `test/glorianCliBinary.test.mjs`

**Interfaces:**
- Consumes: `bin/eos.mjs`
- Produces: Dual-stack CLI binary mapping: `"bin": { "glorian": "./bin/eos.mjs", "eos": "./bin/eos.mjs" }`

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Update `package.json` bin configuration**
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Verified**

---

### Task 2: Elevate Public Web Presentation (`index.html`) to Glorian System

**Files:**
- Modify: `index.html:6-60, 110-150`
- Test: `test/glorianPresentation.test.mjs`

**Interfaces:**
- Consumes: `index.html`
- Produces: Updated DOM metadata, title, OpenGraph tags, JSON-LD, and Hero Bento HUD headers referencing "Glorian System"

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Update metadata, title, and Bento HUD in `index.html`**
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Verified**

---

### Task 3: Elevate Studio Console (`src/ui/eosStudioConsole.html`)

**Files:**
- Modify: `src/ui/eosStudioConsole.html:6, 110`
- Test: `test/glorianStudioConsole.test.mjs`

**Interfaces:**
- Consumes: `src/ui/eosStudioConsole.html`
- Produces: Header and title branded as "GLORIAN SYSTEM"

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Update `src/ui/eosStudioConsole.html`**
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Verified**

---

### Task 4: Update Documentation and Fleet Registry

**Files:**
- Modify: `README.md:1-10`
- Modify: `AGENTS.md:8-12`
- Modify: `docs/projects/registry.json:120-137`
- Test: `test/glorianRegistryDocs.test.mjs`

**Interfaces:**
- Consumes: Master catalog and docs
- Produces: Synchronized documentation referencing Glorian System

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Update `docs/projects/registry.json`, `AGENTS.md`, and `README.md`**
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Verified**

---

### Task 5: Recalculate SRI Integrity and Execute Full Verification Gate

**Files:**
- Modify: `index.html` (if SRI script updates integrity strings)
- Test: `scripts/verify-sri-integrity.mjs`, `scripts/verify-cicd-pipeline.mjs`

**Interfaces:**
- Consumes: All updated files
- Produces: Cryptographic proof of zero broken invariants across landing page and CI/CD

- [x] **Step 1: Run SRI verification and auto-update**
- [x] **Step 2: Run all newly created tests**
- [x] **Step 3: Run CI/CD verification pipeline**
- [x] **Step 4: Final verification complete: 7/7 CI/CD stages passed**
