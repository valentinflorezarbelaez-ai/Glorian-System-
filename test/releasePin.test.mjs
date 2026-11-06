import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildReleasePin,
  computeInventoryDigest,
  verifyReleasePin
} from "../scripts/lib/release-pin.mjs";

function createFixtureRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "release-pin-test-"));
  execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "evidence"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "entry.ts"), "export const value = 1;\n");
  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "release-pin-fixture", version: "1.2.3" }, null, 2)}\n`
  );
  execFileSync("git", ["add", "."], { cwd: root });
  return root;
}

function sealFixture(root) {
  return buildReleasePin({
    root,
    name: "release-pin-fixture",
    version: "1.2.3",
    headCommit: "a".repeat(40),
    branch: "main",
    generatedAt: "2026-11-06T00:00:00.000Z"
  });
}

test("REL-PIN-01: a freshly sealed pin passes structural, version and inventory verification", () => {
  const root = createFixtureRepo();
  try {
    const pin = sealFixture(root);
    const { inventoryDigest } = computeInventoryDigest(root);

    assert.equal(pin.schemaVersion, 1);
    assert.match(pin.seal, /^sha256:[0-9a-f]{64}$/);
    assert.ok(pin.inventoryFileCount >= 2);

    const result = verifyReleasePin(pin, {
      expectedVersion: "1.2.3",
      expectedCommit: "a".repeat(40),
      expectedInventoryDigest: inventoryDigest
    });

    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

test("REL-PIN-02: tampering with the payload breaks the seal", () => {
  const root = createFixtureRepo();
  try {
    const pin = { ...sealFixture(root), headCommit: "b".repeat(40) };
    const result = verifyReleasePin(pin, { expectedVersion: "1.2.3" });

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("Seal mismatch")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

test("REL-PIN-03: version drift between pin and package.json is rejected", () => {
  const root = createFixtureRepo();
  try {
    const result = verifyReleasePin(sealFixture(root), { expectedVersion: "2.0.0" });

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("Version drift")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

test("REL-PIN-04: commit drift is reported only when an expected commit is supplied", () => {
  const root = createFixtureRepo();
  try {
    const pin = sealFixture(root);

    assert.equal(verifyReleasePin(pin, {}).ok, true);

    const drifted = verifyReleasePin(pin, { expectedCommit: "c".repeat(40) });
    assert.equal(drifted.ok, false);
    assert.ok(drifted.errors.some((error) => error.includes("Commit drift")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

test("REL-PIN-05: tracked-file changes alter the inventory digest, volatile evidence does not", () => {
  const root = createFixtureRepo();
  try {
    const baseline = computeInventoryDigest(root);
    const pin = sealFixture(root);

    const volatileFile = path.join(root, "docs", "evidence", "LOCAL-CHECKS-RECEIPT.json");
    fs.writeFileSync(volatileFile, '{"run":1}\n');
    execFileSync("git", ["add", "."], { cwd: root });
    assert.equal(computeInventoryDigest(root).inventoryDigest, baseline.inventoryDigest);

    fs.writeFileSync(path.join(root, "src", "entry.ts"), "export const value = 2;\n");
    execFileSync("git", ["add", "."], { cwd: root });
    const drifted = computeInventoryDigest(root);

    assert.notEqual(drifted.inventoryDigest, baseline.inventoryDigest);
    const result = verifyReleasePin(pin, { expectedInventoryDigest: drifted.inventoryDigest });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("Inventory drift")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
