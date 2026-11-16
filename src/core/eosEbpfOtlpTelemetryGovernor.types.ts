/**
 * EOS SYSTEM — eBPF KERNEL PROBE TELEMETRY & ZERO-DEPENDENCY NATIVE OTLP GATEWAY (TYPES)
 * Governed by SPEC-296, CHANGE-158, IEEE 830 EARS, BDD-1551..1556
 *
 * Provides typed data contracts for Ring-0 eBPF kernel probe synthesis, Tetragon security
 * policies, ring buffer telemetry decoding, and pure Layer-0 OpenTelemetry (OTLP v1) exports.
 * Zero external runtime npm dependencies (Law V).
 */

export type EbpfGovSyscall = "sys_enter_execve" | "sys_enter_connect" | "sys_enter_openat" | "sys_enter_socket";

export type EbpfGovVerdict = "ALLOW" | "AUDIT" | "BLOCK" | "SIGKILL";

export interface EbpfGovProbeSpec {
  readonly syscall: EbpfGovSyscall;
  readonly hookType: "kprobe" | "tracepoint";
  readonly targetSymbol: string;
  readonly cSource: string;
  readonly ringBufferName: string;
  readonly tetragonPolicy: Record<string, unknown>;
  readonly sha256Digest: string;
}

export interface EbpfGovDecodedEvent {
  readonly eventId: string;
  readonly timestampNs: bigint;
  readonly pid: number;
  readonly tgid: number;
  readonly uid: number;
  readonly syscall: EbpfGovSyscall;
  readonly path?: string;
  readonly destinationAddress?: string;
  readonly destinationPort?: number;
  readonly durationNs: number;
  readonly verdict: EbpfGovVerdict;
  readonly violatedRule?: string;
}

export interface EbpfGovSecurityPolicy {
  readonly policyName: string;
  readonly blockedSyscalls?: readonly EbpfGovSyscall[];
  readonly blockedPaths?: readonly string[];
  readonly blockedDestinations?: readonly string[];
  readonly defaultVerdict: EbpfGovVerdict;
}

export interface EbpfGovOtlpAttribute {
  readonly key: string;
  readonly value: {
    readonly stringValue?: string;
    readonly intValue?: string;
    readonly boolValue?: boolean;
    readonly doubleValue?: number;
  };
}

export interface EbpfGovOtlpSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: number; // 1 = INTERNAL, 2 = SERVER, 3 = CLIENT
  readonly startTimeUnixNano: string;
  readonly endTimeUnixNano: string;
  readonly attributes: readonly EbpfGovOtlpAttribute[];
  readonly status: {
    readonly code: number; // 0 = UNSET, 1 = OK, 2 = ERROR
    readonly message?: string;
  };
}

export interface EbpfGovOtlpPayload {
  readonly resourceSpans: ReadonlyArray<{
    readonly resource: {
      readonly attributes: readonly EbpfGovOtlpAttribute[];
    };
    readonly scopeSpans: ReadonlyArray<{
      readonly scope: {
        readonly name: string;
        readonly version: string;
      };
      readonly spans: readonly EbpfGovOtlpSpan[];
    }>;
  }>;
}

export interface EbpfGovExportOptions {
  readonly endpoint?: string;
  readonly headers?: Record<string, string>;
  readonly timeoutMs?: number;
}

export interface EbpfGovExportResult {
  readonly exported: boolean;
  readonly spanCount: number;
  readonly endpoint: string;
  readonly statusCode: number;
  readonly traceId: string;
  readonly error?: string;
}

export interface EbpfGovAuditReceipt {
  readonly specId: "SPEC-296";
  readonly changeId: "CHANGE-158";
  readonly timestamp: string;
  readonly probesGenerated: number;
  readonly eventsDecoded: number;
  readonly violationsBlocked: number;
  readonly otlpSpansExported: number;
  readonly collectorEndpoint: string;
  readonly sha256Signature: string;
}
