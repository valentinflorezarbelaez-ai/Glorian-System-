import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Anti-drift gate for the release documents.
//
// Big Tech pattern (SSOT + golden-value refresh): package.json owns the release
// version and the filesystem owns the metrics. This verifier independently
// recomputes them (BUILDER != VERIFIER) and fails if any release document has
// drifted. Run `npm run tip-refresh` to regenerate the documents.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const freezeDoc = fs.readFileSync(path.join(root, "docs/releases/EOS_FREEZE_GATE_STATUS.md"), "utf8");
const matrixDoc = fs.readFileSync(path.join(root, "docs/releases/RELEASE_CAPABILITY_MATRIX.md"), "utf8");

// Independent recomputation of the same ground-truth metrics tip-refresh writes.
function measureMetrics() {
  const specs = fs.readdirSync(path.join(root, "openspec/specs")).filter((file) => file.endsWith(".md")).length;

  let tla = 0;
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if ([".git", "node_modules", "_sandbox", ".worktrees"].includes(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (abs.endsWith(".tla")) tla++;
    }
  })(root);

  const suites = fs.readdirSync(path.join(root, "test")).filter((file) => file.endsWith(".test.mjs")).length;
  const tsModules = fs.readdirSync(path.join(root, "src/core")).filter((file) => file.endsWith(".ts")).length;

  let jsMjs = 0;
  for (const dir of ["bin", "scripts", "api", "js", "src/mcp"]) {
    const abs = path.join(root, dir);
    if (fs.existsSync(abs)) {
      jsMjs += fs.readdirSync(abs).filter((file) => file.endsWith(".js") || file.endsWith(".mjs")).length;
    }
  }

  return { specs, tla, suites, tsModules, jsMjs };
}

// Extract the leading integer of a ground-truth row, e.g. "**Formal TLA+ Models** | 41 Models".
function rowCount(label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = freezeDoc.match(new RegExp(`\\|\\s*\\*\\*${escaped}\\*\\*\\s*\\|\\s*(\\d+)`));
  assert.ok(match, `EOS_FREEZE_GATE_STATUS.md is missing the "${label}" ground-truth row`);
  return Number(match[1]);
}

test("package.json declares a canonical semver release version", () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/, `expected a semver version, got "${pkg.version}"`);
});

test("EOS_FREEZE_GATE_STATUS.md pins the package.json version as SSOT", () => {
  assert.match(
    freezeDoc,
    new RegExp(`\\*\\*Milestone\\*\\*:.*v${pkg.version.replace(/\./g, "\\.")}`),
    `freeze gate milestone must reference the SSOT version v${pkg.version}; run 'npm run tip-refresh'`,
  );
  assert.match(
    freezeDoc,
    new RegExp(`\\*\\*Release Version \\(SSOT\\)\\*\\*\\s*\\|\\s*\`${pkg.version.replace(/\./g, "\\.")}\``),
    `freeze gate ground-truth table must pin the SSOT version v${pkg.version}; run 'npm run tip-refresh'`,
  );
});

test("RELEASE_CAPABILITY_MATRIX.md version line tracks the package.json version", () => {
  assert.match(
    matrixDoc,
    new RegExp(`\\*\\*Version\\*\\*:\\s*v${pkg.version.replace(/\./g, "\\.")}`),
    `capability matrix version line must equal the SSOT version v${pkg.version}; run 'npm run tip-refresh'`,
  );
});

test("Freeze gate ground-truth metrics match the filesystem", () => {
  const measured = measureMetrics();
  const drift = {
    "Active Formal Specs (OpenSpec)": measured.specs,
    "Formal TLA+ Models": measured.tla,
    "Automated Test Suites": measured.suites,
    "Core TypeScript Modules": measured.tsModules,
    "JavaScript / MJS Modules": measured.jsMjs,
  };

  const mismatches = [];
  for (const [label, actual] of Object.entries(drift)) {
    const documented = rowCount(label);
    if (documented !== actual) mismatches.push(`${label}: doc=${documented} actual=${actual}`);
  }

  assert.deepEqual(
    mismatches,
    [],
    `release docs drifted from ground truth; run 'npm run tip-refresh': ${mismatches.join(", ")}`,
  );
});
