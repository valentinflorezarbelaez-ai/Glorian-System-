/**
 * @file cliDynamicToolSynthesis.mjs
 * @description CLI handler for SPEC-367 / CHANGE-229: Autonomous Dynamic Tool Synthesis & JIT Skill Compiler.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosDynamicToolSynthesis } from "../../src/core/eosDynamicToolSynthesis.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("DYNAMIC_TOOL_SYNTHESIS_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_jit_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const synthesizer = new EosDynamicToolSynthesis();
  const receipt = await synthesizer.audit();
  const receiptPath = getReceiptPath(ROOT);

  try {
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
  } catch (err) {
    console.error(`Warning: Could not persist evidence receipt: ${err.message}`);
  }

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Autonomous Dynamic Tool Synthesis & JIT Skill Compiler (SPEC-367) ===");
    console.log(`Spec ID                   : ${receipt.specId}`);
    console.log(`Change ID                 : ${receipt.changeId}`);
    console.log(`Active Dynamic Tools Count: ${receipt.activeDynamicToolsCount}`);
    console.log(`Registered Tools          : ${receipt.registeredTools.join(", ") || "none"}`);
    console.log(`Checks Summary            :`);
    console.log(`  - Schema Parsing        : ${receipt.checks.schemaParsingConformance}`);
    console.log(`  - Sandbox Validation    : ${receipt.checks.sandboxValidationSecurity}`);
    console.log(`  - Hot-Registration      : ${receipt.checks.zeroDowntimeRegistration}`);
    console.log(`  - Invocation Telemetry  : ${receipt.checks.invocationTelemetry}`);
    console.log(`  - Atomic Rollback       : ${receipt.checks.atomicRollbackSafety}`);
    console.log(`  - Zero Dependency Purity: ${receipt.checks.zeroDependencyPurity}`);
    console.log(`Integrity SHA-256         : ${receipt.integrityHash}`);
  }
}

async function cmd_jit_synthesize(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const name = args.find((a) => !a.startsWith("--")) || "eos_dynamic_sample_tool";
  const synthesizer = new EosDynamicToolSynthesis();

  const tool = synthesizer.synthesizeFromSpec({
    name,
    description: `Dynamically synthesized JIT tool: ${name}`,
    format: "OPENAPI",
    rawSchema: { paths: { [`/${name}`]: { get: { summary: "Dynamic probe" } } } },
  });

  if (isJson) {
    console.log(JSON.stringify(tool, null, 2));
  } else {
    console.log("=== JIT Dynamic Tool Synthesized ===");
    console.log(`Tool Name   : ${tool.toolName}`);
    console.log(`Description : ${tool.description}`);
    console.log(`Status      : ${tool.status}`);
    console.log(`Spec SHA-256: ${tool.specSha256.substring(0, 16)}...`);
  }
}

async function cmd_jit_compile(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const name = args.find((a) => !a.startsWith("--")) || "eos_dynamic_sample_tool";
  const synthesizer = new EosDynamicToolSynthesis();

  synthesizer.synthesizeFromSpec({
    name,
    description: `Dynamically synthesized JIT tool: ${name}`,
    format: "JSON_SCHEMA",
    rawSchema: { type: "object", properties: { input: { type: "string" } } },
  });

  const validation = synthesizer.validateInSandbox(name, { input: "test" });
  const registered = validation.passed ? synthesizer.registerTool(name) : false;

  const output = {
    toolName: name,
    validationPassed: validation.passed,
    registered,
    latencyMs: validation.executionLatencyMs,
  };

  if (isJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log("=== JIT Tool Sandboxed Compilation & Hot Registration ===");
    console.log(`Tool Name         : ${output.toolName}`);
    console.log(`Validation Passed : ${output.validationPassed}`);
    console.log(`Hot Registered    : ${output.registered}`);
    console.log(`Sandbox Latency   : ${output.latencyMs} ms`);
  }
}

async function cmd_jit_tools(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const synthesizer = new EosDynamicToolSynthesis();

  const tools = synthesizer.getRegisteredTools();

  if (isJson) {
    console.log(JSON.stringify(tools, null, 2));
  } else {
    console.log("=== Active Dynamic JIT Tools in Dispatch Table ===");
    if (tools.length === 0) {
      console.log("  (No dynamic JIT tools registered; all static tools loaded from catalog)");
    } else {
      for (const t of tools) {
        console.log(`  - ${t}`);
      }
    }
  }
}

HANDLERS["toolchain:jit:audit"] = cmd_jit_audit;
HANDLERS["toolchain:jit:synthesize"] = cmd_jit_synthesize;
HANDLERS["toolchain:jit:compile"] = cmd_jit_compile;
HANDLERS["toolchain:jit:tools"] = cmd_jit_tools;

export async function handleDynamicToolSynthesisCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:jit command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
