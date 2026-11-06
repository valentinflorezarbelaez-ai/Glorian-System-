/**
 * EOS SYSTEM — CONSCIOUS WITNESS & HOT-PATCHING ENGINE TESTS (v65.0.0)
 *
 * Verifies SPEC-059 (CHANGE-052 / ADR-065) Acceptance Criteria:
 * - BDD-215: Interrogación Metacognitiva del Testigo y Detección de Fascinación
 * - BDD-216: Verificación de Símbolos Reales y Poda de Alucinaciones
 * - BDD-217: Emisión del Sello de Atestación de Conciencia
 * - BDD-218: Hot-Patching Atómico en Memoria sin Reinicio de Proceso
 * - BDD-219: Preservación de Sesiones y Conexiones Inflight
 * - BDD-220: Rollback Automático ante Fallo de Compatibilidad de Interfaz
 *
 * Invariant: Pure Layer-0 Node.js test (dependencies: {}).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosConsciousWitness } from "../src/core/eosConsciousWitness.ts";
import { EosHotPatchEngine } from "../src/core/eosHotPatchEngine.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { CORE_TIER0_TOOL_NAMES } from "../src/mcp/eosMcpToolCatalog.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-215: Interrogación Metacognitiva del Testigo y Detección de Fascinación", () => {
  const witness = new EosConsciousWitness(projectRoot);

  // Proposal without formal spec
  const ungroundedProposal = witness.interrogateAgentIntention({
    targetFiles: ["src/core/unknownFile.ts"],
    proposedAction: "Refactor without spec",
    declaredSpecId: "SPEC-999-NON-EXISTENT"
  });

  assert.equal(ungroundedProposal.verdict, "FASCINATION_DETECTED");
  assert.equal(ungroundedProposal.specVerified, false);
  assert.ok(ungroundedProposal.alignmentScore < 100);
});

test("BDD-216: Verificación de Símbolos Reales y Poda de Alucinaciones", () => {
  const witness = new EosConsciousWitness(projectRoot);

  const hallucinatedSymbols = witness.interrogateAgentIntention({
    declaredSpecId: "SPEC-059",
    targetFiles: ["src/core/eosConsciousWitness.ts"],
    proposedAction: "Use hallucinated helpers",
    affirmedSymbols: ["EosConsciousWitness", "NonExistentMagicalFrameworkHelper"]
  });

  assert.equal(hallucinatedSymbols.verdict, "FASCINATION_DETECTED");
  assert.equal(hallucinatedSymbols.specVerified, true);
  assert.equal(hallucinatedSymbols.groundingsVerified, false);
  assert.ok(hallucinatedSymbols.ungroundedSymbols.includes("NonExistentMagicalFrameworkHelper"));
});

test("BDD-217: Emisión del Sello de Atestación de Conciencia", () => {
  const witness = new EosConsciousWitness(projectRoot);

  const authentic = witness.interrogateAgentIntention({
    declaredSpecId: "SPEC-059",
    targetFiles: ["src/core/eosConsciousWitness.ts", "src/core/eosHotPatchEngine.ts"],
    proposedAction: "Integrate verified conscious witness engine",
    affirmedSymbols: ["EosConsciousWitness", "EosHotPatchEngine"]
  });

  assert.equal(authentic.verdict, "CONSCIOUS_ALIGNMENT_PASS");
  assert.equal(authentic.alignmentScore, 100);
  assert.equal(authentic.specVerified, true);
  assert.equal(authentic.groundingsVerified, true);
  assert.ok(authentic.sha384WitnessSeal.length === 96, "Must be 96-char SHA-384 hex seal");
});

test("BDD-218 & BDD-219: Hot-Patching Atómico en Memoria sin Reinicio y Preservación de Estado", () => {
  const engine = new EosHotPatchEngine();

  // Active service with persistent state
  const mockService = {
    serviceName: "telemetry-core",
    sessionCount: 42,
    processEvent: (x) => `v1-${x * 2}`
  };

  engine.registerTarget("telemetry", mockService);
  assert.ok(engine.getRegisteredTargetNames().includes("telemetry"));
  assert.equal(mockService.processEvent(10), "v1-20");

  // Apply atomic hot patch
  const patchRes = engine.applyHotPatch({
    patchId: "PATCH-001",
    targetName: "telemetry",
    methods: {
      processEvent: (x) => `v2-sovereign-${x * 5}`
    }
  });

  assert.equal(patchRes.applied, true);
  assert.ok(patchRes.methodsPatched.includes("processEvent"));
  assert.ok(patchRes.sha384Receipt.length === 96);

  // Verify new implementation is live immediately without restart
  assert.equal(mockService.processEvent(10), "v2-sovereign-50");
  // Invariant: object identity and internal state preserved
  assert.equal(mockService.sessionCount, 42);
  assert.equal(mockService.serviceName, "telemetry-core");
});

test("BDD-220: Rollback Automático ante Discrepancia o Reversión Solicitada", () => {
  const engine = new EosHotPatchEngine();
  const mockKernel = {
    compute: () => 100
  };

  engine.registerTarget("kernel", mockKernel);
  assert.equal(mockKernel.compute(), 100);

  engine.applyHotPatch({
    patchId: "PATCH-KERNEL-TEMP",
    targetName: "kernel",
    methods: {
      compute: () => 999
    }
  });
  assert.equal(mockKernel.compute(), 999);

  // Rollback patch
  const rollbackRes = engine.rollbackHotPatch("PATCH-KERNEL-TEMP");
  assert.equal(rollbackRes.rolledBack, true);
  assert.ok(rollbackRes.methodsRestored.includes("compute"));
  assert.equal(mockKernel.compute(), 100, "Must be cleanly restored to original function");
});

test("BDD-221: Despacho MCP de eos_conscious_witness en Perfil Full", () => {
  const server = new EosMcpServer(projectRoot, "full");

  // Verify tool is present in full catalog (outside lean core)
  const listRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 10,
    method: "tools/list"
  });
  const tools = listRes?.result?.tools || [];
  const witnessTool = tools.find((t) => t.name === "eos_conscious_witness");
  assert.ok(witnessTool, "eos_conscious_witness must exist in full profile");
  assert.ok(!CORE_TIER0_TOOL_NAMES.has("eos_conscious_witness"), "eos_conscious_witness belongs to full profile");

  // Invoke tool via MCP
  const callRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: {
      name: "eos_conscious_witness",
      arguments: {
        declaredSpecId: "SPEC-059",
        targetFiles: ["src/core/eosConsciousWitness.ts"],
        proposedAction: "Self-witness validation",
        affirmedSymbols: ["EosConsciousWitness"]
      }
    }
  });

  assert.ok(callRes?.result?.content?.[0]?.text);
  const payload = JSON.parse(callRes.result.content[0].text);
  assert.equal(payload.verdict, "CONSCIOUS_ALIGNMENT_PASS");
  assert.equal(payload.alignmentScore, 100);
});
