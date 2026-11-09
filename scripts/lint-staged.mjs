#!/usr/bin/env node
/**
 * Lint-Staged — run ESLint and Prettier only on staged files.
 *
 * Big Tech standard (lint-staged npm package, Husky): instead of running
 * ESLint/Prettier on the entire codebase in the pre-commit hook (which is
 * slow for 200+ files), run them only on the files that are staged for
 * commit. This makes the pre-commit hook fast (< 1s for typical changes).
 *
 * Usage (from .githooks/pre-commit):
 *   node scripts/lint-staged.mjs
 *
 * Zero external dependencies (Law V).
 */

import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();

// Get staged files
let staged = [];
try {
  const raw = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=d"], {
    cwd: root,
    encoding: "utf8",
  });
  staged = raw
    .split("\n")
    .filter(Boolean)
    .map((f) => f.trim());
} catch {
  console.log("[lint-staged] No staged files or git unavailable — skipping.");
  process.exit(0);
}

// Filter to files ESLint/Prettier can handle
const lintable = staged.filter((f) => /\.(ts|mjs|js)$/.test(f) && !f.startsWith("templates/"));
const formattable = staged.filter(
  (f) => /\.(ts|mjs|js|json|md|yml|yaml)$/.test(f) && !f.startsWith("templates/") && !f.startsWith("node_modules/"),
);

if (lintable.length === 0 && formattable.length === 0) {
  console.log("[lint-staged] No lintable/formattable staged files — skipping.");
  process.exit(0);
}

console.log(`[lint-staged] ${lintable.length} lint target(s), ${formattable.length} format target(s)`);

// Windows CreateProcess caps the command line at ~32k characters; a large
// staged changeset (hundreds of paths) overflows it and the spawn fails
// silently, turning the gate into a false negative. Batch the file list so the
// gate stays honest on every platform.
const MAX_ARG_CHARS = 20_000;

function chunkByLength(files, maxChars) {
  const chunks = [];
  let current = [];
  let currentLen = 0;
  for (const file of files) {
    const cost = file.length + 1;
    if (current.length > 0 && currentLen + cost > maxChars) {
      chunks.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(file);
    currentLen += cost;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

// Run ESLint on staged JS/TS files
if (lintable.length > 0) {
  try {
    for (const chunk of chunkByLength(lintable, MAX_ARG_CHARS)) {
      execFileSync(
        process.execPath,
        [path.join(root, "node_modules", "eslint", "bin", "eslint.js"), "--no-warn-ignored", ...chunk],
        {
          cwd: root,
          stdio: "inherit",
        },
      );
    }
    console.log("[lint-staged] ESLint passed.");
  } catch {
    console.error("[lint-staged] ESLint found issues. Fix with `npm run lint:fix` and re-stage.");
    process.exit(1);
  }
}

// Run Prettier --check on staged files
if (formattable.length > 0) {
  try {
    for (const chunk of chunkByLength(formattable, MAX_ARG_CHARS)) {
      execFileSync(
        process.execPath,
        [path.join(root, "node_modules", "prettier", "bin", "prettier.cjs"), "--check", ...chunk],
        {
          cwd: root,
          stdio: "inherit",
        },
      );
    }
    console.log("[lint-staged] Prettier passed.");
  } catch {
    console.error("[lint-staged] Prettier found formatting issues. Run `npm run format` and re-stage.");
    process.exit(1);
  }
}

console.log("[lint-staged] All staged files pass lint and format checks.");
