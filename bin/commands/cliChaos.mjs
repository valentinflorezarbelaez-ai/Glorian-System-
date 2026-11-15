/**
 * EOS SYSTEM — CHAOS & CIRCUIT BREAKER CLI (Layer 0)
 * Governed by SPEC-279, CHANGE-141
 */

import fs from "node:fs";
import path from "node:path";
import { EosChaosCircuitBreaker } from "../../src/core/eosChaosCircuitBreaker.ts";

export const HANDLERS = {};

const registry = new Map();

function getOrCreateBreaker(serviceName, config = {}, chaosPolicy = {}) {
  let breaker = registry.get(serviceName);
  if (!breaker) {
    breaker = new EosChaosCircuitBreaker(serviceName, config, chaosPolicy);
    registry.set(serviceName, breaker);
  }
  return breaker;
}

async function cmd_toolchain_chaos_inject(commandContext) {
  const { args, root, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");
  const fileArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/chaos/glorian-resilience-policy.json";

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: Policy file not found at ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const policy = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const serviceName = "payment-gateway";
  const breaker = getOrCreateBreaker(serviceName, policy.circuitBreaker, {
    ...policy.faultInjection,
    enabled: policy.enabled ?? true,
  });

  // Run a series of 10 simulated calls through the chaos breaker
  const results = [];
  for (let i = 0; i < 10; i++) {
    try {
      const res = await breaker.execute(
        async () => `OK_TX_${i}`,
        async (err) => `FALLBACK: ${err.message}`,
        serviceName,
      );
      results.push({ callId: i, outcome: res });
    } catch (err) {
      results.push({ callId: i, outcome: `FAILED: ${err.message}` });
    }
  }

  const receipt = breaker.generateReceipt();

  if (isJson) {
    console.log(JSON.stringify({ policyName: policy.policyName, results, receipt }, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN CHAOS ENGINEERING & CIRCUIT BREAKER (SPEC-279)`);
  console.log(`===============================================================`);
  console.log(`  Policy Name          : ${policy.policyName}`);
  console.log(`  Target Service       : ${serviceName}`);
  console.log(`  Circuit State        : ${receipt.metrics.state}`);
  console.log(`  Total Invocations    : ${receipt.metrics.totalCalls}`);
  console.log(`  Successful Calls     : ${receipt.metrics.successfulCalls}`);
  console.log(`  Failed / Injected    : ${receipt.metrics.failedCalls}`);
  console.log(`  Rejected (Open)      : ${receipt.metrics.rejectedCalls}`);
  console.log(`  Failure Rate         : ${receipt.metrics.failureRate}%`);
  console.log(`  Receipt SHA-256      : sha256:${receipt.sha256}`);
  console.log(`===============================================================\n`);
}

async function cmd_toolchain_chaos_circuit(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");
  const serviceArg = args.slice(1).find((a) => !a.startsWith("-")) || "payment-gateway";

  const breaker = getOrCreateBreaker(serviceArg);
  const metrics = breaker.getMetrics();

  if (isJson) {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN CIRCUIT BREAKER STATUS (SPEC-279)`);
  console.log(`===============================================================`);
  console.log(`  Service Name         : ${metrics.serviceName}`);
  console.log(`  Current State        : ${metrics.state}`);
  console.log(`  Total Calls          : ${metrics.totalCalls}`);
  console.log(`  Successful Calls     : ${metrics.successfulCalls}`);
  console.log(`  Failed Calls         : ${metrics.failedCalls}`);
  console.log(`  Slow Calls           : ${metrics.slowCalls}`);
  console.log(`  Rejected Calls       : ${metrics.rejectedCalls}`);
  console.log(`  Failure Rate         : ${metrics.failureRate}%`);
  console.log(`  Slow Call Rate       : ${metrics.slowCallRate}%`);
  console.log(`  Last Transition      : ${metrics.lastStateTransitionTime}`);
  console.log(`===============================================================\n`);
}

async function cmd_toolchain_chaos_reset(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");
  const serviceArg = args.slice(1).find((a) => !a.startsWith("-")) || "payment-gateway";

  const breaker = getOrCreateBreaker(serviceArg);
  breaker.reset();
  const metrics = breaker.getMetrics();

  if (isJson) {
    console.log(JSON.stringify({ status: "RESET_OK", metrics }, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN CIRCUIT BREAKER RESET (SPEC-279)`);
  console.log(`===============================================================`);
  console.log(`  Service Name         : ${serviceArg}`);
  console.log(`  New State            : ${metrics.state} (CLOSED)`);
  console.log(`  All sliding counters cleared.`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:chaos:inject"] = cmd_toolchain_chaos_inject;
HANDLERS["toolchain:chaos:circuit"] = cmd_toolchain_chaos_circuit;
HANDLERS["toolchain:chaos:reset"] = cmd_toolchain_chaos_reset;

export async function handleChaosCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
