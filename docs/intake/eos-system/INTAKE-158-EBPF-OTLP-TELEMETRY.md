# INTAKE-158: eBPF Kernel Probe Telemetry & Zero-Dependency Native OTLP Gateway

- **Intake ID**: `INTAKE-158`
- **Change ID**: `CHANGE-158`
- **Spec Reference**: `SPEC-296`
- **Target Module**: `src/core/eosEbpfOtlpTelemetryGovernor.ts`
- **Tier**: Kernel-Space eBPF Observability & Pure OTLP Wire Protocol Gateway
- **Owner**: `user:valentin-florez-arbelaez`
- **Timestamp**: 2026-11-15T21:40:00Z
- **Status**: `INTAKE_COMPLETE`

---

## 1. Business Need & Context

Operating a sovereign software engineering control plane requires real-time, tamper-evident visibility into low-level execution without relying on simulated userland metrics or heavy external agent runtimes.
Traditional APM observability frameworks often introduce bloated npm dependencies (such as `@opentelemetry/sdk-node`, `@opentelemetry/api`, or platform-specific agents) that violate **Law V** (Zero Runtime Dependencies).
Furthermore, agentic sandboxes require kernel-level auditability (eBPF / Tetragon / Aya) to detect unauthorized system calls, network egress violations, and privilege escalation attempts at Ring 0.

Glorian System requires:

1. **eBPF Kernel Probe & Security Policy Specification**: Declarative eBPF tracepoint, kprobe, and Tetragon-style security policy synthesis for monitoring security-critical system calls (`sys_enter_execve`, `sys_enter_connect`, `sys_enter_openat`, `sys_enter_socket`).
2. **Ring Buffer Event Stream Deserialization**: Ingestion and validation of raw kernel binary/structured telemetry packets, tracking PID, TGID, UID, syscall ID, execution paths, latency, and enforcement outcomes (`ALLOW`, `AUDIT`, `SIGKILL`).
3. **Pure Layer-0 OpenTelemetry (OTLP v1) Wire Protocol**: In-process conversion of kernel events into W3C distributed trace spans and OTLP v1 `ExportTraceServiceRequest` JSON payloads without any third-party SDK.
4. **Native HTTP/HTTPS Exporter**: Zero-dependency trace dispatch to OpenTelemetry collectors (Grafana Tempo, Datadog, Jaeger, local OTel Collector sidecars) via `node:https` and native `fetch`.
5. **Cryptographic Proof Receipt**: Emits execution evidence at `docs/evidence/EBPF_OTLP_RECEIPT.json`.

---

## 2. Scope & Technical Objectives

- **Pure Layer-0 TypeScript**: Zero external runtime dependencies (`dependencies: {}`).
- **Kernel Probe Specification**: Synthesize Tetragon / Aya eBPF security policies and C-compatible kprobe definitions with SHA-256 fingerprinting.
- **Ring Buffer Event Parser**: Decode kernel ring buffer telemetry events with nanosecond resolution and identify security policy violations.
- **OTLP v1 Spans Synthesis**: Build compliant OpenTelemetry resource spans, scope spans, span kinds (INTERNAL, CLIENT, SERVER), and attributes.
- **OTLP Exporter**: Native HTTPS/HTTP exporter with configurable collector endpoint and bearer/custom authentication headers.
- **CLI Subcommands**: `toolchain:ebpf:probe`, `toolchain:ebpf:spans`, `toolchain:ebpf:export`, `toolchain:ebpf:audit`.
- **Evidence Receipt**: `docs/evidence/EBPF_OTLP_RECEIPT.json`.
