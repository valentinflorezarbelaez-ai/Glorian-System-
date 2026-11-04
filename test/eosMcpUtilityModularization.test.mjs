/**
 * SPEC-155 — MCP Utility Modularization & conscious tool surface (BDD-475..478)
 */

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { CORE_TIER0_TOOL_NAMES } from "../src/mcp/eosMcpToolCatalog.ts";
import {
  assertCoreToolsAreUtilitarian,
  classifyMcpToolUtility
} from "../src/mcp/eosMcpUtilityDoctrine.ts";
import { EosMcpDispatchRegistry } from "../src/mcp/eosMcpDispatchRegistry.ts";
import {
  PHASE1_CORE_UTILITARIAN_HANDLERS,
  PHASE1_MIGRATED_TOOL_NAMES
} from "../src/mcp/tools/eosMcpCoreUtilitarianHandlers.ts";
import {
  PHASE2_CORE_UTILITARIAN_HANDLERS,
  PHASE2_MIGRATED_TOOL_NAMES
} from "../src/mcp/tools/eosMcpPhase2UtilitarianHandlers.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

test("BDD-475 Utility doctrine classifies core tools as UTILITARIAN", () => {
  const check = assertCoreToolsAreUtilitarian();
  assert.equal(check.ok, true, `offenders=${check.offenders.join(",")}`);
  assert.ok(check.coreCount <= 30);
  assert.equal(check.coreCount, CORE_TIER0_TOOL_NAMES.size);
  for (const name of CORE_TIER0_TOOL_NAMES) {
    assert.equal(classifyMcpToolUtility(name), "UTILITARIAN");
  }
});

test("BDD-476 Dispatch registry hosts migrated core handlers", () => {
  const registry = new EosMcpDispatchRegistry();
  registry.registerAll(PHASE1_CORE_UTILITARIAN_HANDLERS);
  registry.registerAll(PHASE2_CORE_UTILITARIAN_HANDLERS);
  assert.ok(registry.size >= 16);
  assert.ok(PHASE1_MIGRATED_TOOL_NAMES.length >= 8);
  assert.ok(PHASE2_MIGRATED_TOOL_NAMES.length >= 7);
  for (const name of [...PHASE1_MIGRATED_TOOL_NAMES, ...PHASE2_MIGRATED_TOOL_NAMES]) {
    assert.equal(registry.has(name), true);
    assert.equal(classifyMcpToolUtility(name), "UTILITARIAN");
  }
});

test("BDD-477 Core tools/list parity after modularization", () => {
  const server = new EosMcpServer(projectRoot, "core");
  const res = server.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const tools = res?.result?.tools || [];
  assert.equal(tools.length, CORE_TIER0_TOOL_NAMES.size);
  for (const tool of tools) {
    assert.equal(classifyMcpToolUtility(tool.name), "UTILITARIAN");
    assert.ok(CORE_TIER0_TOOL_NAMES.has(tool.name));
  }
});

test("BDD-478 Migrated tool call parity smoke (eos_turbo_verify via registry path)", () => {
  const server = new EosMcpServer(projectRoot, "core");
  const callRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "eos_turbo_verify", arguments: {} }
  });
  assert.ok(callRes?.result?.content?.[0]?.text);
  const payload = JSON.parse(callRes.result.content[0].text);
  assert.equal(payload.success, true);
  assert.equal(payload.epistemicState, "LOCAL_CHECKS_PASSED");
});

test("BDD-479 Phase-2 registry path smoke (eos_check_openspec + eos_audit_fleet)", () => {
  const server = new EosMcpServer(projectRoot, "core");
  const openspecRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "eos_check_openspec", arguments: { action: "audit" } }
  });
  assert.ok(openspecRes?.result?.content?.[0]?.text);
  const openspecPayload = JSON.parse(openspecRes.result.content[0].text);
  assert.ok(openspecPayload);
  assert.ok(
    PHASE2_MIGRATED_TOOL_NAMES.includes("eos_check_openspec"),
    "eos_check_openspec must be Phase-2 migrated"
  );

  const fleetRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "eos_audit_fleet", arguments: {} }
  });
  assert.ok(fleetRes?.result?.content?.[0]?.text);
  const fleetPayload = JSON.parse(fleetRes.result.content[0].text);
  assert.equal(fleetPayload.scope, "LOCAL_REGISTRY_ONLY");
  assert.equal(fleetPayload.totalRegisteredProjects, 10);
});
