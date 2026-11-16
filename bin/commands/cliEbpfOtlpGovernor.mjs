/**
 * CLI eBPF Kernel Probe Telemetry & Native OTLP Gateway Handlers
 *
 * Implements toolchain:ebpf:* subcommands for Ring-0 kernel probe synthesis,
 * ring buffer telemetry event decoding, OTLP v1 span projection, and audit receipts.
 *
 * Conforms to SPEC-296 / CHANGE-158.
 */

import {
  EbpfProbeSpecificationGenerator,
  KernelRingBufferTelemetryDecoder,
  OtlpTracePayloadBuilder,
  NativeOtlpHttpExporter,
  auditEbpfTelemetryPipeline,
} from "../../src/core/eosEbpfOtlpTelemetryGovernor.ts";

const HANDLERS = {};

async function cmd_ebpf_probe(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const syscall = args.find((a) => a.startsWith("sys_enter_")) || "sys_enter_execve";

  const probe = EbpfProbeSpecificationGenerator.generateProbe(syscall);

  if (isJson) {
    console.log(JSON.stringify(probe, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔬  EOS eBPF KERNEL PROBE & TETRAGON POLICY SPEC (SPEC-296)  ");
  console.log("===============================================================");
  console.log(`  Syscall Target      : ${probe.syscall}`);
  console.log(`  Hook Type           : ${probe.hookType}`);
  console.log(`  Kernel Target Symbol: ${probe.targetSymbol}`);
  console.log(`  Ring Buffer Name    : ${probe.ringBufferName}`);
  console.log(`  SHA-256 Digest      : ${probe.sha256Digest}`);
  console.log("---------------------------------------------------------------");
  console.log("  C Source Preview (First 4 lines):");
  const lines = probe.cSource.split("\n").slice(0, 4);
  lines.forEach((l) => console.log(`    ${l}`));
  console.log("===============================================================\n");
}

async function cmd_ebpf_spans(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  // Ingest sample telemetry events and build OTLP payload
  const events = [
    KernelRingBufferTelemetryDecoder.decodeStructuredEvent({
      syscall: "sys_enter_execve",
      path: "/usr/local/bin/node",
      pid: 2468,
      tgid: 2468,
    }),
    KernelRingBufferTelemetryDecoder.decodeStructuredEvent({
      syscall: "sys_enter_openat",
      path: "/workspace/src/core/index.ts",
      pid: 2468,
      tgid: 2468,
    }),
  ];

  const payload = OtlpTracePayloadBuilder.eventsToOtlpSpans(events);

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const spans = payload.resourceSpans[0].scopeSpans[0].spans;
  console.log("\n===============================================================");
  console.log(" 📡  EOS LAYER-0 OPENTELEMETRY (OTLP v1) SPANS (SPEC-296)     ");
  console.log("===============================================================");
  console.log(`  Resource Service    : ${payload.resourceSpans[0].resource.attributes[0].value.stringValue}`);
  console.log(`  Total Spans Built   : ${spans.length}`);
  spans.forEach((s, idx) => {
    console.log(
      `  [Span ${idx + 1}] TraceID=${s.traceId} SpanID=${s.spanId} Name=${s.name} Status=${s.status.code === 1 ? "OK" : "ERROR"}`,
    );
  });
  console.log("===============================================================\n");
}

async function cmd_ebpf_export(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const endpointArg = args.find((a) => a.startsWith("http://") || a.startsWith("https://"));

  const events = [
    KernelRingBufferTelemetryDecoder.decodeStructuredEvent({
      syscall: "sys_enter_execve",
      path: "/usr/bin/git",
      pid: 3000,
    }),
  ];

  const payload = OtlpTracePayloadBuilder.eventsToOtlpSpans(events);
  const result = await NativeOtlpHttpExporter.exportTracePayload(payload, {
    endpoint: endpointArg,
    timeoutMs: 2000,
  });

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🚀  EOS NATIVE OTLP HTTP DISPATCH RESULT (SPEC-296)           ");
  console.log("===============================================================");
  console.log(`  Target Collector    : ${result.endpoint}`);
  console.log(`  Spans Transmitted   : ${result.spanCount}`);
  console.log(`  HTTP Status Code    : ${result.statusCode}`);
  console.log(`  Export Status       : ${result.exported ? "SUCCESS (2xx)" : "FALLBACK / OFFLINE"}`);
  if (result.error) {
    console.log(`  Diagnostic Note     : ${result.error}`);
  }
  console.log("===============================================================\n");
}

async function cmd_ebpf_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = await auditEbpfTelemetryPipeline(process.cwd());

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔒  EOS eBPF TELEMETRY & OTLP AUDIT RECEIPT (SPEC-296)        ");
  console.log("===============================================================");
  console.log(`  Specification       : ${receipt.specId}`);
  console.log(`  Probes Generated    : ${receipt.probesGenerated}`);
  console.log(`  Events Decoded      : ${receipt.eventsDecoded}`);
  console.log(`  Violations Blocked  : ${receipt.violationsBlocked}`);
  console.log(`  OTLP Spans Exported : ${receipt.otlpSpansExported}`);
  console.log(`  Collector Endpoint  : ${receipt.collectorEndpoint}`);
  console.log(`  SHA-256 Receipt Seal: ${receipt.sha256Signature}`);
  console.log("===============================================================\n");
}

HANDLERS["toolchain:ebpf:probe"] = cmd_ebpf_probe;
HANDLERS["toolchain:ebpf:spans"] = cmd_ebpf_spans;
HANDLERS["toolchain:ebpf:export"] = cmd_ebpf_export;
HANDLERS["toolchain:ebpf:audit"] = cmd_ebpf_audit;

export async function handleEbpfCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    return false;
  }
  await handler(commandContext);
  return true;
}
