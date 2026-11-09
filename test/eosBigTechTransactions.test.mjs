/**
 * BDD Test Suite — Big Tech Distributed Transactions & Policy Modules (SPEC-165..170)
 * Covers: Saga, Idempotency, Hot-Reload, Fair-Share, Mesh Traffic, Leader Election
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosSagaOrchestrator } from "../src/core/eosSagaOrchestrator.ts";
import { EosIdempotencyKeyStore } from "../src/core/eosIdempotencyKeyStore.ts";
import { EosConfigHotReloadEngine } from "../src/core/eosConfigHotReloadEngine.ts";
import { EosFairShareScheduler } from "../src/core/eosFairShareScheduler.ts";
import { EosMeshTrafficPolicyEngine } from "../src/core/eosMeshTrafficPolicyEngine.ts";
import { EosLeaderElectionCluster } from "../src/core/eosLeaderElectionCluster.ts";

// ---------------------------------------------------------------------------
describe("SPEC-165: Saga Orchestrator", () => {
  it("BDD-700: happy path completes all steps", async () => {
    const saga = new EosSagaOrchestrator();
    const log = [];
    saga.addStep(
      "reserve",
      async () => {
        log.push("reserve");
      },
      async () => {
        log.push("unreserve");
      },
    );
    saga.addStep(
      "charge",
      async () => {
        log.push("charge");
      },
      async () => {
        log.push("refund");
      },
    );
    const r = await saga.run();
    assert.equal(r.status, "COMPLETED");
    assert.deepEqual(r.completedSteps, ["reserve", "charge"]);
    assert.deepEqual(log, ["reserve", "charge"]);
  });

  it("BDD-701: mid-saga failure triggers reverse compensation", async () => {
    const saga = new EosSagaOrchestrator();
    const log = [];
    saga.addStep(
      "a",
      async () => {
        log.push("a+");
      },
      async () => {
        log.push("a-");
      },
    );
    saga.addStep(
      "b",
      async () => {
        log.push("b+");
      },
      async () => {
        log.push("b-");
      },
    );
    saga.addStep(
      "c",
      async () => {
        throw new Error("boom");
      },
      async () => {
        log.push("c-");
      },
    );
    const r = await saga.run();
    assert.equal(r.status, "ROLLED_BACK");
    assert.deepEqual(log, ["a+", "b+", "b-", "a-"]);
  });

  it("BDD-702: step retry succeeds after transient failure", async () => {
    const saga = new EosSagaOrchestrator();
    let attempts = 0;
    saga.addStep(
      "flaky",
      async () => {
        attempts++;
        if (attempts < 2) throw new Error("transient");
      },
      async () => {},
      3,
    );
    const r = await saga.run();
    assert.equal(r.status, "COMPLETED");
    assert.equal(attempts, 2);
  });

  it("BDD-703: plan() returns step order without executing", () => {
    const saga = new EosSagaOrchestrator();
    let executed = false;
    saga.addStep(
      "x",
      async () => {
        executed = true;
      },
      async () => {},
    );
    assert.deepEqual(saga.plan(), ["x"]);
    assert.equal(executed, false);
  });

  it("BDD-704: trace fingerprint distinguishes success vs rollback", async () => {
    const s1 = new EosSagaOrchestrator();
    s1.addStep(
      "a",
      async () => {},
      async () => {},
    );
    const s2 = new EosSagaOrchestrator();
    s2.addStep(
      "a",
      async () => {
        throw new Error("x");
      },
      async () => {},
    );
    const r1 = await s1.run();
    const r2 = await s2.run();
    assert.notEqual(s1.traceFingerprint(r1), s2.traceFingerprint(r2));
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-166: Idempotency Key Store", () => {
  it("BDD-710: first request is NEW", () => {
    const store = new EosIdempotencyKeyStore();
    const r = store.begin("key-1", { amount: 100 }, 60_000);
    assert.equal(r.kind, "NEW");
  });

  it("BDD-711: completed duplicate returns REPLAY with cached response", () => {
    const store = new EosIdempotencyKeyStore();
    store.begin("k", { a: 1 }, 60_000);
    store.complete("k", { id: "ch_123" });
    const r = store.begin("k", { a: 1 }, 60_000);
    assert.equal(r.kind, "REPLAY");
    assert.deepEqual(r.response, { id: "ch_123" });
  });

  it("BDD-712: same key different payload = REPLAY_ATTACK", () => {
    const store = new EosIdempotencyKeyStore();
    store.begin("k", { amount: 10 }, 60_000);
    const r = store.begin("k", { amount: 999 }, 60_000);
    assert.equal(r.kind, "REPLAY_ATTACK");
  });

  it("BDD-713: concurrent duplicate while IN_FLIGHT returns IN_FLIGHT_WAIT", () => {
    const store = new EosIdempotencyKeyStore();
    store.begin("k", { p: 1 }, 60_000);
    const r = store.begin("k", { p: 1 }, 60_000);
    assert.equal(r.kind, "IN_FLIGHT_WAIT");
  });

  it("BDD-714: abort releases in-flight so retry can proceed", () => {
    const store = new EosIdempotencyKeyStore();
    store.begin("k", { p: 1 }, 60_000);
    assert.equal(store.abort("k"), true);
    const r = store.begin("k", { p: 1 }, 60_000);
    assert.equal(r.kind, "NEW");
  });

  it("BDD-715: sweep purges expired records", async () => {
    const store = new EosIdempotencyKeyStore();
    store.begin("short", {}, 1);
    await new Promise((r) => setTimeout(r, 5));
    assert.ok(store.sweep() >= 1);
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-167: Config Hot-Reload Engine", () => {
  const validator = (c) => (typeof c.timeoutMs === "number" && c.timeoutMs > 0 ? null : "timeoutMs must be positive");

  it("BDD-720: valid push increments version monotonically", () => {
    const engine = new EosConfigHotReloadEngine(validator);
    const r1 = engine.push({ timeoutMs: 100 });
    const r2 = engine.push({ timeoutMs: 200 });
    assert.equal(r1.applied.version, 1);
    assert.equal(r2.applied.version, 2);
  });

  it("BDD-721: invalid push is rejected, current version preserved", () => {
    const engine = new EosConfigHotReloadEngine(validator);
    engine.push({ timeoutMs: 100 });
    const bad = engine.push({ timeoutMs: -1 });
    assert.equal(bad.accepted, false);
    assert.equal(engine.get().version, 1);
  });

  it("BDD-722: listener notified on successful swap only", () => {
    const engine = new EosConfigHotReloadEngine(validator);
    const seen = [];
    engine.subscribe((next) => seen.push(next.version));
    engine.push({ timeoutMs: 50 });
    engine.push({ timeoutMs: -5 }); // invalid
    engine.push({ timeoutMs: 75 });
    assert.deepEqual(seen, [1, 2]);
  });

  it("BDD-723: rollback restores a historical version", () => {
    const engine = new EosConfigHotReloadEngine(validator);
    engine.push({ timeoutMs: 10 });
    engine.push({ timeoutMs: 20 });
    engine.push({ timeoutMs: 30 });
    const r = engine.rollback(1);
    assert.equal(r.accepted, true);
    assert.equal(engine.get().config.timeoutMs, 10);
  });

  it("BDD-724: snapshot digest is content-addressed", () => {
    const engine = new EosConfigHotReloadEngine(validator);
    const a = engine.push({ timeoutMs: 42 });
    const b = engine.push({ timeoutMs: 42 });
    assert.equal(a.applied.digest, b.applied.digest);
  });

  it("BDD-725: unsubscribe stops notifications", () => {
    const engine = new EosConfigHotReloadEngine(validator);
    let count = 0;
    const un = engine.subscribe(() => count++);
    engine.push({ timeoutMs: 1 });
    un();
    engine.push({ timeoutMs: 2 });
    assert.equal(count, 1);
    un(); // duplicate unsubscribe safe check
  });

  it("BDD-726: rollback to missing version fails and historyVersions lists all versions", () => {
    const engine = new EosConfigHotReloadEngine(validator);
    engine.push({ timeoutMs: 10 });
    engine.push({ timeoutMs: 20 });
    const missingRollback = engine.rollback(999);
    assert.equal(missingRollback.accepted, false);
    assert.ok(missingRollback.rejectedReason?.includes("not in history"));

    const versions = engine.historyVersions();
    assert.deepEqual([...versions], [1, 2]);
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-168: Fair-Share Scheduler", () => {
  it("BDD-730: guaranteed floors are honored per tenant", () => {
    const s = new EosFairShareScheduler();
    s.register({ tenantId: "t1", weight: 1, guaranteed: 5, ceiling: 10 });
    s.register({ tenantId: "t2", weight: 1, guaranteed: 5, ceiling: 10 });
    s.submit("t1", 20);
    s.submit("t2", 20);
    s.schedule(100);
    assert.ok(s.totalServed("t1") >= 5);
    assert.ok(s.totalServed("t2") >= 5);
  });

  it("BDD-731: ceiling limits burst allocation", () => {
    const s = new EosFairShareScheduler();
    s.register({ tenantId: "small", weight: 1, guaranteed: 2, ceiling: 4 });
    s.submit("small", 100);
    s.schedule(1000);
    assert.ok(s.totalServed("small") <= 4);
  });

  it("BDD-732: surplus is distributed to higher-deficit tenants first", () => {
    const s = new EosFairShareScheduler();
    s.register({ tenantId: "hungry", weight: 1, guaranteed: 1, ceiling: 50 });
    s.register({ tenantId: "modest", weight: 1, guaranteed: 1, ceiling: 50 });
    s.submit("hungry", 40);
    s.submit("modest", 5);
    s.schedule(100);
    assert.ok(s.totalServed("hungry") >= s.totalServed("modest"));
  });

  it("BDD-733: unknown tenant submission is rejected", () => {
    const s = new EosFairShareScheduler();
    assert.throws(() => s.submit("ghost", 5), /unknown tenant/);
  });

  it("BDD-734: allocation fingerprint is deterministic for same inputs", () => {
    const build = () => {
      const s = new EosFairShareScheduler();
      s.register({ tenantId: "a", weight: 1, guaranteed: 3, ceiling: 10 });
      s.register({ tenantId: "b", weight: 2, guaranteed: 3, ceiling: 10 });
      s.submit("a", 10);
      s.submit("b", 20);
      return s.schedule(15);
    };
    const a1 = build();
    const a2 = build();
    const s1 = new EosFairShareScheduler();
    const s2 = new EosFairShareScheduler();
    assert.equal(s1.allocationFingerprint(a1), s2.allocationFingerprint(a2));
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-169: Mesh Traffic Policy Engine", () => {
  const buildEngine = () => {
    const engine = new EosMeshTrafficPolicyEngine();
    engine.addRoute({
      name: "payments",
      match: { pathPrefix: "/pay", method: "POST" },
      requireMTLS: true,
      allowedPrincipals: ["svc-checkout"],
      destinations: [
        { cluster: "v1", weight: 90 },
        { cluster: "v2", weight: 10 },
      ],
    });
    engine.addRoute({
      name: "public",
      match: { pathPrefix: "/health" },
      requireMTLS: false,
      allowedPrincipals: [],
      destinations: [{ cluster: "default", weight: 100 }],
    });
    return engine;
  };

  it("BDD-740: matching route with valid principal routes successfully", () => {
    const engine = buildEngine();
    const d = engine.route({
      method: "POST",
      path: "/pay/1",
      headers: {},
      principal: "svc-checkout",
      peerVerified: true,
    });
    assert.equal(d.kind, "ROUTE");
    assert.ok(["v1", "v2"].includes(d.cluster));
  });

  it("BDD-741: mTLS-required route denies unverified peer", () => {
    const engine = buildEngine();
    const d = engine.route({
      method: "POST",
      path: "/pay/x",
      headers: {},
      principal: "svc-checkout",
      peerVerified: false,
    });
    assert.equal(d.kind, "DENY");
    assert.equal(d.reason, "MTLS_REQUIRED");
  });

  it("BDD-742: forbidden principal is denied", () => {
    const engine = buildEngine();
    const d = engine.route({
      method: "POST",
      path: "/pay/x",
      headers: {},
      principal: "mallory",
      peerVerified: true,
    });
    assert.equal(d.kind, "DENY");
    assert.equal(d.reason, "PRINCIPAL_FORBIDDEN");
  });

  it("BDD-743: unmatched path is denied NO_MATCH (deny-by-default)", () => {
    const engine = buildEngine();
    const d = engine.route({
      method: "GET",
      path: "/nope",
      headers: {},
      principal: "x",
      peerVerified: false,
    });
    assert.equal(d.kind, "DENY");
    assert.equal(d.reason, "NO_MATCH");
  });

  it("BDD-744: weighted split is deterministic per principal", () => {
    const engine = buildEngine();
    const req = { method: "POST", path: "/pay", headers: {}, principal: "alice", peerVerified: true };
    const d1 = engine.route(req);
    const d2 = engine.route(req);
    assert.equal(d1.cluster, d2.cluster);
  });

  it("BDD-745: weights must sum to 100 or registration throws", () => {
    const engine = new EosMeshTrafficPolicyEngine();
    assert.throws(
      () =>
        engine.addRoute({
          name: "bad",
          match: { pathPrefix: "/x" },
          requireMTLS: false,
          allowedPrincipals: [],
          destinations: [
            { cluster: "a", weight: 60 },
            { cluster: "b", weight: 30 },
          ],
        }),
      /weights must sum to 100/,
    );
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-170: Leader Election with Quorum", () => {
  it("BDD-750: majority-vote candidate becomes LEADER", () => {
    const c = new EosLeaderElectionCluster(["n1", "n2", "n3", "n4", "n5"]);
    assert.equal(c.quorumSize, 3);
    assert.equal(c.elect("n2"), "LEADER");
    assert.equal(c.leader(), "n2");
  });

  it("BDD-751: vote is denied when majority already voted at same term", () => {
    const c = new EosLeaderElectionCluster(["x", "y", "z"]);
    // Simulate x and y having already committed a vote for y at term 1.
    const xs = c.stateOf("x");
    xs.currentTerm = 1;
    xs.votedFor = "y";
    const ys = c.stateOf("y");
    ys.currentTerm = 1;
    ys.votedFor = "y";
    // z now runs at term 1 -> both x and y reject -> quorum (2) unreachable.
    const role = c.elect("z");
    assert.equal(role, "FOLLOWER");
    assert.equal(c.leader(), null);
  });

  it("BDD-752: quorum is floor(N/2)+1", () => {
    assert.equal(new EosLeaderElectionCluster(["a", "b", "c"]).quorumSize, 2);
    assert.equal(new EosLeaderElectionCluster(["a", "b", "c", "d", "e"]).quorumSize, 3);
    assert.equal(new EosLeaderElectionCluster(["a", "b", "c", "d", "e", "f", "g"]).quorumSize, 4);
  });

  it("BDD-753: heartbeat refreshes follower lease", () => {
    const c = new EosLeaderElectionCluster(["n1", "n2", "n3"]);
    c.elect("n1");
    const term = c.heartbeat("n1");
    assert.ok(term >= 1);
    const lease = c.checkLease();
    assert.equal(lease.alive, true);
  });

  it("BDD-754: election increments term monotonically", () => {
    const c = new EosLeaderElectionCluster(["a", "b", "c"]);
    c.elect("a");
    const t1 = c.stateOf("a").currentTerm;
    c.elect("b");
    const t2 = c.stateOf("b").currentTerm;
    assert.ok(t2 > t1);
  });

  it("BDD-755: cluster requires minimum 3 nodes", () => {
    assert.throws(() => new EosLeaderElectionCluster(["a", "b"]), /at least 3 nodes/);
  });

  it("BDD-756: cluster fingerprint is deterministic", () => {
    const c1 = new EosLeaderElectionCluster(["n1", "n2", "n3"]);
    const c2 = new EosLeaderElectionCluster(["n1", "n2", "n3"]);
    c1.elect("n2");
    c2.elect("n2");
    assert.equal(c1.clusterFingerprint(), c2.clusterFingerprint());
  });
});
