/**
 * EOS SYSTEM — OPA KUBERNETES POLICY GOVERNOR (Layer 0)
 * Governed by SPEC-273, CHANGE-135, ADR-135-001..003 (v75.0.0)
 *
 * Implements declarative Kubernetes manifest validation against OPA/Rego security baselines:
 * 1. Blocks privileged containers (securityContext.privileged: true).
 * 2. Requires execution as non-root (securityContext.runAsNonRoot or runAsUser > 0).
 * 3. Enforces explicit CPU and Memory resource limits.
 * 4. Prohibits unpinned or :latest image tags.
 *
 * Supports both OPA CLI invocation (`opa eval`) and pure Layer-0 deterministic AST evaluation.
 * Zero external runtime npm dependencies (Law V).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface OpaPolicyViolation {
  readonly rule: string;
  readonly container: string;
  readonly message: string;
}

export interface OpaEvaluationResult {
  readonly allowed: boolean;
  readonly violations: readonly OpaPolicyViolation[];
  readonly totalViolations: number;
  readonly executionEngine: "OPA_CLI_EVAL" | "NATIVE_AST_FALLBACK";
  readonly evaluatedContainers: number;
  readonly sha256Receipt: string;
}

export interface OpaGovernorOptions {
  readonly policyPath?: string;
  readonly forceNativeFallback?: boolean;
  readonly timeoutMs?: number;
}

interface ContainerSpec {
  readonly name?: string;
  readonly image?: string;
  readonly securityContext?: {
    readonly privileged?: boolean;
    readonly runAsNonRoot?: boolean;
    readonly runAsUser?: number;
  };
  readonly resources?: {
    readonly limits?: {
      readonly cpu?: string | number;
      readonly memory?: string | number;
    };
  };
}

export class EosOpaPolicyGovernor {
  private static extractContainers(manifest: any): ContainerSpec[] {
    if (!manifest || typeof manifest !== "object") return [];
    const containers: ContainerSpec[] = [];

    // Pod
    if (Array.isArray(manifest.spec?.containers)) {
      containers.push(...manifest.spec.containers);
    }
    // Deployment / DaemonSet / StatefulSet
    if (Array.isArray(manifest.spec?.template?.spec?.containers)) {
      containers.push(...manifest.spec.template.spec.containers);
    }
    // CronJob / Job
    if (Array.isArray(manifest.spec?.jobTemplate?.spec?.template?.spec?.containers)) {
      containers.push(...manifest.spec.jobTemplate.spec.template.spec.containers);
    }

    return containers;
  }

  private static checkNonRoot(c: ContainerSpec, manifest: any): boolean {
    if (c.securityContext?.runAsNonRoot === true) return true;
    if (typeof c.securityContext?.runAsUser === "number" && c.securityContext.runAsUser > 0) return true;

    // Pod-level securityContext
    const podSec = manifest?.spec?.securityContext || manifest?.spec?.template?.spec?.securityContext;
    if (podSec?.runAsNonRoot === true) return true;
    if (typeof podSec?.runAsUser === "number" && podSec.runAsUser > 0) return true;

    return false;
  }

  private static evaluateNativeAst(manifest: any): {
    allowed: boolean;
    violations: OpaPolicyViolation[];
    count: number;
  } {
    const containers = EosOpaPolicyGovernor.extractContainers(manifest);
    const violations: OpaPolicyViolation[] = [];

    for (const c of containers) {
      const name = c.name || "unnamed";

      // 1. no_privileged
      if (c.securityContext?.privileged === true) {
        violations.push({
          rule: "no_privileged",
          container: name,
          message: `Container '${name}' must not run in privileged mode`,
        });
      }

      // 2. run_as_non_root
      if (!EosOpaPolicyGovernor.checkNonRoot(c, manifest)) {
        violations.push({
          rule: "run_as_non_root",
          container: name,
          message: `Container '${name}' must set securityContext.runAsNonRoot=true and non-zero UID`,
        });
      }

      // 3. require_resource_limits
      const limits = c.resources?.limits;
      if (!limits || !limits.cpu || !limits.memory) {
        violations.push({
          rule: "require_resource_limits",
          container: name,
          message: `Container '${name}' must declare both CPU and Memory resource limits`,
        });
      }

      // 4. disallow_latest_tag
      const image = c.image || "";
      if (!image.includes(":") || image.endsWith(":latest")) {
        violations.push({
          rule: "disallow_latest_tag",
          container: name,
          message: `Container '${name}' uses an unpinned or latest image tag: ${image}`,
        });
      }
    }

    return {
      allowed: violations.length === 0,
      violations,
      count: containers.length,
    };
  }

  private static evaluateViaOpaCli(
    manifestObj: any,
    policyFile: string,
    timeoutMs: number,
  ): { allowed: boolean; violations: OpaPolicyViolation[]; count: number } | null {
    const tmpInput = path.join(os.tmpdir(), `eos-opa-input-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    try {
      fs.writeFileSync(tmpInput, JSON.stringify(manifestObj), "utf8");
      const res = spawnSync("opa", ["eval", "--data", policyFile, "--input", tmpInput, "data.k8s.security"], {
        encoding: "utf8",
        timeout: timeoutMs,
      });

      if (res.status !== 0) return null;
      const parsed = JSON.parse(res.stdout || "{}");
      const secData = parsed?.result?.[0]?.expressions?.[0]?.value;
      if (!secData) return null;

      const rawViolations = Array.isArray(secData.violations) ? secData.violations : [];
      const violations: OpaPolicyViolation[] = rawViolations.map((v: any) => ({
        rule: String(v.rule || "unknown"),
        container: String(v.container || "unknown"),
        message: String(v.message || ""),
      }));

      const containers = EosOpaPolicyGovernor.extractContainers(manifestObj);
      return {
        allowed: Boolean(secData.allowed),
        violations,
        count: containers.length,
      };
    } catch {
      return null;
    } finally {
      if (fs.existsSync(tmpInput)) {
        try {
          fs.unlinkSync(tmpInput);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }

  public static evaluateManifest(manifest: any | string, options: OpaGovernorOptions = {}): OpaEvaluationResult {
    assertPrecondition(Boolean(manifest), "Manifest must be defined");
    const manifestObj = typeof manifest === "string" ? JSON.parse(manifest) : manifest;
    const policyPath = options.policyPath || path.resolve(process.cwd(), "policies/k8s/security_baseline.rego");
    const timeoutMs = options.timeoutMs || 4000;

    let evalOutcome: { allowed: boolean; violations: OpaPolicyViolation[]; count: number } | null = null;
    let engine: "OPA_CLI_EVAL" | "NATIVE_AST_FALLBACK" = "NATIVE_AST_FALLBACK";

    if (!options.forceNativeFallback && fs.existsSync(policyPath)) {
      evalOutcome = EosOpaPolicyGovernor.evaluateViaOpaCli(manifestObj, policyPath, timeoutMs);
      if (evalOutcome) {
        engine = "OPA_CLI_EVAL";
      }
    }

    if (!evalOutcome) {
      evalOutcome = EosOpaPolicyGovernor.evaluateNativeAst(manifestObj);
      engine = "NATIVE_AST_FALLBACK";
    }

    const receiptPayload = JSON.stringify({
      allowed: evalOutcome.allowed,
      violations: evalOutcome.violations,
      engine,
      totalViolations: evalOutcome.violations.length,
    });
    const sha256Receipt = pureSha256(receiptPayload);

    return deepFreeze({
      allowed: evalOutcome.allowed,
      violations: evalOutcome.violations,
      totalViolations: evalOutcome.violations.length,
      executionEngine: engine,
      evaluatedContainers: evalOutcome.count,
      sha256Receipt,
    });
  }
}
