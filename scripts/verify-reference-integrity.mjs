#!/usr/bin/env node
/**
 * Reference Integrity Gate — a meta-gate that fails closed when the repository
 * cites a specification that does not exist.
 *
 * Big Tech pattern (docs-as-code link checking / "documentation must not lie"):
 * a module header that claims "Governed by SPEC-148" while the OpenSpec catalog
 * does not contain that file is unverifiable prose. It silently inflates the
 * apparent scope of the project and defeats the SDD pipeline (Law II: no code
 * precedes a formal specification). This gate converts that drift into a
 * deterministic, fail-closed signal instead of trusting the prose.
 *
 * Checks
 *   1. Every `SPEC-NNN` token referenced in a scannable source or docs file
 *      resolves to an existing `openspec/specs/SPEC-NNN-*.md` file.
 *   2. The freeze-gate milestone range `(SPEC-001 to SPEC-NNN)` matches the
 *      highest specification identifier present on disk.
 *   3. The freeze-gate governing-doctrine line cites files that exist.
 *   4. Spec identifiers are unique. Pre-existing collisions are carried in a
 *      ratchet allow-list (`docs/quality/spec-id-budget.json`) that may only
 *      shrink — a new duplicate id fails the gate closed.
 *
 * Usage
 *   node scripts/verify-reference-integrity.mjs
 *   npm run verify:references
 *
 * Zero external dependencies.
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const specDir = path.join(root, "openspec", "specs");
const scanExtensions = /\.(md|markdown|ts|mts|cts|mjs|js|cjs|tla|yml|yaml|json)$/i;
const ignoreDirs = new Set(["node_modules", ".git", ".eos", "dist", ".worktrees", "_sandbox", ".vercel", ".coverage"]);
const ignoreFilePatterns = [/\.eos-check\.log$/];
const specToken = /\bSPEC-(\d{3})\b/g;
// Deliberate sentinels used by negative tests to assert that a non-existent
// specification is rejected (e.g. EosConsciousWitness fascination detection).
const sentinelSpecIds = new Set(["999"]);

function collectSpecIds() {
  const ids = new Map();
  for (const file of fs.readdirSync(specDir)) {
    const match = file.match(/^SPEC-(\d{3})-/);
    if (match) ids.set(match[1], file);
  }
  return ids;
}

const duplicateBudgetPath = path.join(root, "docs", "quality", "spec-id-budget.json");

// Group spec files by identifier so collisions (one id, several files) surface.
function collectDuplicateIds() {
  const byId = new Map();
  for (const file of fs.readdirSync(specDir)) {
    const match = file.match(/^SPEC-(\d{3})-/);
    if (!match) continue;
    if (!byId.has(match[1])) byId.set(match[1], []);
    byId.get(match[1]).push(file);
  }
  return new Map([...byId].filter(([, files]) => files.length > 1));
}

// The ratchet allow-list of tolerated duplicate ids. Absent or malformed budget
// resolves to an empty list, so the strictest behaviour (fail on any duplicate)
// is the default and a corrupted budget cannot silently open the gate.
function loadDuplicateAllowList() {
  if (!fs.existsSync(duplicateBudgetPath)) return new Set();
  try {
    const raw = JSON.parse(fs.readFileSync(duplicateBudgetPath, "utf8"));
    return new Set(Array.isArray(raw.knownDuplicateSpecIds) ? raw.knownDuplicateSpecIds : []);
  } catch {
    return new Set();
  }
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
    } else if (entry.isFile()) {
      yield path.join(dir, entry.name);
    }
  }
}

const knownSpecs = collectSpecIds();
if (knownSpecs.size === 0) {
  console.error("❌ Reference integrity gate: no specifications found under openspec/specs/.");
  process.exit(1);
}

// --- Check 1: dangling SPEC-NNN references -------------------------------
const dangling = new Map(); // missing id -> Set<relative file>
for (const abs of walk(root)) {
  const rel = path.relative(root, abs).replace(/\\/g, "/");
  if (!scanExtensions.test(rel)) continue;
  if (ignoreFilePatterns.some((re) => re.test(rel))) continue;

  const text = fs.readFileSync(abs, "utf8");
  specToken.lastIndex = 0;
  let match;
  while ((match = specToken.exec(text)) !== null) {
    const id = match[1];
    if (knownSpecs.has(id) || sentinelSpecIds.has(id)) continue;
    if (!dangling.has(id)) dangling.set(id, new Set());
    dangling.get(id).add(rel);
  }
}

// --- Check 2: freeze-gate declared range must match the highest spec id ---
const failures = [];
const freezeDoc = path.join(root, "docs", "releases", "EOS_FREEZE_GATE_STATUS.md");
let declaredRange = null;
if (fs.existsSync(freezeDoc)) {
  const freezeText = fs.readFileSync(freezeDoc, "utf8");
  const rangeMatch = freezeText.match(/SPEC-001\s+to\s+SPEC-(\d{3})/);
  if (rangeMatch) {
    declaredRange = rangeMatch[1];
    const highest = [...knownSpecs.keys()].sort().at(-1);
    if (declaredRange !== highest) {
      failures.push(
        `EOS_FREEZE_GATE_STATUS.md declares the range up to SPEC-${declaredRange}, ` +
          `but the highest specification on disk is SPEC-${highest}.`,
      );
    }
  }
}

// --- Check 3: the freeze gate's governing-doctrine line must cite real files ---
if (fs.existsSync(freezeDoc)) {
  const doctrineMatch = fs.readFileSync(freezeDoc, "utf8").match(/^\*\*Governing Doctrine\*\*:\s*(.+)$/m);
  if (doctrineMatch) {
    for (const token of doctrineMatch[1]
      .split(" / ")
      .map((t) => t.trim().replace(/`/g, ""))
      .filter(Boolean)) {
      if (!fs.existsSync(path.join(root, token))) {
        failures.push(`EOS_FREEZE_GATE_STATUS.md governing doctrine cites a missing file: ${token}`);
      }
    }
  }
}

// --- Check 4: spec identifiers must be unique (ratcheted allow-list) ------
const duplicateIds = collectDuplicateIds();
const duplicateAllow = loadDuplicateAllowList();
for (const [id, files] of [...duplicateIds.entries()].sort()) {
  if (duplicateAllow.has(id)) continue;
  failures.push(
    `SPEC-${id} is assigned to ${files.length} files (${[...files].sort().join(", ")}); ` +
      "spec identifiers must be unique.",
  );
}
for (const id of [...duplicateAllow].sort()) {
  if (!duplicateIds.has(id)) {
    failures.push(
      `docs/quality/spec-id-budget.json lists SPEC-${id} as duplicated, but it is now unique — ` +
        "remove the stale entry (the allow-list may only shrink).",
    );
  }
}

if (dangling.size > 0) {
  const sortedIds = [...dangling.keys()].sort();
  for (const id of sortedIds) {
    const files = [...dangling.get(id)].sort();
    const sample = files.slice(0, 3).join(", ");
    const extra = files.length > 3 ? ` (+${files.length - 3} more)` : "";
    failures.push(`SPEC-${id} is referenced but has no openspec/specs/SPEC-${id}-*.md (${sample}${extra}).`);
  }
}

if (failures.length > 0) {
  console.error(`❌ Reference integrity gate: ${failures.length} broken reference(s).`);
  for (const f of failures) console.error(`   - ${f}`);
  console.error(
    "\nResolve each finding above: author the missing specification, renumber a " +
      "dangling or duplicate reference to a free identifier, or remove the stale budget entry. " +
      "Every spec identifier must resolve to exactly one existing file.",
  );
  process.exit(1);
}

const highest = [...knownSpecs.keys()].sort().at(-1);
const ratchetNote = duplicateIds.size > 0 ? `; ${duplicateIds.size} known duplicate id(s) remain on the ratchet` : "";
console.log(
  `✅ Reference integrity gate: ${knownSpecs.size} unique specifications (ids up to SPEC-${highest}); ` +
    `all cited SPEC identifiers resolve${declaredRange ? `, the freeze range agrees (up to SPEC-${declaredRange})` : ""}` +
    `${ratchetNote}.`,
);
