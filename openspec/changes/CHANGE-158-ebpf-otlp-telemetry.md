# CHANGE-158: eBPF Kernel Probe Telemetry & Zero-Dependency Native OTLP Gateway

- **Change ID**: `CHANGE-158`
- **Spec Reference**: `SPEC-296`
- **Status**: `PROPOSED`
- **Target Module**: `src/core/eosEbpfOtlpTelemetryGovernor.ts`
- **Tier**: Kernel-Space eBPF Observability & Pure OTLP Wire Protocol Gateway
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Intent & Architectural Justification

Provide high-fidelity, real-time kernel observability and distributed tracing for agent sandboxes and microVMs without compromising Law V (Zero Runtime NPM Dependencies).
By pairing declarative eBPF syscall filtering (Tetragon / Aya model) with a pure Layer-0 OpenTelemetry (OTLP v1) HTTP/JSON wire protocol exporter, Glorian System monitors security-critical kernel events at Ring 0, enforces syscall boundaries (blocking unauthorized sockets or binary executions), and streams standard W3C distributed trace spans directly to OpenTelemetry collectors (Grafana Tempo, Datadog, Jaeger) using native `node:https`.

---

## 2. Capabilities & Deliverables

1. `src/core/eosEbpfOtlpTelemetryGovernor.types.ts` & `src/core/eosEbpfOtlpTelemetryGovernor.ts`:
   - `EbpfProbeSpecificationGenerator`: Synthesizes declarative eBPF probe policies (tracing `sys_enter_execve`, `sys_enter_connect`, `sys_enter_openat`, `sys_enter_socket`) and Tetragon security profiles with SHA-256 fingerprinting.
   - `KernelRingBufferTelemetryDecoder`: Zero-copy deserialization of binary/structured kernel telemetry events, tracking PID, TGID, UID, syscall ID, arguments, latency, and enforcement verdicts.
   - `OtlpTracePayloadBuilder`: Converts kernel events into compliant OTLP v1 `ExportTraceServiceRequest` JSON payloads with W3C trace/span IDs and canonical attributes.
   - `NativeOtlpHttpExporter`: Emits OTLP JSON trace batches to configured OpenTelemetry collectors via `node:https` and native `fetch` with optional authentication.
   - `auditEbpfTelemetryPipeline`: End-to-end verification of probe generation, event decoding, OTLP serialization, security violation detection, and receipt emission.
2. CLI subcommands in `bin/commands/cliEbpfOtlpGovernor.mjs` and delegation in `bin/commands/cliToolchainRouter.mjs`:
   - `toolchain:ebpf:probe`: Inspects or generates declarative eBPF probe and Tetragon security profiles.
   - `toolchain:ebpf:spans`: Ingests kernel ring buffer events and projects them into OTLP spans.
   - `toolchain:ebpf:export`: Emits formatted OTLP payloads to an OpenTelemetry collector endpoint via native HTTP.
   - `toolchain:ebpf:audit`: Audits active syscall compliance against security policies and emits cryptographic receipt.
3. BDD test suite: `test/eosEbpfOtlpTelemetryGovernor.test.mjs` verifying BDD-1551..1556.
4. Cryptographic receipt: `docs/evidence/EBPF_OTLP_RECEIPT.json`.
