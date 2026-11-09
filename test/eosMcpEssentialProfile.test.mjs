/**
 * Essential MCP profile curation — subset of Tier-0 for LLM precision.
 */
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import {
  CORE_TIER0_TOOL_NAMES,
  ESSENTIAL_TIER0_TOOL_NAMES,
  normalizeToolProfile,
} from "../src/mcp/eosMcpToolCatalog.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("BDD-MCP-ESSENTIAL-001: essential is strict subset of core", () => {
  assert.equal(normalizeToolProfile("essential"), "essential");
  assert.ok(ESSENTIAL_TIER0_TOOL_NAMES.size >= 12);
  assert.ok(ESSENTIAL_TIER0_TOOL_NAMES.size < CORE_TIER0_TOOL_NAMES.size);
  for (const name of ESSENTIAL_TIER0_TOOL_NAMES) {
    assert.ok(CORE_TIER0_TOOL_NAMES.has(name), `${name} must remain in core`);
  }
});

test("BDD-MCP-ESSENTIAL-002: tools/list honors essential profile", () => {
  const server = new EosMcpServer(projectRoot, "essential");
  const listRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });
  const tools = listRes?.result?.tools || [];
  assert.equal(tools.length, ESSENTIAL_TIER0_TOOL_NAMES.size);
  for (const tool of tools) {
    assert.ok(ESSENTIAL_TIER0_TOOL_NAMES.has(tool.name));
  }
  assert.ok(tools.some((t) => t.name === "eos_antigravity_direct"));
  assert.ok(!tools.some((t) => t.name === "eos_chaos_monkey_live"));
});
