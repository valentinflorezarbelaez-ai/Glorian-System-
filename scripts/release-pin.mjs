#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildReleasePin, RELEASE_PIN_RELATIVE_PATH } from "./lib/release-pin.mjs";

const root = process.cwd();
const args = process.argv.slice(2);

function readOption(name) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`[FAIL] --${name} requires a value.`);
    process.exit(2);
  }
  return value;
}

const outputPath = path.resolve(root, readOption("out") ?? RELEASE_PIN_RELATIVE_PATH);
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function gitOutput(gitArgs, fallback) {
  try {
    const output = execFileSync("git", gitArgs, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return output || fallback;
  } catch {
    return fallback;
  }
}

const pin = buildReleasePin({
  root,
  name: String(pkg.name ?? "unknown"),
  version: String(pkg.version ?? "0.0.0"),
  headCommit: gitOutput(["rev-parse", "HEAD"], "0000000000000000000000000000000000000000"),
  branch: gitOutput(["branch", "--show-current"], "detached"),
  generatedAt: new Date().toISOString()
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(pin, null, 2)}\n`, "utf8");

console.log("[PASS] Release pin sealed.");
console.log(`  File      : ${path.relative(root, outputPath).replace(/\\/g, "/")}`);
console.log(`  Version   : ${pin.version}`);
console.log(`  Commit    : ${pin.headCommit}`);
console.log(`  Files     : ${pin.inventoryFileCount}`);
console.log(`  Inventory : ${pin.inventoryDigest}`);
console.log(`  Seal      : ${pin.seal}`);
