import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-239: Despacho de herramientas MCP TrueTime y LSM-Tree (SPEC-082)", () => {
  const server = new EosMcpServer(projectRoot, "full");

  // 1. Test TrueTime Commit-Wait MCP tool
  const ttRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 101,
    method: "tools/call",
    params: {
      name: "eos_truetime_commit_wait",
      arguments: { epsilonMs: 3.5, recordToLedger: false }
    }
  });

  assert.equal(ttRes?.error, undefined);
  const ttData = JSON.parse(ttRes?.result?.content?.[0]?.text || "{}");
  assert.equal(ttData.linearizable, true);
  assert.equal(ttData.status, "COMMIT_WAIT_ATTESTED");
  assert.ok(ttData.interval.earliest < ttData.interval.latest);
  assert.equal(ttData.interval.uncertaintyEpsilonMs, 3.5);

  // 2. Test LSM-Tree Put & Get MCP tool
  const putRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 102,
    method: "tools/call",
    params: {
      name: "eos_lsm_storage_put_get",
      arguments: { action: "put", key: "session:user:42", value: "active_token_payload", recordToLedger: false }
    }
  });

  assert.equal(putRes?.error, undefined);
  const putData = JSON.parse(putRes?.result?.content?.[0]?.text || "{}");
  assert.equal(putData.action, "put");
  assert.equal(putData.result.stored, true);

  const getRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 103,
    method: "tools/call",
    params: {
      name: "eos_lsm_storage_put_get",
      arguments: { action: "get", key: "session:user:42", recordToLedger: false }
    }
  });

  const getData = JSON.parse(getRes?.result?.content?.[0]?.text || "{}");
  assert.equal(getData.result.found, true);
  assert.equal(getData.result.value, "active_token_payload");
});

test("BDD-240: Despacho de herramientas MCP Threshold Crypto y MicroVM (SPEC-082)", () => {
  const server = new EosMcpServer(projectRoot, "full");

  // 1. Test Threshold Cryptography Split
  const splitRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 104,
    method: "tools/call",
    params: {
      name: "eos_threshold_secret_split_combine",
      arguments: {
        action: "split",
        secret: "0x123456789abcdef0123456789abcdef0",
        threshold: 3,
        totalShares: 5,
        recordToLedger: false
      }
    }
  });

  assert.equal(splitRes?.error, undefined);
  const splitData = JSON.parse(splitRes?.result?.content?.[0]?.text || "{}");
  assert.equal(splitData.sharesCount, 5);
  assert.equal(splitData.threshold, 3);

  // Combine using first 3 shares
  const combineRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 105,
    method: "tools/call",
    params: {
      name: "eos_threshold_secret_split_combine",
      arguments: {
        action: "combine",
        shares: splitData.shares.slice(0, 3),
        threshold: 3,
        recordToLedger: false
      }
    }
  });

  const combineData = JSON.parse(combineRes?.result?.content?.[0]?.text || "{}");
  assert.equal(combineData.status, "QUORUM_RECONSTRUCTED");
  assert.equal(combineData.reconstructedHex, "0x123456789abcdef0123456789abcdef0");

  // 2. Test MicroVM Enclave Generator
  const microVmRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 106,
    method: "tools/call",
    params: {
      name: "eos_microvm_enclave_generate",
      arguments: {
        enclaveId: "test-enclave-mcp",
        vcpuCount: 4,
        memSizeMib: 1024,
        recordToLedger: false
      }
    }
  });

  assert.equal(microVmRes?.error, undefined);
  const microVmData = JSON.parse(microVmRes?.result?.content?.[0]?.text || "{}");
  assert.equal(microVmData.enclaveId, "test-enclave-mcp");
  assert.equal(microVmData.firecrackerProfile.machine_config.vcpu_count, 4);
  assert.equal(microVmData.firecrackerProfile.machine_config.mem_size_mib, 1024);
  assert.ok(microVmData.hostCapabilities.platform);
});
