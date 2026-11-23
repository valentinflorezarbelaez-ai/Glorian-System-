/**
 * MCP Tier-0 token economy — default profile + bounded core count (LIDR M6 / fazt.dev).
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import {
  CORE_TIER0_TOOL_NAMES,
  ESSENTIAL_TIER0_TOOL_NAMES,
  MCP_TIER0_CORE_MAX_TOOLS,
  normalizeToolProfile,
} from "../src/mcp/eosMcpToolCatalog.ts";
import { EosAntigravityDirector } from "../src/core/eosAntigravityDirector.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("BDD-MCP-TIER0-001: default / unset / tier0 aliases resolve to core", () => {
  assert.equal(normalizeToolProfile(), "core");
  assert.equal(normalizeToolProfile(""), "core");
  assert.equal(normalizeToolProfile("   "), "core");
  assert.equal(normalizeToolProfile("tier0"), "core");
  assert.equal(normalizeToolProfile("tier-0"), "core");
  assert.equal(normalizeToolProfile("core"), "core");
  assert.equal(normalizeToolProfile("unknown_profile"), "core");
  assert.equal(normalizeToolProfile("full"), "full");
  assert.equal(normalizeToolProfile("complete"), "full");
  assert.equal(normalizeToolProfile("essential"), "essential");
});

test("BDD-MCP-TIER0-002: Tier-0 core count stays bounded (≤46) and essential ⊂ core", () => {
  assert.equal(MCP_TIER0_CORE_MAX_TOOLS, 46);
  assert.ok(CORE_TIER0_TOOL_NAMES.size > 0);
  assert.ok(
    CORE_TIER0_TOOL_NAMES.size <= MCP_TIER0_CORE_MAX_TOOLS,
    `Tier-0 core must stay ≤ ${MCP_TIER0_CORE_MAX_TOOLS}, got ${CORE_TIER0_TOOL_NAMES.size}`,
  );
  assert.equal(CORE_TIER0_TOOL_NAMES.size, 46);
  assert.ok(ESSENTIAL_TIER0_TOOL_NAMES.size < CORE_TIER0_TOOL_NAMES.size);
  for (const name of ESSENTIAL_TIER0_TOOL_NAMES) {
    assert.ok(CORE_TIER0_TOOL_NAMES.has(name), `${name} must remain in core`);
  }
});

test("BDD-MCP-TIER0-003: default EosMcpServer tools/list is Tier-0 (not full catalog)", () => {
  const prev = process.env.EOS_MCP_PROFILE;
  delete process.env.EOS_MCP_PROFILE;
  try {
    const server = new EosMcpServer(projectRoot);
    const listRes = server.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const tools = listRes?.result?.tools || [];
    assert.equal(tools.length, CORE_TIER0_TOOL_NAMES.size);
    assert.ok(tools.length <= MCP_TIER0_CORE_MAX_TOOLS);
    assert.ok(tools.some((t) => t.name === "eos_antigravity_direct"));
    assert.ok(!tools.some((t) => t.name === "eos_spotify_honk_dispatch"));
  } finally {
    if (prev === undefined) delete process.env.EOS_MCP_PROFILE;
    else process.env.EOS_MCP_PROFILE = prev;
  }
});

test("BDD-MCP-TIER0-004: full profile still advertises the complete catalog", () => {
  const fullServer = new EosMcpServer(projectRoot, "full");
  const fullRes = fullServer.handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const fullTools = fullRes?.result?.tools || [];
  assert.ok(fullTools.length > MCP_TIER0_CORE_MAX_TOOLS);
  assert.ok(fullTools.length >= 115);
  assert.ok(fullTools.some((t) => t.name === "eos_spotify_honk_dispatch"));
});

test("BDD-MCP-TIER0-005: Antigravity MCP entry defaults EOS_MCP_PROFILE=core", () => {
  const prev = process.env.EOS_MCP_PROFILE;
  delete process.env.EOS_MCP_PROFILE;
  try {
    const entry = EosAntigravityDirector.synthesizeAntigravityMcpEntry(projectRoot);
    assert.equal(entry.env.EOS_MCP_PROFILE, "core");
  } finally {
    if (prev === undefined) delete process.env.EOS_MCP_PROFILE;
    else process.env.EOS_MCP_PROFILE = prev;
  }
});

test("BDD-MCP-TIER0-006: governance doc and AGENTS/CLAUDE pointers exist", () => {
  const doc = path.join(projectRoot, "docs", "governance", "MCP_TIER0_TOKEN_ECONOMY.md");
  assert.ok(fs.existsSync(doc), "MCP_TIER0_TOKEN_ECONOMY.md must exist");
  const body = fs.readFileSync(doc, "utf8");
  assert.match(body, /EOS_MCP_PROFILE/);
  assert.match(body, /gh/);
  const agents = fs.readFileSync(path.join(projectRoot, "AGENTS.md"), "utf8");
  assert.match(agents, /MCP Tier-0|MCP_TIER0_TOKEN_ECONOMY/);
  const claude = fs.readFileSync(path.join(projectRoot, "CLAUDE.md"), "utf8");
  assert.match(claude, /MCP Tier-0|MCP_TIER0_TOKEN_ECONOMY|EOS_MCP_PROFILE=core/);
});
