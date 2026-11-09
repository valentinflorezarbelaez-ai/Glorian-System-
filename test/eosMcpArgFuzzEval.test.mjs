/**
 * Hermetic wrong-tool / wrong-args MCP fuzz evals (AI Engineer roadmap gap).
 * WITHIN_TESTED_SCOPE — catalog-only; does not invoke live providers.
 */
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { EosMcpSchemaValidator } from "../src/core/eosMcpSchemaValidator.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadCatalog() {
  const server = new EosMcpServer(projectRoot, "full");
  const listRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });
  return listRes?.result?.tools || [];
}

test("BDD-MCP-ARG-FUZZ-001: unknown tool is rejected fail-closed", () => {
  const tools = loadCatalog();
  const validator = new EosMcpSchemaValidator(projectRoot);
  const result = validator.validateToolCallArguments(tools, "eos_definitely_not_a_real_tool", {});
  assert.equal(result.ok, false);
  assert.equal(result.code, "UNKNOWN_TOOL");
});

test("BDD-MCP-ARG-FUZZ-002: missing required args rejected", () => {
  const tools = loadCatalog();
  const validator = new EosMcpSchemaValidator(projectRoot);
  const result = validator.validateToolCallArguments(tools, "eos_amplify_prompt", {});
  assert.equal(result.ok, false);
  assert.equal(result.code, "MISSING_REQUIRED");
  assert.equal(result.field, "rawPrompt");
});

test("BDD-MCP-ARG-FUZZ-003: wrong JSON type rejected", () => {
  const tools = loadCatalog();
  const validator = new EosMcpSchemaValidator(projectRoot);
  const result = validator.validateToolCallArguments(tools, "eos_amplify_prompt", {
    rawPrompt: 42,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "WRONG_TYPE");
  assert.equal(result.field, "rawPrompt");
});

test("BDD-MCP-ARG-FUZZ-004: enum violation rejected", () => {
  const tools = loadCatalog();
  const validator = new EosMcpSchemaValidator(projectRoot);
  const result = validator.validateToolCallArguments(tools, "eos_amplify_prompt", {
    rawPrompt: "outline AST search",
    targetModel: "not-a-real-model-family",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "ENUM_VIOLATION");
  assert.equal(result.field, "targetModel");
});

test("BDD-MCP-ARG-FUZZ-005: unexpected property rejected (strict schema)", () => {
  const tools = loadCatalog();
  const validator = new EosMcpSchemaValidator(projectRoot);
  const result = validator.validateToolCallArguments(
    tools,
    "eos_turbo_verify",
    { roguePayload: true },
    { allowAdditionalProperties: false },
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "UNEXPECTED_PROPERTY");
  assert.equal(result.field, "roguePayload");
});

test("BDD-MCP-ARG-FUZZ-006: valid args accepted", () => {
  const tools = loadCatalog();
  const validator = new EosMcpSchemaValidator(projectRoot);
  const result = validator.validateToolCallArguments(tools, "eos_amplify_prompt", {
    rawPrompt: "outline AST search format lint",
    targetModel: "gemini",
    strictLevel: "sovereign",
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, "OK");
});

test("BDD-MCP-ARG-FUZZ-007: deterministic fuzz corpus over catalog required fields", () => {
  const tools = loadCatalog();
  assert.ok(tools.length > 50);
  const validator = new EosMcpSchemaValidator(projectRoot);
  let rejected = 0;
  for (const tool of tools.slice(0, 40)) {
    const poison = validator.validateToolCallArguments(
      tools,
      tool.name,
      { __fuzz_poison__: "x".repeat(64) },
      { allowAdditionalProperties: false },
    );
    if (!poison.ok) rejected += 1;
  }
  assert.ok(rejected >= 30, `expected most tools to reject poison args, got ${rejected}`);
});
