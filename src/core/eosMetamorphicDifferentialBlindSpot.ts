/**
 * Glorian System — Metamorphic, Differential & Structural-Shrinking Blind-Spot Hunter
 * Governed by SPEC-341 / CHANGE-203 / ADR-203-001..003
 *
 * Implements:
 *  1. Recursive Structural Arbitrary JSON Generator & Tree Shrinker (Mulberry32).
 *  2. Differential Testing Oracle comparing reference vs candidate outputs with minimal shrinking.
 *  3. Metamorphic Relation Verifier (Sort Idempotence, Filter Subset Monotonicity, JSON Round-Trip).
 *  4. High-volume Boundary Fuzzing Harness (500+ payloads, zero unhandled HTTP 500s).
 *
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies, <= 800 lines.
 */

import { createHash } from "node:crypto";
import { createMulberry32 } from "./eosKernelPrimitives.ts";
import type {
  BlindSpotErrorCode,
  BlindSpotHunterAuditReceipt,
  BoundaryFuzzCampaignOptions,
  BoundaryFuzzCampaignResult,
  BoundaryFuzzOutcome,
  DifferentialCampaignOptions,
  DifferentialCampaignResult,
  MetamorphicCampaignOptions,
  MetamorphicCampaignResult,
  StructuralPropertyOptions,
  StructuralPropertyReport,
  SyncBoundaryFuzzCampaignOptions,
} from "./eosMetamorphicDifferentialBlindSpot.types.ts";

export * from "./eosMetamorphicDifferentialBlindSpot.types.ts";

export class BlindSpotError extends Error {
  public readonly code: BlindSpotErrorCode;

  constructor(code: BlindSpotErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "BlindSpotError";
  }
}

const ADVERSARIAL_NUMBERS: readonly number[] = [0, -0, 1, -1, 2, -2, 9, 10, 11, 17.99999, 18, 100, -100, 1e9, -1e9];

const ADVERSARIAL_STRINGS: readonly string[] = [
  "",
  "   ",
  "\t\n",
  "0",
  "18",
  "17.99999",
  "1e5",
  "NaN",
  "Infinity",
  "__proto__",
  "constructor",
  "\0null",
  "🚀",
  "SELECT 1; --",
];

interface FuzzAccumulator {
  readonly targetName: string;
  readonly seed: number;
  readonly iterations: number;
  readonly corpus: ReadonlyArray<unknown>;
  readonly nextFloat: () => number;
  readonly statusCounts: Record<string, number>;
  unhandledExceptionCount: number;
  http5xxCount: number;
  firstFailingPayload?: unknown;
  firstFailureReason?: string;
}

function initFuzzAccumulator(
  options: Pick<BoundaryFuzzCampaignOptions, "targetName" | "seed" | "iterations" | "customCorpus"> & {
    handler: unknown;
  },
): FuzzAccumulator {
  if (!options || typeof options.targetName !== "string" || !options.targetName.trim()) {
    throw new BlindSpotError("BLINDSPOT_INVALID_PARAMETERS", "targetName must be a non-empty string");
  }
  if (typeof options.handler !== "function") {
    throw new BlindSpotError("BLINDSPOT_INVALID_PARAMETERS", "handler function is required");
  }
  const seed = normalizeSeed(options.seed);
  const iterations = normalizePositiveInt(options.iterations, 500, 1, 5000, "iterations");
  return {
    targetName: options.targetName.trim(),
    seed,
    iterations,
    corpus: Array.isArray(options.customCorpus) ? options.customCorpus : [],
    nextFloat: createBlindSpotPrng(seed),
    statusCounts: {},
    unhandledExceptionCount: 0,
    http5xxCount: 0,
  };
}

function recordFuzzOutcome(acc: FuzzAccumulator, payload: unknown, outcome: BoundaryFuzzOutcome): void {
  const code = Number.isInteger(outcome?.statusCode) ? outcome.statusCode : 500;
  acc.statusCounts[String(code)] = (acc.statusCounts[String(code)] ?? 0) + 1;
  if (code >= 500) {
    acc.http5xxCount++;
    if (acc.firstFailureReason === undefined) {
      acc.firstFailingPayload = payload;
      acc.firstFailureReason = `HTTP_${code}`;
    }
  }
}

function recordFuzzException(acc: FuzzAccumulator, payload: unknown, err: unknown): void {
  acc.unhandledExceptionCount++;
  acc.statusCounts.EXCEPTION = (acc.statusCounts.EXCEPTION ?? 0) + 1;
  if (acc.firstFailureReason === undefined) {
    acc.firstFailingPayload = payload;
    acc.firstFailureReason = err instanceof Error ? err.message : String(err);
  }
}

function finalizeFuzzAccumulator(acc: FuzzAccumulator): BoundaryFuzzCampaignResult {
  const totalFailures = acc.unhandledExceptionCount + acc.http5xxCount;
  const stabilityScore = Number(((acc.iterations - totalFailures) / acc.iterations).toFixed(6));
  const body = {
    targetName: acc.targetName,
    seed: acc.seed,
    iterations: acc.iterations,
    handledCount: acc.iterations - totalFailures,
    unhandledExceptionCount: acc.unhandledExceptionCount,
    http5xxCount: acc.http5xxCount,
    stabilityScore,
    statusCounts: acc.statusCounts,
    ...(acc.firstFailureReason !== undefined
      ? { firstFailingPayload: acc.firstFailingPayload, firstFailureReason: acc.firstFailureReason }
      : {}),
  };
  return { ...body, sha256Digest: sha256Hex(body) };
}

function sha256Hex(payload: unknown): string {
  return createHash("sha256").update(canonicalSerialize(payload)).digest("hex");
}

function normalizePositiveInt(value: unknown, fallback: number, min: number, max: number, label: string): number {
  const n = value === undefined ? fallback : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) {
    throw new BlindSpotError("BLINDSPOT_INVALID_PARAMETERS", `${label} must be an integer in ${min}..${max}`);
  }
  return n;
}

function normalizeSeed(seed: unknown, fallback = 2026341): number {
  const s = seed === undefined ? fallback : seed;
  if (typeof s !== "number" || !Number.isFinite(s)) {
    throw new BlindSpotError("BLINDSPOT_INVALID_PARAMETERS", "seed must be a finite number");
  }
  return Math.trunc(s);
}

/** Deterministic 32-bit Mulberry32 PRNG wrapper normalizing zero/truncation for BlindSpot campaigns. */
export function createBlindSpotPrng(seedInput: number): () => number {
  return createMulberry32((Math.trunc(seedInput) || 0x9e3779b9) >>> 0);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Canonical serializer handling sorted keys, -0, NaN, Infinity, undefined, and cycles. */
export function canonicalSerialize(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null) return "null";
  if (value === undefined) return '"[undefined]"';
  if (typeof value === "number") {
    if (Object.is(value, -0)) return "-0";
    if (Number.isNaN(value)) return '"[NaN]"';
    if (!Number.isFinite(value)) return value > 0 ? '"[Infinity]"' : '"[-Infinity]"';
    return String(value);
  }
  if (typeof value === "boolean" || typeof value === "bigint") return JSON.stringify(String(value));
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "function" || typeof value === "symbol") return JSON.stringify(`[${typeof value}]`);
  if (typeof value === "object") {
    if (seen.has(value)) return '"[Circular]"';
    seen.add(value);
    if (Array.isArray(value)) {
      const items = value.map((v) => canonicalSerialize(v, seen));
      return `[${items.join(",")}]`;
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalSerialize(v, seen)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function generateArbitraryIntArray(nextFloat: () => number, minLen = 0, maxLen = 12): number[] {
  const len = minLen + Math.floor(nextFloat() * (maxLen - minLen + 1));
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    if (nextFloat() < 0.35) {
      out.push(Math.trunc(ADVERSARIAL_NUMBERS[Math.floor(nextFloat() * ADVERSARIAL_NUMBERS.length)]) || 0);
    } else {
      out.push(Math.floor((nextFloat() - 0.5) * 400) || 0);
    }
  }
  return out;
}

/** Generate arbitrary structural JSON trees (null, booleans, boundary numbers, strings, arrays, objects). */
export function generateArbitraryJsonValue(nextFloat: () => number, depth = 0, maxDepth = 3): unknown {
  const allowComposite = depth < maxDepth;
  const pick = Math.floor(nextFloat() * (allowComposite ? 6 : 4));
  switch (pick) {
    case 0:
      return null;
    case 1:
      return nextFloat() < 0.5;
    case 2:
      return nextFloat() < 0.5
        ? ADVERSARIAL_NUMBERS[Math.floor(nextFloat() * ADVERSARIAL_NUMBERS.length)]
        : Number(((nextFloat() - 0.5) * 10000).toFixed(4));
    case 3:
      if (nextFloat() < 0.6) {
        return ADVERSARIAL_STRINGS[Math.floor(nextFloat() * ADVERSARIAL_STRINGS.length)];
      }
      return `token_${Math.floor(nextFloat() * 100000)}`;
    case 4: {
      const len = Math.floor(nextFloat() * 7);
      const arr: unknown[] = [];
      for (let i = 0; i < len; i++) arr.push(generateArbitraryJsonValue(nextFloat, depth + 1, maxDepth));
      return arr;
    }
    default: {
      const keys = Math.floor(nextFloat() * 5);
      const obj: Record<string, unknown> = {};
      const keyPool = ["id", "age", "seed", "method", "params", "name", "tag", "value", "commitSha"];
      for (let i = 0; i < keys; i++) {
        const key = keyPool[Math.floor(nextFloat() * keyPool.length)];
        obj[key] = generateArbitraryJsonValue(nextFloat, depth + 1, maxDepth);
      }
      return obj;
    }
  }
}

function safePredicate<T>(predicate: (v: T) => boolean, value: T): boolean {
  try {
    return predicate(value) === true;
  } catch {
    return false;
  }
}

function generateShrinkCandidates(value: unknown): unknown[] {
  const candidates: unknown[] = [];
  if (typeof value === "boolean") {
    if (value) candidates.push(false);
    return candidates;
  }
  if (typeof value === "number") {
    if (value !== 0) candidates.push(0);
    if (Object.is(value, -0)) return [0];
    if (Number.isFinite(value)) {
      const t = Math.trunc(value);
      if (t !== value) candidates.push(t);
      const half = Math.trunc(value / 2);
      if (half !== value) candidates.push(half);
      const step = value > 0 ? value - 1 : value + 1;
      if (step !== value && Math.abs(step) < Math.abs(value)) candidates.push(step);
    }
    return candidates;
  }
  if (typeof value === "string") {
    if (value.length > 0) candidates.push("");
    const cps = Array.from(value);
    if (cps.length > 1) {
      const mid = Math.floor(cps.length / 2);
      candidates.push(cps.slice(0, mid).join(""), cps.slice(mid).join(""));
      for (let i = 0; i < cps.length && i < 16; i++) {
        candidates.push([...cps.slice(0, i), ...cps.slice(i + 1)].join(""));
      }
    }
    return candidates;
  }
  if (Array.isArray(value)) {
    if (value.length > 0) candidates.push([]);
    if (value.length > 1) {
      const mid = Math.floor(value.length / 2);
      candidates.push(value.slice(0, mid), value.slice(mid));
      for (let i = 0; i < value.length && i < 16; i++) {
        candidates.push([...value.slice(0, i), ...value.slice(i + 1)]);
      }
    }
    for (let i = 0; i < value.length && i < 8; i++) {
      for (const shrunkEl of generateShrinkCandidates(value[i])) {
        const clone = [...value];
        clone[i] = shrunkEl;
        candidates.push(clone);
      }
    }
    return candidates;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length > 0) candidates.push({});
    for (const k of keys) {
      const without: Record<string, unknown> = { ...value };
      delete without[k];
      candidates.push(without);
    }
    for (const k of keys.slice(0, 6)) {
      for (const shrunkVal of generateShrinkCandidates(value[k])) {
        candidates.push({ ...value, [k]: shrunkVal });
      }
    }
  }
  return candidates;
}

/** Recursively shrink any failing JSON value/structure toward minimal failing form. */
export function shrinkJsonValue(
  failing: unknown,
  predicate: (v: unknown) => boolean,
  maxShrinkSteps = 128,
): { minimal: unknown; steps: number } {
  let current = failing;
  let steps = 0;
  while (steps < maxShrinkSteps) {
    let improved = false;
    for (const candidate of generateShrinkCandidates(current)) {
      if (steps >= maxShrinkSteps) break;
      steps++;
      if (!safePredicate(predicate, candidate)) {
        current = candidate;
        improved = true;
        break;
      }
    }
    if (!improved) break;
  }
  return { minimal: current, steps };
}

export class EosMetamorphicDifferentialBlindSpotCore {
  /** Pillar 1: Check invariant over seeded structural values and shrink counterexamples recursively. */
  public static checkStructuralProperty<T = unknown>(
    options: StructuralPropertyOptions<T>,
  ): StructuralPropertyReport<T> {
    if (
      !options ||
      typeof options.name !== "string" ||
      !options.name.trim() ||
      typeof options.predicate !== "function"
    ) {
      throw new BlindSpotError("BLINDSPOT_INVALID_PARAMETERS", "name and predicate function are required");
    }
    const seed = normalizeSeed(options.seed);
    const runs = normalizePositiveInt(options.runs, 200, 1, 5000, "runs");
    const maxDepth = normalizePositiveInt(options.maxDepth, 3, 0, 6, "maxDepth");
    const maxShrinkSteps = normalizePositiveInt(options.maxShrinkSteps, 128, 1, 1024, "maxShrinkSteps");
    const mode = options.generatorMode ?? "JSON_ANY";
    const nextFloat = createBlindSpotPrng(seed);

    for (let i = 0; i < runs; i++) {
      const candidate = options.generator
        ? options.generator(nextFloat, i)
        : ((mode === "INT_ARRAY"
            ? generateArbitraryIntArray(nextFloat)
            : generateArbitraryJsonValue(nextFloat, 0, maxDepth)) as T);

      if (!safePredicate(options.predicate, candidate)) {
        const shrunk = shrinkJsonValue(candidate, (v) => safePredicate(options.predicate, v as T), maxShrinkSteps);
        const body = {
          name: options.name.trim(),
          seed,
          runsExecuted: i + 1,
          passed: false,
          initialFailingInput: candidate,
          minimalCounterexample: shrunk.minimal as T,
          shrinkStepsTaken: shrunk.steps,
        };
        return { ...body, sha256Digest: sha256Hex(body) };
      }
    }

    const body = { name: options.name.trim(), seed, runsExecuted: runs, passed: true, shrinkStepsTaken: 0 };
    return { ...body, sha256Digest: sha256Hex(body) };
  }

  /** Pillar 2: Execute Differential Testing Oracle comparing reference vs candidate outputs. */
  public static runDifferentialCampaign<T = number[]>(
    options: DifferentialCampaignOptions<T>,
  ): DifferentialCampaignResult {
    if (
      !options ||
      typeof options.targetName !== "string" ||
      !options.targetName.trim() ||
      typeof options.referenceFn !== "function" ||
      typeof options.candidateFn !== "function"
    ) {
      throw new BlindSpotError("BLINDSPOT_INVALID_PARAMETERS", "targetName, referenceFn, and candidateFn are required");
    }
    const seed = normalizeSeed(options.seed);
    const runs = normalizePositiveInt(options.runs, 200, 1, 5000, "runs");
    const maxShrinkSteps = normalizePositiveInt(options.maxShrinkSteps, 128, 1, 1024, "maxShrinkSteps");
    const nextFloat = createBlindSpotPrng(seed);

    const isEquivalentOn = (val: unknown): boolean => {
      try {
        const ref = options.referenceFn(val as T);
        const cand = options.candidateFn(val as T);
        return canonicalSerialize(ref) === canonicalSerialize(cand);
      } catch {
        return false;
      }
    };

    let divergenceCount = 0;
    let firstDiverging: T | undefined;
    for (let i = 0; i < runs; i++) {
      const sample = options.generator
        ? options.generator(nextFloat, i)
        : (generateArbitraryIntArray(nextFloat, 0, 10) as unknown as T);
      if (!isEquivalentOn(sample)) {
        divergenceCount++;
        if (firstDiverging === undefined) firstDiverging = sample;
      }
    }

    if (firstDiverging === undefined) {
      const body = {
        targetName: options.targetName.trim(),
        seed,
        totalRuns: runs,
        divergenceCount: 0,
        equivalent: true,
        shrinkStepsTaken: 0,
      };
      return { ...body, sha256Digest: sha256Hex(body) };
    }

    const shrunk = shrinkJsonValue(firstDiverging, isEquivalentOn, maxShrinkSteps);
    let referenceOutput: unknown;
    let candidateOutput: unknown;
    let candidateError: string | undefined;
    try {
      referenceOutput = options.referenceFn(shrunk.minimal as T);
    } catch (err) {
      referenceOutput = `[Error: ${err instanceof Error ? err.message : String(err)}]`;
    }
    try {
      candidateOutput = options.candidateFn(shrunk.minimal as T);
    } catch (err) {
      candidateError = err instanceof Error ? err.message : String(err);
    }

    const body = {
      targetName: options.targetName.trim(),
      seed,
      totalRuns: runs,
      divergenceCount,
      equivalent: false,
      initialDivergingInput: firstDiverging,
      minimalDivergingInput: shrunk.minimal,
      referenceOutput,
      candidateOutput,
      ...(candidateError !== undefined ? { candidateError } : {}),
      shrinkStepsTaken: shrunk.steps,
    };
    return { ...body, sha256Digest: sha256Hex(body) };
  }

  /** Pillar 3: Verify mathematical Metamorphic Relations without precomputed ground-truth labels. */
  public static verifyMetamorphicRelation(options: MetamorphicCampaignOptions): MetamorphicCampaignResult {
    if (!options || typeof options.relation !== "string") {
      throw new BlindSpotError("BLINDSPOT_INVALID_PARAMETERS", "metamorphic relation name is required");
    }
    const seed = normalizeSeed(options.seed);
    const runs = normalizePositiveInt(options.runs, 150, 1, 5000, "runs");
    const nextFloat = createBlindSpotPrng(seed);
    let violations = 0;
    let minimal: unknown;
    let detail = "All metamorphic transformations satisfied.";

    if (options.relation === "SORT_PERMUTATION_IDEMPOTENCE") {
      const sortFn = options.sortFn ?? ((items: readonly number[]) => [...items].sort((a, b) => a - b));
      for (let i = 0; i < runs; i++) {
        const arr = generateArbitraryIntArray(nextFloat, 0, 12);
        const reversed = [...arr].reverse();
        const outA = sortFn(arr);
        const outB = sortFn(reversed);
        const ordered = outA.every((v, idx) => idx === 0 || outA[idx - 1] <= v);
        if (!ordered || canonicalSerialize(outA) !== canonicalSerialize(outB)) {
          violations++;
          if (minimal === undefined) {
            minimal = shrinkJsonValue(
              arr,
              (v) => {
                const candidateArr = v as number[];
                const sA = sortFn(candidateArr);
                const sB = sortFn([...candidateArr].reverse());
                return (
                  sA.every((x, idx) => idx === 0 || sA[idx - 1] <= x) &&
                  canonicalSerialize(sA) === canonicalSerialize(sB)
                );
              },
              64,
            ).minimal;
            detail = "Sort output violated ordering or permutation invariance.";
          }
        }
      }
    } else if (options.relation === "FILTER_SUBSET_MONOTONICITY") {
      const filterFn = options.filterFn ?? ((items: readonly number[], t: number) => items.filter((n) => n >= t));
      for (let i = 0; i < runs; i++) {
        const arr = generateArbitraryIntArray(nextFloat, 0, 14);
        const looseThreshold = Math.floor(nextFloat() * 50) - 25;
        const tightThreshold = looseThreshold + 1 + Math.floor(nextFloat() * 20);
        const resLoose = filterFn(arr, looseThreshold);
        const resTight = filterFn(arr, tightThreshold);
        if (!Array.isArray(resLoose) || !Array.isArray(resTight) || resTight.length > resLoose.length) {
          violations++;
          if (minimal === undefined) {
            minimal = { items: arr, looseThreshold, tightThreshold };
            detail = "Tighter predicate returned more items than looser predicate.";
          }
        }
      }
    } else if (options.relation === "JSON_ROUNDTRIP_INVERTIBILITY") {
      const ser = options.roundtripFn?.serialize ?? ((v: unknown) => JSON.stringify(v));
      const de = options.roundtripFn?.deserialize ?? ((s: string) => JSON.parse(s));
      for (let i = 0; i < runs; i++) {
        const val = generateArbitraryJsonValue(nextFloat, 0, 3);
        const safeNormalize = (x: unknown): unknown => JSON.parse(JSON.stringify(x));
        const expected = safeNormalize(val);
        let roundtripped: unknown;
        try {
          roundtripped = de(ser(expected));
        } catch {
          violations++;
          if (minimal === undefined) minimal = expected;
          continue;
        }
        if (canonicalSerialize(expected) !== canonicalSerialize(roundtripped)) {
          violations++;
          if (minimal === undefined) {
            minimal = expected;
            detail = "JSON round-trip altered structural representation.";
          }
        }
      }
    } else if (options.relation === "CUSTOM" && options.customRelation) {
      const cr = options.customRelation;
      for (let i = 0; i < runs; i++) {
        const x = generateArbitraryJsonValue(nextFloat, 0, 2);
        const tx = cr.transform(x, nextFloat);
        if (!cr.holds(cr.evaluate(x), cr.evaluate(tx), x, tx)) {
          violations++;
          if (minimal === undefined) {
            minimal = x;
            detail = "Custom metamorphic relation violated.";
          }
        }
      }
    } else {
      throw new BlindSpotError("BLINDSPOT_INVALID_PARAMETERS", `unsupported metamorphic relation: ${options.relation}`);
    }

    const body = {
      relation: options.relation,
      seed,
      totalRuns: runs,
      violationCount: violations,
      passed: violations === 0,
      ...(minimal !== undefined ? { minimalCounterexample: minimal } : {}),
      detail,
    };
    return { ...body, sha256Digest: sha256Hex(body) };
  }

  /** Synchronous 500-payload boundary fuzzing campaign (zero unhandled 500s). */
  public static runBoundaryFuzzCampaignSync(options: SyncBoundaryFuzzCampaignOptions): BoundaryFuzzCampaignResult {
    const acc = initFuzzAccumulator(options);
    for (let i = 0; i < acc.iterations; i++) {
      const payload = i < acc.corpus.length ? acc.corpus[i] : generateArbitraryJsonValue(acc.nextFloat, 0, 3);
      try {
        recordFuzzOutcome(acc, payload, options.handler(payload, i));
      } catch (err) {
        recordFuzzException(acc, payload, err);
      }
    }
    return finalizeFuzzAccumulator(acc);
  }

  /** Pillar 4: Async 500-payload API/handler boundary fuzzing campaign (zero unhandled 500s). */
  public static async runBoundaryFuzzCampaign(
    options: BoundaryFuzzCampaignOptions,
  ): Promise<BoundaryFuzzCampaignResult> {
    const acc = initFuzzAccumulator(options);
    for (let i = 0; i < acc.iterations; i++) {
      const payload = i < acc.corpus.length ? acc.corpus[i] : generateArbitraryJsonValue(acc.nextFloat, 0, 3);
      try {
        recordFuzzOutcome(acc, payload, await options.handler(payload, i));
      } catch (err) {
        recordFuzzException(acc, payload, err);
      }
    }
    return finalizeFuzzAccumulator(acc);
  }

  /** Pillar 5: Deterministic full self-audit across shrinking, differential, metamorphic, and 500-payload fuzzing. */
  public audit(seedInput = 2026341): BlindSpotHunterAuditReceipt {
    const seed = normalizeSeed(seedInput);

    const naiveSortCheck = EosMetamorphicDifferentialBlindSpotCore.checkStructuralProperty<number[]>({
      name: "naive_sort_blind_spot",
      seed,
      runs: 120,
      generatorMode: "INT_ARRAY",
      predicate: (arr) => {
        const sorted = [...arr].sort();
        return sorted.every((v, idx) => idx === 0 || sorted[idx - 1] <= v);
      },
    });
    const structuralShrinkCaughtSortBug =
      !naiveSortCheck.passed &&
      Array.isArray(naiveSortCheck.minimalCounterexample) &&
      naiveSortCheck.minimalCounterexample.length === 2;

    const diffBug = EosMetamorphicDifferentialBlindSpotCore.runDifferentialCampaign<number[]>({
      targetName: "naive_vs_numeric_sort",
      seed,
      runs: 120,
      referenceFn: (arr) => [...arr].sort((a, b) => a - b),
      candidateFn: (arr) => [...arr].sort(),
    });
    const diffOk = EosMetamorphicDifferentialBlindSpotCore.runDifferentialCampaign<number[]>({
      targetName: "numeric_sort_parity",
      seed,
      runs: 120,
      referenceFn: (arr) => [...arr].sort((a, b) => a - b),
      candidateFn: (arr) => [...arr].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    });

    const metaSort = EosMetamorphicDifferentialBlindSpotCore.verifyMetamorphicRelation({
      relation: "SORT_PERMUTATION_IDEMPOTENCE",
      seed,
      runs: 120,
    });
    const metaFilter = EosMetamorphicDifferentialBlindSpotCore.verifyMetamorphicRelation({
      relation: "FILTER_SUBSET_MONOTONICITY",
      seed: seed + 1,
      runs: 120,
    });
    const metaRoundtrip = EosMetamorphicDifferentialBlindSpotCore.verifyMetamorphicRelation({
      relation: "JSON_ROUNDTRIP_INVERTIBILITY",
      seed: seed + 2,
      runs: 120,
    });

    const fuzzRes = EosMetamorphicDifferentialBlindSpotCore.runBoundaryFuzzCampaignSync({
      targetName: "hardened_registration_validator",
      seed,
      iterations: 500,
      handler: (payload) => {
        if (!isPlainObject(payload)) return { statusCode: 400, body: { error: "invalid_object" } };
        const age = payload.age;
        if (typeof age !== "number" || !Number.isInteger(age) || age < 0 || age > 130) {
          return { statusCode: 422, body: { error: "invalid_age" } };
        }
        return { statusCode: 201, body: { adult: age >= 18 } };
      },
    });

    const allPassed =
      structuralShrinkCaughtSortBug &&
      !diffBug.equivalent &&
      diffBug.divergenceCount >= 1 &&
      diffOk.equivalent &&
      metaSort.passed &&
      metaFilter.passed &&
      metaRoundtrip.passed &&
      fuzzRes.unhandledExceptionCount === 0 &&
      fuzzRes.http5xxCount === 0 &&
      fuzzRes.stabilityScore === 1;

    const body = {
      specRef: "SPEC-341" as const,
      seed,
      structuralShrinkCaughtSortBug,
      minimalSortCounterexampleLength: naiveSortCheck.minimalCounterexample?.length ?? 0,
      differentialCaughtDivergence: !diffBug.equivalent && diffBug.divergenceCount >= 1,
      differentialParityConfirmed: diffOk.equivalent,
      metamorphicSortPassed: metaSort.passed,
      metamorphicFilterPassed: metaFilter.passed,
      metamorphicRoundtripPassed: metaRoundtrip.passed,
      fuzzCampaignIterations: fuzzRes.iterations,
      fuzzUnhandledExceptions: fuzzRes.unhandledExceptionCount,
      fuzzHttp5xxCount: fuzzRes.http5xxCount,
      fuzzStabilityScore: fuzzRes.stabilityScore,
      allPassed,
    };
    return { ...body, sha256Digest: sha256Hex(body) };
  }
}
