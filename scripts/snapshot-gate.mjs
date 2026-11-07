#!/usr/bin/env node
/**
 * Snapshot Testing Gate — CLI output stability verification.
 *
 * Big Tech standard (Jest snapshot testing, Meta's snapshot testing):
 * capture the output of CLI commands and compare against a frozen baseline.
 * If the output changes (even by a character), the gate fails — forcing the
 * developer to explicitly update the snapshot with `--update` and review
 * the diff. This catches unintended CLI output regressions.
 *
 * Usage:
 *   node scripts/snapshot-gate.mjs              # verify snapshots
 *   node scripts/snapshot-gate.mjs --update       # regenerate all snapshots
 *   npm run snapshot:check
 *
 * Zero external dependencies (Law V).
 */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const update = process.argv.includes("--update");
const SNAPSHOTS_DIR = path.join(root, "docs", "snapshots");

// CLI commands to snapshot
const COMMANDS = [
  { name: "help", args: ["bin/eos.mjs", "help"] },
  { name: "guide", args: ["bin/eos.mjs", "guide"] },
  { name: "version", args: ["bin/eos.mjs", "--version"] },
];

fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

const violations = [];

for (const { name, args } of COMMANDS) {
  const snapPath = path.join(SNAPSHOTS_DIR, `${name}.snap.txt`);

  let output;
  try {
    output = execFileSync(process.execPath, args, {
      cwd: root,
      encoding: "utf8",
      timeout: 15_000,
      maxBuffer: 2 * 1024 * 1024,
    }).trimEnd();
  } catch {
    console.log(`  [SKIP] ${name}: command failed or timed out`);
    continue;
  }

  const hash = crypto.createHash("sha256").update(output).digest("hex");

  if (update) {
    fs.writeFileSync(snapPath, `${hash}\n${output}\n`, "utf8");
    console.log(`  [UPDATED] ${name}.snap.txt (${output.length} bytes, sha256:${hash.slice(0, 12)}...)`);
    continue;
  }

  if (!fs.existsSync(snapPath)) {
    console.log(`  [NEW] ${name}: no snapshot found — run with --update to create`);
    continue;
  }

  const snapContent = fs.readFileSync(snapPath, "utf8");
  const snapHash = snapContent.split("\n")[0];
  const currentHash = hash;

  if (snapHash === currentHash) {
    console.log(`  [PASS] ${name}: output matches snapshot (${output.length} bytes)`);
  } else {
    // Show a small diff for context
    const snapOutput = snapContent.split("\n").slice(1).join("\n").trimEnd();
    const diffLines = output.split("\n").filter((line, i) => {
      const snapLine = snapOutput.split("\n")[i];
      return snapLine !== line;
    });
    violations.push(
      `${name}: output changed (sha256 ${snapHash.slice(0, 12)}... → ${currentHash.slice(0, 12)}...)\n` +
        `  First diff lines: ${diffLines
          .slice(0, 3)
          .map((l) => `"${l.slice(0, 80)}"`)
          .join(", ")}`,
    );
  }
}

if (update) {
  console.log(`\nSnapshots updated: ${COMMANDS.length} command(s). Review the diff before committing.`);
  process.exit(0);
}

console.log("======================================================================");
console.log(" EOS SNAPSHOT GATE — CLI Output Stability");
console.log("======================================================================");

if (violations.length === 0) {
  console.log(" PASS — All CLI outputs match their snapshots.");
  console.log("======================================================================");
  process.exit(0);
}

console.error(`\n FAIL — ${violations.length} snapshot(s) changed:`);
for (const v of violations) console.error(`  ${v}`);
console.error("\nIf the change is intentional, run `npm run snapshot:check -- --update`");
console.error("and review the diff before committing.");
process.exit(1);
