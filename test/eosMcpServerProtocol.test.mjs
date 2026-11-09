/**
 * EOS SYSTEM — MCP SERVER PROTOCOL & JSON-RPC 2.0 BOUNDARY TEST SUITE
 * Validates JSON-RPC 2.0 conformance, argument validation, security bounds,
 * resources, prompts, and tool profile switching.
 */

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { EosMcpDispatchRegistry } from "../src/mcp/eosMcpDispatchRegistry.ts";
import { computeToolAnnotations, normalizeToolProfile, annotateAndFilterTools } from "../src/mcp/eosMcpToolCatalog.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-281: MCP Server JSON-RPC 2.0 Protocol Envelope & Handshake", () => {
  const server = new EosMcpServer(projectRoot, "full");

  // 1. initialize handshake
  const initRes = server.handleRequest({
    jsonrpc: "2.0",
    id: "init-1",
    method: "initialize",
    params: { protocolVersion: "2024-11-05" },
  });
  assert.equal(initRes.jsonrpc, "2.0");
  assert.equal(initRes.id, "init-1");
  assert.equal(initRes.result.protocolVersion, "2024-11-05");
  assert.ok(initRes.result.serverInfo.name);

  // 1b. initialize with negotiated protocolVersion 2025-03-26
  const init2025 = server.handleRequest({
    jsonrpc: "2.0",
    id: "init-2",
    method: "initialize",
    params: { protocolVersion: "2025-03-26" },
  });
  assert.equal(init2025.result.protocolVersion, "2025-03-26");

  // 2. ping
  const pingRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "ping",
  });
  assert.equal(pingRes.jsonrpc, "2.0");
  assert.deepEqual(pingRes.result, {});

  // 3. notifications/initialized returns null (no response for notifications)
  const notifRes = server.handleRequest({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });
  assert.equal(notifRes, null);

  // 4. tools/list
  const toolsList = server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/list",
  });
  assert.ok(Array.isArray(toolsList.result.tools));

  // 5. Tool profiles and registered tools
  server.setToolProfile("tier0");
  const tier0Tools = server.handleRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/list",
  });
  assert.ok(tier0Tools.result.tools.length > 0);
  server.setToolProfile("full");

  const registered = server.listRegisteredTools();
  assert.ok(registered.length > 20);
});

test("BDD-282: MCP Resources and Prompts Discovery and Retrieval", () => {
  const server = new EosMcpServer(projectRoot, "full");

  // 1. resources/list
  const resList = server.handleRequest({
    jsonrpc: "2.0",
    id: 10,
    method: "resources/list",
  });
  assert.ok(Array.isArray(resList.result.resources));
  assert.ok(resList.result.resources.some((r) => r.uri === "eos://specs/constitution"));

  // 2. resources/read for valid URIs
  const uris = ["eos://specs/constitution", "eos://evidence/receipt", "eos://projects/registry"];
  for (const uri of uris) {
    const readRes = server.handleRequest({
      jsonrpc: "2.0",
      id: 11,
      method: "resources/read",
      params: { uri },
    });
    assert.equal(readRes.jsonrpc, "2.0");
    assert.ok(readRes.result.contents[0].text);
  }

  // 3. resources/read unknown URI
  const readUnknown = server.handleRequest({
    jsonrpc: "2.0",
    id: 12,
    method: "resources/read",
    params: { uri: "eos://unknown/resource" },
  });
  assert.ok(readUnknown.error);
  assert.equal(readUnknown.error.code, -32603);
  assert.ok(readUnknown.error.message.includes("Unknown resource URI"));

  // 4. resources/read missing uri
  const readNoUri = server.handleRequest({
    jsonrpc: "2.0",
    id: 13,
    method: "resources/read",
    params: {},
  });
  assert.ok(readNoUri.error);

  // 5. prompts/list
  const promptsList = server.handleRequest({
    jsonrpc: "2.0",
    id: 20,
    method: "prompts/list",
  });
  assert.ok(Array.isArray(promptsList.result.prompts));
  assert.ok(promptsList.result.prompts.length > 0);

  // 6. prompts/get
  const firstPrompt = promptsList.result.prompts[0].name;
  const promptRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 21,
    method: "prompts/get",
    params: { name: firstPrompt, arguments: { directive: "Test" } },
  });
  assert.ok(promptRes.result.messages);

  // 7. prompts/get unknown or missing name
  const promptUnknown = server.handleRequest({
    jsonrpc: "2.0",
    id: 22,
    method: "prompts/get",
    params: { name: "unknown_prompt_xyz" },
  });
  assert.ok(promptUnknown.error);

  const promptNoName = server.handleRequest({
    jsonrpc: "2.0",
    id: 23,
    method: "prompts/get",
    params: {},
  });
  assert.ok(promptNoName.error);
});

test("BDD-283: MCP Request Validation and Bound Error Enforcement", () => {
  const server = new EosMcpServer(projectRoot, "full");

  // 1. Not a plain record
  assert.equal(server.handleRequest(null).error.code, -32600);
  assert.equal(server.handleRequest("not-json").error.code, -32600);
  assert.equal(server.handleRequest([1, 2, 3]).error.code, -32600);

  // 2. Invalid jsonrpc version
  const badVersion = server.handleRequest({ jsonrpc: "1.0", id: 1, method: "ping" });
  assert.equal(badVersion.error.code, -32600);

  // 3. Missing or invalid method
  assert.equal(server.handleRequest({ jsonrpc: "2.0", id: 1, method: 123 }).error.code, -32600);
  assert.equal(server.handleRequest({ jsonrpc: "2.0", id: 1, method: "a".repeat(129) }).error.code, -32600);

  // 4. Invalid id
  const badId = server.handleRequest({ jsonrpc: "2.0", id: "x".repeat(129), method: "ping" });
  assert.equal(badId.error.code, -32600);

  // 5. Unknown method
  const unknownMethod = server.handleRequest({ jsonrpc: "2.0", id: 50, method: "unregistered/call" });
  assert.equal(unknownMethod.error.code, -32601);

  // 6. Params not an object
  const badParams = server.handleRequest({ jsonrpc: "2.0", id: 51, method: "tools/call", params: "bad" });
  assert.equal(badParams.error.code, -32602);

  // 7. tools/call with invalid name
  const badToolName = server.handleRequest({
    jsonrpc: "2.0",
    id: 52,
    method: "tools/call",
    params: { name: "", arguments: {} },
  });
  assert.ok(badToolName.error);

  // 8. tools/call with invalid arguments type
  const badToolArgs = server.handleRequest({
    jsonrpc: "2.0",
    id: 53,
    method: "tools/call",
    params: { name: "eos_health_check", arguments: "not-an-object" },
  });
  assert.ok(badToolArgs.error);

  // 9. Argument bounds: Prototype pollution key rejection
  const protoPollution = server.handleRequest({
    jsonrpc: "2.0",
    id: 60,
    method: "tools/call",
    params: { name: "eos_health_check", arguments: JSON.parse('{"__proto__":{"evil":true}}') },
  });
  assert.ok(protoPollution.error);
  assert.ok(protoPollution.error.message.includes("prototype-control"));

  // 10. Argument bounds: Non-finite number rejection
  const nonFinite = server.handleRequest({
    jsonrpc: "2.0",
    id: 61,
    method: "tools/call",
    params: { name: "eos_health_check", arguments: { value: Infinity } },
  });
  assert.ok(nonFinite.error);
  assert.ok(nonFinite.error.message.includes("finite"));

  // 11. Argument bounds: String > 256 KiB
  const giantString = "a".repeat(256 * 1024 + 10);
  const oversizedStr = server.handleRequest({
    jsonrpc: "2.0",
    id: 62,
    method: "tools/call",
    params: { name: "eos_health_check", arguments: { big: giantString } },
  });
  assert.ok(oversizedStr.error);
  assert.ok(oversizedStr.error.message.includes("limit"));
});

test("BDD-287: EosMcpDispatchRegistry Invariants and Batch JSON-RPC Requests", () => {
  const registry = new EosMcpDispatchRegistry();
  assert.equal(registry.size, 0);

  // Error when toolName is empty
  assert.throws(() => registry.register("", () => "result"), /toolName required/);
  assert.throws(() => registry.register("   ", () => "result"), /toolName required/);

  // Register single tool
  registry.register("tool_alpha", (args) => `alpha:${args.val}`);
  assert.equal(registry.size, 1);
  assert.equal(registry.has("tool_alpha"), true);
  assert.equal(registry.has("unknown_tool"), false);

  // RegisterAll bundle
  registry.registerAll({
    tool_beta: (args) => `beta:${args.count}`,
    tool_gamma: (_args, ctx) => `gamma:${ctx.projectRoot}`,
  });
  assert.equal(registry.size, 3);
  assert.deepEqual(registry.listRegistered(), ["tool_alpha", "tool_beta", "tool_gamma"]);

  // Dispatch handled with args
  const ctx = {
    projectRoot: "/mock/root",
    resolveProjectPath: (_v, _k, fb) => fb ?? "/mock/path",
  };
  const resAlpha = registry.tryDispatch("tool_alpha", { val: "test" }, ctx);
  assert.equal(resAlpha.handled, true);
  if (resAlpha.handled) {
    assert.equal(resAlpha.result, "alpha:test");
  }

  // Dispatch handled with null args (defaults to {})
  const resGamma = registry.tryDispatch("tool_gamma", null, ctx);
  assert.equal(resGamma.handled, true);
  if (resGamma.handled) {
    assert.equal(resGamma.result, "gamma:/mock/root");
  }

  // Dispatch unhandled
  const resNotFound = registry.tryDispatch("tool_delta", {}, ctx);
  assert.equal(resNotFound.handled, false);

  // Non-plain-record rejection (arrays and primitives)
  const server = new EosMcpServer(projectRoot, "full");
  const batchRes = server.handleRequest([{ jsonrpc: "2.0", id: 101, method: "ping" }]);
  assert.ok(batchRes.error);
  assert.equal(batchRes.error.code, -32600);

  // Empty batch request rejection
  const emptyBatchRes = server.handleRequest([]);
  assert.ok(emptyBatchRes.error);
  assert.equal(emptyBatchRes.error.code, -32600);

  // Invalid JSON-RPC version
  const invalidRpcVer = server.handleRequest({ jsonrpc: "1.0", id: 999, method: "ping" });
  assert.ok(invalidRpcVer.error);
  assert.equal(invalidRpcVer.error.code, -32600);

  // Method not found
  const unknownMethod = server.handleRequest({ jsonrpc: "2.0", id: 998, method: "non_existent_method" });
  assert.ok(unknownMethod.error);
  assert.equal(unknownMethod.error.code, -32601);

  // Prompt listing and get
  const promptsList = server.handleRequest({ jsonrpc: "2.0", id: 701, method: "prompts/list" });
  assert.ok(Array.isArray(promptsList.result.prompts));
  if (promptsList.result.prompts.length > 0) {
    const pName = promptsList.result.prompts[0].name;
    const promptGet = server.handleRequest({
      jsonrpc: "2.0",
      id: 702,
      method: "prompts/get",
      params: { name: pName },
    });
    assert.ok(promptGet.result);
  }

  // Unknown prompt returns error
  const badPrompt = server.handleRequest({
    jsonrpc: "2.0",
    id: 703,
    method: "prompts/get",
    params: { name: "completely_unknown_prompt_name" },
  });
  assert.ok(badPrompt.error);
});

test("BDD-288: EosMcpToolCatalog annotations, profile normalization, and filtering", () => {
  // 1. Tool Annotations
  const worktreeAnnot = computeToolAnnotations("eos_manage_worktree");
  assert.equal(worktreeAnnot.destructiveHint, true);
  assert.equal(worktreeAnnot.readOnlyHint, false);

  const reconcileAnnot = computeToolAnnotations("eos_reconcile_state");
  assert.equal(reconcileAnnot.idempotentHint, true);

  const mcpAnnot = computeToolAnnotations("eos_run_mcp_tool");
  assert.equal(mcpAnnot.title, "EOS run MCP Tool");

  // 2. Profile Normalization
  assert.equal(normalizeToolProfile("core"), "core");
  assert.equal(normalizeToolProfile(" CORE "), "core");
  assert.equal(normalizeToolProfile("full"), "full");
  assert.equal(normalizeToolProfile(), "full");
  assert.equal(normalizeToolProfile("unknown_profile"), "full");

  // 3. annotateAndFilterTools
  const sampleTools = [
    { name: "eos_antigravity_direct", description: "Direct engineering mission", inputSchema: { type: "object" } },
    { name: "eos_non_core_tool", description: "Non core testing tool", inputSchema: { type: "object" } },
  ];

  const fullAnnotated = annotateAndFilterTools(sampleTools, "full");
  assert.equal(fullAnnotated.length, 2);
  assert.ok(fullAnnotated[0].annotations);

  const coreAnnotated = annotateAndFilterTools(sampleTools, "core");
  assert.equal(coreAnnotated.length, 1);
  assert.equal(coreAnnotated[0].name, "eos_antigravity_direct");
});
