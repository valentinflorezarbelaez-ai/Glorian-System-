# Backstage ↔ EOS MCP / API scorecard bridge

**Status:** optional read-only bridge (post Software Templates / #668).  
**Invariant:** portal **reads** EOS receipts — never rescores; **no** `@backstage/*` / npm deps in `src/core/` (Law V).

## Why

A future Backstage host needs a fail-closed way to show Soundcheck / fleet scorecard posture without inventing a second scoring engine. Prefer existing Tier-0 MCP tools and committed receipt JSON; the serverless `/api/scorecard` endpoint is a thin Host/Origin-gated mirror of those files.

## Preferred consumption order

| Priority | Surface | Use when |
| --- | --- | --- |
| 1 | **Catalog annotations + raw GitHub URLs** | Portal can fetch public evidence without secrets |
| 2 | **MCP Tier-0 tools** (stdio / agent side) | Operator or backend agent already runs EOS MCP |
| 3 | **`GET /api/scorecard`** | Live portal backend needs Host/Origin discipline on Vercel |

## Receipt paths (single writer)

| Kind | Path | Writer / gate | Envelope metadata |
| --- | --- | --- | --- |
| `soundcheck` | [`docs/evidence/SOUNDCHECK_SCORECARD_RECEIPT.json`](../evidence/SOUNDCHECK_SCORECARD_RECEIPT.json) | `src/core/eosBackstageSoundcheckScorecard.ts` (SPEC-299) | MCP `eos_fleet_soundcheck` + `eos_audit_fleet`; scripts `fleet:scorecards` / `fleet:audit` |
| `fleet-products` | [`docs/evidence/FLEET_PRODUCT_SCORECARDS_RECEIPT.json`](../evidence/FLEET_PRODUCT_SCORECARDS_RECEIPT.json) | `scripts/eos-fleet-product-scorecards.mjs` | MCP `eos_audit_fleet`; script `fleet:scorecards` |
| `l0-consumer` | [`docs/evidence/MODULE_CONSUMER_GRAPH.json`](../evidence/MODULE_CONSUMER_GRAPH.json) | `scripts/verify-module-consumers.mjs` (SPEC-270) | No MCP tools; scripts `boundary:check` / `consumers:audit` |

`/api/scorecard` success envelopes set `singleWriter` / `mcpTier0Tools` / `npmScripts` **per `kind`** — never Soundcheck defaults for other kinds.

Pillar map: [`scorecard-pillar-map.json`](./scorecard-pillar-map.json).  
Posture default: `CONTROL_PLANE_ONLY` until fleet paths are mounted and `npm run fleet:audit` exits 0.

### Raw GitHub URLs (catalog / plugin config)

```text
https://raw.githubusercontent.com/valentinflorezarbelaez-ai/Glorian-System-/main/docs/evidence/SOUNDCHECK_SCORECARD_RECEIPT.json
https://raw.githubusercontent.com/valentinflorezarbelaez-ai/Glorian-System-/main/docs/backstage/scorecard-pillar-map.json
```

Catalog Location ingestion remains **one** root URL — see [`app-config.snippet.yaml`](./app-config.snippet.yaml).

## MCP Tier-0 (reuse — do not add tools)

| Tool | Profile | Role for Backstage |
| --- | --- | --- |
| `eos_fleet_soundcheck` | essential / core | Live Soundcheck audit of registered fleet repos |
| `eos_audit_fleet` | core | Fleet registry / mission-control health |
| `eos_health_check` | essential / core | Control-plane process telemetry |

Set `EOS_MCP_PROFILE=core` (default) or `essential`. Do **not** expand the public HTTP MCP allowlist solely for scorecards — use `/api/scorecard` or raw receipts instead. See [`MCP_TIER0_TOKEN_ECONOMY.md`](../governance/MCP_TIER0_TOKEN_ECONOMY.md).

CLI equivalents:

```bash
npm run fleet:scorecards
npm run fleet:audit
node bin/eos.mjs toolchain:soundcheck:audit
```

## Serverless API (`GET /api/scorecard`)

| Item | Value |
| --- | --- |
| Method | `GET` / `HEAD` / `OPTIONS` only |
| Query | `kind=soundcheck` (default when absent) \| `fleet-products` \| `l0-consumer`; duplicate `kind` → **400** fail-closed |
| CORS | Reflect allowlisted `Origin` only — never `Access-Control-Allow-Origin: *` |
| Host | Fail-closed allowlist (`glorian-system.vercel.app`, localhost, + `EOS_ALLOWED_HOSTS`) |
| Origin | Fail-closed when present (`EOS_ALLOWED_ORIGINS` + static set) |
| Body | Envelope + committed `receipt` JSON + `receiptSha256` |

Example (server-side Backstage plugin; typically **no** browser `Origin`):

```http
GET /api/scorecard?kind=soundcheck HTTP/1.1
Host: glorian-system.vercel.app
Accept: application/json
```

Production URL:

```text
https://glorian-system.vercel.app/api/scorecard?kind=soundcheck
```

### Env allowlist extensions

| Env | Purpose |
| --- | --- |
| `EOS_ALLOWED_ORIGINS` | Extra CORS origins (comma-separated; `*` rejected) |
| `EOS_ALLOWED_HOSTS` | Extra Host values (comma-separated; `*` rejected) |

## Catalog annotations

Root Component annotations (see [`catalog-info.yaml`](../../catalog-info.yaml)):

- `eos.glorian/soundcheck-receipt`
- `eos.glorian/scorecard-api: /api/scorecard`
- `eos.glorian/mcp-bridge: docs/backstage/mcp-api-bridge.md`
- `eos.glorian/fleet-posture: CONTROL_PLANE_ONLY`

## Explicit non-goals

- Re-implementing Soundcheck inside a Backstage plugin
- Adding `@backstage/*` to root `package.json` / `src/core/`
- Wildcard CORS on this route
- Exposing `eos_fleet_soundcheck` on the public HTTP MCP allowlist solely for this slice
