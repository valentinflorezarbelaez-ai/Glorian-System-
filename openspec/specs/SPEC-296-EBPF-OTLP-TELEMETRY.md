# SPEC-296: eBPF Kernel Probe Telemetry & Zero-Dependency Native OTLP Gateway

- **Specification ID**: `SPEC-296`
- **Change ID**: `CHANGE-158`
- **Status**: `APPROVED`
- **Module**: `src/core/eosEbpfOtlpTelemetryGovernor.ts`
- **Tier**: Kernel-Space eBPF Observability & Pure OTLP Wire Protocol Gateway
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-296-01 (Event-Driven eBPF Probe & Tetragon Policy Generation)**: WHEN an eBPF observability probe or security policy is requested, THE SYSTEM SHALL synthesize declarative C-compatible probe source and Tetragon YAML/JSON security policies targeting security-critical system calls (`sys_enter_execve`, `sys_enter_connect`, `sys_enter_openat`, `sys_enter_socket`).
- **FR-296-02 (State-Driven Kernel Ring Buffer Telemetry Event Decoding)**: MIENTRAS raw ring buffer binary or structured events are received, THE SYSTEM SHALL decode timestamp (ns), PID, TGID, UID, syscall ID, execution paths, arguments, and evaluate compliance against active security rules.
- **FR-296-03 (Error / Unwanted Condition: Syscall Security Policy Violation & Mitigation)**: SI an event matches a forbidden action (unauthorized network connect or untrusted binary execution), ENTONCES EL SISTEMA SHALL flag the event with a security verdict (`BLOCK` or `SIGKILL`), identify the violation policy rule, and prevent propagation.
- **FR-296-04 (Ubiquitous Layer-0 OTLP v1 Distributed Trace Synthesis)**: EL SISTEMA SHALL serialize telemetry events into compliant OpenTelemetry v1 `ExportTraceServiceRequest` JSON payloads with W3C 128-bit trace IDs, 64-bit span IDs, and canonical attributes without third-party npm packages.
- **FR-296-05 (Event-Driven Zero-Dependency Native HTTP Export)**: WHEN trace export is triggered, THE SYSTEM SHALL transmit OTLP JSON payloads to the configured collector endpoint via native `node:https` / `node:http` or native `fetch` with configurable timeout and authorization headers.
- **FR-296-06 (Cryptographic Proof Receipt)**: WHEN an eBPF telemetry audit completes, THE SYSTEM SHALL emit a verification receipt at `docs/evidence/EBPF_OTLP_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1551 Declarative eBPF Probe and Tetragon Security Policy Synthesis
  GIVEN an observability profile for sandbox isolation
  WHEN EbpfProbeSpecificationGenerator synthesizes probe code and Tetragon security policy
  THEN it emits valid eBPF C kprobe/tracepoint hooks for sys_enter_execve, sys_enter_connect, sys_enter_openat
  AND synthesizes a Tetragon TracingPolicy specification with binary execution restrictions and SHA-256 fingerprint.

SCENARIO: BDD-1552 Kernel Ring Buffer Binary & Structured Event Stream Decoding
  GIVEN a binary or structured kernel ring buffer payload
  WHEN KernelRingBufferTelemetryDecoder decodes the buffer
  THEN it extracts pid, tgid, uid, syscallId, path, destinationAddress, and nanosecond latency
  AND preserves monotonic event ordering across stream items.

SCENARIO: BDD-1553 Syscall Security Policy Violation Detection and Fail-Closed Verdict
  GIVEN an active security policy forbidding outbound network connects from container processes
  WHEN an event with syscall "sys_enter_connect" to an external IP is processed
  THEN KernelRingBufferTelemetryDecoder evaluates the verdict as BLOCK or SIGKILL
  AND identifies the violated security policy rule with zero unhandled escapes.

SCENARIO: BDD-1554 Layer-0 OpenTelemetry OTLP v1 Span Serialization with W3C Context
  GIVEN a sequence of decoded kernel telemetry events
  WHEN OtlpTracePayloadBuilder converts events into OTLP v1 format
  THEN it generates valid resourceSpans containing service.name, telemetry.sdk.language="nodejs"
  AND generates scopeSpans with 32-hex traceId, 16-hex spanId, valid start/end timestamps, and semantic attributes.

SCENARIO: BDD-1555 Native HTTP/HTTPS Exporter Dispatch with Custom Headers & Retries
  GIVEN a serialized OTLP trace payload and target OpenTelemetry collector URL
  WHEN NativeOtlpHttpExporter dispatches the payload
  THEN it transmits the payload using native node:https/node:http without third-party dependencies
  AND handles collector responses with status code 200/202, returning transmission receipts.

SCENARIO: BDD-1556 Cryptographic eBPF OTLP Audit Receipt Generation
  GIVEN an audit executed via toolchain:ebpf:audit or auditEbpfTelemetryPipeline
  WHEN the audit completes
  THEN docs/evidence/EBPF_OTLP_RECEIPT.json is written
  AND contains probesGenerated, eventsDecoded, violationsBlocked, otlpSpansExported, and a valid sha256Signature.
```
