/**
 * EOS SYSTEM — Local remediation suggestions test suite
 *
 * Verifies:
 * 1. Root-cause localization and surgical AST remediation diff synthesis.
 * 2. Read-only-by-default behavior and opt-in file writes.
 * 3. Local check status without production verification claims.
 * 4. Model Context Protocol (MCP) tool dispatch.
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EosAutonomousHealer
} from "../src/core/eosAutonomousHealer.ts";

import {
  EosMcpServer
} from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const testDir = path.join(root, "test/_sandbox", `healer-${process.pid}`);
const testFile = path.join(testDir, "anomalousFile.ts");
const generatedReceipts = [];

function resetTestFile() {
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  const badContent = "export function sampleMath(): number {\r\n  return 42;   \r\n}\r\n";
  fs.writeFileSync(testFile, badContent, "utf8");
}

describe("EOS Sovereign Autonomous Healer & FDIR Suite", () => {
  before(() => {
    resetTestFile();
  });

  beforeEach(() => {
    resetTestFile();
  });

  after(() => {
    try {
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore teardown races under parallel suite batches.
    }
    for (const receiptPath of generatedReceipts) {
      if (fs.existsSync(receiptPath)) {
        try {
          fs.unlinkSync(receiptPath);
        } catch {
          /* ignore */
        }
      }
    }
  });

  describe("Suite 1: Diagnostic & Remediation Synthesis (BDD-026)", () => {
    it("diagnoses trailing whitespace and CRLF line endings", () => {
      const healer = new EosAutonomousHealer(root);
      const relPath = path.relative(root, testFile).replace(/\\/g, "/");
      const candidates = healer.diagnoseAndSynthesize(relPath);

      assert.equal(candidates.length, 1);
      assert.equal(candidates[0].targetPath, relPath);
      assert.ok(candidates[0].sandboxValid, "Remediation patch must pass AST sandbox");
      assert.ok(candidates[0].proposedContent.length > 0);
      assert.ok(!candidates[0].proposedContent.includes("\r\n"), "Must eliminate CRLF");
      assert.ok(candidates[0].patchDiff.length > 0);
    });

    it("verifies safe clean files require 0 remediations", () => {
      const healer = new EosAutonomousHealer(root);
      const cleanFile = "src/core/eosNeuralVectorCore.ts";
      const candidates = healer.diagnoseAndSynthesize(cleanFile);
      assert.equal(candidates.length, 0);
    });
  });

  describe("Suite 2: Closed-Loop FDIR Healing & Cryptographic Ledger (BDD-027)", () => {
    it("defaults to a read-only proposal without modifying disk", () => {
      const healer = new EosAutonomousHealer(root);
      const relPath = path.relative(root, testFile).replace(/\\/g, "/");
      const beforeContent = fs.readFileSync(testFile, "utf8");

      const report = healer.executeHealing({ targetFile: relPath });
      assert.equal(report.success, true);
      assert.equal(report.remediatedCount, 0);
      assert.equal(report.candidateCount, 1);
      assert.equal(report.changesApplied, false);

      const afterContent = fs.readFileSync(testFile, "utf8");
      assert.equal(afterContent, beforeContent, "Dry run must not touch disk");
    });

    it("writes changes and emits a local result record only after explicit opt-in", () => {
      const healer = new EosAutonomousHealer(root);
      const relPath = path.relative(root, testFile).replace(/\\/g, "/");

      const report = healer.executeHealing({ targetFile: relPath, autoApply: true });
      assert.equal(report.success, true);
      assert.equal(report.epistemicState, "LOCAL_CHECKS_PASSED");
      assert.equal(report.changesApplied, true);
      assert.ok(report.receiptPath !== null);
      assert.ok(report.receiptSha256 !== null);
      assert.ok(fs.existsSync(report.receiptPath));
      generatedReceipts.push(report.receiptPath);

      const healedContent = fs.readFileSync(testFile, "utf8");
      assert.ok(!healedContent.includes("\r\n"), "File on disk must now have LF line endings");
      assert.ok(healedContent.endsWith("\n"), "Must terminate with clean newline");
    });
  });

  describe("Suite 3: MCP Tool Integration", () => {
    it("advertises eos_autonomous_heal in tools/list", () => {
      const server = new EosMcpServer(root);
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 401,
        method: "tools/list"
      });

      assert.ok(res?.result?.tools);
      const names = res.result.tools.map((t) => t.name);
      assert.ok(names.includes("eos_autonomous_heal"));
    });

    it("dispatches eos_autonomous_heal via MCP in dry-run mode", () => {
      const server = new EosMcpServer(root);
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 402,
        method: "tools/call",
        params: {
          name: "eos_autonomous_heal",
          arguments: {
            dryRun: true
          }
        }
      });

      assert.ok(res?.result?.content?.[0]?.text);
      const report = JSON.parse(res.result.content[0].text);
      assert.equal(report.success, true);
      assert.equal(report.epistemicState, "LOCAL_CHECKS_PASSED");
    });
  });
});
