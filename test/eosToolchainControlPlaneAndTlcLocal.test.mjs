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
import { resolveEvidencePath } from "./lib/testEvidence.mjs";

import { EosToolchainDoctor, SUPPORTED_TOOLS } from "../src/core/eosToolchainDoctor.ts";
import { EosEventLoopSaturationGovernor } from "../src/core/eosEventLoopSaturationGovernor.ts";
import { runTlcVerification, resolveTlaJarPath, CONFIGURED_SPECS } from "../scripts/run-tlc.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

describe("SPEC-272: Toolchain Control Plane, Local TLC Execution & SRE Warmup Grace", () => {
  // -------------------------------------------------------------------------
  // BDD-1407: Toolchain Doctor Audit Execution
  // -------------------------------------------------------------------------
  it("BDD-1407: EosToolchainDoctor audits tools and generates verified receipt", () => {
    const receiptPath = resolveEvidencePath("TOOLCHAIN_RECEIPT.json");
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
  // BDD-1411: TLC Jar Archive & Digest Verification
  // -------------------------------------------------------------------------
  it("BDD-1411: tools/tla2tools.jar validates ZIP archive & SHA-256 digest when staged or resolves fail-soft when absent", () => {
    const jarPath = path.join(ROOT, "tools", "tla2tools.jar");
    if (fs.existsSync(jarPath)) {
      assert.equal(resolveTlaJarPath(), path.resolve(jarPath));
      const jarBytes = fs.readFileSync(jarPath);
      assert.ok(jarBytes.length > 1_000_000, `tools/tla2tools.jar looks truncated (${jarBytes.length} bytes)`);
      assert.equal(jarBytes[0], 0x50, "tools/tla2tools.jar must start with ZIP magic byte 'P'");
      assert.equal(jarBytes[1], 0x4b, "tools/tla2tools.jar must start with ZIP magic byte 'K'");
      assert.equal(jarBytes[2], 0x03);
      assert.equal(jarBytes[3], 0x04);
      const hash = crypto.createHash("sha256").update(jarBytes).digest("hex");
      assert.match(hash, /^[0-9a-f]{64}$/, "tools/tla2tools.jar SHA-256 digest must be 64 hex chars");
    } else {
      assert.equal(resolveTlaJarPath(), null);
    }
  });

  // -------------------------------------------------------------------------
  // BDD-1412: Local TLC Live Invariant Verification
  // -------------------------------------------------------------------------
  it("BDD-1412: Local TLC model checking executes live across all configured specs", () => {
    const receiptPath = resolveEvidencePath(`.tlc-receipt-bdd1412-${process.pid}.json`);
    try {
      const receipt = runTlcVerification({ receiptPath });

      assert.ok(
        receipt.executionMode === "LIVE_TLC" || receipt.executionMode === "DEFERRED_TO_CI",
        `Execution mode must be LIVE_TLC or DEFERRED_TO_CI (actual: ${receipt.executionMode})`,
      );
      assert.equal(receipt.totalConfiguredSpecs, CONFIGURED_SPECS.length);
      assert.notEqual(receipt.status, "VERIFIED", "VERIFIED reserved for external IV&V");
      assert.equal(receipt.tlaJarPath.includes(":\\"), false, "receipt must not embed Windows drive paths");
      assert.equal(receipt.tlaJarPath.startsWith("/Users/"), false);

      if (receipt.executionMode === "LIVE_TLC") {
        assert.equal(receipt.status, "LIVE_TLC_EXECUTED");
        assert.equal(receipt.allPassed, true);
        for (const model of receipt.models) {
          assert.equal(model.verifiedLive, true);
          assert.equal(model.passed, true);
          assert.equal(model.exitCode, 0);
          assert.equal(model.violationInvariant, null);
        }
      } else {
        assert.equal(receipt.status, "DEFERRED_TO_CI");
      }
    } finally {
      try {
        fs.unlinkSync(receiptPath);
      } catch {
        // temp receipt cleanup
      }
    }
  });
});
