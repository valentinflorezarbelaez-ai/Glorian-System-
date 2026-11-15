/**
 * EOS SYSTEM — OPENTELEMETRY COLLECTOR GATEWAY CLI (Layer 0)
 * Governed by SPEC-278, CHANGE-140
 */

import fs from "node:fs";
import path from "node:path";
import { EosOtlpCollectorGateway } from "../../src/core/eosOtlpCollectorGateway.ts";

export const HANDLERS = {};

const defaultGateway = new EosOtlpCollectorGateway();

function parseOption(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  const val = Number(arg.slice(prefix.length));
  return Number.isNaN(val) ? defaultValue : val;
}

async function cmd_toolchain_otel_ingest(commandContext) {
  const { args, root, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");
  const sampleRate = parseOption(args, "--sample-rate=", 0.05);
  const latencyThresholdMs = parseOption(args, "--latency-threshold=", 250);
  const fileArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/otel/sample-otlp-traces.json";

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const gateway = new EosOtlpCollectorGateway({ sampleRate, latencyThresholdMs });
  const result = gateway.ingestSpans(content, { sampleRate, latencyThresholdMs });
  const receipt = gateway.generateReceipt();

  if (isJson) {
    console.log(JSON.stringify({ ...result, ...receipt }, null, 2));
    if (result.status !== "PASS") process.exitCode = 1;
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN OPENTELEMETRY OTLP COLLECTOR GATEWAY (SPEC-278)`);
  console.log(`===============================================================`);
  console.log(`  Target Payload       : ${fileArg}`);
  console.log(`  Ingest Status        : ${result.status === "PASS" ? "✔ PASS" : "✖ ERROR"}`);
  console.log(`  Total Ingested Spans : ${result.totalIngested}`);
  console.log(
    `  Retained Spans       : ${result.retainedCount} (Ratio: ${(receipt.metrics.retentionRatio * 100).toFixed(1)}%)`,
  );
  console.log(`  Dropped Nominal      : ${receipt.metrics.totalDropped}`);
  console.log(`  Latency Outliers     : ${receipt.metrics.latencyOutlierCount}`);
  console.log(`  Error Spans (100%)   : ${receipt.metrics.errorCount}`);
  console.log(
    `  P50 / P90 / P99 (ms) : ${receipt.metrics.p50Ms} / ${receipt.metrics.p90Ms} / ${receipt.metrics.p99Ms}`,
  );
  console.log(`  Receipt SHA-256      : sha256:${receipt.sha256}`);
  console.log(`===============================================================\n`);

  if (result.status !== "PASS") process.exitCode = 1;
}

async function cmd_toolchain_otel_spans(commandContext) {
  const { args, root, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");
  const errorsOnly = args.includes("--errors");
  const limit = parseOption(args, "--limit=", 20);

  // Ingest sample if buffer empty
  const samplePath = path.join(root, "templates/otel/sample-otlp-traces.json");
  if (fs.existsSync(samplePath)) {
    defaultGateway.ingestSpans(fs.readFileSync(samplePath, "utf8"), { sampleRate: 1.0 });
  }

  const spans = defaultGateway.getSpans({ errorsOnly, limit });

  if (isJson) {
    console.log(JSON.stringify(spans, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN OTLP CAPTURED SPANS (SPEC-278)`);
  console.log(`===============================================================`);
  console.log(`  Total Spans Rendered : ${spans.length} ${errorsOnly ? "(Errors Only)" : ""}`);
  for (const s of spans) {
    const statusStr = s.status.code === 2 ? "[ERR]" : "[OK]";
    console.log(
      `  ${statusStr} [${s.durationMs.toFixed(1)}ms] ${s.name} (${s.traceId.slice(0, 8)}... / ${s.spanId.slice(0, 8)}...)`,
    );
  }
  console.log(`===============================================================\n`);
}

async function cmd_toolchain_otel_stats(commandContext) {
  const { args, root, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");

  const samplePath = path.join(root, "templates/otel/sample-otlp-traces.json");
  if (fs.existsSync(samplePath)) {
    defaultGateway.ingestSpans(fs.readFileSync(samplePath, "utf8"));
  }

  const metrics = defaultGateway.computeMetrics();

  if (isJson) {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN OTLP TELEMETRY METRICS & PERCENTILES (SPEC-278)`);
  console.log(`===============================================================`);
  console.log(`  Total Ingested       : ${metrics.totalIngested}`);
  console.log(`  Total Retained       : ${metrics.totalRetained}`);
  console.log(`  Retention Ratio      : ${(metrics.retentionRatio * 100).toFixed(2)}%`);
  console.log(`  Error Rate           : ${(metrics.errorRate * 100).toFixed(2)}%`);
  console.log(`  Latency P50          : ${metrics.p50Ms} ms`);
  console.log(`  Latency P90          : ${metrics.p90Ms} ms`);
  console.log(`  Latency P95          : ${metrics.p95Ms} ms`);
  console.log(`  Latency P99          : ${metrics.p99Ms} ms`);
  console.log(`  Mean Duration        : ${metrics.meanDurationMs} ms`);
  console.log(`  Max Duration         : ${metrics.maxDurationMs} ms`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:otel:ingest"] = cmd_toolchain_otel_ingest;
HANDLERS["toolchain:otel:spans"] = cmd_toolchain_otel_spans;
HANDLERS["toolchain:otel:stats"] = cmd_toolchain_otel_stats;

export async function handleOtelCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
