/**
 * @fileoverview Type definitions for EosDynamicToolSynthesis.
 *
 * Implements SPEC-367 / CHANGE-229: Autonomous Dynamic Tool Synthesis & JIT Skill Compiler.
 * Strict Layer-0 types with zero external runtime dependencies.
 */

export type ToolSynthesisStatus = "UNPARSED" | "SYNTHESIZED" | "TESTING" | "REGISTERED" | "REJECTED";

export type ToolSourceFormat = "OPENAPI" | "CLI_HELP" | "TYPESCRIPT_INTERFACE" | "JSON_SCHEMA";

export interface DynamicToolSpec {
  readonly name: string;
  readonly description: string;
  readonly format: ToolSourceFormat;
  readonly rawSchema: string | Record<string, unknown>;
  readonly version?: string;
}

export interface SynthesizedTool {
  readonly toolName: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly status: ToolSynthesisStatus;
  readonly handlerSource: string;
  readonly createdAt: number;
  readonly specSha256: string;
}

export interface SandboxValidationResult {
  readonly toolName: string;
  readonly passed: boolean;
  readonly exitCode: number;
  readonly executionLatencyMs: number;
  readonly outputContractValid: boolean;
  readonly errorMessage?: string;
}

export interface ToolInvocationMetric {
  readonly toolName: string;
  readonly invocationsCount: number;
  readonly lastInvokedAt: number;
  readonly averageLatencyMs: number;
  readonly errorCount: number;
}

export interface EosDynamicToolSynthesisReceipt {
  readonly receiptId: string;
  readonly specId: "SPEC-367";
  readonly changeId: "CHANGE-229";
  readonly timestamp: number;
  readonly activeDynamicToolsCount: number;
  readonly registeredTools: readonly string[];
  readonly checks: {
    readonly schemaParsingConformance: "PASS" | "FAIL";
    readonly sandboxValidationSecurity: "PASS" | "FAIL";
    readonly zeroDowntimeRegistration: "PASS" | "FAIL";
    readonly invocationTelemetry: "PASS" | "FAIL";
    readonly atomicRollbackSafety: "PASS" | "FAIL";
    readonly zeroDependencyPurity: "PASS" | "FAIL";
  };
  readonly integrityHash: string;
}
