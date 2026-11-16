/**
 * CLI Sovereign AI Gateway & Adversarial Consensus Handlers
 *
 * Implements toolchain:gateway:* subcommands for multi-model frontier routing,
 * dual-model adversarial consensus, circuit breaker monitoring, and audit receipts.
 *
 * Conforms to SPEC-298 / CHANGE-160.
 */

import { SovereignAiGateway } from "../../src/core/eosSovereignAiGateway.ts";

const HANDLERS = {};
const globalGateway = new SovereignAiGateway();

async function cmd_gateway_route(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const intentArg =
    args
      .find((a) => a.startsWith("--intent="))
      ?.split("=")[1]
      ?.toUpperCase() || "CODE_SYNTHESIS";
  const promptArg =
    args.find((a) => a.startsWith("--prompt="))?.split("=")[1] ||
    "Generate pure TypeScript domain handler without external dependencies.";

  const validIntents = ["CODE_SYNTHESIS", "ARCHITECTURE_DESIGN", "TRIAGE_FAST", "DEEP_RESEARCH", "FORMAL_REASONING"];
  const intent = validIntents.includes(intentArg) ? intentArg : "CODE_SYNTHESIS";

  const res = await globalGateway.routeRequest({
    requestId: `cli-${Date.now()}`,
    intent,
    prompt: promptArg,
  });

  if (isJson) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🤖  EOS SOVEREIGN AI GATEWAY ROUTE (SPEC-298)                 ");
  console.log("===============================================================");
  console.log(`  Request ID          : ${res.requestId}`);
  console.log(`  Intent Category     : ${intent}`);
  console.log(`  Routed Provider     : ${res.provider}`);
  console.log(`  Frontier Model      : ${res.model}`);
  console.log(`  Cached Hit          : ${res.cached}`);
  console.log(`  Tokens (In / Out)   : ${res.promptTokens} / ${res.completionTokens}`);
  console.log(`  Estimated Spend     : $${res.estimatedCostUsd.toFixed(6)}`);
  console.log(`  Latency             : ${res.latencyMs} ms`);
  console.log(`  Completion Output   : ${res.completion}`);
  console.log("===============================================================\n");
}

async function cmd_gateway_consensus(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const promptArg =
    args.find((a) => a.startsWith("--prompt="))?.split("=")[1] ||
    "Verify hexagonal purity and zero runtime dependency constraints in domain.";

  const session = await globalGateway.runConsensusSession(promptArg);

  if (isJson) {
    console.log(JSON.stringify(session, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" ⚖️  EOS DUAL-MODEL ADVERSARIAL CONSENSUS (SPEC-298)            ");
  console.log("===============================================================");
  console.log(`  Session ID          : ${session.sessionId}`);
  console.log(`  Model A             : ${session.modelA.provider} (${session.modelA.model})`);
  console.log(`  Model B             : ${session.modelB.provider} (${session.modelB.model})`);
  console.log(`  Divergence Score    : ${session.divergenceScore}`);
  console.log(`  Invariants Checked  : ${session.invariantsEvaluated.length}`);
  console.log(`  Constitutional Pass : ${session.invariantCheckPassed}`);
  console.log(`  Consensus Verdict   : ${session.verdict}`);
  console.log(`  Synthesis Summary   : ${session.synthesisSummary}`);
  console.log("===============================================================\n");
}

async function cmd_gateway_circuit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const providerArg = args.find((a) => a.startsWith("--provider="))?.split("=")[1] || "google-gemini";
  const reset = args.includes("--reset");

  if (reset) {
    globalGateway.resetCircuit(providerArg);
  }

  const circuit = globalGateway.getCircuit(providerArg);

  if (isJson) {
    console.log(JSON.stringify(circuit, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" ⚡  EOS AI GATEWAY CIRCUIT BREAKER (SPEC-298)                ");
  console.log("===============================================================");
  console.log(`  Provider Target     : ${circuit.provider}`);
  console.log(`  Circuit State       : ${circuit.state}`);
  console.log(`  Consecutive Fails   : ${circuit.consecutiveFailures}`);
  console.log(`  Failure Threshold   : ${circuit.failureThreshold}`);
  console.log(`  Cooldown Duration   : ${circuit.cooldownDurationMs} ms`);
  console.log(
    `  Last Failure TS     : ${circuit.lastFailureTime ? new Date(circuit.lastFailureTime).toISOString() : "None"}`,
  );
  console.log("===============================================================\n");
}

async function cmd_gateway_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = await globalGateway.auditAiGatewayPipeline();

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔒  EOS SOVEREIGN AI GATEWAY AUDIT RECEIPT (SPEC-298)         ");
  console.log("===============================================================");
  console.log(`  Specification Ref   : ${receipt.specRef}`);
  console.log(`  Providers Audited   : ${receipt.providersAudited.join(", ")}`);
  console.log(`  Routes Evaluated    : ${receipt.routesEvaluated}`);
  console.log(`  Consensus Sessions  : ${receipt.consensusSessionsCount}`);
  console.log(`  Cache Hit Ratio     : ${(receipt.cacheHitRatio * 100).toFixed(1)}%`);
  console.log(`  Total Cost Tracked  : $${receipt.totalCostUsd.toFixed(6)}`);
  console.log(`  SHA-256 Signature   : ${receipt.sha256Signature}`);
  console.log("===============================================================\n");
}

HANDLERS["toolchain:gateway:route"] = cmd_gateway_route;
HANDLERS["toolchain:gateway:consensus"] = cmd_gateway_consensus;
HANDLERS["toolchain:gateway:circuit"] = cmd_gateway_circuit;
HANDLERS["toolchain:gateway:audit"] = cmd_gateway_audit;

export async function handleAiGatewayCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    return false;
  }
  await handler(commandContext);
  return true;
}
