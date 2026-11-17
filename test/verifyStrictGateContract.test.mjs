/**
 * Contract: npm run verify:strict is the canonical 7-stage SecDevOps entrypoint.
 * Maps to the real gate (`node bin/eos.mjs verify`) — no fixture invention.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const CANONICAL_GATE = "node bin/eos.mjs verify";

test("package.json declares verify:strict as the canonical 7-stage entrypoint", () => {
  assert.ok(pkg.scripts, "package.json must declare scripts");
  assert.equal(
    typeof pkg.scripts["verify:strict"],
    "string",
    'scripts["verify:strict"] must exist (docs/spec FR-006 + CLAUDE/AGENTS SoT)',
  );
  assert.equal(
    pkg.scripts["verify:strict"].trim(),
    CANONICAL_GATE,
    `verify:strict must map to the real gate "${CANONICAL_GATE}"`,
  );
});

test("canonical gate binary exists at bin/eos.mjs", () => {
  const gateBin = path.join(root, "bin", "eos.mjs");
  assert.ok(fs.existsSync(gateBin), `expected gate binary at ${gateBin}`);
});
