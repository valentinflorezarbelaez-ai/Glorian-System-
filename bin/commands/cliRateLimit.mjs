/**
 * CLI Rate Limiting & Traffic Shaping Command Handlers
 *
 * Implements toolchain:ratelimit:* subcommands for inspecting,
 * consuming, and auditing hierarchical rate limiters with RFC 6585
 * header emission and cryptographic receipts.
 *
 * Conforms to SPEC-286 / CHANGE-148.
 */

import { EosRateLimitingGovernor } from "../../src/core/eosRateLimitingGovernor.ts";

const HANDLERS = {};

async function cmd_ratelimit_audit(commandContext) {
  const args = commandContext.args || [];
  let count = 200;
  const countArg = args.find((a) => a.startsWith("--count="));
  if (countArg) {
    count = parseInt(countArg.split("=")[1], 10) || 200;
  }

  const isJson = args.includes("--json");
  const governor = new EosRateLimitingGovernor();
  const report = await governor.auditThroughput(count);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🛡️  EOS RATE LIMITING & TRAFFIC SHAPING AUDIT (SPEC-286)     ");
  console.log("===============================================================");
  console.log(`  Total Evaluations   : ${report.totalEvaluations}`);
  console.log(`  Granted Requests    : ${report.grantedCount}`);
  console.log(`  Rejected (Throttled): ${report.rejectedCount}`);
  console.log(`  Rejection Rate      : ${(report.rejectionRate * 100).toFixed(2)}%`);
  console.log(`  Active Buckets      : ${report.activeBucketsCount}`);
  console.log(`  SHA-256 Signature   : ${report.sha256Signature}`);
  console.log("===============================================================\n");
}

async function cmd_ratelimit_consume(commandContext) {
  const args = commandContext.args || [];
  const tierArg = args.find((a) => a.startsWith("--tier="));
  const keyArg = args.find((a) => a.startsWith("--key="));
  const costArg = args.find((a) => a.startsWith("--cost="));

  const tier = tierArg ? tierArg.split("=")[1] : "client";
  const key = keyArg ? keyArg.split("=")[1] : "client-anon";
  const cost = costArg ? parseInt(costArg.split("=")[1], 10) || 1 : 1;
  const isJson = args.includes("--json");

  const governor = new EosRateLimitingGovernor();
  const decision = governor.evaluateSingle(tier, key, cost);

  if (isJson) {
    console.log(JSON.stringify({ tier, key, cost, ...decision }, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🚦 EOS RATE LIMIT EVALUATION (RFC 6585)                      ");
  console.log("===============================================================");
  console.log(`  Tier                : ${decision.tier}`);
  console.log(`  Key                 : ${key}`);
  console.log(`  Cost                : ${cost}`);
  console.log(`  Allowed             : ${decision.allowed ? "YES (200 OK)" : "NO (429 TOO MANY REQUESTS)"}`);
  console.log(`  Remaining           : ${decision.remaining} / ${decision.limit}`);
  console.log(`  Reset In            : ${decision.resetInMs}ms`);
  if (!decision.allowed) {
    console.log(`  Retry-After         : ${decision.retryAfterSec}s`);
  }
  console.log("  RFC 6585 Headers:");
  for (const [hKey, hVal] of Object.entries(decision.headers)) {
    console.log(`    ${hKey}: ${hVal}`);
  }
  console.log("===============================================================\n");
}

async function cmd_ratelimit_inspect(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const governor = new EosRateLimitingGovernor();
  // Evaluate sample requests to populate state
  governor.evaluateSingle("client", "sample-client", 2);
  governor.evaluateSingle("endpoint", "/api/v1/orders", 1);

  const inspections = governor.inspectBuckets();

  if (isJson) {
    console.log(JSON.stringify(inspections, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔍 EOS ACTIVE RATE LIMIT BUCKET INSPECTION                   ");
  console.log("===============================================================");
  for (const item of inspections) {
    console.log(`  Key: ${item.key} [Tier: ${item.tier}]`);
    console.log(`    Algorithm        : ${item.algorithm}`);
    console.log(`    Capacity         : ${item.capacity}`);
    console.log(`    Current Level    : ${item.currentLevel}`);
    console.log(`    Rate / sec       : ${item.ratePerSec}`);
    console.log(`    Last Updated     : ${item.lastUpdatedMs}ms`);
    console.log("  -------------------------------------------------------------");
  }
  console.log("===============================================================\n");
}

HANDLERS["toolchain:ratelimit:audit"] = cmd_ratelimit_audit;
HANDLERS["toolchain:ratelimit:consume"] = cmd_ratelimit_consume;
HANDLERS["toolchain:ratelimit:inspect"] = cmd_ratelimit_inspect;

export async function handleRateLimitCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
