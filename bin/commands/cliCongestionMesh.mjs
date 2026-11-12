import { EosAdaptiveCongestionRateLimiterCore } from "../../src/core/eosAdaptiveCongestionRateLimiterCore.ts";

const HANDLERS = {};

async function cmd_congestion_demo(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");

  const limiter = new EosAdaptiveCongestionRateLimiterCore({
    capacity: 20,
    refillRate: 10,
    initialCwnd: 10,
    minCwnd: 2,
    maxCwnd: 40,
    alpha: 2,
    beta: 0.5,
    latencyThresholdMs: 50,
    windowMs: 5000,
  });

  const timeline = [];

  // Phase 1: Nominal traffic (low latency 15ms)
  for (let i = 0; i < 5; i++) {
    const res = limiter.admit();
    limiter.complete(15);
    timeline.push({ step: i + 1, phase: "NOMINAL", decision: res.decision, cwnd: limiter.stats().cwnd });
  }

  // Phase 2: Congestion spike (high latency 120ms > threshold 50ms)
  for (let i = 0; i < 3; i++) {
    const res = limiter.admit();
    limiter.complete(120);
    timeline.push({ step: i + 6, phase: "SPIKE", decision: res.decision, cwnd: limiter.stats().cwnd });
  }

  // Phase 3: Recovery (latency drops to 20ms)
  for (let i = 0; i < 4; i++) {
    const res = limiter.admit();
    limiter.complete(20);
    timeline.push({ step: i + 9, phase: "RECOVERY", decision: res.decision, cwnd: limiter.stats().cwnd });
  }

  const finalStats = limiter.stats();

  if (isJson) {
    console.log(JSON.stringify({ timeline, stats: finalStats }, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN ADAPTIVE AIMD CONGESTION RATE LIMITER (SPEC-228)`);
  console.log(`===============================================================`);
  console.log(`  Bucket Capacity        : ${finalStats.capacity} tokens`);
  console.log(`  Refill Rate            : ${finalStats.refillRate} tokens/sec`);
  console.log(`  Latency Threshold      : ${finalStats.latencyThresholdMs} ms`);
  console.log(`  AIMD Parameters        : alpha=+${finalStats.alpha}, beta=*${finalStats.beta}`);
  console.log(
    `  Congestion Window (cwnd): ${finalStats.cwnd} [min: ${finalStats.minCwnd}, max: ${finalStats.maxCwnd}]`,
  );
  console.log(`  P99 Latency (HDR)      : ${finalStats.p99LatencyMs} ms`);
  console.log(`  Total Admitted         : ${finalStats.totalAdmitted}`);
  console.log(`  Total Completed        : ${finalStats.totalCompleted}`);
  console.log(`---------------------------------------------------------------`);
  console.log(`  Timeline Execution:`);
  for (const t of timeline) {
    console.log(
      `    Step ${String(t.step).padStart(2)} | Phase: ${t.phase.padEnd(8)} | Decision: ${t.decision.padEnd(8)} | cwnd: ${t.cwnd}`,
    );
  }
  console.log(`===============================================================\n`);
}

async function cmd_congestion_admit(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");

  const limiter = new EosAdaptiveCongestionRateLimiterCore({
    capacity: 10,
    refillRate: 5,
    initialCwnd: 5,
  });

  const res = limiter.admit();
  const stats = limiter.stats();

  if (isJson) {
    console.log(JSON.stringify({ admission: res, stats }, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN CONGESTION RATE LIMITER ADMISSION (SPEC-228)`);
  console.log(`===============================================================`);
  console.log(`  Decision               : ${res.decision}`);
  console.log(`  Allowed                : ${res.allowed}`);
  console.log(`  Available Tokens       : ${res.availableTokens}`);
  console.log(`  In-Flight Requests     : ${res.inFlight}`);
  console.log(`  Congestion Window (cwnd): ${res.cwnd}`);
  console.log(`===============================================================\n`);
}

async function cmd_congestion_stats(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");

  const limiter = new EosAdaptiveCongestionRateLimiterCore({
    capacity: 50,
    refillRate: 25,
    initialCwnd: 25,
  });

  const stats = limiter.stats();

  if (isJson) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN CONGESTION RATE LIMITER STATS (SPEC-228)`);
  console.log(`===============================================================`);
  console.log(`  Bucket Capacity        : ${stats.capacity} tokens`);
  console.log(`  Available Tokens       : ${stats.availableTokens}`);
  console.log(`  Refill Rate            : ${stats.refillRate} tokens/sec`);
  console.log(`  Congestion Window (cwnd): ${stats.cwnd}`);
  console.log(`  In-Flight Requests     : ${stats.inFlight}`);
  console.log(`  P99 Latency (HDR)      : ${stats.p99LatencyMs} ms`);
  console.log(`===============================================================\n`);
}

HANDLERS["congestion:demo"] = cmd_congestion_demo;
HANDLERS["congestion:admit"] = cmd_congestion_admit;
HANDLERS["congestion:stats"] = cmd_congestion_stats;

export async function handleCongestionCommands(command, commandContext) {
  const handler = HANDLERS[command];
  if (!handler) return false;
  await handler(commandContext);
  return true;
}
