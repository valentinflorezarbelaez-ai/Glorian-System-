import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosNeuroSymbolicFleetHealingEngine } from "../src/core/eosNeuroSymbolicFleetHealingEngine.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

test("BDD-330: Neuro-Symbolic Invariant Prover guarantees mathematical safety (UNSAT)", () => {
  const engine = new EosNeuroSymbolicFleetHealingEngine(root);

  // Clauses representing:
  // (P || Q) AND (!P) AND (!Q) -> Contradiction / Impossible to violate
  const report = engine.verifyInvariantProof({
    theoremName: "ABAC_BOUNDARY_THEOREM",
    clauses: [
      ["RULE_VALID", "ROLE_AUTHORIZED"],
      ["!ROLE_AUTHORIZED"],
      ["!RULE_VALID"]
    ]
  });

  assert.equal(report.verdict, "PROVED_UNSAT_SECURE");
  assert.equal(report.isProvablySecure, true);
  assert.ok(report.sha256Receipt.length === 64);
  assert.ok(report.durationUs >= 0);
});

test("BDD-331: Neuro-Symbolic Invariant Prover identifies violation counterexample model (SAT)", () => {
  const engine = new EosNeuroSymbolicFleetHealingEngine(root);

  // Clauses representing satisfiable scenario (can be true):
  const report = engine.verifyInvariantProof({
    theoremName: "LEAKAGE_VULNERABILITY_THEOREM",
    clauses: [
      ["UNAUTHORIZED_READ", "FIREWALL_BLOCKED"],
      ["UNAUTHORIZED_READ"]
    ]
  });

  assert.equal(report.verdict, "VIOLATION_SAT_MODEL_FOUND");
  assert.equal(report.isProvablySecure, false);
  assert.ok(report.satisfyingModel);
  assert.equal(report.satisfyingModel.UNAUTHORIZED_READ, true);
});

test("BDD-332: Closed-Loop AST Surgical Remediation synthesizes safe patch without regressions", () => {
  const engine = new EosNeuroSymbolicFleetHealingEngine(root);

  const mockCode = `
export function computeTotal(items: any[]) {
  if (!items) {
    throw new Error("Missing items");
  }
  return items.length;
}
`;

  const report = engine.executeClosedLoopHealing({
    faultId: "FAULT_TEST_001",
    targetFilePath: "src/sampleFault.ts",
    failingLine: 4,
    errorMessage: "Uncaught Error: Missing items",
    offendingExpression: 'throw new Error("Missing items");',
    mockOriginalContent: mockCode
  });

  assert.equal(report.faultId, "FAULT_TEST_001");
  assert.equal(report.status, "VERIFIED_ZERO_REGRESSIONS");
  assert.ok(report.remediatedSha256);
  assert.ok(report.sha256Receipt.length === 64);
  assert.ok(report.diffSummary.length > 0);
});

test("BDD-333: Fleet-Wide LSC Campaign Partitioning and Cryptographic Attestation", () => {
  const engine = new EosNeuroSymbolicFleetHealingEngine(root);

  const report = engine.planAndExecuteLscCampaign({
    campaignId: "LSC_CAMPAIGN_TEST_ALPHA",
    description: "Standardize Layer-0 imports across fleet modules",
    targetModules: [
      "src/core/eosKernelPrimitives.ts",
      "src/core/eosDurableSqliteLedger.ts",
      "src/core/eosSmtAutomatedReasoningProver.ts"
    ],
    transformationRule: "ENFORCE_HEXAGONAL_LAYER0",
    invariantClauses: [
      ["LAYER0_PURE", "FALLBACK_BLOCKED"],
      ["!FALLBACK_BLOCKED"],
      ["!LAYER0_PURE"]
    ]
  });

  assert.equal(report.campaignId, "LSC_CAMPAIGN_TEST_ALPHA");
  assert.equal(report.status, "CAMPAIGN_COMPLETED");
  assert.equal(report.totalShards, 3);
  assert.equal(report.successfulShards, 3);
  assert.equal(report.shards.length, 3);
  assert.equal(report.shards[0].status, "SHARD_ATTESTED");
  assert.ok(report.masterReceiptSha256.length === 64);
});

test("BDD-334: MCP Server Dispatches eos_neurosymbolic_fleet_healing for all actions", () => {
  const server = new EosMcpServer(root);

  // 1. prove_invariant action
  const proveRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 901,
    method: "tools/call",
    params: {
      name: "eos_neurosymbolic_fleet_healing",
      arguments: {
        action: "prove_invariant",
        theoremName: "MCP_SMT_SAFETY",
        clauses: [
          ["A", "B"],
          ["!A"],
          ["!B"]
        ]
      }
    }
  });

  assert.ok(proveRes?.result?.content?.[0]?.text);
  const proveParsed = JSON.parse(proveRes.result.content[0].text);
  assert.equal(proveParsed.verdict, "PROVED_UNSAT_SECURE");

  // 2. heal_fault action
  const healRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 902,
    method: "tools/call",
    params: {
      name: "eos_neurosymbolic_fleet_healing",
      arguments: {
        action: "heal_fault",
        faultId: "MCP_FAULT_001",
        targetFilePath: "src/sample.ts",
        failingLine: 2,
        errorMessage: "Error: failure",
        mockOriginalContent: "function x() { throw new Error('failure'); }"
      }
    }
  });

  assert.ok(healRes?.result?.content?.[0]?.text);
  const healParsed = JSON.parse(healRes.result.content[0].text);
  assert.equal(healParsed.status, "VERIFIED_ZERO_REGRESSIONS");

  // 3. run_lsc_campaign action
  const lscRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 903,
    method: "tools/call",
    params: {
      name: "eos_neurosymbolic_fleet_healing",
      arguments: {
        action: "run_lsc_campaign",
        campaignId: "LSC_MCP_CAMPAIGN",
        targetModules: ["src/core/eosKernelPrimitives.ts"],
        transformationRule: "AUDIT_HEXAGONAL",
        clauses: [
          ["CLEAN_ARCH", "REJECT"],
          ["!REJECT"],
          ["!CLEAN_ARCH"]
        ]
      }
    }
  });

  assert.ok(lscRes?.result?.content?.[0]?.text);
  const lscParsed = JSON.parse(lscRes.result.content[0].text);
  assert.equal(lscParsed.status, "CAMPAIGN_COMPLETED");
});
