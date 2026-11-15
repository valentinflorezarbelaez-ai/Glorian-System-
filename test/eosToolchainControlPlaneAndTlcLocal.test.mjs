/**
 * Glorian System — Toolchain Control Plane, Local TLC Execution & Warmup Grace Test Suite
 * Governed by SPEC-272 / CHANGE-134
 *
 * Verifies BDD-1407 through BDD-1412.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EosToolchainDoctor, SUPPORTED_TOOLS } from "../src/core/eosToolchainDoctor.ts";
import { EosEventLoopSaturationGovernor } from "../src/core/eosEventLoopSaturationGovernor.ts";
import { runTlcVerification, CONFIGURED_SPECS } from "../scripts/run-tlc.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

describe("SPEC-272: Toolchain Control Plane, Local TLC Execution & SRE Warmup Grace", () => {
  // -------------------------------------------------------------------------
  // BDD-1407: Toolchain Doctor Audit Execution
  // -------------------------------------------------------------------------
  it("BDD-1407: EosToolchainDoctor audits tools and generates verified receipt", () => {
    const receiptPath = path.join(ROOT, "docs/evidence/TOOLCHAIN_RECEIPT.json");
    const report = EosToolchainDoctor.diagnose({ receiptPath });

    assert.equal(report.totalTools, SUPPORTED_TOOLS.length);
    assert.ok(report.availableCount > 0, "At least some tools must be available");
    assert.equal(typeof report.sha256Receipt, "string");
    assert.equal(report.sha256Receipt.length, 64);
    assert.ok(fs.existsSync(receiptPath), "Receipt file must be written to disk");

    const onDisk = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(onDisk.sha256Receipt, report.sha256Receipt);
  });

  // -------------------------------------------------------------------------
  // BDD-1408: Toolchain Doctor Fail-Soft Missing Tool Handling
  // -------------------------------------------------------------------------
  it("BDD-1408: Toolchain Doctor handles missing or failing binary definitions fail-soft", () => {
    const dummyDef = {
      name: "nonexistent-tool-xyz-123",
      command: "nonexistent-tool-xyz-123",
      versionArgs: ["--version"],
      category: "SECURITY",
      timeoutMs: 1000,
    };

    const itemReport = EosToolchainDoctor.evaluateTool(dummyDef);
    assert.equal(itemReport.name, "nonexistent-tool-xyz-123");
    assert.equal(itemReport.available, false);
    assert.equal(itemReport.version, null);
    assert.ok(itemReport.error, "Must report an error message when binary is missing");
  });

  // -------------------------------------------------------------------------
  // BDD-1409: Saturation Governor Warmup Grace
  // -------------------------------------------------------------------------
  it("BDD-1409: Saturation governor suppresses shedding during initial warmup cycles", () => {
    const governor = new EosEventLoopSaturationGovernor(50.0, 3, 3);
    governor.start();

    // Inject massive lag during warmup cycle 1
    governor.injectSimulatedLag(250.0);
    const sample1 = governor.sample();

    assert.equal(sample1.warmupActive, true);
    assert.equal(sample1.sheddingActive, false);
    assert.equal(sample1.state, "NORMAL");
    assert.equal(governor.shouldShedLoad("NORMAL"), false, "Must not shed during warmup");

    // Cycle 2 still in warmup
    const sample2 = governor.sample();
    assert.equal(sample2.warmupActive, true);
    assert.equal(governor.shouldShedLoad("NORMAL"), false);

    governor.stop();
  });

  // -------------------------------------------------------------------------
  // BDD-1410: Sustained Lag Shedding Post-Warmup
  // -------------------------------------------------------------------------
  it("BDD-1410: Sustained event loop lag triggers load shedding after warmup has elapsed", () => {
    const governor = new EosEventLoopSaturationGovernor(50.0, 3, 2);
    governor.start();

    governor.injectSimulatedLag(100.0);
    governor.sample(); // cycle 1 (warmup)
    governor.sample(); // cycle 2 (warmup)

    // Cycle 3 is post-warmup with sustained lag >= 50ms
    const sample3 = governor.sample();
    assert.equal(sample3.warmupActive, false);
    assert.equal(sample3.sheddingActive, true);
    assert.equal(sample3.state, "SHEDDING_ACTIVE");
    assert.equal(governor.shouldShedLoad("NORMAL"), true, "Must shed load when past warmup with high lag");

    // Critical requests are never shed
    assert.equal(governor.shouldShedLoad("CRITICAL"), false);

    governor.stop();
  });

  // -------------------------------------------------------------------------
  // BDD-1411: TLC Jar Hash Verification
  // -------------------------------------------------------------------------
  it("BDD-1411: tools/tla2tools.jar exists and matches release SHA-256", () => {
    const jarPath = path.join(ROOT, "tools", "tla2tools.jar");
    assert.ok(fs.existsSync(jarPath), "tools/tla2tools.jar must exist locally");

    const jarBytes = fs.readFileSync(jarPath);
    const hash = crypto.createHash("sha256").update(jarBytes).digest("hex");
    assert.equal(
      hash,
      "7e53aa636dac8a3cb0533f343115c0548e03fc0ce5edc7739becf58d3d0fb84f",
      "tools/tla2tools.jar hash must match canonical v1.8.0 release",
    );
  });

  // -------------------------------------------------------------------------
  // BDD-1412: Local TLC Live Invariant Verification
  // -------------------------------------------------------------------------
  it("BDD-1412: Local TLC model checking executes live across all configured specs", () => {
    const receipt = runTlcVerification();

    assert.equal(receipt.executionMode, "LIVE_LOCAL_TLC");
    assert.equal(receipt.status, "VERIFIED");
    assert.equal(receipt.allPassed, true);
    assert.equal(receipt.totalConfiguredSpecs, CONFIGURED_SPECS.length);

    for (const model of receipt.models) {
      assert.equal(model.verifiedLive, true);
      assert.equal(model.passed, true);
      assert.equal(model.exitCode, 0);
      assert.equal(model.violationInvariant, null);
    }
  });
});
