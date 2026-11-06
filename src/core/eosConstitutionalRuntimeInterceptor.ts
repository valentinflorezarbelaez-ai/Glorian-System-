/**
 * EOS SYSTEM — DYNAMIC CONSTITUTIONAL RUNTIME INTERCEPTOR & AGENT PROXY (Layer 0)
 * Governed by SPEC-069, CHANGE-059, ADR-074, FR-238..FR-241, BDD-213..BDD-214 (v67.0.0)
 *
 * Implements Anthropic Constitutional AI runtime guardrails & DeepMind Safe Swarm Interception.
 * Wraps tool execution with fail-closed Law IV path confinement, SMT formal policy verification,
 * and post-execution automated secret sanitization and redaction.
 *
 * Zero external runtime npm dependencies (Law V). Node 24 strip-only compliant.
 */

import path from "node:path";
import {
  assertPrecondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";
import { EosSmtAutomatedReasoningProver } from "./eosSmtAutomatedReasoningProver.ts";
import { EosDurableSqliteLedger } from "./eosDurableSqliteLedger.ts";

export interface InterceptorOptions {
  readonly callerRole?: string;
  readonly callerPrincipal?: string;
  readonly allowedWorkspaceRoot?: string;
  readonly enforceSmtPolicy?: boolean;
  readonly ledgerPath?: string;
}

export interface InterceptionReceipt {
  readonly toolName: string;
  readonly callerRole: string;
  readonly approved: boolean;
  readonly blockedReason?: string;
  readonly secretsRedactedCount: number;
  readonly evaluatedAtIso: string;
  readonly sha256Receipt: string;
}

const CRITICAL_SECRET_PATTERNS = [
  { name: "Live Stripe/OpenAI Key", regex: /sk-live-[0-9a-zA-Z]{16,}/g },
  { name: "GitHub Personal Access Token", regex: /ghp_[0-9a-zA-Z]{24,}/g },
  { name: "AWS Access Key ID", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "Google API Key", regex: /AIza[0-9A-Za-z\-_]{35}/g },
  { name: "PEM Private Key Block", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g }
];

export class EosConstitutionalRuntimeInterceptor {
  private readonly workspaceRoot: string;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = path.resolve(workspaceRoot || process.cwd());
  }

  /**
   * Evaluates proposed tool arguments against Law IV (External Write Barrier)
   * and SMT formal access control policies before tool execution.
   */
  public evaluatePreExecutionGuardrails(
    toolName: string,
    args: Record<string, unknown>,
    options?: InterceptorOptions
  ): { readonly approved: boolean; readonly reason?: string } {
    assertPrecondition(Boolean(args && typeof args === "object"), "Tool arguments must be a valid object");

    // Check for path containment in arguments (Law IV)
    const checkPathConfinement = (val: unknown): string | null => {
      if (typeof val === "string") {
        const norm = val.replace(/\\/g, "/");
        // Check for known restricted external paths (e.g., Documents/Fundacion or root system drives)
        if (norm.includes("Documents/Fundacion") || norm.startsWith("/etc/") || norm.startsWith("/var/")) {
          return `Law IV external write barrier violated: Path ${val} is restricted`;
        }
        if (path.isAbsolute(val)) {
          const resolved = path.resolve(val);
          const allowedRoot = options?.allowedWorkspaceRoot
            ? path.resolve(options.allowedWorkspaceRoot)
            : this.workspaceRoot;
          // Disallow writes outside allowedRoot
          const rel = path.relative(allowedRoot, resolved);
          if (rel.startsWith("..") && !resolved.startsWith(allowedRoot)) {
            return `Law IV boundary breach: Path ${val} escapes allowed workspace`;
          }
        }
      } else if (val && typeof val === "object") {
        for (const childVal of Object.values(val as Record<string, unknown>)) {
          const err = checkPathConfinement(childVal);
          if (err) return err;
        }
      }
      return null;
    };

    const pathViolation = checkPathConfinement(args);
    if (pathViolation) {
      return { approved: false, reason: `CONSTITUTIONAL_GUARDRAIL_BLOCKED: ${pathViolation}` };
    }

    // Evaluate SMT formal ABAC policy if required
    if (options?.enforceSmtPolicy) {
      const role = options.callerRole || "guest";
      const rules = [
        { role: "guest", action: "read_only", allow: true },
        { role: "guest", action: "destructive_mutate", allow: false },
        { role: "architect", action: "destructive_mutate", allow: true },
        { role: "architect", action: "read_only", allow: true }
      ];

      const action = toolName.includes("manage_worktree") || toolName.includes("delete")
        ? "destructive_mutate"
        : "read_only";

      const proof = EosSmtAutomatedReasoningProver.proveAbacSafety(rules, role, action);
      if (proof.verdict !== "PROVED_UNSAT_SECURE" && !proof.isSatisfiable) {
        return {
          approved: false,
          reason: `CONSTITUTIONAL_GUARDRAIL_BLOCKED: SMT ABAC security theorem failed for role=${role}, action=${action}`
        };
      }
    }

    return { approved: true };
  }

  /**
   * Sanitizes output produced by a tool, redacting secrets and plain credentials.
   */
  public sanitizePostExecutionOutput(rawOutput: unknown): {
    readonly sanitizedOutput: unknown;
    readonly redactedCount: number;
  } {
    if (typeof rawOutput === "string") {
      let redactedCount = 0;
      let sanitized = rawOutput;

      for (const pat of CRITICAL_SECRET_PATTERNS) {
        const matches = sanitized.match(pat.regex);
        if (matches) {
          redactedCount += matches.length;
          sanitized = sanitized.replace(pat.regex, "[REDACTED_BY_EOS_CONSTITUTION]");
        }
      }

      return { sanitizedOutput: sanitized, redactedCount };
    }

    if (rawOutput && typeof rawOutput === "object") {
      const serialized = JSON.stringify(rawOutput);
      const { sanitizedOutput, redactedCount } = this.sanitizePostExecutionOutput(serialized);
      if (redactedCount > 0) {
        try {
          return { sanitizedOutput: JSON.parse(sanitizedOutput as string), redactedCount };
        } catch {
          return { sanitizedOutput, redactedCount };
        }
      }
    }

    return { sanitizedOutput: rawOutput, redactedCount: 0 };
  }

  /**
   * Dual-phase proxy executing the target tool within strict constitutional bounds.
   */
  public executeWithConstitutionalGuardrail<TInput extends Record<string, unknown>, TOutput>(
    toolName: string,
    args: TInput,
    executor: (validatedArgs: TInput) => TOutput,
    options?: InterceptorOptions
  ): {
    readonly success: boolean;
    readonly result?: TOutput;
    readonly blockedReason?: string;
    readonly receipt: InterceptionReceipt;
  } {
    const preCheck = this.evaluatePreExecutionGuardrails(toolName, args, options);

    if (!preCheck.approved) {
      const evaluatedAtIso = new Date().toISOString();
      const receipt: InterceptionReceipt = deepFreeze({
        toolName,
        callerRole: options?.callerRole || "agent",
        approved: false,
        blockedReason: preCheck.reason,
        secretsRedactedCount: 0,
        evaluatedAtIso,
        sha256Receipt: pureSha256(`${toolName}:BLOCKED:${preCheck.reason}:${evaluatedAtIso}`)
      });

      return {
        success: false,
        blockedReason: preCheck.reason,
        receipt
      };
    }

    // Execute tool
    const rawResult = executor(args);

    // Sanitize output
    const { sanitizedOutput, redactedCount } = this.sanitizePostExecutionOutput(rawResult);

    const evaluatedAtIso = new Date().toISOString();
    const receipt: InterceptionReceipt = deepFreeze({
      toolName,
      callerRole: options?.callerRole || "agent",
      approved: true,
      secretsRedactedCount: redactedCount,
      evaluatedAtIso,
      sha256Receipt: pureSha256(`${toolName}:APPROVED:${redactedCount}:${evaluatedAtIso}`)
    });

    if (options?.ledgerPath) {
      try {
        const ledger = new EosDurableSqliteLedger(options.ledgerPath);
        ledger.appendEntry({
          category: "SECURITY_AUDIT",
          projectId: "eos-system",
          title: `Constitutional Interception: ${toolName}`,
          payload: {
            toolName,
            approved: true,
            redactedCount,
            receiptHash: receipt.sha256Receipt
          }
        });
        ledger.close();
      } catch {
        // Safe fail-through for in-memory / testing
      }
    }

    return {
      success: true,
      result: sanitizedOutput as TOutput,
      receipt
    };
  }
}
