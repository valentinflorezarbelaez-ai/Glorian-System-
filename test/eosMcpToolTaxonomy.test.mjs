import assert from "node:assert/strict";
import { test } from "node:test";

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
import { CORE_TIER0_TOOL_NAMES as CATALOG_CORE_TIER0 } from "../src/mcp/eosMcpToolCatalog.ts";
import { PHASE1_CORE_UTILITARIAN_HANDLERS } from "../src/mcp/tools/eosMcpCoreUtilitarianHandlers.ts";
import { PHASE2_CORE_UTILITARIAN_HANDLERS } from "../src/mcp/tools/eosMcpPhase2UtilitarianHandlers.ts";

const PHASE_LISTS = {
  PHASE1: PHASE1_MIGRATED_TOOL_NAMES,
  PHASE2: PHASE2_MIGRATED_TOOL_NAMES,
  PHASE3: PHASE3_MIGRATED_TOOL_NAMES,
  PHASE4: PHASE4_MIGRATED_TOOL_NAMES,
  PHASE5: PHASE5_MIGRATED_TOOL_NAMES,
  PHASE6: PHASE6_MIGRATED_TOOL_NAMES,
  PHASE7: PHASE7_MIGRATED_TOOL_NAMES
};

test("TAX-01: Los catálogos Phase 1 y Phase 2 no derivan de sus handlers", () => {
  assert.deepEqual([...PHASE1_MIGRATED_TOOL_NAMES], Object.keys(PHASE1_CORE_UTILITARIAN_HANDLERS).sort());
  assert.deepEqual([...PHASE2_MIGRATED_TOOL_NAMES], Object.keys(PHASE2_CORE_UTILITARIAN_HANDLERS).sort());
});

test("TAX-02: Cada fase declara nombres únicos y congelados", () => {
  for (const [phase, names] of Object.entries(PHASE_LISTS)) {
    assert.ok(names.length > 0, `${phase} must not be empty`);
    assert.equal(new Set(names).size, names.length, `${phase} has duplicates`);
    assert.ok(Object.isFrozen(names), `${phase} must be frozen`);
  }
});

test("TAX-03: El perfil Tier-0 tiene handler migrado y respeta el techo de 30", () => {
  const migrated = new Set([...PHASE1_MIGRATED_TOOL_NAMES, ...PHASE2_MIGRATED_TOOL_NAMES, ...PHASE3_MIGRATED_TOOL_NAMES]);

  assert.ok(CORE_TIER0_TOOL_NAMES.size <= 30, `core profile has ${CORE_TIER0_TOOL_NAMES.size} tools`);
  for (const name of CORE_TIER0_TOOL_NAMES) {
    assert.ok(migrated.has(name), `core tool ${name} has no migrated handler`);
  }
});

test("TAX-04: El catálogo MCP reexporta la misma fuente de verdad", () => {
  assert.equal(CATALOG_CORE_TIER0, CORE_TIER0_TOOL_NAMES);
});
