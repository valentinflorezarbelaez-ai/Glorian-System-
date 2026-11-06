import test from "node:test";
import assert from "node:assert/strict";

import { EosBenchmarkTracker } from "../src/core/eosBenchmarkTracker.ts";

test("BDD-204: EosBenchmarkTracker records nanosecond benchmarks and detects historical regressions", () => {
  const tracker = new EosBenchmarkTracker(":memory:");

  try {
    // 1. Initial run (baseline)
    const run1 = tracker.recordBenchmark({
      benchmarkName: "DisruptorRing_Throughput",
      commitSha: "abc111",
      p50Ns: 120,
      p95Ns: 150,
      p99Ns: 180,
      opsPerSec: 5000000
    });

    assert.equal(run1.verdict, "NOMINAL");
    assert.equal(run1.baselineP95Ns, 150);
    assert.equal(run1.percentChange, 0);
    assert.equal(run1.isRegression, false);

    // 2. Second run within tolerance (+5%)
    const run2 = tracker.recordBenchmark({
      benchmarkName: "DisruptorRing_Throughput",
      commitSha: "abc222",
      p50Ns: 125,
      p95Ns: 157.5,
      p99Ns: 185,
      opsPerSec: 4900000
    });

    assert.equal(run2.verdict, "NOMINAL");
    assert.equal(run2.baselineP95Ns, 150);
    assert.equal(run2.percentChange, 5);
    assert.equal(run2.isRegression, false);

    // 3. Third run with severe regression (+30%)
    const run3 = tracker.recordBenchmark({
      benchmarkName: "DisruptorRing_Throughput",
      commitSha: "abc333",
      p50Ns: 160,
      p95Ns: 204.75, // +30% over 157.5
      p99Ns: 250,
      opsPerSec: 3500000
    });

    assert.equal(run3.verdict, "REGRESSION_DETECTED");
    assert.equal(run3.isRegression, true);
    assert.ok(run3.percentChange >= 30);

    // 4. Fourth run with optimization (-25%)
    const run4 = tracker.recordBenchmark({
      benchmarkName: "DisruptorRing_Throughput",
      commitSha: "abc444",
      p50Ns: 90,
      p95Ns: 110,
      p99Ns: 130,
      opsPerSec: 7000000
    });

    assert.equal(run4.verdict, "OPTIMIZED");
    assert.equal(run4.isRegression, false);

    // 5. Query history
    const history = tracker.getHistory("DisruptorRing_Throughput", 10);
    assert.equal(history.length, 4);
  } finally {
    tracker.close();
  }
});
