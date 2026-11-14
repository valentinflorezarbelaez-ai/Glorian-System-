# SPEC-104 — Layer-0 Bio-Sequence Alignment & Folding Confidence (`pLDDT` / `PAE`) Core

## Metadata

- **SPEC ID**: SPEC-104
- **Change ID**: CHANGE-127
- **Intake ID**: INTAKE-127
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosBioSequenceFoldingConfidenceCore`

---

## 1. Overview

`EosBioSequenceFoldingConfidenceCore` validates canonical 20-amino-acid protein sequences, runs deterministic Smith-Waterman local sequence alignment, inspects 3D C-alpha atom backbone coordinates for physiological bond geometry, steric clashes (`distance < 2.0` Å for non-adjacent residues $|i - j| > 1$), native residue contact map formation (`distance < 8.0` Å), and evaluates per-residue & global `pLDDT` (0–100) and `PAE` (Å) confidence.

---

## 2. Functional Requirements (EARS Syntax)

**FR-104-001** (Event-Driven)
WHEN `evaluateFoldingAndSequenceAlignment(options)` is invoked, THE SYSTEM SHALL validate that normalized primary and reference sequences are non-empty and match the canonical 20-amino-acid alphabet `/^[ACDEFGHIKLMNPQRSTVWY]+$/`.

**FR-104-002** (State-Driven)
WHILE evaluating sequence homology, THE SYSTEM SHALL execute Smith-Waterman local alignment (`matchScore`, `mismatchPenalty`, linear `gapPenalty`) and return exact `smithWatermanMaxScore` and `alignmentIdentityRatio`.

**FR-104-003** (State-Driven)
WHILE analyzing the 3D C-alpha backbone coordinate trace (`caCoordinates`), THE SYSTEM SHALL compute pairwise Euclidean distances, count non-adjacent spatial contacts (`distance < 8.0` Å with $|i - j| \ge 2$), and flag any steric clashes (`distance < 2.0` Å for $|i - j| \ge 2$).

**FR-104-004** (Error Condition)
IF `stericClashCount > 0`, THEN THE SYSTEM SHALL emit verdict `"STERIC_VIOLATION_REJECTED"`; ELSE IF `meanPlddt < 70` OR `meanPaeAngstrom > 5.0`, THEN emit `"DISORDERED_LOW_CONFIDENCE"`; ELSE `"HIGH_CONFIDENCE_FOLD"`.

**FR-104-005** (Ubiquitous)
THE SYSTEM SHALL seal the output via `deepFreeze` and a 64-hex `bioFoldDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1306 — High-Confidence Well-Folded Domain & Contact Formation

```gherkin
SCENARIO: Canonical alpha-helical motif yields HIGH_CONFIDENCE_FOLD with contact map density
  GIVEN default well-packed protein sequence, coordinates, and pLDDT >= 85
  WHEN evaluateFoldingAndSequenceAlignment executes
  THEN verdict is "HIGH_CONFIDENCE_FOLD", stericClashCount is 0, contactPairsCount > 0, and meanPlddt >= 80
```

### BDD-1307 — Smith-Waterman Local Alignment Accuracy

```gherkin
SCENARIO: Smith-Waterman scores exact conserved motif higher than diverged sequence
  GIVEN identical query and reference sequence vs mutated query sequence
  WHEN evaluateFoldingAndSequenceAlignment executes both
  THEN exact match yields alignmentIdentityRatio = 1 and strictly higher smithWatermanMaxScore
```

### BDD-1308 — Steric Clash Fail-Closed Rejection

```gherkin
SCENARIO: Overlapping non-adjacent C-alpha coordinates trigger STERIC_VIOLATION_REJECTED
  GIVEN non-adjacent residues i and i+3 placed at distance < 2.0 Angstroms
  WHEN evaluateFoldingAndSequenceAlignment executes
  THEN stericClashCount >= 1 and verdict is "STERIC_VIOLATION_REJECTED"
```

### BDD-1309 — Disordered Low-Confidence Detection & Invalid Residue Rejection

```gherkin
SCENARIO: Reject non-canonical amino acid symbols and classify low-pLDDT loop as DISORDERED_LOW_CONFIDENCE
  GIVEN sequence containing invalid character 'X' OR low per-residue pLDDT < 60
  WHEN evaluateFoldingAndSequenceAlignment executes
  THEN invalid symbol throws Error, while low pLDDT returns "DISORDERED_LOW_CONFIDENCE"
```

### BDD-1310 — End-to-End CLI `bio:fold` & JSON-RPC MCP `alphafold_fold_audit`

```gherkin
SCENARIO: Dispatch Bio-Sequence Folding Evaluator via CLI and full EosMcpServer JSON-RPC tools/call
  GIVEN wired CLI handler bio:fold and MCP action "alphafold_fold_audit" on eos_enterprise_workspace
  WHEN invoked via CLI --json and EosMcpServer.handleRequest tools/call
  THEN both return verdict "HIGH_CONFIDENCE_FOLD" and a 64-hex bioFoldDigestSha256
```
