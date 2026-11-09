import test from "node:test";
import assert from "node:assert/strict";

import { EosEbpfKernelProbeEngine } from "../src/core/eosEbpfKernelProbeEngine.ts";

test("BDD-257: Síntesis y validación de programas eBPF C para monitoreo de sockets (SPEC-091)", () => {
  const tcpProbe = EosEbpfKernelProbeEngine.generateProbe("KPROBE_TCP");

  assert.equal(tcpProbe.targetSymbol, "tcp_sendmsg");
  assert.equal(tcpProbe.license, "GPL");
  assert.ok(tcpProbe.cSource.includes('SEC("kprobe/tcp_sendmsg")'));
  assert.ok(tcpProbe.cSource.includes("BPF_MAP_TYPE_RINGBUF"));

  const audit = EosEbpfKernelProbeEngine.verifyProbeSource(tcpProbe);
  assert.equal(audit.valid, true);
  assert.equal(audit.reasons.length, 0);

  // Test sched tracepoint
  const schedProbe = EosEbpfKernelProbeEngine.generateProbe("TRACEPOINT_SCHED");
  assert.equal(schedProbe.targetSymbol, "sched_switch");
  assert.ok(schedProbe.cSource.includes('SEC("tracepoint/sched/sched_switch")'));

  // Test socket filter probe
  const socketProbe = EosEbpfKernelProbeEngine.generateProbe("SOCKET_FILTER");
  assert.equal(socketProbe.targetSymbol, "socket_filter");
  assert.ok(socketProbe.cSource.includes('SEC("socket")'));
  const socketAudit = EosEbpfKernelProbeEngine.verifyProbeSource(socketProbe);
  assert.equal(socketAudit.valid, true);

  // Negative validation tests: invalid license, invalid header, unbounded loop
  const invalidProbe = {
    ...tcpProbe,
    cSource: 'SEC("kprobe/other") int fn() { while (1) {} return 0; }',
  };
  const invalidAudit = EosEbpfKernelProbeEngine.verifyProbeSource(invalidProbe);
  assert.equal(invalidAudit.valid, false);
  assert.ok(invalidAudit.reasons.some((r) => r.includes("license")));
  assert.ok(invalidAudit.reasons.some((r) => r.includes("Missing valid section header")));
  assert.ok(invalidAudit.reasons.some((r) => r.includes("Unbounded loops")));

  // Another loop variant: for (;;)
  const forLoopProbe = {
    ...tcpProbe,
    cSource: 'SEC("socket") int fn() { for (;;) {} return 0; } SEC("license") = "GPL";',
  };
  const forLoopAudit = EosEbpfKernelProbeEngine.verifyProbeSource(forLoopProbe);
  assert.equal(forLoopAudit.valid, false);
  assert.ok(forLoopAudit.reasons.some((r) => r.includes("Unbounded loops")));
});

test("BDD-258: Deserialización y procesamiento de eventos de Ring Buffer del kernel (SPEC-091)", () => {
  // Construct a 28-byte raw buffer simulating kernel event_t
  const buf = Buffer.alloc(28);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // PID = 4200
  view.setUint32(0, 4200, true);
  // Timestamp = 1730382000123456789n
  view.setBigUint64(4, 1730382000123456789n, true);
  // Function code = 0x54435001
  view.setUint32(12, 0x54435001, true);
  // Payload bytes = 1460 (standard TCP MSS)
  view.setUint32(16, 1460, true);
  // Latency = 850 ns
  view.setBigUint64(20, 850n, true);

  const event = EosEbpfKernelProbeEngine.decodeRingBufferEvent(buf);

  assert.equal(event.pid, 4200);
  assert.equal(event.timestampNs, 1730382000123456789n);
  assert.equal(event.functionCode, 0x54435001);
  assert.equal(event.payloadBytes, 1460);
  assert.equal(event.latencyNs, 850);

  // Precondition failure on undersized buffer (< 28 bytes)
  const smallBuf = Buffer.alloc(20);
  assert.throws(
    () => EosEbpfKernelProbeEngine.decodeRingBufferEvent(smallBuf),
    /Event buffer must be at least 28 bytes/,
  );
});
