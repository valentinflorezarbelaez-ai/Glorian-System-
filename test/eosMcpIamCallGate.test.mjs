/**
 * MCP IAM call gate — per-tool write detection (fail-closed).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeMcpToolsCall,
  mcpToolRequestsMutation,
  MCP_MUTATION_CAPABLE_TOOLS,
} from "../src/core/eosMcpIamCallGate.ts";

const NO_POLICIES = [];

test("IAM gate: forge and TrueTime writers are mutation-capable", () => {
  assert.ok(MCP_MUTATION_CAPABLE_TOOLS.has("eos_forge_tool"));
  assert.ok(MCP_MUTATION_CAPABLE_TOOLS.has("eos_truetime_commit_wait"));
  assert.equal(mcpToolRequestsMutation("eos_forge_tool", {}), true);
  assert.equal(mcpToolRequestsMutation("eos_truetime_commit_wait", {}), true);
  assert.equal(mcpToolRequestsMutation("eos_truetime_commit_wait", { recordToLedger: false }), false);
});

test("IAM gate: sqlite ledger only writes on action=record", () => {
  assert.equal(mcpToolRequestsMutation("eos_sqlite_ledger", { action: "record" }), true);
  assert.equal(mcpToolRequestsMutation("eos_sqlite_ledger", { action: " RECORD " }), true);
  assert.equal(mcpToolRequestsMutation("eos_sqlite_ledger", { action: "verify" }), false);
  assert.equal(mcpToolRequestsMutation("eos_sqlite_ledger", { action: "search" }), false);
});

test("IAM gate: ledger record without principal is denied before any write", () => {
  const out = authorizeMcpToolsCall({
    toolName: "eos_sqlite_ledger",
    args: { action: "record", title: "x" },
    meta: null,
    policies: NO_POLICIES,
    defaultPrincipal: null,
  });
  assert.equal(out.ok, false);
  assert.equal(out.gate.required, true);
});

test("IAM gate: content-addressable cache write and default-receipt modes", () => {
  assert.equal(mcpToolRequestsMutation("eos_content_addressable_cache", { action: "put_blob" }), true);
  assert.equal(mcpToolRequestsMutation("eos_content_addressable_cache", { action: "put_action" }), true);
  assert.equal(mcpToolRequestsMutation("eos_content_addressable_cache", { action: "get_blob" }), false);
  assert.equal(mcpToolRequestsMutation("eos_content_addressable_cache", { action: "has_blob" }), false);
  assert.equal(mcpToolRequestsMutation("eos_content_addressable_cache", {}), true);
  assert.equal(
    mcpToolRequestsMutation("eos_content_addressable_cache", { action: "stats", recordToLedger: false }),
    false,
  );
});

test("IAM gate: unconditional and default-on writers require IAM", () => {
  assert.equal(mcpToolRequestsMutation("eos_hnsw_index_add", {}), true);
  assert.equal(mcpToolRequestsMutation("eos_sapfix_autoshipper", {}), true);
  assert.equal(mcpToolRequestsMutation("eos_chaos_monkey_live", {}), true);
  assert.equal(mcpToolRequestsMutation("eos_chaos_monkey_live", { recordToLedger: false }), false);
});

test("IAM gate: action-driven writers", () => {
  assert.equal(mcpToolRequestsMutation("eos_gentleman_update", { action: "apply" }), true);
  assert.equal(mcpToolRequestsMutation("eos_gentleman_update", { action: "check" }), false);
  assert.equal(mcpToolRequestsMutation("eos_evolve_module", {}), true);
  assert.equal(mcpToolRequestsMutation("eos_evolve_module", { action: "circuit_breaker" }), false);
  assert.equal(mcpToolRequestsMutation("eos_agent_topology_mesh", { action: "publish" }), true);
  assert.equal(mcpToolRequestsMutation("eos_agent_topology_mesh", { action: "compile", recordToLedger: true }), true);
  assert.equal(mcpToolRequestsMutation("eos_agent_topology_mesh", { action: "compile" }), false);
  assert.equal(mcpToolRequestsMutation("eos_surgical_healing", { recordToLedger: true }), true);
  assert.equal(mcpToolRequestsMutation("eos_surgical_healing", {}), false);
});

test("IAM gate: mutation-capable tools without a predicate fail closed", () => {
  assert.equal(mcpToolRequestsMutation("eos_manage_worktree", { action: "status" }), true);
  assert.equal(mcpToolRequestsMutation("eos_not_a_mutating_tool", { apply: true }), false);
});
