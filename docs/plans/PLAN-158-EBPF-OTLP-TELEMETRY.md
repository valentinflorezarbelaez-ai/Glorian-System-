# PLAN-158: eBPF Kernel Probe Telemetry & Zero-Dependency Native OTLP Gateway

- **Plan ID**: `PLAN-158`
- **Change ID**: `CHANGE-158`
- **Spec Reference**: `SPEC-296`
- **Status**: `APPROVED`
- **Target Module**: `src/core/eosEbpfOtlpTelemetryGovernor.ts`
- **Tier**: Kernel-Space eBPF Observability & Pure OTLP Wire Protocol Gateway
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Architectural Strategy

The eBPF Kernel Probe Telemetry & Zero-Dependency Native OTLP Gateway provides real-time, low-level execution observability and security enforcement for Glorian System's agent sandboxes, microVMs, and workflow steps without introducing bloated third-party APM packages.

### Pure Layer-0 Architecture (Law V)

1. **eBPF Probe & Tetragon Policy Generator (`EbpfProbeSpecificationGenerator`)**:
   - Synthesizes declarative C-compatible eBPF probes for Linux kprobes and tracepoints targeting security-critical system calls:
     - `sys_enter_execve`: Monitors process creation, detecting unauthorized shells or binaries.
     - `sys_enter_connect`: Monitors network socket connection attempts, catching sandbox network egress.
     - `sys_enter_openat`: Monitors file opens, flagging sensitive credential/system file access.
     - `sys_enter_socket`: Monitors socket allocations.
   - Synthesizes Tetragon-compatible YAML/JSON TracingPolicy definitions with action directives (`ALLOW`, `AUDIT`, `SIGKILL`).
   - Computes SHA-256 integrity digests for all synthesized probe specifications.

2. **Kernel Ring Buffer Event Stream Decoder (`KernelRingBufferTelemetryDecoder`)**:
   - Zero-copy deserialization of structured kernel event records from eBPF ring buffers.
   - Decodes monotonic nanosecond timestamps, process IDs (PID, TGID, UID), syscall identifiers, arguments (executable paths, IP addresses, ports), and execution duration.
   - Evaluates incoming events against active security policies, immediately marking unauthorized actions with `BLOCK` or `SIGKILL` verdicts.

3. **Layer-0 OpenTelemetry (OTLP v1) Span Serializer (`OtlpTracePayloadBuilder`)**:
   - Formats decoded kernel events into standard OpenTelemetry v1 `ExportTraceServiceRequest` JSON payloads without `@opentelemetry/sdk-node`.
   - Generates compliant 128-bit W3C hex trace IDs (32 chars) and 64-bit span IDs (16 chars).
   - Maps kernel execution telemetry to OpenTelemetry semantic conventions (`process.pid`, `process.executable.path`, `net.peer.name`, `net.peer.port`, `ebpf.syscall.name`, `ebpf.action`).

4. **Zero-Dependency Native HTTP Exporter (`NativeOtlpHttpExporter`)**:
   - Directly transmits OTLP trace payloads to OpenTelemetry collector endpoints (Grafana Tempo, Datadog, Jaeger, local OTel Collector sidecars) using `node:https` and native `fetch`.
   - Supports custom headers (Authorization Bearer tokens, tenant IDs), configurable timeouts, and graceful offline fallback.

5. **Cryptographic Proof Receipt**:
   - Emits verification metadata at `docs/evidence/EBPF_OTLP_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Component Design & Interfaces

```typescript
export type EbpfSyscallType =
  "sys_enter_execve" | "sys_enter_connect" | "sys_enter_openat" | "sys_enter_socket";

export type EbpfEnforcementAction = "ALLOW" | "AUDIT" | "BLOCK" | "SIGKILL";

export interface EbpfProbeDefinition {
  readonly syscall: EbpfSyscallType;
  readonly hookType: "kprobe" | "tracepoint";
  readonly targetSymbol: string;
  readonly cSource: string;
  readonly tetragonPolicy: Record<string, unknown>;
  readonly sourceSha256: string;
}

export interface DecodedKernelEvent {
  readonly eventId: string;
  readonly timestampNs: bigint;
  readonly pid: number;
  readonly tgid: number;
  readonly uid: number;
  readonly syscall: EbpfSyscallType;
  readonly path?: string;
  readonly destinationAddress?: string;
  readonly destinationPort?: number;
  readonly durationNs: number;
  readonly verdict: EbpfEnforcementAction;
  readonly violatedRule?: string;
}

export interface OtlpExportResult {
  readonly exported: boolean;
  readonly spanCount: number;
  readonly endpoint: string;
  readonly statusCode: number;
  readonly traceId: string;
}
```

---

## 3. Execution Plan

1. Define types in `src/core/eosEbpfOtlpTelemetryGovernor.types.ts`.
2. Implement core engine in `src/core/eosEbpfOtlpTelemetryGovernor.ts` ($\le 450$ lines).
3. Export from `src/core/index.ts` and verify with `npm run typecheck`.
4. Create CLI commands in `bin/commands/cliEbpfOtlpGovernor.mjs` and wire delegation into `bin/commands/cliToolchainRouter.mjs`.
5. Register in `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md`.
6. Write test suite in `test/eosEbpfOtlpTelemetryGovernor.test.mjs` validating BDD-1551..1556.
7. Run `node scripts/tip-refresh.mjs` and seal the pin.
