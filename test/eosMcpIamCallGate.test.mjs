/**
 * SPEC-184 MCP Runtime IAM Gate — hermetic BDD for tools/call enforcement.
 */
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import {
  MCP_IAM_DENIED_RPC_CODE,
  evaluateMcpIamCallGate,
  mcpToolRequestsMutation,
  stripMcpIamEnvelope,
} from "../src/core/eosMcpIamCallGate.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const grantPolicy = {
  id: "pol-mcp-worktree",
  tenantId: "tenant-local",
  roles: ["engineer"],
  actions: ["mcp.tools.call"],
  resourcePrefix: "mcp/tools/",
};

test("mcpToolRequestsMutation: write flags only", () => {
  assert.equal(mcpToolRequestsMutation("eos_health_check", { apply: true }), false);
  assert.equal(mcpToolRequestsMutation("eos_manage_worktree", { action: "list" }), false);
  assert.equal(mcpToolRequestsMutation("eos_manage_worktree", { action: "create", apply: true }), true);
  assert.equal(mcpToolRequestsMutation("eos_product_foundry_create", { dryRun: false }), true);
});

test("BDD-932: plan-only mutation-capable call does not require IAM", () => {
  const gate = evaluateMcpIamCallGate({
    toolName: "eos_manage_worktree",
    args: { action: "list" },
    policies: [],
  });
  assert.equal(gate.required, false);
  assert.equal(gate.allowed, true);
  assert.equal(gate.decision, null);
});

test("BDD-931: mutating write without principal denies before dispatch", async () => {
  const server = new EosMcpServer(projectRoot, "full");
  server.configureIamPolicies([grantPolicy]);
  server.configureIamDefaultPrincipal(null);

  const response = await server.handleRequest({
    jsonrpc: "2.0",
    id: 931,
    method: "tools/call",
    params: {
      name: "eos_manage_worktree",
      arguments: { action: "create", branch: "cursor/iam-denied-84b7", apply: true },
    },
  });

  assert.ok(response.error, "expected JSON-RPC error");
  assert.equal(response.error.code, MCP_IAM_DENIED_RPC_CODE);
  assert.equal(response.error.data.code, "DENY_INVALID_INPUT");
  assert.equal(response.error.data.toolName, "eos_manage_worktree");
  assert.equal(typeof response.error.data.sha256Receipt, "string");
  assert.equal(response.error.data.sha256Receipt.length, 64);
});

test("BDD-933: granted policy allows mutating write to reach the handler", async () => {
  const server = new EosMcpServer(projectRoot, "full");
  server.configureIamPolicies([grantPolicy]);
  server.configureIamDefaultPrincipal(null);

  const response = await server.handleRequest({
    jsonrpc: "2.0",
    id: 933,
    method: "tools/call",
    params: {
      name: "eos_manage_worktree",
      arguments: {
        action: "list",
        apply: true,
        _eosIam: {
          subjectId: "eng-1",
          tenantId: "tenant-local",
          roles: ["engineer"],
        },
      },
    },
  });

  assert.equal(response.error, undefined);
  assert.ok(response.result?.content?.[0]?.text);
  const body = JSON.parse(response.result.content[0].text);
  assert.ok(body);
});

test("stripMcpIamEnvelope removes the envelope key", () => {
  const cleaned = stripMcpIamEnvelope({
    action: "list",
    apply: true,
    _eosIam: { subjectId: "u", tenantId: "t", roles: ["engineer"] },
  });
  assert.equal(cleaned.action, "list");
  assert.equal(cleaned.apply, true);
  assert.equal(Object.prototype.hasOwnProperty.call(cleaned, "_eosIam"), false);
});

test("BDD-931b: meta.iam principal with no matching policy denies", async () => {
  const server = new EosMcpServer(projectRoot, "full");
  server.configureIamPolicies([]);
  server.configureIamDefaultPrincipal(null);

  const response = await server.handleRequest({
    jsonrpc: "2.0",
    id: "931b",
    method: "tools/call",
    params: {
      name: "eos_manage_worktree",
      arguments: { action: "create", branch: "x", apply: true },
      _meta: {
        iam: { subjectId: "eng-1", tenantId: "tenant-local", roles: ["engineer"] },
      },
    },
  });

  assert.equal(response.error?.code, MCP_IAM_DENIED_RPC_CODE);
  assert.equal(response.error?.data?.code, "DENY_NO_POLICY");
});

test("read-only tools/call is unchanged by the IAM gate", async () => {
  const server = new EosMcpServer(projectRoot, "full");
  server.configureIamPolicies([]);
  const response = await server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "eos_health_check", arguments: {} },
  });
  assert.equal(response.error, undefined);
  assert.ok(response.result?.content?.[0]?.text);
});
