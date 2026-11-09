/**
 * EOS SYSTEM — SPEC-041: AUTONOMOUS CONTINUOUS REFACTORING & DST TEST SUITE
 * Validates BDD-114 through BDD-118.
 *
 * Requirements:
 * - 100% native node:test execution.
 * - Strict assertion of Design by Contract (DbC), DST reproducibility, and DRY analysis.
 * - Zero external dependencies.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertPrecondition,
  assertPostcondition,
  assertInvariant,
  deepFreeze,
  ContractError,
} from "../src/core/eosKernelPrimitives.ts";

import { EosContinuousRefactorEngine } from "../src/core/eosContinuousRefactorEngine.ts";

import { EosDeterministicSimulator } from "../src/core/eosDeterministicSimulator.ts";

import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

describe("SPEC-041: Autonomous Continuous Refactoring & DST Verification", () => {
  describe("BDD-114: AST Duplication & Dead Code Detection (DRY & Diet)", () => {
    it("scans core directory and detects structural metrics with SHA-256 receipt", () => {
      const coreDir = path.join(projectRoot, "src/core");
      const report = EosContinuousRefactorEngine.auditDirectory(coreDir);

      assert.ok(report.scannedFilesCount > 20, "Should scan more than 20 core modules");
      assert.ok(report.totalLinesAnalyzed > 5000, "Should analyze thousands of LOC");
      assert.equal(typeof report.potentialLinesReduction, "number");
      assert.equal(typeof report.sha256AuditReceipt, "string");
      assert.equal(report.sha256AuditReceipt.length, 64);
    });

    it("calculates code diet ratio and duplication density", () => {
      const coreDir = path.join(projectRoot, "src/core");
      const report = EosContinuousRefactorEngine.auditDirectory(coreDir);
      const diet = EosContinuousRefactorEngine.calculateCodeDietRatio(report);

      assert.ok(diet.totalLines > 0);
      assert.ok(diet.dietPercentage >= 0);
      assert.ok(diet.duplicationDensity >= 0);
    });
  });

  describe("BDD-115: Design by Contract (DbC) & Deep Immutability", () => {
    it("enforces assertPrecondition with ContractError on failure", () => {
      assert.throws(
        () => assertPrecondition(false, "Precondition must hold"),
        (err) => err instanceof ContractError && err.contractType === "PRECONDITION",
      );
      assert.doesNotThrow(() => assertPrecondition(true, "Valid precondition"));
    });

    it("enforces assertPostcondition with ContractError on failure", () => {
      assert.throws(
        () => assertPostcondition(false, "Postcondition must hold"),
        (err) => err instanceof ContractError && err.contractType === "POSTCONDITION",
      );
      assert.doesNotThrow(() => assertPostcondition(true, "Valid postcondition"));
    });

    it("enforces assertInvariant with ContractError on failure", () => {
      assert.throws(
        () => assertInvariant(false, "Invariant must hold"),
        (err) => err instanceof ContractError && err.contractType === "INVARIANT",
      );
      assert.doesNotThrow(() => assertInvariant(true, "Valid invariant"));
    });

    it("guarantees deepFreeze recursively prevents mutation", () => {
      const state = deepFreeze({
        tier: 0,
        subsystem: { name: "kernel", metrics: [1, 2, 3] },
      });

      assert.ok(Object.isFrozen(state));
      assert.ok(Object.isFrozen(state.subsystem));
      assert.ok(Object.isFrozen(state.subsystem.metrics));

      assert.throws(() => {
        state.tier = 1;
      }, /Cannot assign to read only property/);
    });
  });

  describe("BDD-116: Deterministic Simulation Testing (DST) Seed Reproducibility", () => {
    it("produces 100% bit-for-bit identical execution trace hash for identical seed", () => {
      const simA = new EosDeterministicSimulator({
        seed: 42,
        totalSteps: 200,
        faultInjectionRate: 0.1,
      });
      const resA = simA.runSimulation();

      const simB = new EosDeterministicSimulator({
        seed: 42,
        totalSteps: 200,
        faultInjectionRate: 0.1,
      });
      const resB = simB.runSimulation();

      assert.equal(resA.totalStepsExecuted, resB.totalStepsExecuted);
      assert.equal(resA.virtualTimeElapsedMs, resB.virtualTimeElapsedMs);
      assert.equal(resA.totalFaultsInjected, resB.totalFaultsInjected);
      assert.equal(resA.executionTraceHash, resB.executionTraceHash);
      assert.equal(resA.invariantsViolated, 0);
    });

    it("produces distinct execution trace for different seed", () => {
      const simA = new EosDeterministicSimulator({
        seed: 1337,
        totalSteps: 100,
        faultInjectionRate: 0.05,
      });
      const resA = simA.runSimulation();

      const simB = new EosDeterministicSimulator({
        seed: 9999,
        totalSteps: 100,
        faultInjectionRate: 0.05,
      });
      const resB = simB.runSimulation();

      assert.notEqual(resA.executionTraceHash, resB.executionTraceHash);
    });
  });

  describe("BDD-117: Autonomous Continuous Refactoring Loop Lifecycle", () => {
    it("starts and cleanly stops periodic autonomous daemon runner", (t, done) => {
      const daemon = EosContinuousRefactorEngine.createDaemonRunner(projectRoot, 20, (summary) => {
        assert.ok(summary.auditReport);
        assert.equal(summary.epistemicState, "VERIFIED");
        daemon.stop();
        assert.equal(daemon.isRunning(), false);
        done();
      });
    });
  });

  describe("BDD-118: Multi-Channel MCP & CLI Refactor Dispatch", () => {
    it("dispatches eos_refactor_audit via MCP server", () => {
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "eos_refactor_audit",
          arguments: { dirPath: "src/core" },
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.ok(parsed.scannedFilesCount > 0);
      assert.ok(parsed.sha256AuditReceipt);
    });

    it("dispatches eos_dst_simulate via MCP server", () => {
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "eos_dst_simulate",
          arguments: { seed: 101, steps: 50, faultRate: 0.05 },
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.seed, 101);
      assert.equal(parsed.verifiedDeterministic, true);
    });

    it("dispatches eos_dbc_verify via MCP server", () => {
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "eos_dbc_verify",
          arguments: { sampleValue: 42 },
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.dbcStatus, "VERIFIED");
      assert.equal(parsed.immutable, true);
    });
  });
});
