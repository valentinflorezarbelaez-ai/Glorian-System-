import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { CORE_TIER0_TOOL_NAMES } from "../src/mcp/eosMcpToolCatalog.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-199: Dispatch of 6 Big Tech Frontier Tools via Native MCP Server (Core Profile)", () => {
  const server = new EosMcpServer(projectRoot, "core");

  // 1. Verify tools exist in tools/list
  const listRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });
  const tools = listRes?.result?.tools || [];
  const toolNames = new Set(tools.map((t) => t.name));

  const expectedFrontierTools = [
    "eos_sapfix_autoshipper",
    "eos_slsa_provenance_sbom",
    "eos_content_addressable_cache",
    "eos_smt_reasoning_prover",
    "eos_chaos_monkey_live",
    "eos_bft_swarm_consensus",
  ];

  for (const name of expectedFrontierTools) {
    assert.ok(toolNames.has(name), `Expected ${name} in MCP tools/list`);
    assert.ok(CORE_TIER0_TOOL_NAMES.has(name), `Expected ${name} in CORE_TIER0_TOOL_NAMES`);
  }

  // 2. Invoke eos_sapfix_autoshipper
  const sapfixRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "eos_sapfix_autoshipper",
      arguments: {
        faultId: "MCP-TEST-FAULT-1",
        targetFilePath: "src/core/eosKernelPrimitives.ts",
        failingLine: 12,
        errorMessage: "Mock property undefined error",
        dryRun: true,
      },
    },
  });
  assert.ok(sapfixRes?.result?.content?.[0]?.text);
  const sapfixData = JSON.parse(sapfixRes.result.content[0].text);
  assert.equal(sapfixData.faultId, "MCP-TEST-FAULT-1");
  assert.ok(sapfixData.sha256Receipt);

  // 3. Invoke eos_slsa_provenance_sbom
  const slsaRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "eos_slsa_provenance_sbom",
      arguments: {
        mode: "both",
        recordToLedger: false,
      },
    },
  });
  assert.ok(slsaRes?.result?.content?.[0]?.text);
  const slsaData = JSON.parse(slsaRes.result.content[0].text);
  assert.ok(slsaData.sbom);
  assert.ok(slsaData.slsa);
  assert.equal(slsaData.sbom.bomFormat, "CycloneDX");
  assert.equal(slsaData.slsa.predicateType, "https://slsa.dev/provenance/v1");

  // 4. Invoke eos_content_addressable_cache
  const casPutRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "eos_content_addressable_cache",
      arguments: {
        action: "put_blob",
        content: "MCP-TEST-BLOB-CONTENT",
        recordToLedger: false,
      },
    },
  });
  assert.ok(casPutRes?.result?.content?.[0]?.text);
  const casPutData = JSON.parse(casPutRes.result.content[0].text);
  assert.ok(casPutData.digest);
  assert.equal(casPutData.stored, true);

  const casGetRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "eos_content_addressable_cache",
      arguments: {
        action: "get_blob",
        digest: casPutData.digest,
      },
    },
  });
  const casGetData = JSON.parse(casGetRes.result.content[0].text);
  assert.equal(casGetData.content, "MCP-TEST-BLOB-CONTENT");

  // 5. Invoke eos_smt_reasoning_prover
  const smtRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "eos_smt_reasoning_prover",
      arguments: {
        theoremType: "abac_safety",
        principalRole: "guest",
        targetAction: "ledger_write",
        recordToLedger: false,
      },
    },
  });
  assert.ok(smtRes?.result?.content?.[0]?.text);
  const smtData = JSON.parse(smtRes.result.content[0].text);
  assert.equal(smtData.verdict, "PROVED_UNSAT_SECURE");
  assert.equal(smtData.isSatisfiable, false);

  // 6. Invoke eos_chaos_monkey_live
  const chaosRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: {
      name: "eos_chaos_monkey_live",
      arguments: {
        targetUrl: "https://eos.dev/health",
        burstCount: 3,
        maxErrorBudgetPercent: 50,
        recordToLedger: false,
      },
    },
  });
  assert.ok(chaosRes?.result?.content?.[0]?.text);
  const chaosData = JSON.parse(chaosRes.result.content[0].text);
  assert.equal(chaosData.probesSent, 3);
  assert.ok(chaosData.sha256Receipt);

  // 7. Invoke eos_bft_swarm_consensus
  const bftRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: {
      name: "eos_bft_swarm_consensus",
      arguments: {
        proposalId: "MCP-PROP-1",
        authorAgentId: "agent_architect",
        hasSecurityVeto: false,
        recordToLedger: false,
      },
    },
  });
  assert.ok(bftRes?.result?.content?.[0]?.text);
  const bftData = JSON.parse(bftRes.result.content[0].text);
  assert.equal(bftData.proposalId, "MCP-PROP-1");
  assert.equal(bftData.verdict, "CONSENSUS_REACHED");
  assert.equal(bftData.vetoTriggered, false);
});
