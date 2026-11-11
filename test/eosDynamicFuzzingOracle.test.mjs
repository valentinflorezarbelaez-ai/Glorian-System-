/**
 * EosDynamicFuzzingOracle Test Suite (SPEC-195 / CHANGE-080)
 *
 * Validates:
 * - Numeric boundary edge cases (IEEE 754 specials, integer bounds)
 * - String & Unicode malformation resistance (null bytes, surrogates, format strings)
 * - Structural prototype pollution and circular reference traps
 * - Bounded execution harness with latency percentiles and crash detection
 * - Cryptographic receipt generation and CLI invocation (glorian fuzz)
 *
 * Strict Layer-0 Purity: Node.js test runner and strict assertions.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EosDynamicFuzzingOracle } from "../src/core/eosDynamicFuzzingOracle.ts";

describe("SPEC-195: EosDynamicFuzzingOracle", () => {
  it("BDD-994: Numeric boundary edge-case mutation", () => {
    const corpus = EosDynamicFuzzingOracle.generateNumericCorpus();

    assert.ok(Array.isArray(corpus));
    assert.ok(corpus.some((v) => Number.isNaN(v)));
    assert.ok(corpus.some((v) => v === Infinity));
    assert.ok(corpus.some((v) => v === -Infinity));
    assert.ok(corpus.includes(Number.MAX_SAFE_INTEGER));
    assert.ok(corpus.includes(Number.MIN_SAFE_INTEGER));
    assert.ok(corpus.includes(0));
    assert.ok(corpus.includes(0x7fffffff));
  });

  it("BDD-995: Unicode and string malformation resistance", () => {
    const corpus = EosDynamicFuzzingOracle.generateStringCorpus();

    assert.ok(Array.isArray(corpus));
    assert.ok(corpus.includes(""));
    assert.ok(corpus.includes("\0"));
    assert.ok(corpus.some((s) => s.includes("\uD800")));
    assert.ok(corpus.some((s) => s.includes("%s%s")));
    assert.ok(corpus.some((s) => s.length >= 1024));
  });

  it("BDD-996: Structural prototype pollution and circular reference trap testing", () => {
    const corpus = EosDynamicFuzzingOracle.generateObjectCorpus();

    assert.ok(Array.isArray(corpus));
    assert.ok(corpus.includes(null));
    assert.ok(corpus.includes(undefined));

    // Ensure Object.prototype is not polluted
    const pollutedCandidate = corpus.find((item) => item && typeof item === "object" && "__proto__" in item);
    assert.ok(pollutedCandidate);
    assert.equal(Object.prototype.polluted, undefined);
  });

  it("BDD-997: Bounded execution campaign with crash detection and metrics", () => {
    // 1. Resilient target function
    const resilientTarget = (input) => {
      if (input === null || input === undefined) return "nil";
      return typeof input === "object" ? "obj" : String(input);
    };

    const resilientResult = EosDynamicFuzzingOracle.runCampaign(resilientTarget, "resilient_test_fn", {
      iterations: 30,
    });

    assert.equal(resilientResult.totalIterations, 30);
    assert.equal(resilientResult.successfulExecutions, 30);
    assert.equal(resilientResult.crashCount, 0);
    assert.equal(resilientResult.stabilityScore, 100);
    assert.equal(resilientResult.sha256Receipt.length, 64);
    assert.ok(resilientResult.latencyMetricsUs.p50Us >= 0);

    // 2. Error-prone target function that crashes on non-strings or format strings
    const fragileTarget = (input) => {
      if (typeof input !== "string") {
        throw new TypeError("EXPECTED_STRING_ONLY");
      }
      if (input.includes("%n")) {
        throw new Error("FORMAT_STRING_CRASH");
      }
      return input.length;
    };

    const fragileResult = EosDynamicFuzzingOracle.runCampaign(fragileTarget, "fragile_test_fn", { iterations: 40 });

    assert.ok(fragileResult.crashCount > 0);
    assert.ok(fragileResult.stabilityScore < 100);
    assert.ok(fragileResult.crashes.length > 0);
    assert.ok(fragileResult.crashes[0].errorName.length > 0);
  });

  it("BDD-998: Cryptographic receipt generation and CLI invocation", () => {
    const root = path.resolve(".");
    const binPath = path.join(root, "bin", "eos.mjs");

    const stdout = execFileSync("node", [binPath, "fuzz", "--iterations=25", "--json"], {
      cwd: root,
      encoding: "utf8",
    });

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.targetName, "kernel:pureSha256");
    assert.equal(parsed.totalIterations, 25);
    assert.equal(parsed.stabilityScore, 100);
    assert.equal(parsed.crashCount, 0);
    assert.equal(parsed.sha256Receipt.length, 64);
    assert.ok(parsed.latencyMetricsUs);
  });
});
