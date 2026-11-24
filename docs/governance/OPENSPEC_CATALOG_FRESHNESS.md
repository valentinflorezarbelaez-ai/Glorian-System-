# OpenSpec Catalog Freshness Policy

Epistemic state: `UNLOCKED_WITHIN_TESTED_SCOPE` · remediation P1-1 / PR-E

## Command

```bash
npm run catalog:freshness   # → node scripts/tip-refresh.mjs --check-catalog
```

Regenerate the committed index after Status edits or tip-seal:

```bash
node --input-type=module -e "import { EosTacticalCommandEngine } from './src/core/eosTacticalCommandEngine.ts'; new EosTacticalCommandEngine(process.cwd()).exportOpenSpecsJson();"
```

## Tip postures (thresholds)

| Tip state      | Detected by                                                              | UNKNOWN                                                            | SHA parity           | Freeze-pin bind                                                   |
| -------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------- |
| **Tip-sealed** | `ACTIVE_FREEZE_GATE_PINNED` in `docs/releases/EOS_FREEZE_GATE_STATUS.md` | **Fail-closed if > 0**                                             | Fail-closed on drift | Fail-closed if `freezePinBoundSha` missing or ≠ Freeze Pin (HEAD) |
| **Tip-open**   | Any other freeze status (or missing pin)                                 | **Advisory only** (no hard fail; threshold = unlimited until seal) | Fail-closed on drift | Not required (`freezePinBoundSha` may be `null`)                  |

Drive UNKNOWN to 0 before tip-seal. PROPOSED specs always require `**Owner**` and `**ProposedCloseBy**` regardless of tip posture. Mass PROPOSED archive is a separate PR stream (PR-F).

## Why `timestampIso` is not wall-clock age

`docs/specs/openspec-catalog-index.json` uses `writeDeterministicArtifact` / `contentDerivedIso`: `timestampIso` is reused for byte-stable regenerations when the logical catalog is unchanged. Comparing that stamp to the freeze pin commit date would false-fail a fresh tip.

**Stale vs freeze pin** is therefore defined as: tip-sealed ∧ (`freezePinBoundSha` missing ∨ does not match Freeze Pin (HEAD)). `node scripts/tip-refresh.mjs --seal-pin` rewrites the Freeze Pin cell **and** re-exports the catalog so `freezePinBoundSha` stays in lockstep.

## Invariants

- Layer-0 `dependencies: {}` unchanged.
- No fleet mounts required for this gate.
- Contract tests: `test/eosTacticalCommandEngine.test.mjs` (`BDD-OPENSPEC-FRESHNESS`).
