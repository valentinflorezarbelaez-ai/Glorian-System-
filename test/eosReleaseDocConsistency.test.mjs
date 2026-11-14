import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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

test("Freeze Pin equals HEAD after tip-refresh --seal-pin (self-ref via working-tree seal)", () => {
  // A committed pin cannot cryptographically equal its own commit hash. The
  // seal ritual writes pin==HEAD into the working tree; committed pin must stay
  // an ancestor of HEAD within two tip-refresh meta commits (never multi-merge lag).
  const pinMatch = freezeDoc.match(/\|\s*\*\*Freeze Pin \(HEAD\)\*\*\s*\|\s*`([0-9a-f]+)`/i);
  assert.ok(pinMatch, "Freeze Pin row missing short SHA");
  const committedPin = pinMatch[1];

  let head;
  try {
    head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    execFileSync("git", ["merge-base", "--is-ancestor", committedPin, "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const lag = Number(
      execFileSync("git", ["rev-list", "--count", `${committedPin}..HEAD`], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
    );
    assert.ok(
      lag <= 2,
      `Freeze Pin ${committedPin} is ${lag} commits behind HEAD=${head}; run tip-refresh && tip-refresh:seal`,
    );
  } catch (err) {
    if (err && /not a git|unknown revision|Not a valid/i.test(String(err.stderr || err.message || err))) {
      return;
    }
    throw err;
  }

  // Working-tree seal: after --seal-pin, the emitted pin must equal HEAD (isolated via tmpdir to prevent parallel Windows lock races).
  const tmpSealPath = path.join(os.tmpdir(), `eos-freeze-seal-${process.pid}-${Date.now()}.md`);
  try {
    execFileSync(process.execPath, [path.join(root, "scripts/tip-refresh.mjs"), "--seal-pin", `--out=${tmpSealPath}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const after = fs.readFileSync(tmpSealPath, "utf8");
    const sealedPin = after.match(/\|\s*\*\*Freeze Pin \(HEAD\)\*\*\s*\|\s*`([0-9a-f]+)`/i)?.[1];
    assert.equal(sealedPin, head, `tip-refresh --seal-pin must write Freeze Pin == HEAD (${head})`);
  } finally {
    if (fs.existsSync(tmpSealPath)) fs.unlinkSync(tmpSealPath);
  }
});
