/**
 * SPEC-152 / CHANGE-087 — Universal Agent Session Contract + Golden Path enforcement
 * BDD-461 .. BDD-466
 */

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EosUniversalAgentSessionContract,
  SUPPORTED_IDE_FAMILIES
} from "../src/core/eosUniversalAgentSessionContract.ts";
import {
  EosProductDeliveryOrchestrator,
  createRealVerificationGatePort,
  createHermeticVerificationGatePort,
  PRODUCT_SCORECARD_FLOOR,
  computeProductQualityScorecard
} from "../src/core/eosProductDeliveryOrchestrator.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function demoManifest(overrides = {}) {
  return {
    id: "session-contract-probe",
    name: "Session Contract Probe",
    domain: "fintech-ledger",
    description: "SPEC-152 scorecard and gate probe",
    tier: "MVP",
    platforms: ["distributed-backend", "web"],
    entities: ["LedgerEntry", "Account"],
    commands: ["PostEntry", "ReconcileBooks"],
    compliance: ["SLSA_4"],
    ...overrides
  };
}

test("BDD-461: Multi-IDE session binding", () => {
  const contract = new EosUniversalAgentSessionContract(projectRoot);
  for (const ide of SUPPORTED_IDE_FAMILIES) {
    const opened = contract.openSession({
      ideFamily: ide,
      directive: "Deliver a fintech ledger product via Golden Path with verification gates",
      target: "eos-system"
    });
    assert.ok(opened.sessionId.length > 0);
    assert.match(opened.sessionReceipt, /^[a-f0-9]{64}$/);
    assert.ok(opened.mandatoryTools.length >= 1);
    assert.equal(opened.ideFamily, ide);
  }
});

test("BDD-462: Pre-write DAG enforcement", () => {
  const contract = new EosUniversalAgentSessionContract(projectRoot);
  const opened = contract.openSession({
    ideFamily: "cursor",
    directive: "Implement SPEC-152 session contract with mandatory MCP DAG before writes",
    target: "eos-system"
  });
  assert.ok(opened.mandatoryTools.length >= 1);

  const denied = contract.authorizeWrite({
    sessionId: opened.sessionId,
    sessionReceipt: opened.sessionReceipt,
    paths: ["src/core/eosUniversalAgentSessionContract.ts"]
  });
  assert.equal(denied.decision, "deny");
  assert.equal(denied.reason, "MANDATORY_DAG_INCOMPLETE");
  assert.ok(denied.missingTools.length > 0);

  for (const toolName of opened.mandatoryTools) {
    const rec = contract.recordToolInvocation(opened.sessionId, toolName);
    assert.equal(rec.recorded, true);
  }

  const allowed = contract.authorizeWrite({
    sessionId: opened.sessionId,
    sessionReceipt: opened.sessionReceipt
  });
  assert.equal(allowed.decision, "allow");
  assert.equal(allowed.reason, "DAG_COMPLETE");
  assert.equal(allowed.missingTools.length, 0);
});

test("BDD-463: Unknown IDE family rejected", () => {
  const contract = new EosUniversalAgentSessionContract(projectRoot);
  assert.throws(
    () =>
      contract.openSession({
        ideFamily: "notepad-plus-plus",
        directive: "should fail"
      }),
    /Unsupported ideFamily/
  );
});

test("BDD-464: Real gates on write materialization", () => {
  const real = createRealVerificationGatePort(projectRoot);
  const turbo = real.runTurboPurity();
  assert.equal(turbo.name, "turbo_purity");
  assert.match(turbo.evidence, /RUNTIME_DEPENDENCIES/);
  assert.equal(turbo.exitCode, 0);

  const hermetic = createHermeticVerificationGatePort();
  assert.equal(hermetic.runTurboPurity().evidence, "LAYER0_DEPENDENCIES_EMPTY");

  const result = EosProductDeliveryOrchestrator.deliverProduct(demoManifest({ id: "real-gates-probe" }), {
    dryRun: false,
    projectRoot,
    enforceGates: true,
    externalSatellite: false
  });
  assert.ok(["SUCCESS", "BLOCKED", "FAILED"].includes(result.status));
  const turboGate = result.gateResults.find((g) => g.name === "turbo_purity");
  assert.ok(turboGate);
  assert.match(turboGate.evidence, /RUNTIME_DEPENDENCIES/);
  assert.notEqual(turboGate.evidence, "LAYER0_DEPENDENCIES_EMPTY");
});

test("BDD-465: Scorecard floor fail-closed", () => {
  assert.equal(PRODUCT_SCORECARD_FLOOR, 80);

  const result = EosProductDeliveryOrchestrator.deliverProduct(
    demoManifest({ id: "scorecard-floor-probe" }),
    {
      dryRun: true,
      projectRoot,
      enforceGates: true,
      blastRadiusKnown: false,
      gates: {
        runTurboPurity: () => ({
          name: "turbo_purity",
          exitCode: 0,
          evidence: "RUNTIME_DEPENDENCIES_EMPTY",
          durationMs: 1
        }),
        runSecretScan: () => ({
          name: "secret_scan",
          exitCode: 0,
          evidence: "NO_PLAIN_SECRET_PATTERNS",
          durationMs: 1
        }),
        runMutationFloor: () => ({
          name: "mutation_floor",
          exitCode: 0,
          evidence: "mutationScore=0;grade=F",
          durationMs: 1
        })
      }
    }
  );

  assert.ok(result.scorecard);
  assert.ok(result.scorecard.score < PRODUCT_SCORECARD_FLOOR);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.reason, "SCORECARD_FLOOR");
  assert.equal(result.epistemicState, "BLOCKED");

  const card = computeProductQualityScorecard({
    topology: result.topology,
    gateResults: result.gateResults,
    mutationScore: 0,
    timeToGreenMs: 60_000,
    blastRadiusKnown: false
  });
  assert.ok(card.score < 80);
});

test("BDD-466: MCP session contract dispatch", async () => {
  const server = new EosMcpServer(projectRoot, "full");
  const openRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: "s152-open",
    method: "tools/call",
    params: {
      name: "eos_agent_session_contract",
      arguments: {
        action: "open",
        ideFamily: "antigravity",
        directive: "Ship product delivery Golden Path under SPEC-152 session contract",
        target: "eos-system"
      }
    }
  });
  assert.ok(openRes.result, openRes.error?.message || "open failed");
  const opened = JSON.parse(openRes.result.content[0].text);
  assert.equal(opened.action, "open");
  assert.ok(opened.sessionId);
  assert.match(opened.sessionReceipt, /^[a-f0-9]{64}$/);

  const denyRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: "s152-deny",
    method: "tools/call",
    params: {
      name: "eos_agent_session_contract",
      arguments: {
        action: "authorize_write",
        sessionId: opened.sessionId,
        sessionReceipt: opened.sessionReceipt
      }
    }
  });
  assert.ok(denyRes.result, denyRes.error?.message || "authorize failed");
  const denied = JSON.parse(denyRes.result.content[0].text);
  assert.equal(denied.allowed, false);
  assert.equal(denied.decision, "deny");
});
