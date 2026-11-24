# Delta note — ESLint 10 + `@types/node` 26 (closes #628)

## Intent

Lift `DEPENDABOT_MAJOR_POLICY` won’t-fix window for:

- `eslint` / `@eslint/js` 10
- `eslint-plugin-n` 18
- `@types/node` 26

## Lint semantics change

ESLint 10 `js.configs.recommended` enables `no-useless-assignment`. Call sites that initialized locals then always overwrote them before read were cleaned (no rule disable). Behavior of scripts/CLI is unchanged.

## Types change

`@types/node` 26:

- Removed `crypto.KeyPairSyncResult` — `eosTlsPeerTransport.ts` uses an explicit `{ publicKey: string; privateKey: string }` PEM pair type.
- `worker_threads` `error` event payload is `unknown` — `eosWorkerTribunal.ts` narrows via `instanceof Error`.

Engines remain `>=22.18.0 <25` (Node 24 LTS). Types may lead the engine ceiling.

## Layer-0 invariant

`package.json` has no runtime `dependencies` (empty / absent). DevDependency majors only.
