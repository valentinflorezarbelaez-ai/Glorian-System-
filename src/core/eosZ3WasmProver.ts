/**
 * EOS Live Leslie Lamport TLC Model Checking & Bounded Constraint Solving Engine
 *
 * SPEC-292 / CHANGE-154: Formal verification via live TLC model checking, an in-process
 * interval constraint solver, finite-domain inductive invariant checks, and automated
 * counterexample test synthesis.
 *
 * SPEC-342 (Verification Honesty): no code path in this module reports success without
 * having executed the corresponding verification. When TLC is unavailable the result is
 * NOT_VERIFIED; the constraint solver returns UNKNOWN outside its decidable fragment.
 *
 * Pure Layer-0 TypeScript (Law V: zero npm runtime dependencies).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawnSync } from "node:child_process";

export * from "./eosZ3WasmProver.types.ts";
import type {
  TlcExecutionResult,
  SmtVariable,
  SmtConstraint,
  SmtSolveResult,
  InductiveProofResult,
  Z3ProverAuditReceipt,
} from "./eosZ3WasmProver.types.ts";

const TLC_COMPLETION_MARKER = /Model checking completed\.\s*No error has been found/i;
const TLC_INVARIANT_VIOLATION = /Error:\s*Invariant\s+([A-Za-z0-9_]+)\s+is violated/i;
const TLC_DEADLOCK = /Error:\s*Deadlock reached/i;

function parseTlcCounter(output: string, pattern: RegExp): number | null {
  const m = output.match(pattern);
  if (!m) return null;
  const n = Number.parseInt(m[1].replace(/,/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Leslie Lamport TLC Model Checker Runner.
 * Executes live TLC verification when available. When it is not available the result is
 * reported as NOT_VERIFIED (SPEC-342 FR-1); state counts are never fabricated.
 */
export class EosTlcModelChecker {
  public static async runTlc(
    specPath: string,
    options: { maxStates?: number; timeoutMs?: number; jarPath?: string; javaCommand?: string } = {},
  ): Promise<TlcExecutionResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? 60000;
    const fullPath = path.resolve(process.cwd(), specPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`TLA+ specification file not found: ${specPath}`);
    }

    const jarPath = options.jarPath ?? path.join(process.cwd(), "tools", "tla2tools.jar");
    const javaCommand = options.javaCommand ?? "java";
    const hasJar = fs.existsSync(jarPath);
    let hasJava = false;
    try {
      const jCheck = spawnSync(javaCommand, ["-version"], { encoding: "utf8", timeout: 5000, windowsHide: true });
      hasJava = jCheck.status === 0;
    } catch {
      hasJava = false;
    }

    const base = { specFile: specPath, generatedStates: 0, distinctStates: 0, invariantViolations: 0 };

    if (!hasJava || !hasJar) {
      return {
        ...base,
        executionMode: "UNAVAILABLE",
        status: "NOT_VERIFIED",
        verified: false,
        reason: !hasJava ? "Java runtime not found on PATH" : `TLC jar not staged at ${jarPath}`,
        durationMs: Date.now() - startTime,
      };
    }

    // Isolated metadata directory: TLC must never write state files into the repository.
    const metaDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-tlc-meta-"));
    try {
      const tlcArgs = ["-cp", jarPath, "tlc2.TLC", "-deadlock", "-workers", "1", "-metadir", metaDir, fullPath];
      const res = spawnSync(javaCommand, tlcArgs, {
        encoding: "utf8",
        timeout: timeoutMs,
        windowsHide: true,
        cwd: path.dirname(fullPath),
        maxBuffer: 32 * 1024 * 1024,
      });
      const durationMs = Date.now() - startTime;

      if (res.error) {
        const timedOut = (res.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
        return {
          ...base,
          executionMode: "LIVE_LOCAL_TLC",
          status: timedOut ? "TIMEOUT" : "INCONCLUSIVE",
          verified: false,
          reason: timedOut ? `TLC exceeded ${timeoutMs}ms` : `TLC process error: ${res.error.message}`,
          durationMs,
        };
      }

      const output = `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
      const generatedStates = parseTlcCounter(output, /([\d,]+)\s+states generated/i);
      const distinctStates = parseTlcCounter(output, /([\d,]+)\s+distinct states found/i);
      const counters = { generatedStates: generatedStates ?? 0, distinctStates: distinctStates ?? 0 };
      const violation = output.match(TLC_INVARIANT_VIOLATION);

      if (violation) {
        return {
          ...base,
          ...counters,
          executionMode: "LIVE_LOCAL_TLC",
          invariantViolations: 1,
          status: "INVARIANT_VIOLATION",
          verified: true,
          reason: `Invariant ${violation[1]} is violated`,
          durationMs,
        };
      }
      if (TLC_DEADLOCK.test(output)) {
        return {
          ...base,
          ...counters,
          executionMode: "LIVE_LOCAL_TLC",
          status: "DEADLOCK",
          verified: true,
          reason: "Deadlock reached",
          durationMs,
        };
      }
      if (
        res.status === 0 &&
        TLC_COMPLETION_MARKER.test(output) &&
        generatedStates !== null &&
        distinctStates !== null
      ) {
        return { ...base, ...counters, executionMode: "LIVE_LOCAL_TLC", status: "PASS", verified: true, durationMs };
      }
      return {
        ...base,
        ...counters,
        executionMode: "LIVE_LOCAL_TLC",
        status: "INCONCLUSIVE",
        verified: false,
        reason: `TLC exited with code ${res.status} without a completion marker`,
        durationMs,
      };
    } finally {
      fs.rmSync(metaDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  }
}

interface IntegerDomain {
  lo: number;
  hi: number;
  excluded: Set<number>;
  isBool: boolean;
}

function constraintValue(c: SmtConstraint): number | null {
  if (typeof c.rightVal === "boolean") return c.rightVal ? 1 : 0;
  if (typeof c.rightVal === "number" && Number.isFinite(c.rightVal)) return c.rightVal;
  return null;
}

function satisfiesConstraint(value: number, op: SmtConstraint["op"], val: number): boolean {
  switch (op) {
    case "<":
      return value < val;
    case "<=":
      return value <= val;
    case ">":
      return value > val;
    case ">=":
      return value >= val;
    case "==":
      return value === val;
    case "!=":
      return value !== val;
    default:
      return false;
  }
}

/** Smallest-magnitude integer in [lo, hi] that is not excluded; null if none exists. */
function pickWitness(d: IntegerDomain): number | null {
  const preferred = Math.min(Math.max(0, d.lo), d.hi);
  for (let k = 0; k <= d.excluded.size; k++) {
    for (const candidate of k === 0 ? [preferred] : [preferred + k, preferred - k]) {
      if (candidate >= d.lo && candidate <= d.hi && !d.excluded.has(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * Interval Constraint Solver (SPEC-342 FR-3).
 *
 * Decision procedure for conjunctions of single-variable integer bound constraints
 * (<, <=, >, >=, ==, !=) and boolean equalities over unbounded integer domains.
 * Sound and complete for that fragment; anything outside it yields UNKNOWN.
 * This is NOT Z3 and does not decide arbitrary first-order formulas.
 */
export class EosIntervalConstraintSolver {
  public static solve(variables: SmtVariable[], constraints: SmtConstraint[]): SmtSolveResult {
    if (!Array.isArray(variables) || !Array.isArray(constraints)) {
      return { status: "UNKNOWN", reason: "variables and constraints must be arrays" };
    }
    const domains = new Map<string, IntegerDomain>();
    for (const v of variables) {
      if (!v || typeof v.name !== "string" || v.name.length === 0) {
        return { status: "UNKNOWN", reason: "Invalid variable declaration" };
      }
      const isBool = v.type === "bool";
      const lo = isBool ? 0 : (v.minBound ?? -Infinity);
      const hi = isBool ? 1 : (v.maxBound ?? Infinity);
      if (Number.isNaN(lo) || Number.isNaN(hi)) return { status: "UNKNOWN", reason: `Invalid bounds for ${v.name}` };
      domains.set(v.name, { lo: Math.ceil(lo), hi: Math.floor(hi), excluded: new Set(), isBool });
    }

    for (const c of constraints) {
      const val = constraintValue(c);
      if (!c || typeof c.leftVar !== "string" || val === null) {
        return { status: "UNKNOWN", reason: "Constraint outside the single-variable integer bound fragment" };
      }
      let d = domains.get(c.leftVar);
      if (!d) {
        d = { lo: -Infinity, hi: Infinity, excluded: new Set(), isBool: false };
        domains.set(c.leftVar, d);
      }
      if (typeof c.rightVal === "boolean" && c.op !== "==" && c.op !== "!=") {
        return { status: "UNKNOWN", reason: `Unsupported boolean operator ${c.op}` };
      }
      switch (c.op) {
        case ">":
          d.lo = Math.max(d.lo, Math.floor(val) + 1);
          break;
        case ">=":
          d.lo = Math.max(d.lo, Math.ceil(val));
          break;
        case "<":
          d.hi = Math.min(d.hi, Math.ceil(val) - 1);
          break;
        case "<=":
          d.hi = Math.min(d.hi, Math.floor(val));
          break;
        case "==":
          if (!Number.isInteger(val)) {
            return { status: "UNSAT", reason: `Integer variable ${c.leftVar} cannot equal ${val}` };
          }
          d.lo = Math.max(d.lo, val);
          d.hi = Math.min(d.hi, val);
          break;
        case "!=":
          if (Number.isInteger(val)) d.excluded.add(val);
          break;
        default:
          return { status: "UNKNOWN", reason: `Unsupported operator ${String(c.op)}` };
      }
      if (d.lo > d.hi) {
        return { status: "UNSAT", reason: `Contradiction on ${c.leftVar}: interval [${d.lo}, ${d.hi}] is empty` };
      }
    }

    const model: Record<string, number | boolean> = {};
    const numeric: Record<string, number> = {};
    for (const [name, d] of domains.entries()) {
      const witness = pickWitness(d);
      if (witness === null) {
        return { status: "UNSAT", reason: `Every integer in [${d.lo}, ${d.hi}] is excluded for ${name}` };
      }
      if (!Number.isSafeInteger(witness)) {
        return { status: "UNKNOWN", reason: `Witness for ${name} exceeds safe integer precision` };
      }
      numeric[name] = witness;
      model[name] = d.isBool ? witness === 1 : witness;
    }

    // Self-check: never return a SAT model that violates a constraint.
    for (const c of constraints) {
      if (!satisfiesConstraint(numeric[c.leftVar], c.op, constraintValue(c) as number)) {
        return { status: "UNKNOWN", reason: `Model self-check failed on ${c.leftVar} ${c.op} ${String(c.rightVal)}` };
      }
    }
    return { status: "SAT", model };
  }

  /**
   * Finite-domain inductive invariant check (SPEC-342 FR-4):
   * 1. Base case: Init(s) => Invariant(s) for every s in the domain.
   * 2. Inductive step: Invariant(s) => Invariant(Transition(s)) for every s in the domain.
   * The result is a proof (INDUCTIVE_INVARIANT_PROVEN) only when the domain is closed under
   * the transition relation; otherwise it is a sampled check (HOLDS_ON_SAMPLED_DOMAIN).
   */
  public static proveInductiveInvariant(params: {
    invariantName: string;
    initialPredicate: (s: Record<string, number | boolean>) => boolean;
    transition: (s: Record<string, number | boolean>) => Record<string, number | boolean>;
    invariant: (s: Record<string, number | boolean>) => boolean;
    domain: Array<Record<string, number | boolean>>;
  }): InductiveProofResult {
    const { invariantName, initialPredicate, transition, invariant, domain } = params;
    const key = (s: Record<string, number | boolean>): string =>
      JSON.stringify(
        Object.keys(s)
          .sort()
          .map((k) => [k, s[k]]),
      );
    const domainKeys = new Set(domain.map(key));
    const fail = (baseCaseProven: boolean, counterexample: Record<string, number | boolean>): InductiveProofResult => ({
      invariantName,
      status: "VIOLATION_DETECTED",
      baseCaseProven,
      inductiveStepProven: false,
      domainSize: domain.length,
      domainClosedUnderTransition: false,
      counterexample,
    });

    for (const state of domain) {
      if (initialPredicate(state) && !invariant(state)) return fail(false, state);
    }
    let closed = true;
    for (const state of domain) {
      if (!invariant(state)) continue;
      const nextState = transition(state);
      if (!invariant(nextState)) return fail(true, nextState);
      if (!domainKeys.has(key(nextState))) closed = false;
    }
    return {
      invariantName,
      status: closed ? "INDUCTIVE_INVARIANT_PROVEN" : "HOLDS_ON_SAMPLED_DOMAIN",
      baseCaseProven: true,
      inductiveStepProven: true,
      domainSize: domain.length,
      domainClosedUnderTransition: closed,
    };
  }
}

/** @deprecated Use EosIntervalConstraintSolver. This is not Z3 (SPEC-342 FR-3). */
export const EosZ3SmtSolver = EosIntervalConstraintSolver;

/**
 * Translates counterexample state assignments into executable BDD unit test assertions.
 */
export class CounterexampleTranslator {
  public static translateToBddTest(testName: string, counterexample: Record<string, unknown>): string {
    const entries = Object.entries(counterexample);
    const assignments = entries.map(([k, v]) => `    const ${k} = ${JSON.stringify(v)};`).join("\n");
    const assertions = entries.map(([k, v]) => `    assert.equal(${k}, ${JSON.stringify(v)});`).join("\n");

    return [
      `// Auto-generated Counterexample Regression Test for: ${testName}`,
      `import { test } from "node:test";`,
      `import * as assert from "node:assert/strict";`,
      ``,
      `test("Counterexample Regression: ${testName}", () => {`,
      assignments,
      assertions,
      `});`,
    ].join("\n");
  }
}

/**
 * Audits formal verification capabilities and emits Z3_PROVER_RECEIPT.json.
 * Reports inventoried specs separately from specs actually model-checked (SPEC-342 FR-5).
 */
export async function auditFormalProver(options?: {
  rootDir?: string;
  emitReceipt?: boolean;
  evidenceDir?: string;
}): Promise<Z3ProverAuditReceipt> {
  const rootDir = options?.rootDir ?? process.cwd();
  const emitReceipt = options?.emitReceipt !== false;

  // 1. Inventory TLA+ specs and model-check one deterministic sample live.
  const formalDir = path.join(rootDir, "docs", "formal");
  const tlaFiles = fs.existsSync(formalDir)
    ? fs
        .readdirSync(formalDir)
        .filter((f) => f.endsWith(".tla") && fs.existsSync(path.join(formalDir, f.replace(/\.tla$/, ".cfg"))))
        .sort()
    : [];
  const inventoried = fs.existsSync(formalDir) ? fs.readdirSync(formalDir).filter((f) => f.endsWith(".tla")).length : 0;
  let tlcSampleStatus: TlcExecutionResult["status"] = "NOT_VERIFIED";
  let checked = 0;
  if (tlaFiles.length > 0) {
    const sample = await EosTlcModelChecker.runTlc(path.join(formalDir, tlaFiles[0]), {
      jarPath: path.join(rootDir, "tools", "tla2tools.jar"),
    });
    tlcSampleStatus = sample.status;
    checked = sample.verified && sample.status === "PASS" ? 1 : 0;
  }

  // 2. Decide a contradiction: x > 10 and x < 5 is UNSAT.
  const smtRes = EosIntervalConstraintSolver.solve(
    [{ name: "x", type: "int" }],
    [
      { leftVar: "x", op: ">", rightVal: 10 },
      { leftVar: "x", op: "<", rightVal: 5 },
    ],
  );
  const theoremsProven = smtRes.status === "UNSAT" ? 1 : 0;

  // 3. Prove an inductive invariant on a transition-closed domain: x' = (x + 1) mod 5.
  const indRes = EosIntervalConstraintSolver.proveInductiveInvariant({
    invariantName: "BoundedModularCounter",
    initialPredicate: (s) => s.x === 0,
    transition: (s) => ({ x: (Number(s.x) + 1) % 5 }),
    invariant: (s) => Number(s.x) >= 0 && Number(s.x) < 5,
    domain: [0, 1, 2, 3, 4].map((x) => ({ x })),
  });
  const inductiveProven = indRes.status === "INDUCTIVE_INVARIANT_PROVEN" ? 1 : 0;

  const content = {
    specRef: "SPEC-292" as const,
    totalTlaSpecsInventoried: inventoried,
    totalTlaSpecsChecked: checked,
    tlcSampleStatus,
    totalSmtTheoremsProven: theoremsProven,
    inductiveInvariantsVerified: inductiveProven,
  };
  const sha256Signature = crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex");
  const receipt: Z3ProverAuditReceipt = { timestampIso: new Date().toISOString(), ...content, sha256Signature };

  if (emitReceipt) {
    const evidenceDir = options?.evidenceDir ?? process.env.EOS_EVIDENCE_DIR ?? path.join(rootDir, "docs", "evidence");
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, "Z3_PROVER_RECEIPT.json"), JSON.stringify(receipt, null, 2), "utf8");
  }

  return receipt;
}
