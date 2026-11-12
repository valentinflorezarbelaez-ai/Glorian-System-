import { EosOtlpDistributedTracingCore } from "../../src/core/eosOtlpDistributedTracingCore.ts";

const HANDLERS = {};

async function cmd_trace_demo(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");

  const tracer = new EosOtlpDistributedTracingCore({
    serviceName: "glorian-system",
    serviceVersion: "75.0.0",
  });

  const rootSpan = tracer.startSpan("glorian.mission.orchestrate", {
    kind: "SERVER",
    attributes: {
      "glorian.mission.id": "MISSION-111",
      "glorian.tier": "SOVEREIGN",
    },
  });

  rootSpan.addEvent("mission.intake.accepted", { status: "OK" });

  const childSpan = tracer.startSpan("glorian.task.execute", {
    parent: {
      traceId: rootSpan.traceId,
      spanId: rootSpan.spanId,
      traceFlags: "01",
    },
    kind: "INTERNAL",
    attributes: {
      "task.type": "pure_computation",
      "task.concurrency": 4,
    },
  });

  childSpan.setStatus("OK");
  tracer.recordSpan(childSpan);

  rootSpan.setStatus("OK");
  tracer.recordSpan(rootSpan);

  const report = tracer.exportToOtlpJson();

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN OTLP DISTRIBUTED TRACE EXPORTER (SPEC-226)`);
  console.log(`===============================================================`);
  console.log(`  Spans Exported         : ${report.spansExported}`);
  console.log(`  Overflow Count         : ${report.overflowCount}`);
  console.log(`  Traceparent (Root)     : 00-${rootSpan.traceId}-${rootSpan.spanId}-01`);
  console.log(`  Receipt SHA-256        : sha256:${report.receipt}`);
  console.log(`---------------------------------------------------------------`);
  console.log(`  CANONICAL OTLP/HTTP-JSON PAYLOAD:`);
  console.log(JSON.stringify(report.payload, null, 2));
  console.log(`===============================================================\n`);
}

HANDLERS["trace:demo"] = cmd_trace_demo;
HANDLERS["trace:export"] = cmd_trace_demo;

export async function handleOtlpCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
