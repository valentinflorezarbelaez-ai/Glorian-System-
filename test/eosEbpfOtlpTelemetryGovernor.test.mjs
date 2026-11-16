/**
 * BDD Test Suite for SPEC-296 / CHANGE-158:
 * eBPF Kernel Probe Telemetry & Zero-Dependency Native OTLP Gateway
 *
 * Verifies BDD-1551..BDD-1556.
 */

import { test, describe } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";
import {
  EbpfProbeSpecificationGenerator,
  KernelRingBufferTelemetryDecoder,
  OtlpTracePayloadBuilder,
  NativeOtlpHttpExporter,
  auditEbpfTelemetryPipeline,
  DEFAULT_EBPF_POLICIES,
} from "../src/core/eosEbpfOtlpTelemetryGovernor.ts";

describe("SPEC-296: eBPF Kernel Probe Telemetry & Zero-Dependency Native OTLP Gateway", () => {
  // BDD-1551
  test("BDD-1551: Declarative eBPF Probe and Tetragon Security Policy Synthesis", () => {
    const probe = EbpfProbeSpecificationGenerator.generateProbe("sys_enter_execve");

    assert.equal(probe.syscall, "sys_enter_execve");
    assert.equal(probe.hookType, "tracepoint");
    assert.equal(probe.targetSymbol, "__x64_sys_execve");
    assert.ok(probe.cSource.includes("#include <linux/bpf.h>"));
    assert.ok(probe.cSource.includes('SEC("tracepoint/sys_enter_execve")'));
    assert.ok(probe.tetragonPolicy);
    assert.equal(probe.tetragonPolicy.spec.kprobes[0].call, "__x64_sys_execve");

    assert.equal(typeof probe.sha256Digest, "string");
    assert.equal(probe.sha256Digest.length, 64);

    const allProbes = EbpfProbeSpecificationGenerator.generateAllProbes();
    assert.equal(allProbes.length, 4);
    assert.ok(allProbes.every((p) => p.sha256Digest.length === 64));
  });

  // BDD-1552
  test("BDD-1552: Kernel Ring Buffer Binary & Structured Event Stream Decoding", () => {
    // 1. Structured decoding
    const structured = KernelRingBufferTelemetryDecoder.decodeStructuredEvent({
      syscall: "sys_enter_openat",
      path: "/usr/lib/libc.so",
      pid: 4096,
      tgid: 4096,
      uid: 1000,
      durationNs: 850,
    });

    assert.equal(structured.syscall, "sys_enter_openat");
    assert.equal(structured.path, "/usr/lib/libc.so");
    assert.equal(structured.pid, 4096);
    assert.equal(structured.durationNs, 850);
    assert.equal(structured.verdict, "ALLOW");

    // 2. Binary buffer decoding
    // Layout: timestampNs(8), pid(4), tgid(4), uid(4), syscallCode(2), path(string)
    const buf = Buffer.alloc(48);
    buf.writeBigUInt64LE(1700000000000000000n, 0);
    buf.writeUInt32LE(5001, 8);
    buf.writeUInt32LE(5001, 12);
    buf.writeUInt32LE(0, 16);
    buf.writeUInt16LE(1, 20); // 1 = sys_enter_execve
    buf.write("/bin/bash\0", 24, "utf8");

    const decoded = KernelRingBufferTelemetryDecoder.decodeBinaryEvent(buf, DEFAULT_EBPF_POLICIES.PERMISSIVE_OBSERVE);
    assert.equal(decoded.pid, 5001);
    assert.equal(decoded.syscall, "sys_enter_execve");
    assert.equal(decoded.path, "/bin/bash");
    assert.equal(decoded.verdict, "AUDIT");
  });

  // BDD-1553
  test("BDD-1553: Syscall Security Policy Violation Detection and Fail-Closed Verdict", () => {
    // Blocked connect syscall
    const blockedConnect = KernelRingBufferTelemetryDecoder.decodeStructuredEvent(
      {
        syscall: "sys_enter_connect",
        destinationAddress: "169.254.169.254",
        destinationPort: 80,
      },
      DEFAULT_EBPF_POLICIES.STRICT_SANDBOX,
    );

    assert.equal(blockedConnect.verdict, "BLOCK");
    assert.ok(blockedConnect.violatedRule?.includes("sys_enter_connect"));

    // Sensitive path violation triggering SIGKILL
    const killedPath = KernelRingBufferTelemetryDecoder.decodeStructuredEvent(
      {
        syscall: "sys_enter_openat",
        path: "/etc/shadow",
      },
      DEFAULT_EBPF_POLICIES.STRICT_SANDBOX,
    );

    assert.equal(killedPath.verdict, "SIGKILL");
    assert.ok(killedPath.violatedRule?.includes("/etc/shadow"));
  });

  // BDD-1554
  test("BDD-1554: Layer-0 OpenTelemetry OTLP v1 Span Serialization with W3C Context", () => {
    const events = [
      KernelRingBufferTelemetryDecoder.decodeStructuredEvent({
        syscall: "sys_enter_execve",
        path: "/bin/ls",
        pid: 7777,
      }),
      KernelRingBufferTelemetryDecoder.decodeStructuredEvent({
        syscall: "sys_enter_connect",
        destinationAddress: "10.0.0.1",
        destinationPort: 443,
        pid: 7777,
      }),
    ];

    const fixedTraceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const payload = OtlpTracePayloadBuilder.eventsToOtlpSpans(events, "test-service", fixedTraceId);

    assert.equal(payload.resourceSpans.length, 1);
    const rs = payload.resourceSpans[0];
    const serviceAttr = rs.resource.attributes.find((a) => a.key === "service.name");
    assert.equal(serviceAttr?.value.stringValue, "test-service");

    const spans = rs.scopeSpans[0].spans;
    assert.equal(spans.length, 2);
    assert.equal(spans[0].traceId, fixedTraceId);
    assert.equal(spans[0].name, "ebpf/sys_enter_execve");
    assert.equal(spans[0].kind, 1);
    assert.equal(spans[0].spanId.length, 16);
    assert.ok(spans[0].startTimeUnixNano.length > 10);
    assert.equal(spans[0].status.code, 1); // ALLOW is OK status
    assert.equal(spans[1].status.code, 2); // BLOCK is error status
  });

  // BDD-1555
  test("BDD-1555: Native HTTP/HTTPS Exporter Dispatch with Custom Headers & Retries", async () => {
    // Spin up local mock HTTP collector server
    let receivedPayload = null;
    let authHeader = undefined;

    const server = http.createServer((req, res) => {
      authHeader = req.headers["authorization"];
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        receivedPayload = JSON.parse(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ partialSuccess: {} }));
      });
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const port = server.address().port;
    const testEndpoint = `http://127.0.0.1:${port}/v1/traces`;

    try {
      const event = KernelRingBufferTelemetryDecoder.decodeStructuredEvent({
        syscall: "sys_enter_openat",
        path: "/var/log/app.log",
      });
      const payload = OtlpTracePayloadBuilder.eventsToOtlpSpans([event]);

      const result = await NativeOtlpHttpExporter.exportTracePayload(payload, {
        endpoint: testEndpoint,
        headers: { Authorization: "Bearer test-otel-token" },
        timeoutMs: 2000,
      });

      assert.equal(result.exported, true);
      assert.equal(result.statusCode, 200);
      assert.equal(result.spanCount, 1);
      assert.equal(authHeader, "Bearer test-otel-token");
      assert.ok(receivedPayload);
      assert.equal(receivedPayload.resourceSpans[0].scopeSpans[0].spans[0].name, "ebpf/sys_enter_openat");
    } finally {
      server.close();
    }
  });

  // BDD-1556
  test("BDD-1556: Cryptographic eBPF OTLP Audit Receipt Generation", async () => {
    const receipt = await auditEbpfTelemetryPipeline(process.cwd());

    assert.equal(receipt.specId, "SPEC-296");
    assert.equal(receipt.changeId, "CHANGE-158");
    assert.equal(receipt.probesGenerated, 4);
    assert.equal(receipt.eventsDecoded, 3);
    assert.equal(receipt.violationsBlocked, 2);
    assert.equal(receipt.otlpSpansExported, 3);
    assert.ok(receipt.sha256Signature.length === 64);

    const receiptPath = path.join(process.cwd(), "docs", "evidence", "EBPF_OTLP_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath));
    const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(saved.specId, "SPEC-296");
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });
});
