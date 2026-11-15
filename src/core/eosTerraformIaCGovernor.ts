/**
 * EOS SYSTEM — TERRAFORM / OPENTOFU IAC GOVERNOR (Layer 0)
 * Governed by SPEC-276, CHANGE-138
 *
 * Implements sovereign Infrastructure as Code governance:
 * 1. Format & Syntax Verification via terraform fmt -check.
 * 2. OPA Rego Security Baseline Evaluation over planned resource changes.
 * 3. Rejection of public ingress to sensitive ports (SSH 22, Postgres 5432, etc.).
 * 4. Enforcement of encryption at rest for EBS, S3, and RDS.
 * 5. Destruction gating blocking unauthorized deletion of stateful databases.
 * 6. Dual-engine evaluation: OPA CLI primary with pure Layer-0 native fallback.
 * 7. Cryptographic receipts: docs/evidence/TERRAFORM_RECEIPT.json.
 *
 * Zero external runtime dependencies. Node 24 strip-only compliant.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export type TerraformAuditStatus = "PASS" | "POLICY_VIOLATION" | "DESTRUCTION_REJECTED" | "AUDIT_FAILED";

export interface TerraformValidateReport {
  readonly timestampIso: string;
  readonly modulePath: string;
  readonly status: "PASS" | "VALIDATION_FAILED";
  readonly clean: boolean;
  readonly latencyMs: number;
  readonly rawOutput: string;
  readonly sha256Receipt: string;
  readonly error?: string;
}

export interface TerraformPolicyViolation {
  readonly rule: string;
  readonly resource: string;
  readonly message: string;
}

export interface TerraformAuditReport {
  readonly timestampIso: string;
  readonly status: TerraformAuditStatus;
  readonly allowed: boolean;
  readonly totalViolations: number;
  readonly violations: readonly TerraformPolicyViolation[];
  readonly evaluatedResources: number;
  readonly executionEngine: "OPA_CLI_EVAL" | "NATIVE_AST_FALLBACK";
  readonly latencyMs: number;
  readonly sha256Receipt: string;
  readonly error?: string;
}

export interface TerraformAuditOptions {
  readonly policyPath?: string;
  readonly allowDestroy?: boolean;
  readonly forceNativeFallback?: boolean;
  readonly receiptPath?: string;
  readonly timeoutMs?: number;
}

const SENSITIVE_PORTS = new Set([22, 3389, 5432, 3306, 6379, 27017]);
const STATEFUL_DB_TYPES = new Set(["aws_db_instance", "aws_rds_cluster", "google_sql_database_instance"]);

export class EosTerraformIaCGovernor {
  /**
   * Validates Terraform module formatting and syntax.
   */
  public static validateIaC(modulePath: string, options: { timeoutMs?: number } = {}): TerraformValidateReport {
    assertPrecondition(Boolean(modulePath), "Module path is required");
    const startTime = Date.now();
    const timeout = options.timeoutMs || 10000;

    const res = spawnSync("terraform", ["fmt", "-check", modulePath], {
      encoding: "utf8",
      timeout,
      windowsHide: true,
    });

    const latencyMs = Date.now() - startTime;
    const rawOutput = (res.stdout || res.stderr || "").trim();
    const clean = res.status === 0;
    const status: "PASS" | "VALIDATION_FAILED" = clean ? "PASS" : "VALIDATION_FAILED";

    const payload = {
      timestampIso: new Date().toISOString(),
      modulePath: path.basename(modulePath),
      status,
      clean,
      latencyMs,
      rawOutput,
    };

    const sha256Receipt = pureSha256(JSON.stringify(payload));
    const error = clean ? undefined : (res.error?.message || rawOutput).slice(0, 300);

    return deepFreeze({
      ...payload,
      sha256Receipt,
      error,
    });
  }

  /**
   * Audits a Terraform plan change set against the security baseline.
   */
  public static auditPlan(
    planInput: string | Record<string, unknown>,
    options: TerraformAuditOptions = {},
  ): TerraformAuditReport {
    const startTime = Date.now();
    let planData: Record<string, unknown>;

    try {
      if (typeof planInput === "string") {
        if (fs.existsSync(planInput)) {
          planData = JSON.parse(fs.readFileSync(planInput, "utf8"));
        } else {
          planData = JSON.parse(planInput);
        }
      } else {
        planData = planInput;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.finalizeReport(
        "AUDIT_FAILED",
        false,
        [],
        0,
        "NATIVE_AST_FALLBACK",
        Date.now() - startTime,
        options.receiptPath,
        `Failed to parse plan JSON: ${msg}`,
      );
    }

    // Embed allow_destroy parameter into input if provided
    const evaluatedInput = {
      ...planData,
      allow_destroy: Boolean(options.allowDestroy),
    };

    // Primary: OPA CLI evaluation
    if (!options.forceNativeFallback) {
      const policyFile =
        options.policyPath || path.resolve(process.cwd(), "policies", "iac", "terraform_baseline.rego");

      if (fs.existsSync(policyFile)) {
        const opaRes = spawnSync(
          "opa",
          ["eval", "--stdin-input", "--data", policyFile, "data.terraform.security.violations"],
          {
            input: JSON.stringify(evaluatedInput),
            encoding: "utf8",
            timeout: options.timeoutMs || 8000,
            windowsHide: true,
          },
        );

        if (opaRes.status === 0 && opaRes.stdout) {
          try {
            const parsed = JSON.parse(opaRes.stdout);
            const rawViolations = parsed.result?.[0]?.expressions?.[0]?.value;
            if (Array.isArray(rawViolations)) {
              const violations: TerraformPolicyViolation[] = rawViolations.map((v) => ({
                rule: String(v?.rule || "unknown_rule"),
                resource: String(v?.resource || "unknown_resource"),
                message: String(v?.message || "Policy violation detected"),
              }));

              const resourceChanges = (planData.resource_changes as unknown[]) || [];
              const hasDestruction = violations.some((v) => v.rule === "no_unauthorized_deletion");
              const status: TerraformAuditStatus =
                violations.length === 0 ? "PASS" : hasDestruction ? "DESTRUCTION_REJECTED" : "POLICY_VIOLATION";

              return this.finalizeReport(
                status,
                violations.length === 0,
                violations,
                resourceChanges.length,
                "OPA_CLI_EVAL",
                Date.now() - startTime,
                options.receiptPath,
              );
            }
          } catch {}
        }
      }
    }

    // Fallback: Pure Layer-0 AST evaluation
    return this.evaluateNativeFallback(evaluatedInput, startTime, options);
  }

  /**
   * Pure Layer-0 deterministic AST fallback evaluator.
   */
  private static evaluateNativeFallback(
    planData: Record<string, unknown>,
    startTime: number,
    options: TerraformAuditOptions,
  ): TerraformAuditReport {
    const violations: TerraformPolicyViolation[] = [];
    const resourceChanges = Array.isArray(planData.resource_changes) ? planData.resource_changes : [];
    const allowDestroy = Boolean(planData.allow_destroy);

    for (const rc of resourceChanges) {
      if (!rc || typeof rc !== "object") continue;
      const type = String((rc as Record<string, unknown>).type || "");
      const address = String((rc as Record<string, unknown>).address || type);
      const change = ((rc as Record<string, unknown>).change || {}) as Record<string, unknown>;
      const actions = Array.isArray(change.actions) ? change.actions : [];
      const after = (change.after || {}) as Record<string, unknown>;

      const isDelete = actions.includes("delete");

      // Rule 1: No public ingress on sensitive ports (create/update only)
      if (!isDelete && type === "aws_security_group" && Array.isArray(after.ingress)) {
        for (const ing of after.ingress) {
          if (!ing || typeof ing !== "object") continue;
          const cidrs = Array.isArray(ing.cidr_blocks) ? ing.cidr_blocks : [];
          if (cidrs.includes("0.0.0.0/0")) {
            const fromPort = Number(ing.from_port || 0);
            const toPort = Number(ing.to_port || 0);
            if (SENSITIVE_PORTS.has(fromPort) || SENSITIVE_PORTS.has(toPort) || (fromPort === 0 && toPort === 0)) {
              violations.push({
                rule: "no_public_ingress",
                resource: address,
                message: `Security Group '${address}' permits public ingress on sensitive port ${fromPort}`,
              });
            }
          }
        }
      } else if (!isDelete && type === "aws_security_group_rule" && after.type === "ingress") {
        const cidr = String(after.cidr_block || "");
        const cidrs = Array.isArray(after.cidr_blocks) ? after.cidr_blocks : [];
        if (cidr === "0.0.0.0/0" || cidrs.includes("0.0.0.0/0")) {
          const fromPort = Number(after.from_port || 0);
          const toPort = Number(after.to_port || 0);
          if (SENSITIVE_PORTS.has(fromPort) || SENSITIVE_PORTS.has(toPort) || (fromPort === 0 && toPort === 0)) {
            violations.push({
              rule: "no_public_ingress",
              resource: address,
              message: `Security Group Rule '${address}' permits public ingress on sensitive port ${fromPort}`,
            });
          }
        }
      }

      // Rule 2: No public storage buckets (create/update only)
      if (!isDelete && type === "aws_s3_bucket") {
        const acl = String(after.acl || "");
        if (["public-read", "public-read-write", "website"].includes(acl)) {
          violations.push({
            rule: "no_public_storage",
            resource: address,
            message: `S3 Bucket '${address}' specifies public ACL: ${acl}`,
          });
        }
      }

      // Rule 3: Enforce encryption at rest (create/update only)
      if (!isDelete && type === "aws_ebs_volume" && after.encrypted !== true) {
        violations.push({
          rule: "enforce_encryption_at_rest",
          resource: address,
          message: `EBS volume '${address}' does not enable encryption`,
        });
      }
      if (!isDelete && STATEFUL_DB_TYPES.has(type) && after.storage_encrypted !== true) {
        violations.push({
          rule: "enforce_encryption_at_rest",
          resource: address,
          message: `Database '${address}' (${type}) does not enable storage encryption`,
        });
      }

      // Rule 4: No unauthorized deletion of stateful databases
      if (STATEFUL_DB_TYPES.has(type) && actions.includes("delete") && !allowDestroy) {
        violations.push({
          rule: "no_unauthorized_deletion",
          resource: address,
          message: `Database '${address}' (${type}) is scheduled for deletion without explicit authorization`,
        });
      }
    }

    const hasDestruction = violations.some((v) => v.rule === "no_unauthorized_deletion");
    const status: TerraformAuditStatus =
      violations.length === 0 ? "PASS" : hasDestruction ? "DESTRUCTION_REJECTED" : "POLICY_VIOLATION";

    return this.finalizeReport(
      status,
      violations.length === 0,
      violations,
      resourceChanges.length,
      "NATIVE_AST_FALLBACK",
      Date.now() - startTime,
      options.receiptPath,
    );
  }

  private static finalizeReport(
    status: TerraformAuditStatus,
    allowed: boolean,
    violations: TerraformPolicyViolation[],
    evaluatedResources: number,
    executionEngine: "OPA_CLI_EVAL" | "NATIVE_AST_FALLBACK",
    latencyMs: number,
    customReceiptPath?: string,
    error?: string,
  ): TerraformAuditReport {
    const payload = {
      timestampIso: new Date().toISOString(),
      status,
      allowed,
      totalViolations: violations.length,
      violations: deepFreeze(violations),
      evaluatedResources,
      executionEngine,
      latencyMs,
    };

    const sha256Receipt = pureSha256(JSON.stringify(payload));
    const finalReport: TerraformAuditReport = deepFreeze({
      ...payload,
      sha256Receipt,
      error,
    });

    const defaultReceipt = path.resolve(process.cwd(), "docs", "evidence", "TERRAFORM_RECEIPT.json");
    const targetReceipt = customReceiptPath || defaultReceipt;

    try {
      const dir = path.dirname(targetReceipt);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(targetReceipt, JSON.stringify(finalReport, null, 2), "utf8");
    } catch {}

    return finalReport;
  }
}
