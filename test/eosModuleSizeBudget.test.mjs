import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Architecture fitness function: the shape of the codebase is frozen as a
// ratchet. Modules above the default ceiling are grandfathered at their
// recorded size; nothing may grow past its ceiling. Refresh the baseline with
// `npm run size:budget -- --update` after an intentional, reviewed change.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIRS = ["src", "bin", "scripts", "api", "js"];
const budget = JSON.parse(fs.readFileSync(path.join(root, "docs/quality/size-budget.json"), "utf8"));

// Independently recompute module sizes (verifier independence).
function measureSizes() {
  const sizes = new Map();
  const walk = (abs, rel) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (["node_modules", ".git"].includes(entry.name)) continue;
      const childAbs = path.join(abs, entry.name);
      const childRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(childAbs, childRel);
      else if (/\.(ts|mjs|js)$/.test(entry.name)) {
        sizes.set(childRel, fs.readFileSync(childAbs, "utf8").split("\n").length);
      }
    }
  };
  for (const dir of SOURCE_DIRS) {
    const abs = path.join(root, dir);
    if (fs.existsSync(abs)) walk(abs, dir);
  }
  return sizes;
}

test("Module size budget declares a positive default ceiling", () => {
  assert.ok(
    Number.isInteger(budget.defaultMaxLines) && budget.defaultMaxLines > 0,
    "defaultMaxLines must be a positive integer",
  );
});

test("No source module exceeds its ratchet ceiling", () => {
  const sizes = measureSizes();
  const violations = [];
  for (const [file, lines] of sizes) {
    const ceiling = Object.hasOwn(budget.ceilings, file) ? budget.ceilings[file] : budget.defaultMaxLines;
    if (lines > ceiling) violations.push(`${file}: ${lines} lines > ceiling ${ceiling}`);
  }
  assert.deepEqual(
    violations,
    [],
    `module size budget exceeded; refactor or run 'npm run size:budget -- --update':\n${violations.join("\n")}`,
  );
});

test("Size budget baseline has no stale or unnecessary ceilings", () => {
  const sizes = measureSizes();
  const stale = Object.keys(budget.ceilings).filter(
    (file) => !sizes.has(file) || sizes.get(file) <= budget.defaultMaxLines,
  );
  assert.deepEqual(stale, [], `stale size-budget ceilings; run 'npm run size:budget -- --update': ${stale.join(", ")}`);
});
