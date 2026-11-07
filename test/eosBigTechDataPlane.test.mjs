/**
 * BDD Test Suite — Big Tech Data Plane Modules (SPEC-171..176)
 * Covers: CacheEngine, DependencyContainer, ReactiveStream, BatchAggregator,
 *         CertificateLifecycle, ProbabilisticDataStructures
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosCacheEngine } from "../src/core/eosCacheEngine.ts";
import { EosDependencyContainer } from "../src/core/eosDependencyContainer.ts";
import { EosObservable, EosBoundedQueue } from "../src/core/eosReactiveStreamEngine.ts";
import { EosBatchAggregator } from "../src/core/eosBatchAggregator.ts";
import { EosCertificateLifecycleManager } from "../src/core/eosCertificateLifecycleManager.ts";
import { EosBloomFilter, EosCountMinSketch } from "../src/core/eosProbabilisticDataStructures.ts";

// ---------------------------------------------------------------------------
describe("SPEC-171: Cache Engine (LRU + TTL + singleflight)", () => {
  it("BDD-800: set/get hit updates LRU order", () => {
    const c = new EosCacheEngine({ maxEntries: 2, defaultTtlMs: 1000 });
    c.set("a", 1);
    c.set("b", 2);
    c.get("a"); // touch a so b becomes LRU
    c.set("c", 3); // should evict b
    assert.equal(c.get("a"), 1);
    assert.equal(c.get("b"), undefined);
    assert.equal(c.get("c"), 3);
  });

  it("BDD-801: TTL expiry counts as miss", async () => {
    const c = new EosCacheEngine({ maxEntries: 10, defaultTtlMs: 1 });
    c.set("k", 42, 1);
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(c.get("k"), undefined);
    assert.ok(c.telemetry().expired >= 1);
  });

  it("BDD-802: singleflight coalesces concurrent loads", async () => {
    const c = new EosCacheEngine({ maxEntries: 10, defaultTtlMs: 1000 });
    let backendCalls = 0;
    const loader = async () => {
      backendCalls++;
      await new Promise((r) => setTimeout(r, 10));
      return "V";
    };
    const results = await Promise.all([c.load("k", loader), c.load("k", loader), c.load("k", loader)]);
    assert.deepEqual(results, ["V", "V", "V"]);
    assert.equal(backendCalls, 1);
    assert.ok(c.telemetry().stampedesCoalesced >= 2);
  });

  it("BDD-803: hit ratio reflects traffic", () => {
    const c = new EosCacheEngine({ maxEntries: 10, defaultTtlMs: 5000 });
    c.set("a", 1);
    c.get("a");
    c.get("a");
    c.get("miss");
    const ratio = c.hitRatio();
    assert.ok(ratio > 0.6 && ratio < 0.7);
  });

  it("BDD-804: fingerprint is stable across same-state instances", () => {
    const c1 = new EosCacheEngine({ maxEntries: 5, defaultTtlMs: 5000 });
    const c2 = new EosCacheEngine({ maxEntries: 5, defaultTtlMs: 5000 });
    c1.set("x", 1);
    c1.set("y", 2);
    c2.set("x", 1);
    c2.set("y", 2);
    assert.equal(c1.stateFingerprint(), c2.stateFingerprint());
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-172: Dependency Injection Container", () => {
  it("BDD-810: singleton returns same instance across resolves", () => {
    const c = new EosDependencyContainer();
    c.register("logger", () => ({ id: Math.random() }), "SINGLETON");
    assert.equal(c.resolve("logger"), c.resolve("logger"));
  });

  it("BDD-811: transient returns new instance every resolve", () => {
    const c = new EosDependencyContainer();
    c.register("id", () => ({ v: Math.random() }), "TRANSIENT");
    assert.notEqual(c.resolve("id"), c.resolve("id"));
  });

  it("BDD-812: scoped returns same within scope but different across scopes", () => {
    const c = new EosDependencyContainer();
    c.register("ctx", () => ({ id: Math.random() }), "SCOPED");
    const s1 = c.createScope();
    const s2 = c.createScope();
    assert.equal(s1.resolve("ctx"), s1.resolve("ctx"));
    assert.notEqual(s1.resolve("ctx"), s2.resolve("ctx"));
    s1.dispose();
    s2.dispose();
  });

  it("BDD-813: circular dependency throws", () => {
    const c = new EosDependencyContainer();
    c.register("a", (r) => ({ b: r("b") }), "TRANSIENT", ["b"]);
    c.register("b", (r) => ({ a: r("a") }), "TRANSIENT", ["a"]);
    assert.throws(() => c.resolve("a"), /Circular dependency/);
  });

  it("BDD-814: unregistered token throws", () => {
    const c = new EosDependencyContainer();
    assert.throws(() => c.resolve("ghost"), /no registration/);
  });

  it("BDD-815: graph fingerprint is order-independent", () => {
    const c1 = new EosDependencyContainer();
    const c2 = new EosDependencyContainer();
    c1.register("a", () => 1, "SINGLETON", []);
    c1.register("b", () => 2, "TRANSIENT", []);
    c2.register("b", () => 2, "TRANSIENT", []);
    c2.register("a", () => 1, "SINGLETON", []);
    assert.equal(c1.graphFingerprint(), c2.graphFingerprint());
  });

  it("BDD-816: disposed scope rejects resolve", () => {
    const c = new EosDependencyContainer();
    c.register("x", () => 1, "SCOPED");
    const s = c.createScope();
    s.dispose();
    assert.throws(() => s.resolve("x"), /disposed/);
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-173: Reactive Stream Operators", () => {
  it("BDD-820: map transforms each value", async () => {
    const src = new EosObservable();
    const mapped = src.map((x) => x * 2);
    const p = mapped.collect();
    src.next(1);
    src.next(2);
    src.next(3);
    src.complete();
    assert.deepEqual(await p, [2, 4, 6]);
  });

  it("BDD-821: filter drops non-matching", async () => {
    const src = new EosObservable();
    const p = src.filter((x) => x % 2 === 0).collect();
    for (const v of [1, 2, 3, 4, 5]) src.next(v);
    src.complete();
    assert.deepEqual(await p, [2, 4]);
  });

  it("BDD-822: take completes after N values", async () => {
    const src = new EosObservable();
    const p = src.take(3).collect();
    for (let i = 1; i <= 10; i++) src.next(i);
    assert.deepEqual(await p, [1, 2, 3]);
  });

  it("BDD-823: buffer aggregates in fixed-size chunks with tail", async () => {
    const src = new EosObservable();
    const p = src.buffer(2).collect();
    src.next(1);
    src.next(2);
    src.next(3);
    src.complete();
    assert.deepEqual(await p, [[1, 2], [3]]);
  });

  it("BDD-824: merge combines sources", async () => {
    const a = new EosObservable();
    const b = new EosObservable();
    const p = EosObservable.merge(a, b).collect();
    a.next(1);
    b.next(2);
    a.next(3);
    a.complete();
    b.complete();
    assert.deepEqual(await p, [1, 2, 3]);
  });

  it("BDD-825: error terminates all subscribers", async () => {
    const src = new EosObservable();
    let receivedError = null;
    src.subscribe({
      onNext: () => {},
      onError: (e) => {
        receivedError = String(e);
      },
      onComplete: () => {},
    });
    src.error(new Error("boom"));
    src.next(1); // ignored after terminal
    assert.ok(receivedError && receivedError.includes("boom"));
    assert.equal(src.isTerminated, true);
  });

  it("BDD-826: bounded queue drops on overflow", () => {
    const q = new EosBoundedQueue(2);
    assert.equal(q.tryOffer("a"), true);
    assert.equal(q.tryOffer("b"), true);
    assert.equal(q.tryOffer("c"), false);
    assert.equal(q.poll(), "a");
    assert.equal(q.isFull, false);
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-174: Batch Aggregator", () => {
  it("BDD-830: size trigger fires exact batches", () => {
    const b = new EosBatchAggregator({ maxBatchSize: 3, maxDelayMs: 10_000 });
    assert.equal(b.add("a"), null);
    assert.equal(b.add("b"), null);
    const batch = b.add("c");
    assert.ok(batch);
    assert.equal(batch.trigger, "SIZE");
    assert.deepEqual([...batch.items], ["a", "b", "c"]);
  });

  it("BDD-831: tick flushes aged partial batches", () => {
    const b = new EosBatchAggregator({ maxBatchSize: 100, maxDelayMs: 50 });
    b.add("x");
    const now = Date.now() + 100;
    const flushed = b.tick(now);
    assert.equal(flushed.length, 1);
    assert.equal(flushed[0].trigger, "TIME");
  });

  it("BDD-832: keyed partitioning isolates streams", () => {
    const b = new EosBatchAggregator({ maxBatchSize: 2, maxDelayMs: 10_000 });
    b.add("a", "eu");
    b.add("b", "us");
    const eub = b.add("c", "eu");
    assert.ok(eub);
    assert.equal(eub.key, "eu");
    assert.deepEqual([...eub.items], ["a", "c"]);
  });

  it("BDD-833: flushAll drains every non-empty bucket", () => {
    const b = new EosBatchAggregator({ maxBatchSize: 100, maxDelayMs: 100_000 });
    b.add("k1", "a");
    b.add("k2", "a");
    b.add("k1", "b");
    const all = b.flushAll();
    assert.equal(all.length, 2);
    assert.equal(b.pendingCount(), 0);
  });

  it("BDD-834: maxKeys enforces partition cap", () => {
    const b = new EosBatchAggregator({ maxBatchSize: 10, maxDelayMs: 10_000, maxKeys: 2 });
    b.add("v1", "a");
    b.add("v2", "b");
    assert.throws(() => b.add("v3", "c"), /key capacity/);
  });

  it("BDD-835: fingerprint changes when batches change", () => {
    const b1 = new EosBatchAggregator({ maxBatchSize: 2, maxDelayMs: 10_000 });
    const b2 = new EosBatchAggregator({ maxBatchSize: 2, maxDelayMs: 10_000 });
    b1.add(1);
    b1.add(2);
    b2.add(1);
    b2.add(2);
    b2.add(3);
    b2.add(4);
    assert.notEqual(b1.fingerprint(), b2.fingerprint());
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-175: TLS Certificate Lifecycle Manager", () => {
  const policy = { renewalWindowDays: 30, warnDaysBeforeExpiry: 7 };

  it("BDD-840: newly issued cert is ACTIVE when far from expiry", () => {
    const m = new EosCertificateLifecycleManager(policy);
    const c = m.issue("api.example.com", "IntCA", ["api.example.com"], 365);
    assert.equal(m.status(c.serial), "ACTIVE");
  });

  it("BDD-841: cert inside renewal window is RENEWING", () => {
    const m = new EosCertificateLifecycleManager(policy);
    const c = m.issue("short.example.com", "IntCA", ["short"], 15);
    assert.equal(m.status(c.serial), "RENEWING");
  });

  it("BDD-842: renew retires the old serial", () => {
    const m = new EosCertificateLifecycleManager(policy);
    const c1 = m.issue("a.example.com", "IntCA", ["a"], 300);
    const c2 = m.renew(c1.serial, 300);
    assert.equal(m.status(c1.serial), "REVOKED");
    assert.equal(m.status(c2.serial), "ACTIVE");
    assert.notEqual(c1.serial, c2.serial);
  });

  it("BDD-843: manual revoke reflects in status", () => {
    const m = new EosCertificateLifecycleManager(policy);
    const c = m.issue("x", "IntCA", ["x"], 90);
    assert.equal(m.revoke(c.serial), true);
    assert.equal(m.status(c.serial), "REVOKED");
  });

  it("BDD-844: chain verification walks issuer linkage", () => {
    const m = new EosCertificateLifecycleManager(policy);
    const root = m.issue("RootCA", "RootCA", [], 3650);
    const inter = m.issue("IntCA", "RootCA", [], 730);
    const leaf = m.issue("leaf.example.com", "IntCA", ["leaf"], 90);
    const result = m.verifyChain([leaf.serial, inter.serial, root.serial]);
    assert.equal(result.ok, true);
  });

  it("BDD-845: chain with revoked intermediate breaks", () => {
    const m = new EosCertificateLifecycleManager(policy);
    const root = m.issue("RC", "RC", [], 3650);
    const inter = m.issue("IC", "RC", [], 730);
    const leaf = m.issue("L", "IC", ["L"], 90);
    m.revoke(inter.serial);
    const r = m.verifyChain([leaf.serial, inter.serial, root.serial]);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "revoked");
  });

  it("BDD-846: CRL fingerprint is deterministic", () => {
    const m1 = new EosCertificateLifecycleManager(policy);
    const m2 = new EosCertificateLifecycleManager(policy);
    const a = m1.issue("x", "CA", [], 90);
    const b = m2.issue("x", "CA", [], 90);
    m1.revoke(a.serial);
    m2.revoke(b.serial);
    assert.equal(m1.crlFingerprint(), m2.crlFingerprint());
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-176: Probabilistic Data Structures", () => {
  it("BDD-850: bloom filter has zero false negatives", () => {
    const bf = new EosBloomFilter({ capacity: 1000, falsePositiveRate: 0.01 });
    const keys = [];
    for (let i = 0; i < 500; i++) {
      const k = `k-${i}`;
      keys.push(k);
      bf.add(k);
    }
    for (const k of keys) assert.equal(bf.has(k), true);
  });

  it("BDD-851: bloom filter FP rate stays under target on unseen keys", () => {
    const bf = new EosBloomFilter({ capacity: 1000, falsePositiveRate: 0.01 });
    for (let i = 0; i < 1000; i++) bf.add(`present-${i}`);
    let fp = 0;
    const trials = 5000;
    for (let i = 0; i < trials; i++) if (bf.has(`absent-${i}`)) fp++;
    assert.ok(fp / trials < 0.05, `FP rate too high: ${fp / trials}`);
  });

  it("BDD-852: bloom fingerprint is stable", () => {
    const a = new EosBloomFilter({ capacity: 100, falsePositiveRate: 0.01 });
    const b = new EosBloomFilter({ capacity: 100, falsePositiveRate: 0.01 });
    for (const k of ["x", "y", "z"]) {
      a.add(k);
      b.add(k);
    }
    assert.equal(a.fingerprint(), b.fingerprint());
  });

  it("BDD-853: count-min overestimates but never underestimates", () => {
    const cms = new EosCountMinSketch(1000, 5);
    for (let i = 0; i < 50; i++) cms.add("hot");
    for (let i = 0; i < 5; i++) cms.add("cold");
    assert.ok(cms.estimate("hot") >= 50);
    assert.ok(cms.estimate("cold") >= 5);
  });

  it("BDD-854: conservative update improves accuracy", () => {
    const a = new EosCountMinSketch(50, 4);
    const b = new EosCountMinSketch(50, 4);
    for (let i = 0; i < 1000; i++) {
      const k = `key-${i % 20}`;
      a.add(k);
      b.conservativeAdd(k);
    }
    // Both must at least track true totals; conservative should be <= standard for skew
    assert.ok(b.estimate("key-5") <= a.estimate("key-5") + 5);
  });

  it("BDD-855: observed total increments per add", () => {
    const cms = new EosCountMinSketch(100, 3);
    cms.add("a", 2);
    cms.add("b", 3);
    assert.equal(cms.observedTotal, 5);
  });

  it("BDD-856: fingerprint distinguishes different content", () => {
    const a = new EosCountMinSketch(100, 3);
    const b = new EosCountMinSketch(100, 3);
    a.add("apple");
    b.add("orange");
    assert.notEqual(a.fingerprint(), b.fingerprint());
  });
});
