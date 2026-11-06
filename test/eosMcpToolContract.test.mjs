/**
 * MCP tool surface contract: schemas, taxonomy and dispatch must describe the same set.
 * Every advertised tool must have exactly one handler path; every handler must be advertised.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CORE_TIER0_TOOL_NAMES,
  PHASE1_MIGRATED_TOOL_NAMES,
  PHASE2_MIGRATED_TOOL_NAMES,
  PHASE3_MIGRATED_TOOL_NAMES,
  PHASE4_MIGRATED_TOOL_NAMES,
  PHASE5_MIGRATED_TOOL_NAMES,
  PHASE6_MIGRATED_TOOL_NAMES,
  PHASE7_MIGRATED_TOOL_NAMES
} from "../src/core/eosMcpToolTaxonomy.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { LEGACY_TOOL_NAMES } from "../src/mcp/dispatch/eosLegacyDispatch.ts";
import { KNOWLEDGE_LEGACY_HANDLERS } from "../src/mcp/dispatch/eosLegacyKnowledgeHandlers.ts";
import { SOVEREIGN_LEGACY_HANDLERS } from "../src/mcp/dispatch/eosLegacySovereignHandlers.ts";
import { RUNTIME_LEGACY_HANDLERS } from "../src/mcp/dispatch/eosLegacyRuntimeHandlers.ts";
import { RELIABILITY_LEGACY_HANDLERS } from "../src/mcp/dispatch/eosLegacyReliabilityHandlers.ts";
import { GOVERNANCE_LEGACY_HANDLERS } from "../src/mcp/dispatch/eosLegacyGovernanceHandlers.ts";
import { EOS_MCP_TOOL_DEFINITIONS } from "../src/mcp/eosMcpToolDefinitions.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let cachedSurface;
function surface() {
  if (cachedSurface) return cachedSurface;
  const server = new EosMcpServer(projectRoot);
  const response = server.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  cachedSurface = {
    defined: new Set((response?.result?.tools ?? []).map((tool) => tool.name)),
    registered: new Set(server.listRegisteredTools()),
    legacy: new Set(LEGACY_TOOL_NAMES)
  };
  return cachedSurface;
}

const TAXONOMY = [
  ...PHASE1_MIGRATED_TOOL_NAMES,
  ...PHASE2_MIGRATED_TOOL_NAMES,
  ...PHASE3_MIGRATED_TOOL_NAMES,
  ...PHASE4_MIGRATED_TOOL_NAMES,
  ...PHASE5_MIGRATED_TOOL_NAMES,
  ...PHASE6_MIGRATED_TOOL_NAMES,
  ...PHASE7_MIGRATED_TOOL_NAMES
];

test("CTR-01: Los 200 esquemas son únicos, bien formados y anunciables", () => {
  const names = EOS_MCP_TOOL_DEFINITIONS.map((tool) => tool.name);

  assert.equal(new Set(names).size, names.length, "duplicate tool names in EOS_MCP_TOOL_DEFINITIONS");
  for (const tool of EOS_MCP_TOOL_DEFINITIONS) {
    assert.match(tool.name, /^(eos|glorian)_[a-z0-9_]+$/, `invalid tool name: ${tool.name}`);
    assert.ok(tool.description.trim().length >= 10, `${tool.name} needs a description`);
    assert.equal(tool.inputSchema?.type, "object", `${tool.name} inputSchema must be an object schema`);
    assert.equal(typeof tool.inputSchema?.properties, "object", `${tool.name} inputSchema needs properties`);
  }
  assert.deepEqual([...surface().defined].sort(), [...names].sort(), "tools/list must expose every definition");
});

test("CTR-02: Toda herramienta anunciada tiene exactamente una ruta de despacho", () => {
  const { defined, registered, legacy } = surface();

  for (const name of defined) {
    const paths = Number(registered.has(name)) + Number(legacy.has(name));
    assert.equal(paths, 1, `${name} must have exactly one handler path (registry=${registered.has(name)}, legacy=${legacy.has(name)})`);
  }
});

test("CTR-03: Ningún handler queda fuera del contrato público", () => {
  const { defined, registered, legacy } = surface();

  for (const name of registered) assert.ok(defined.has(name), `registry handler ${name} is not advertised in tools/list`);
  for (const name of legacy) assert.ok(defined.has(name), `legacy handler ${name} is not advertised in tools/list`);
});

test("CTR-04: Taxonomía y perfil Tier-0 son subconjuntos del contrato", () => {
  const { defined } = surface();

  for (const name of TAXONOMY) assert.ok(defined.has(name), `taxonomy name ${name} is not a defined tool`);
  for (const name of CORE_TIER0_TOOL_NAMES) assert.ok(defined.has(name), `core profile name ${name} is not a defined tool`);
});

test("CTR-05: El perfil core filtra el contrato sin inventar herramientas", () => {
  const server = new EosMcpServer(projectRoot, "core");
  const response = server.handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const coreTools = (response?.result?.tools ?? []).map((tool) => tool.name);

  assert.equal(coreTools.length, CORE_TIER0_TOOL_NAMES.size);
  for (const name of coreTools) assert.ok(CORE_TIER0_TOOL_NAMES.has(name), `core profile leaked ${name}`);
});

test("CTR-06: Los handlers legacy viven en módulos de dominio congelados y sin duplicados", () => {
  const groups = [
    KNOWLEDGE_LEGACY_HANDLERS,
    SOVEREIGN_LEGACY_HANDLERS,
    RUNTIME_LEGACY_HANDLERS,
    RELIABILITY_LEGACY_HANDLERS,
    GOVERNANCE_LEGACY_HANDLERS
  ];

  const seen = new Set();
  let total = 0;
  for (const group of groups) {
    assert.ok(Object.isFrozen(group), "legacy handler domain maps must be frozen");
    for (const name of Object.keys(group)) {
      assert.match(name, /^(eos|glorian)_[a-z0-9_]+$/, `invalid legacy handler name: ${name}`);
      assert.equal(seen.has(name), false, `legacy handler ${name} defined in more than one domain module`);
      seen.add(name);
      total += 1;
    }
  }

  assert.equal(total, 93, "the legacy dispatch surface must keep its 93 handlers");
  assert.deepEqual([...seen].sort(), [...LEGACY_TOOL_NAMES].sort(), "dispatch index must expose every domain handler");
});
