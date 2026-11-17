#!/usr/bin/env node
/**
 * Deep local verify — enables Stage 4.6 mutation + Stage 4.7 flaky gates (advisory).
 * Epistemic: LOCAL_DEEP_GATES_WITHIN_TESTED_SCOPE. Not FEDERAL_ATO.
 *
 * Defaults SKIP_COVERAGE=1 so Stage 4.5 uses the incremental PTS ratchet (same as
 * pre-push) instead of a silent full V8 coverage re-run of all suites — that path
 * hung ~12h on Windows and never reached mutation/flaky.
 *
 * Usage: npm run verify:deep
 * Full V8 coverage: SKIP_COVERAGE=0 npm run verify:deep
 * Enforce fail-closed: EOS_MUTATION_ENFORCE=1 EOS_FLAKY_ENFORCE=1 npm run verify:deep
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {
  ...process.env,
  EOS_MUTATION: process.env.EOS_MUTATION || "1",
  EOS_FLAKY: process.env.EOS_FLAKY || "1",
  // Prefer incremental ratchet unless the caller explicitly requests full coverage.
  SKIP_COVERAGE: process.env.SKIP_COVERAGE ?? "1",
};

const result = spawnSync(process.execPath, [path.join(root, "scripts/verify-cicd-pipeline.mjs")], {
  cwd: root,
  env,
  stdio: "inherit",
});

process.exit(result.status === null ? 1 : result.status);
