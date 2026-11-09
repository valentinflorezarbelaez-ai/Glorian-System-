import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosAgentTopologyMesh, AgentRingBufferMesh } from "../src/core/eosAgentTopologyMesh.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-149: Compilar DAG Acíclico de Subagentes sin Bloqueos (Topological Scheduling)", () => {
  const nodes = [
    { id: "NODE-1-IFACE", name: "Interface Spec", assignedModulePath: "src/core/interface.ts", dependencies: [] },
    {
      id: "NODE-2-DOMAIN",
      name: "Domain Logic",
      assignedModulePath: "src/core/domain.ts",
      dependencies: ["NODE-1-IFACE"],
    },
    {
      id: "NODE-3-APP",
      name: "Application Handler",
      assignedModulePath: "src/core/app.ts",
      dependencies: ["NODE-2-DOMAIN"],
    },
    {
      id: "NODE-4-TESTS",
      name: "Property Tests",
      assignedModulePath: "test/domain.test.ts",
      dependencies: ["NODE-3-APP"],
    },
  ];

  const topology = EosAgentTopologyMesh.compileTopology("DAG-TEST-001", nodes);

  assert.equal(topology.dagId, "DAG-TEST-001");
  assert.equal(topology.isAcyclic, true);
  assert.equal(topology.totalNodes, 4);
  assert.deepEqual(topology.topologicalOrder, ["NODE-1-IFACE", "NODE-2-DOMAIN", "NODE-3-APP", "NODE-4-TESTS"]);
  assert.equal(topology.sha256PlanReceipt.length, 64);
});

test("BDD-150: Detección Inmediata y Rechazo de Dependencias Cíclicas", () => {
  const cyclicNodes = [
    { id: "NODE-A", name: "Module A", assignedModulePath: "src/a.ts", dependencies: ["NODE-B"] },
    { id: "NODE-B", name: "Module B", assignedModulePath: "src/b.ts", dependencies: ["NODE-C"] },
    { id: "NODE-C", name: "Module C", assignedModulePath: "src/c.ts", dependencies: ["NODE-A"] },
  ];

  assert.throws(() => {
    EosAgentTopologyMesh.compileTopology("DAG-CYCLIC-FAIL", cyclicNodes);
  }, /CYCLIC_DEPENDENCY_DETECTED/);
});

test("BDD-151: Transmisión Zero-Copy en Malla de Ring Buffer Circular", () => {
  const mesh = new AgentRingBufferMesh(64);
  assert.equal(mesh.getCapacity(), 64);

  const ev1 = mesh.publish("AGENT-BLUE-01", "NODE-2-DOMAIN", "AST_MUTATION_DELTA", {
    diffLines: 12,
    astNodeCount: 45,
  });

  const ev2 = mesh.publish("AGENT-RED-02", "NODE-3-APP", "VERIFICATION_SIGNAL", {
    passedInvariants: 8,
    status: "PASS",
  });

  assert.equal(ev1.sequence, 0);
  assert.equal(ev2.sequence, 1);
  assert.equal(ev1.sha256PayloadReceipt.length, 64);
  assert.equal(ev2.sha256PayloadReceipt.length, 64);

  const readEvents = mesh.readSince(0);
  assert.equal(readEvents.length, 2);
  assert.equal(readEvents[0].emitterAgentId, "AGENT-BLUE-01");
  assert.equal(readEvents[1].emitterAgentId, "AGENT-RED-02");

  // Read since sequence 1
  const readSince1 = mesh.readSince(1);
  assert.equal(readSince1.length, 1);
  assert.equal(readSince1[0].sequence, 1);
});

test("BDD-152: Cuantificación de Reducción de Tokens de Coordinación", () => {
  const compactEnvelopeBytes = 384;
  const fullContextBaselineBytes = 4096;

  const result = EosAgentTopologyMesh.calculateTokenEfficiency(compactEnvelopeBytes, fullContextBaselineBytes);

  assert.ok(result.reductionRatioPct >= 70, `Expected >= 70% token savings, got ${result.reductionRatioPct}%`);
  assert.ok(result.coordinationTokensSaved > 500, `Expected > 500 tokens saved, got ${result.coordinationTokensSaved}`);
});

test("BDD-153: Atestación Criptográfica y Registro en Ledger SQLite WAL", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-topology-ledger-"));
  const ledgerDbPath = path.join(tmpDir, "mesh_ledger.sqlite");

  try {
    const nodes = [
      { id: "NODE-CORE", name: "Core", assignedModulePath: "src/core.ts", dependencies: [] },
      { id: "NODE-ADAPTER", name: "Adapter", assignedModulePath: "src/adapter.ts", dependencies: ["NODE-CORE"] },
    ];
    const topology = EosAgentTopologyMesh.compileTopology("DAG-LEAD-001", nodes);
    const mesh = new AgentRingBufferMesh(32);
    const ev = mesh.publish("AGENT-DISPATCHER", "NODE-CORE", "CONTRACT_ATTESTATION", {
      contractId: "CTR-001",
      status: "SEALED",
    });

    const entryId = EosAgentTopologyMesh.recordMeshAttestation(topology, [ev], {
      ledgerDbPath,
      projectId: "eos-system",
    });

    assert.ok(entryId.startsWith("EOS-LEDGER-") || entryId.startsWith("MREC-"));

    const ledger = new EosDurableSqliteLedger(ledgerDbPath);
    try {
      const integrity = ledger.verifyChainIntegrity();
      assert.equal(integrity.intact, true);
      assert.equal(integrity.totalEntries, 1);
    } finally {
      ledger.close();
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("BDD-154: Invocación MCP Integrada de eos_agent_topology_mesh", () => {
  const server = new EosMcpServer(projectRoot, "core");

  // 0. Verify presence in core profile
  const listToolsRes = server.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const tools = listToolsRes?.result?.tools || [];
  const meshTool = tools.find((t) => t.name === "eos_agent_topology_mesh");
  assert.ok(meshTool, "eos_agent_topology_mesh must exist in 'core' profile");
  assert.equal(meshTool.annotations.readOnlyHint, false);

  // 1. Compile DAG via MCP
  const compileRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "eos_agent_topology_mesh",
      arguments: {
        action: "compile",
        dagId: "DAG-MCP-001",
        nodes: [
          { id: "M1", assignedModulePath: "src/m1.ts", dependencies: [] },
          { id: "M2", assignedModulePath: "src/m2.ts", dependencies: ["M1"] },
        ],
      },
    },
  });
  assert.ok(!compileRes.error);
  const compiledData = JSON.parse(compileRes.result.content[0].text);
  assert.equal(compiledData.dagId, "DAG-MCP-001");
  assert.equal(compiledData.isAcyclic, true);
  assert.deepEqual(compiledData.topologicalOrder, ["M1", "M2"]);

  // 2. Publish event via MCP
  const pubRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "eos_agent_topology_mesh",
      arguments: {
        action: "publish",
        emitterAgentId: "SUBAGENT-ALPHA",
        targetNodeId: "M2",
        eventType: "AST_MUTATION_DELTA",
        compactPayload: { astDelta: "+fn", tokens: 42 },
      },
    },
  });
  assert.ok(!pubRes.error);
  const pubData = JSON.parse(pubRes.result.content[0].text);
  assert.equal(pubData.emitterAgentId, "SUBAGENT-ALPHA");

  // 3. Read events via MCP
  const readRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "eos_agent_topology_mesh",
      arguments: {
        action: "read",
        sinceSequence: 0,
      },
    },
  });
  assert.ok(!readRes.error);
  const readData = JSON.parse(readRes.result.content[0].text);
  assert.ok(readData.events.length >= 1);

  // 4. Calculate efficiency via MCP
  const effRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "eos_agent_topology_mesh",
      arguments: {
        action: "efficiency",
        compactBytes: 256,
        fullFileContextBytes: 4096,
      },
    },
  });
  assert.ok(!effRes.error);
  const effData = JSON.parse(effRes.result.content[0].text);
  assert.equal(effData.reductionRatioPct, 94);
});
