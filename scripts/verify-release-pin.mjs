#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  computeInventoryDigest,
  RELEASE_PIN_RELATIVE_PATH,
  verifyReleasePin
} from "./lib/release-pin.mjs";

const root = process.cwd();
const args = process.argv.slice(2);

function readOption(name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`[FAIL] --${name} requires a value.`);
    process.exit(2);
  }
  return value;
}

const allowMissing = args.includes("--allow-missing");
const requireInventory = args.includes("--require-inventory");
const pinPath = path.resolve(root, readOption("file", RELEASE_PIN_RELATIVE_PATH));
const expectedCommit = readOption("expected-commit", undefined);

if (!fs.existsSync(pinPath)) {
  if (allowMissing) {
    console.log(`[SKIP] Release pin not present at ${path.relative(root, pinPath)}.`);
    process.exit(0);
  }
  console.error(
    `[FAIL] Release pin missing at ${path.relative(root, pinPath)}. Run: npm run release:pin`
  );
  process.exit(1);
}

let pin;
try {
  pin = JSON.parse(fs.readFileSync(pinPath, "utf8"));
} catch (error) {
  console.error(`[FAIL] Release pin is not valid JSON: ${error.message}`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

let expectedInventoryDigest;
if (requireInventory) {
  expectedInventoryDigest = computeInventoryDigest(root).inventoryDigest;
}

const result = verifyReleasePin(pin, {
  expectedVersion: String(pkg.version ?? "0.0.0"),
  expectedCommit,
  expectedInventoryDigest
});

if (!result.ok) {
  console.error(`[FAIL] Release pin verification failed (${path.relative(root, pinPath)}):`);
  for (const error of result.errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log("[PASS] Release pin verified.");
console.log(`  Version   : ${pin.version}`);
console.log(`  Commit    : ${pin.headCommit}`);
console.log(`  Inventory : ${pin.inventoryDigest}`);
