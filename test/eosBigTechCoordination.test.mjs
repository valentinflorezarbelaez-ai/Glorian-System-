/**
 * BDD Test Suite — Big Tech Distributed Coordination Modules (SPEC-177..182)
 * Covers: TimingWheel, GossipMembership, VectorClock, DagScheduler,
 *         ScatterGather, SchemaRegistry
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosHashedTimingWheel } from "../src/core/eosHashedTimingWheel.ts";
import { EosGossipMembership } from "../src/core/eosGossipMembership.ts";
import { EosVectorClock, EosCausalRegister } from "../src/core/eosVectorClockCausality.ts";
import { EosDagJobScheduler } from "../src/core/eosDagJobScheduler.ts";
import { EosScatterGatherEngine } from "../src/core/eosScatterGatherHedger.ts";
import { EosSchemaRegistry } from "../src/core/eosSchemaRegistry.ts";

// ---------------------------------------------------------------------------
describe("SPEC-177: Hashed Timing Wheel", () => {
  it("BDD-900: one-shot fires exactly at deadline tick", () => {
    const w = new EosHashedTimingWheel({ slots: 8, tickDurationMs: 10 });
    let fired = false;
    w.schedule(30, () => {
      fired = true;
    });
    w.advance(1);
    w.advance(1);
    assert.equal(fired, false);
    w.advance(1);
    assert.equal(fired, true);
  });

  it("BDD-901: cancellation prevents firing", () => {
    const w = new EosHashedTimingWheel({ slots: 8, tickDurationMs: 10 });
    let count = 0;
    const h = w.schedule(50, () => {
      count++;
    });
    assert.equal(w.cancel(h), true);
    w.advance(10);
    assert.equal(count, 0);
    assert.equal(w.telemetry().cancelled, 1);
  });

  it("BDD-902: overflow rounds for far-future deadlines", () => {
    const w = new EosHashedTimingWheel({ slots: 4, tickDurationMs: 10 });
    let fired = false;
    w.schedule(70, () => {
      fired = true;
    }); // 7 ticks > 4 slots
    w.advance(6);
    assert.equal(fired, false);
    w.advance(1);
    assert.equal(fired, true);
  });

  it("BDD-903: recurring timers reschedule", () => {
    const w = new EosHashedTimingWheel({ slots: 8, tickDurationMs: 10 });
    let count = 0;
    w.scheduleRecurring(20, 30, () => {
      count++;
    });
    w.advance(2);
    assert.equal(count, 1);
    w.advance(3);
    assert.equal(count, 2);
    w.advance(3);
    assert.equal(count, 3);
  });

  it("BDD-904: fingerprint distinguishes different schedules", () => {
    const w1 = new EosHashedTimingWheel({ slots: 4, tickDurationMs: 10 });
    const w2 = new EosHashedTimingWheel({ slots: 4, tickDurationMs: 10 });
    w1.schedule(10, () => {});
    w2.schedule(20, () => {});
    assert.notEqual(w1.fingerprint(), w2.fingerprint());
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-178: SWIM Gossip Membership", () => {
  it("BDD-910: all healthy members remain ALIVE after rounds", () => {
    const t = { ping: () => true, pingReq: () => true };
    const g = new EosGossipMembership(t, { seedPeers: ["a", "b", "c"] });
    g.round();
    g.round();
    g.round();
    const snap = g.snapshot();
    assert.deepEqual(snap.alive, ["a", "b", "c"]);
    assert.equal(snap.failed.length, 0);
  });

  it("BDD-911: unreachable member escalates SUSPECT then FAILED", () => {
    const dead = "b";
    const t = {
      ping: (_f, to) => to !== dead,
      pingReq: (_f, _v, target) => target !== dead,
    };
    const g = new EosGossipMembership(t, { seedPeers: ["a", "b", "c"], confirmRounds: 2 });
    g.round(); // b -> SUSPECT
    assert.equal(g.stateOf("b"), "SUSPECT");
    g.round();
    g.round(); // escalate
    assert.equal(g.stateOf("b"), "FAILED");
  });

  it("BDD-912: indirect ping rescues a partitioned member", () => {
    const t = {
      ping: (_f, to) => to !== "b",
      pingReq: (_f, _via, target) => target === "b", // proxy can reach b
    };
    const g = new EosGossipMembership(t, { seedPeers: ["a", "b", "c"] });
    g.round();
    assert.equal(g.stateOf("b"), "ALIVE");
  });

  it("BDD-913: applyIndirect with lower incarnation is ignored", () => {
    const t = { ping: () => true, pingReq: () => true };
    const g = new EosGossipMembership(t, { seedPeers: ["a", "b", "c"] });
    assert.equal(g.applyIndirect("a", "FAILED", 1), false); // same incarnation
    assert.equal(g.applyIndirect("a", "FAILED", 5), true);
    assert.equal(g.stateOf("a"), "FAILED");
  });

  it("BDD-914: fingerprint is deterministic given same inputs", () => {
    const build = () => {
      const t = { ping: (_f, to) => to !== "c", pingReq: () => false };
      const g = new EosGossipMembership(t, { seedPeers: ["a", "b", "c"], confirmRounds: 1 });
      g.round();
      g.round();
      return g.fingerprint();
    };
    assert.equal(build(), build());
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-179: Vector Clock / Causal Ordering", () => {
  it("BDD-920: same-replica increment gives BEFORE/AFTER", () => {
    const c1 = new EosVectorClock({ a: 1 });
    const c2 = c1.increment("a");
    assert.equal(c1.compare(c2), "BEFORE");
    assert.equal(c2.compare(c1), "AFTER");
  });

  it("BDD-921: disjoint increments are CONCURRENT", () => {
    const base = new EosVectorClock({ a: 1, b: 1 });
    const ca = base.increment("a");
    const cb = base.increment("b");
    assert.equal(ca.compare(cb), "CONCURRENT");
  });

  it("BDD-922: merge takes element-wise max", () => {
    const c1 = new EosVectorClock({ a: 3, b: 1 });
    const c2 = new EosVectorClock({ a: 1, b: 5 });
    const m = c1.merge(c2);
    assert.equal(m.get("a"), 3);
    assert.equal(m.get("b"), 5);
  });

  it("BDD-923: causal register merge adopts newer version", () => {
    const reg = new EosCausalRegister();
    const v1 = reg.put("a", 10, 100);
    const v2 = { replicaId: "a", value: 20, clock: v1.clock.increment("a"), wallTickMs: 200 };
    reg.merge(v2);
    assert.equal(reg.read().value, 20);
  });

  it("BDD-924: concurrent writes resolved by wallTick tie-break", () => {
    const reg = new EosCausalRegister();
    const vA = reg.put("a", "fromA", 100);
    const vB = { replicaId: "b", value: "fromB", clock: new EosVectorClock({ a: 1, b: 1 }), wallTickMs: 200 };
    reg.merge(vB);
    assert.equal(reg.read().value, "fromB");
    assert.ok(vA.wallTickMs < 200);
  });

  it("BDD-925: clock digest is stable regardless of entry order", () => {
    const c1 = new EosVectorClock({ a: 1, b: 2 });
    const c2 = new EosVectorClock({ b: 2, a: 1 });
    assert.equal(c1.digest(), c2.digest());
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-180: DAG Job Scheduler", () => {
  it("BDD-930: topo order respects dependencies", () => {
    const d = new EosDagJobScheduler();
    d.add({ id: "a", deps: [], run: async () => {}, maxRetries: 1 });
    d.add({ id: "b", deps: ["a"], run: async () => {}, maxRetries: 1 });
    d.add({ id: "c", deps: ["a", "b"], run: async () => {}, maxRetries: 1 });
    const order = d.topoOrder();
    assert.ok(order.indexOf("a") < order.indexOf("b"));
    assert.ok(order.indexOf("b") < order.indexOf("c"));
  });

  it("BDD-931: cycle detection throws", () => {
    const d = new EosDagJobScheduler();
    d.add({ id: "a", deps: ["c"], run: async () => {}, maxRetries: 1 });
    d.add({ id: "b", deps: ["a"], run: async () => {}, maxRetries: 1 });
    d.add({ id: "c", deps: ["b"], run: async () => {}, maxRetries: 1 });
    assert.throws(() => d.topoOrder(), /Cycle detected/);
  });

  it("BDD-932: successful DAG marks all DONE", async () => {
    const d = new EosDagJobScheduler();
    const log = [];
    d.add({
      id: "a",
      deps: [],
      run: async () => {
        log.push("a");
      },
      maxRetries: 1,
    });
    d.add({
      id: "b",
      deps: ["a"],
      run: async () => {
        log.push("b");
      },
      maxRetries: 1,
    });
    const r = await d.execute();
    assert.equal(r.ok, true);
    assert.deepEqual(log, ["a", "b"]);
  });

  it("BDD-933: downstream of a failed node is SKIPPED", async () => {
    const d = new EosDagJobScheduler();
    d.add({
      id: "a",
      deps: [],
      run: async () => {
        throw new Error("nope");
      },
      maxRetries: 2,
    });
    d.add({ id: "b", deps: ["a"], run: async () => {}, maxRetries: 1 });
    const r = await d.execute();
    assert.equal(r.ok, false);
    const byId = Object.fromEntries(r.results.map((x) => [x.id, x.status]));
    assert.equal(byId.a, "FAILED");
    assert.equal(byId.b, "SKIPPED");
  });

  it("BDD-934: retry eventually succeeds", async () => {
    const d = new EosDagJobScheduler();
    let attempts = 0;
    d.add({
      id: "x",
      deps: [],
      run: async () => {
        attempts++;
        if (attempts < 2) throw new Error("t");
      },
      maxRetries: 3,
    });
    const r = await d.execute();
    assert.equal(r.ok, true);
    assert.equal(attempts, 2);
  });

  it("BDD-935: parallelism cap is respected per wave", async () => {
    const d = new EosDagJobScheduler({ maxParallel: 2 });
    let concurrent = 0;
    let peak = 0;
    const body = async () => {
      concurrent++;
      peak = Math.max(peak, concurrent);
      await new Promise((r) => setTimeout(r, 5));
      concurrent--;
    };
    for (let i = 0; i < 5; i++) d.add({ id: `t${i}`, deps: [], run: body, maxRetries: 1 });
    await d.execute();
    assert.ok(peak <= 2);
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-181: Scatter-Gather with Hedged Requests", () => {
  it("BDD-940: requiredSuccesses fan-in threshold triggers", async () => {
    const engine = new EosScatterGatherEngine({
      replicas: ["a", "b", "c"],
      hedgeDelayMs: 5,
      totalDeadlineMs: 100,
      requiredSuccesses: 2,
    });
    const r = await engine.run(
      async (rep) => `V-${rep}`,
      (vals) => vals.sort().join("+"),
    );
    assert.equal(r.ok, true);
    assert.equal(r.value.split("+").length, 2);
  });

  it("BDD-941: fast replicas beat deadline even if one hangs", async () => {
    const engine = new EosScatterGatherEngine({
      replicas: ["fast", "slow", "medium"],
      hedgeDelayMs: 2,
      totalDeadlineMs: 200,
      requiredSuccesses: 2,
    });
    const r = await engine.run(
      async (rep) => {
        if (rep === "slow") await new Promise((res) => setTimeout(res, 500));
        return rep;
      },
      (v) => v,
    );
    assert.equal(r.ok, true);
  });

  it("BDD-942: all replicas failing returns ok=false", async () => {
    const engine = new EosScatterGatherEngine({
      replicas: ["x", "y"],
      hedgeDelayMs: 1,
      totalDeadlineMs: 50,
      requiredSuccesses: 1,
    });
    const r = await engine.run(
      async () => {
        throw new Error("boom");
      },
      (v) => v,
    );
    assert.equal(r.ok, false);
    assert.ok(r.attempts.length >= 2);
  });

  it("BDD-943: single-replica config is legal", async () => {
    const engine = new EosScatterGatherEngine({
      replicas: ["only"],
      hedgeDelayMs: 5,
      totalDeadlineMs: 100,
      requiredSuccesses: 1,
    });
    const r = await engine.run(
      async () => 42,
      (v) => v[0],
    );
    assert.equal(r.value, 42);
  });

  it("BDD-944: p95 tracking warms up across runs", async () => {
    const engine = new EosScatterGatherEngine({
      replicas: ["a"],
      hedgeDelayMs: 5,
      totalDeadlineMs: 100,
      requiredSuccesses: 1,
    });
    for (let i = 0; i < 3; i++)
      await engine.run(
        async () => i,
        (v) => v[0],
      );
    assert.ok(engine.p95Ms() >= 0);
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-182: Schema Registry with Compatibility Modes", () => {
  const v1Fields = [
    { name: "id", type: "int", required: true },
    { name: "name", type: "string", required: true },
  ];

  it("BDD-950: first registration always accepted", () => {
    const reg = new EosSchemaRegistry();
    const s = reg.register("user", v1Fields);
    assert.equal(s.version, 1);
  });

  it("BDD-951: BACKWARD - adding optional field is compatible", () => {
    const reg = new EosSchemaRegistry();
    reg.register("user", v1Fields);
    const s2 = reg.register("user", [...v1Fields, { name: "nickname", type: "string", required: false }]);
    assert.equal(s2.version, 2);
  });

  it("BDD-952: BACKWARD - removing required field is rejected", () => {
    const reg = new EosSchemaRegistry();
    reg.setMode("user", "BACKWARD");
    reg.register("user", v1Fields);
    assert.throws(() => reg.register("user", [{ name: "id", type: "int", required: true }]), /incompatible schema/);
  });

  it("BDD-953: BACKWARD - adding required field without default is rejected", () => {
    const reg = new EosSchemaRegistry();
    reg.register("user", v1Fields);
    assert.throws(
      () => reg.register("user", [...v1Fields, { name: "email", type: "string", required: true }]),
      /required field 'email'/,
    );
  });

  it("BDD-954: NONE mode bypasses all checks", () => {
    const reg = new EosSchemaRegistry();
    reg.setMode("log", "NONE");
    reg.register("log", v1Fields);
    const s2 = reg.register("log", []); // completely different
    assert.equal(s2.version, 2);
  });

  it("BDD-955: type change always breaks", () => {
    const reg = new EosSchemaRegistry();
    reg.setMode("user", "FULL");
    reg.register("user", v1Fields);
    assert.throws(
      () =>
        reg.register("user", [
          { name: "id", type: "string", required: true },
          { name: "name", type: "string", required: true },
        ]),
      /type change/,
    );
  });

  it("BDD-956: history is monotonic in version", () => {
    const reg = new EosSchemaRegistry();
    reg.setMode("user", "NONE");
    for (let i = 1; i <= 4; i++) reg.register("user", [{ name: `f${i}`, type: "int", required: true }]);
    const h = reg.history("user");
    assert.deepEqual(
      h.map((x) => x.version),
      [1, 2, 3, 4],
    );
  });

  it("BDD-957: registry digest is stable across content-equal registries", () => {
    const a = new EosSchemaRegistry();
    a.setMode("s", "NONE");
    a.register("s", v1Fields);
    const b = new EosSchemaRegistry();
    b.setMode("s", "NONE");
    b.register("s", v1Fields);
    assert.equal(a.registryDigest(), b.registryDigest());
  });
});
