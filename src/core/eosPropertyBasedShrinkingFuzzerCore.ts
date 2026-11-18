/**
 * SPEC-240 / CHANGE-121 — Layer-0 Property-Based Testing & Counterexample Shrinking Engine.
 * Provides deterministic seeded PRNG generation and binary/structural counterexample
 * shrinking with zero third-party runtime dependencies (EOS Law V).
 */

import crypto from "node:crypto";
import type {
  NumericPropertyOptions,
  PropertyCheckResult,
  PropertySuiteReport,
  StringPropertyOptions,
} from "./eosPropertyBasedShrinkingFuzzerCore.types.ts";

function finiteInt(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function createXorShift32(seedInput: number | undefined): () => number {
  const normalized = finiteInt(seedInput, 1337);
  let state = (normalized === 0 ? 0x9e3779b9 : normalized) | 0 || 1337;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function safeCall<T>(predicate: (v: T) => boolean, value: T): boolean {
  try {
    return predicate(value) === true;
  } catch {
    return false;
  }
}

function sha256Hex(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function shrinkNumberTowardTarget(
  failing: number,
  target: number,
  maxSteps: number,
  predicate: (n: number) => boolean,
): { minimal: number; steps: number } {
  if (!safeCall(predicate, target)) {
    return { minimal: target, steps: 1 };
  }
  let ok = target;
  let bad = failing;
  let steps = 0;

  while (Math.abs(bad - ok) > 1 && steps < maxSteps) {
    const mid = Math.trunc((ok + bad) / 2);
    steps++;
    if (!safeCall(predicate, mid)) {
      bad = mid;
    } else {
      ok = mid;
    }
  }
  return { minimal: bad, steps };
}

function findSingleCharShrink(current: string, predicate: (s: string) => boolean): string | undefined {
  const codePoints = Array.from(current);
  for (let i = 0; i < codePoints.length; i++) {
    const candidate = [...codePoints.slice(0, i), ...codePoints.slice(i + 1)].join("");
    if (!safeCall(predicate, candidate)) return candidate;
  }
  return undefined;
}

function shrinkString(
  failing: string,
  maxSteps: number,
  predicate: (s: string) => boolean,
): { minimal: string; steps: number } {
  if (!safeCall(predicate, "")) {
    return { minimal: "", steps: 1 };
  }
  let current = failing;
  let steps = 0;

  while (Array.from(current).length > 0 && steps < maxSteps) {
    const codePoints = Array.from(current);
    const half = Math.floor(codePoints.length / 2);
    const left = codePoints.slice(0, half).join("");
    const right = codePoints.slice(half).join("");

    if (left.length > 0 && !safeCall(predicate, left)) {
      current = left;
      steps++;
      continue;
    }
    if (right.length > 0 && right.length < current.length && !safeCall(predicate, right)) {
      current = right;
      steps++;
      continue;
    }
    const reduced = findSingleCharShrink(current, predicate);
    if (reduced !== undefined) {
      current = reduced;
      steps++;
      continue;
    }
    break;
  }
  return { minimal: current, steps };
}

function generateSeededString(nextFloat: () => number, alphabet: string, maxLength: number): string {
  const chars = Array.from(alphabet);
  const len = Math.floor(nextFloat() * (maxLength + 1));
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(nextFloat() * chars.length)];
  }
  return out;
}

export class EosPropertyBasedShrinkingFuzzerCore {
  public static checkNumericProperty(options: NumericPropertyOptions): PropertyCheckResult<number> {
    const seed = finiteInt(options.seed, 1337);
    const runs = Math.max(1, Math.min(2000, finiteInt(options.runs, 100)));
    const rawMin = Math.max(-1_000_000_000, Math.min(1_000_000_000, finiteInt(options.min, 0)));
    const rawMax = Math.max(-1_000_000_000, Math.min(1_000_000_000, finiteInt(options.max, 10000)));
    const min = Math.min(rawMin, rawMax);
    const max = Math.max(rawMin, rawMax);
    const maxShrinkSteps = Math.max(1, Math.min(1024, finiteInt(options.maxShrinkSteps, 64)));
    const nextFloat = createXorShift32(seed);

    for (let i = 0; i < runs; i++) {
      const candidate = min + Math.floor(nextFloat() * (max - min + 1));
      if (!safeCall(options.predicate, candidate)) {
        const target = min <= 0 && max >= 0 ? 0 : min;
        const shrunk = shrinkNumberTowardTarget(candidate, target, maxShrinkSteps, options.predicate);
        const body = {
          name: options.name,
          passed: false,
          runsExecuted: i + 1,
          seed,
          initialFailingInput: candidate,
          minimalCounterexample: shrunk.minimal,
          shrinkStepsTaken: shrunk.steps,
        };
        return { ...body, resultDigestSha256: sha256Hex(body) };
      }
    }

    const body = { name: options.name, passed: true, runsExecuted: runs, seed, shrinkStepsTaken: 0 };
    return { ...body, resultDigestSha256: sha256Hex(body) };
  }

  public static checkStringProperty(options: StringPropertyOptions): PropertyCheckResult<string> {
    const seed = finiteInt(options.seed, 1337);
    const runs = Math.max(1, Math.min(2000, finiteInt(options.runs, 100)));
    const maxLength = Math.max(1, Math.min(256, finiteInt(options.maxLength, 32)));
    const alphabet =
      options.alphabet && options.alphabet.length > 0 ? options.alphabet : "abcdefghijklmnopqrstuvwxyz0123456789-_";
    const maxShrinkSteps = Math.max(1, Math.min(1024, finiteInt(options.maxShrinkSteps, 64)));
    const nextFloat = createXorShift32(seed);

    for (let i = 0; i < runs; i++) {
      const candidate = generateSeededString(nextFloat, alphabet, maxLength);
      if (!safeCall(options.predicate, candidate)) {
        const shrunk = shrinkString(candidate, maxShrinkSteps, options.predicate);
        const body = {
          name: options.name,
          passed: false,
          runsExecuted: i + 1,
          seed,
          initialFailingInput: candidate,
          minimalCounterexample: shrunk.minimal,
          shrinkStepsTaken: shrunk.steps,
        };
        return { ...body, resultDigestSha256: sha256Hex(body) };
      }
    }

    const body = { name: options.name, passed: true, runsExecuted: runs, seed, shrinkStepsTaken: 0 };
    return { ...body, resultDigestSha256: sha256Hex(body) };
  }

  public static runBuiltInSuite(seed = 1337): PropertySuiteReport {
    const safeSeed = finiteInt(seed, 1337);
    const r1 = EosPropertyBasedShrinkingFuzzerCore.checkNumericProperty({
      name: "integer_addition_commutativity",
      seed: safeSeed,
      runs: 100,
      min: -5000,
      max: 5000,
      predicate: (n) => n + 7 === 7 + n,
    });
    const r2 = EosPropertyBasedShrinkingFuzzerCore.checkStringProperty({
      name: "sha256_digest_length_64_hex_invariant",
      seed: safeSeed + 1,
      runs: 80,
      maxLength: 48,
      predicate: (s) => /^[0-9a-f]{64}$/.test(crypto.createHash("sha256").update(s).digest("hex")),
    });
    const r3 = EosPropertyBasedShrinkingFuzzerCore.checkNumericProperty({
      name: "clamped_percentage_bounds_invariant",
      seed: safeSeed + 2,
      runs: 100,
      min: -100,
      max: 200,
      predicate: (n) => {
        const clamped = Math.min(100, Math.max(0, n));
        return clamped >= 0 && clamped <= 100;
      },
    });
    const results: Array<PropertyCheckResult<number | string>> = [r1, r2, r3];
    const passedProperties = results.filter((r) => r.passed).length;
    const body = {
      seed: safeSeed,
      totalProperties: results.length,
      passedProperties,
      allPassed: passedProperties === results.length,
      results,
    };
    return { ...body, suiteDigestSha256: sha256Hex(body) };
  }
}
