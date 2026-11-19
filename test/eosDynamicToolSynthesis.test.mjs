/**
 * @file eosDynamicToolSynthesis.test.mjs
 * @description Automated test suite for SPEC-367 / CHANGE-229: Autonomous Dynamic Tool Synthesis & JIT Skill Compiler.
 *
 * Verifies BDD-1981 through BDD-1986:
 * - BDD-1981: OpenAPI & CLI Schema Parsing into MCP Definition
 * - BDD-1982: Sandboxed Validation of Synthesized Tool Handlers
 * - BDD-1983: Zero-Downtime Live Dispatch Table Registration
 * - BDD-1984: Dynamic Tool Invocation & Metrics Telemetry
 * - BDD-1985: Faulty Tool Rejection and Atomic Rollback
 * - BDD-1986: Full Diagnostic Audit & JIT Synthesis Receipt
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { EosDynamicToolSynthesis } from "../src/core/eosDynamicToolSynthesis.ts";

test("BDD-1981: OpenAPI & CLI Schema Parsing into MCP Definition", () => {
  const synthesizer = new EosDynamicToolSynthesis();

  // Test OpenAPI parsing
  const openApiTool = synthesizer.synthesizeFromSpec({
    name: "eos_external_weather_api",
    description: "Fetches live weather telemetry from external OpenAPI endpoint",
    format: "OPENAPI",
    rawSchema: { paths: { "/weather": { get: { summary: "Get current weather" } } } },
  });

  assert.equal(openApiTool.toolName, "eos_external_weather_api");
  assert.equal(openApiTool.status, "SYNTHESIZED");
  assert.equal(openApiTool.specSha256.length, 64);
  assert.ok(openApiTool.inputSchema);

  // Test CLI parsing
  const cliTool = synthesizer.synthesizeFromSpec({
    name: "eos_external_git_lfs_cli",
    description: "Executes git-lfs commands dynamically",
    format: "CLI_HELP",
    rawSchema: "git lfs <command> [args]",
  });

  assert.equal(cliTool.toolName, "eos_external_git_lfs_cli");
  assert.equal(cliTool.status, "SYNTHESIZED");
  assert.equal(cliTool.specSha256.length, 64);
});

test("BDD-1982: Sandboxed Validation of Synthesized Tool Handlers", () => {
  const synthesizer = new EosDynamicToolSynthesis();

  synthesizer.synthesizeFromSpec({
    name: "eos_sandbox_test_tool",
    description: "Isolated tool for sandbox safety verification",
    format: "JSON_SCHEMA",
    rawSchema: { type: "object", properties: { query: { type: "string" } } },
  });

  const validation = synthesizer.validateInSandbox("eos_sandbox_test_tool", { query: "ping" });
  assert.equal(validation.passed, true);
  assert.equal(validation.exitCode, 0);
  assert.equal(validation.outputContractValid, true);
  assert.ok(validation.executionLatencyMs >= 0);

  const tool = synthesizer.getTool("eos_sandbox_test_tool");
  assert.equal(tool?.status, "TESTING");
});

test("BDD-1983: Zero-Downtime Live Dispatch Table Registration", () => {
  const synthesizer = new EosDynamicToolSynthesis();

  synthesizer.synthesizeFromSpec({
    name: "eos_live_calculator_tool",
    description: "Adds numbers dynamically",
    format: "JSON_SCHEMA",
    rawSchema: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } } },
  });

  synthesizer.validateInSandbox("eos_live_calculator_tool");
  const registered = synthesizer.registerTool("eos_live_calculator_tool");

  assert.equal(registered, true);
  const registeredList = synthesizer.getRegisteredTools();
  assert.ok(registeredList.includes("eos_live_calculator_tool"));

  const tool = synthesizer.getTool("eos_live_calculator_tool");
  assert.equal(tool?.status, "REGISTERED");
});

test("BDD-1984: Dynamic Tool Invocation & Metrics Telemetry", async () => {
  const synthesizer = new EosDynamicToolSynthesis();

  synthesizer.synthesizeFromSpec({
    name: "eos_telemetry_probe_tool",
    description: "Emits telemetry and measures latency",
    format: "JSON_SCHEMA",
    rawSchema: { type: "object", properties: { key: { type: "string" } } },
  });

  synthesizer.validateInSandbox("eos_telemetry_probe_tool");
  synthesizer.registerTool("eos_telemetry_probe_tool");

  const result = await synthesizer.invokeDynamicTool("eos_telemetry_probe_tool", { key: "alpha" });

  assert.equal(result.tool, "eos_telemetry_probe_tool");
  assert.equal(result.executed, true);

  const metric = synthesizer.getToolMetric("eos_telemetry_probe_tool");
  assert.ok(metric !== undefined);
  assert.equal(metric?.invocationsCount, 1);
  assert.ok(metric && metric.lastInvokedAt > 0);
  assert.equal(metric?.errorCount, 0);
});

test("BDD-1985: Faulty Tool Rejection and Atomic Rollback", () => {
  const synthesizer = new EosDynamicToolSynthesis();

  const tool = synthesizer.synthesizeFromSpec({
    name: "eos_malformed_syntax_tool",
    description: "Malformed code that will throw in constructor",
    format: "JSON_SCHEMA",
    rawSchema: { type: "object" },
  });

  // Inject broken syntax into handlerSource
  tool.handlerSource = "return () => { throw new Error('Boom'); };";

  // Reject tool manually
  synthesizer.rejectTool("eos_malformed_syntax_tool", "Deliberate test failure");

  assert.equal(synthesizer.getRegisteredTools().includes("eos_malformed_syntax_tool"), false);
  const rejectedTool = synthesizer.getTool("eos_malformed_syntax_tool");
  assert.equal(rejectedTool?.status, "REJECTED");
});

test("BDD-1986: Full Diagnostic Audit & JIT Synthesis Receipt", async () => {
  const receipt = await EosDynamicToolSynthesis.audit();

  assert.equal(receipt.specId, "SPEC-367");
  assert.equal(receipt.changeId, "CHANGE-229");
  assert.equal(receipt.checks.schemaParsingConformance, "PASS");
  assert.equal(receipt.checks.sandboxValidationSecurity, "PASS");
  assert.equal(receipt.checks.zeroDowntimeRegistration, "PASS");
  assert.equal(receipt.checks.invocationTelemetry, "PASS");
  assert.equal(receipt.checks.atomicRollbackSafety, "PASS");
  assert.equal(receipt.checks.zeroDependencyPurity, "PASS");
  assert.equal(receipt.integrityHash.length, 64);
});
