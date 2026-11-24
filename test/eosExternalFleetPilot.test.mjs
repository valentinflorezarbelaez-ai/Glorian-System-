/**
 * Test Suite: External Fleet Lifecycle Pilot Benchmark (SPEC-124 / T4)
 * Exercises real ephemeral `git clone` -> `inspect/plan/guard/start/commit/validate/review/tamper-reject/apply/revert/close`
 * across synthetic temporary repositories with complete cleanup under `os.tmpdir()`.
 */

import "./lib/testEvidence.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runExternalFleetPilot } from "../scripts/run-external-fleet-pilot.mjs";

function createTempRepo(parentDir, name, files) {
  const repoDir = path.join(parentDir, name);
  fs.mkdirSync(repoDir, { recursive: true });
  execFileSync("git", ["init", "-b", "main"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Pilot Test"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@glorian.local"], { cwd: repoDir, stdio: "ignore" });
  for (const [relPath, content] of Object.entries(files)) {
    const absPath = path.join(repoDir, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, "utf8");
  }
  execFileSync("git", ["add", "-A"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "chore: seed pilot repository"], { cwd: repoDir, stdio: "ignore" });
  return repoDir;
}

test("BDD-1201: runExternalFleetPilot exercises full lifecycle, tamper rejection, and reversibility on 2 isolated repos", async (t) => {
  const scratch = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), "eos-pilot-fixture-"));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 4, retryDelay: 50 }));

  const nodeRepo = createTempRepo(scratch, "node-sample", {
    "package.json": JSON.stringify({ name: "node-sample", scripts: { test: 'node -e "process.exit(0)"' } }, null, 2),
    "src/index.js": "export function ping() {\n  return 'pong';\n}\n",
  });
  const staticRepo = createTempRepo(scratch, "static-sample", {
    "index.html": "<!doctype html><html><body>Hello</body></html>\n",
    "app.js": "export const ready = true;\n",
  });

  const receiptPath = path.join(scratch, "EXTERNAL_FLEET_PILOT_RECEIPT.json");
  const receipt = await runExternalFleetPilot({
    writeReceipt: true,
    receiptPath,
    doctorOverride: {
      ready: false,
      image: null,
      runtimes: [],
      gvisorAvailable: false,
      message: "Synthetic Docker-offline pilot verification",
    },
    targets: [
      { id: "node-sample", name: "Node Sample", cloneSource: nodeRepo, sourceType: "temp_fixture" },
      { id: "static-sample", name: "Static Sample", cloneSource: staticRepo, sourceType: "temp_fixture" },
    ],
  });

  assert.equal(receipt.environment.validationBackend, "HOST_SUBPROCESS_DOCKER_OFFLINE");
  assert.equal(receipt.summary.repositoriesTested, 2);
  assert.equal(receipt.summary.lifecyclePassCount, 2);
  assert.equal(receipt.summary.tamperRejectionsVerified, 2);
  assert.equal(receipt.summary.reversibilityPassCount, 2);
  assert.equal(receipt.summary.worktreeCleanupCount, 2);
  assert.ok(fs.existsSync(receiptPath), "Pilot receipt must be written to requested output path");

  for (const repo of receipt.repositories) {
    assert.equal(repo.passed, true);
    assert.equal(repo.tamperRejected, true);
    assert.equal(repo.appliedFastForwardVerified, true);
    assert.equal(repo.reversibilityVerified, true);
    assert.equal(repo.worktreeRemoved, true);
    assert.equal(/^[a-f0-9]{64}$/.test(repo.reviewedDiffSha256), true);
    assert.ok(repo.timingsMs.total > 0);
  }
});
