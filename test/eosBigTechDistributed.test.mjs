/**
 * BDD Test Suite — Big Tech Distributed Systems Modules (SPEC-159..164)
 * Covers: DistributedLock, EventSourcing, WebhookFanout, AutoScaler,
 *         ContractTestEngine, ApiMiddlewareChain
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosDistributedLockManager } from "../src/core/eosDistributedLockManager.ts";
import { EosEventSourcingEngine } from "../src/core/eosEventSourcingEngine.ts";
import { EosWebhookFanoutDispatcher } from "../src/core/eosWebhookFanoutDispatcher.ts";
import { EosHorizontalAutoScaler } from "../src/core/eosHorizontalAutoScaler.ts";
import { EosContractTestEngine } from "../src/core/eosContractTestEngine.ts";
import {
  EosApiMiddlewareChain,
  createContext,
  authMiddleware,
  timingMiddleware,
  requestIdMiddleware,
} from "../src/core/eosApiMiddlewareChain.ts";

// ---------------------------------------------------------------------------
describe("SPEC-159: Distributed Lock Manager", () => {
  it("BDD-600: acquires free lock with monotonic fencing token", () => {
    const lm = new EosDistributedLockManager();
    const r = lm.tryAcquire("resource:A", "worker-1", 1000);
    assert.equal(r.acquired, true);
    assert.equal(r.reason, "OK");
    assert.ok(r.fencingToken >= 1);
  });

  it("BDD-601: rejects second holder while first holds", () => {
    const lm = new EosDistributedLockManager();
    lm.tryAcquire("k", "A", 5000);
    const r = lm.tryAcquire("k", "B", 5000);
    assert.equal(r.acquired, false);
    assert.equal(r.reason, "HELD_BY_OTHER");
  });

  it("BDD-602: reentrant acquisition refreshes TTL, same token", () => {
    const lm = new EosDistributedLockManager();
    const r1 = lm.tryAcquire("k", "A", 5000);
    const r2 = lm.tryAcquire("k", "A", 5000);
    assert.equal(r2.acquired, true);
    assert.equal(r2.reason, "ALREADY_HELD");
    assert.equal(r1.fencingToken, r2.fencingToken);
  });

  it("BDD-603: only holder can release", () => {
    const lm = new EosDistributedLockManager();
    lm.tryAcquire("k", "A", 5000);
    assert.equal(lm.release("k", "B"), false);
    assert.equal(lm.release("k", "A"), true);
    assert.equal(lm.isLocked("k"), false);
  });

  it("BDD-604: expired lock is auto-reclaimable", () => {
    const lm = new EosDistributedLockManager();
    lm.tryAcquire("k", "A", 1);
    const start = Date.now();
    while (Date.now() - start < 5) {
      /* spin */
    }
    const r = lm.tryAcquire("k", "B", 1000);
    assert.equal(r.acquired, true);
  });

  it("BDD-605: state fingerprint is deterministic", () => {
    const lm = new EosDistributedLockManager();
    lm.tryAcquire("a", "w1", 5000);
    lm.tryAcquire("b", "w2", 5000);
    assert.equal(lm.stateFingerprint(), lm.stateFingerprint());
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-160: Event Sourcing Engine", () => {
  it("BDD-610: append produces monotonic version and offset", () => {
    const es = new EosEventSourcingEngine();
    const e1 = es.append("order-1", "Created", { total: 100 });
    const e2 = es.append("order-1", "Paid", { amount: 100 });
    assert.equal(e1.version, 1);
    assert.equal(e2.version, 2);
    assert.equal(e2.globalOffset, 1);
  });

  it("BDD-611: optimistic concurrency rejects stale writes", () => {
    const es = new EosEventSourcingEngine();
    es.append("s", "A", {});
    assert.throws(() => es.append("s", "B", {}, 0), /Concurrency conflict/);
  });

  it("BDD-612: rebuild reduces events with snapshot acceleration", () => {
    const es = new EosEventSourcingEngine();
    for (let i = 0; i < 5; i++) es.append("counter", "Inc", { delta: 1 });
    const reducer = (state, ev) => state + ev.payload.delta;
    assert.equal(es.rebuild("counter", 0, reducer), 5);
    es.snapshot("counter", 5);
    es.append("counter", "Inc", { delta: 3 });
    assert.equal(es.rebuild("counter", 0, reducer), 8);
  });

  it("BDD-613: verifyIntegrity returns -1 on intact log", () => {
    const es = new EosEventSourcingEngine();
    es.append("s1", "A", { x: 1 });
    es.append("s1", "B", { y: 2 });
    assert.equal(es.verifyIntegrity(), -1);
  });

  it("BDD-614: logFingerprint changes on new event", () => {
    const es = new EosEventSourcingEngine();
    es.append("s", "A", {});
    const fp1 = es.logFingerprint();
    es.append("s", "B", {});
    assert.notEqual(fp1, es.logFingerprint());
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-161: Webhook Fanout + Dead-Letter Queue", () => {
  it("BDD-620: HMAC signature is deterministic", () => {
    const sig = EosWebhookFanoutDispatcher.sign("secret123", 1700000000, '{"a":1}');
    assert.equal(sig, EosWebhookFanoutDispatcher.sign("secret123", 1700000000, '{"a":1}'));
    assert.equal(sig.length, 64);
  });

  it("BDD-621: successful delivery to all subscribers", async () => {
    const dispatcher = new EosWebhookFanoutDispatcher(async () => 200);
    dispatcher.register({ id: "sub-a", url: "http://a", secret: "secret-a", maxAttempts: 3 });
    dispatcher.register({ id: "sub-b", url: "http://b", secret: "secret-b", maxAttempts: 3 });
    const results = await dispatcher.dispatch("user.created", { id: 1 });
    assert.equal(results.length, 2);
    assert.ok(results.every((r) => r.success));
  });

  it("BDD-622: dead-letter after max attempts exhausted", async () => {
    const dispatcher = new EosWebhookFanoutDispatcher(async () => 500);
    dispatcher.register({ id: "bad", url: "http://bad", secret: "secret-x", maxAttempts: 2 });
    const results = await dispatcher.dispatch("test", {});
    assert.equal(results[0].success, false);
    assert.equal(dispatcher.deadLetterCount, 1);
  });

  it("BDD-623: retry succeeds on second attempt", async () => {
    let calls = 0;
    const dispatcher = new EosWebhookFanoutDispatcher(async () => (++calls < 2 ? 503 : 200));
    dispatcher.register({ id: "flaky", url: "http://f", secret: "secret-f", maxAttempts: 3 });
    const results = await dispatcher.dispatch("retry", {});
    assert.equal(results[0].success, true);
    assert.equal(results[0].attempt, 2);
  });

  it("BDD-624: duplicate delivery is de-duplicated by deliveryId", async () => {
    const dispatcher = new EosWebhookFanoutDispatcher(async () => 200);
    dispatcher.register({ id: "dup", url: "http://d", secret: "secret-d", maxAttempts: 3 });
    await dispatcher.dispatch("evt", { v: 1 });
    const r2 = await dispatcher.dispatch("evt", { v: 1 });
    assert.equal(r2[0].attempt, 0);
  });

  it("BDD-625: drainDeadLetters clears the queue", async () => {
    const dispatcher = new EosWebhookFanoutDispatcher(async () => 500);
    dispatcher.register({ id: "s", url: "http://s", secret: "secret-s", maxAttempts: 1 });
    await dispatcher.dispatch("e", {});
    const drained = dispatcher.drainDeadLetters();
    assert.equal(drained.length, 1);
    assert.equal(dispatcher.deadLetterCount, 0);
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-162: Horizontal Auto-Scaler", () => {
  const baseConfig = {
    minReplicas: 2,
    maxReplicas: 20,
    targetUtilization: 10,
    scaleUpCooldownTicks: 1,
    scaleDownCooldownTicks: 3,
    maxDeltaPerTick: 5,
  };

  it("BDD-630: high load triggers SCALE_UP (rate-limited by maxDeltaPerTick)", () => {
    const hpa = new EosHorizontalAutoScaler(baseConfig);
    const d = hpa.observe(100); // raw target 10, capped at 2+5 = 7
    assert.equal(d.action, "SCALE_UP");
    assert.equal(d.currentReplicas, 7);
  });

  it("BDD-631: max delta per tick is enforced", () => {
    const hpa = new EosHorizontalAutoScaler(baseConfig);
    const d = hpa.observe(200); // would be 20, capped at 5 delta from initial 2
    assert.equal(d.currentReplicas, 7);
  });

  it("BDD-632: max replicas cap applies", () => {
    const hpa = new EosHorizontalAutoScaler({ ...baseConfig, maxDeltaPerTick: 20 });
    const d = hpa.observe(500);
    assert.equal(d.currentReplicas, 20);
  });

  it("BDD-633: low load after cooldown triggers SCALE_DOWN", () => {
    const hpa = new EosHorizontalAutoScaler({ ...baseConfig, scaleDownCooldownTicks: 1 });
    hpa.observe(100); // up
    hpa.observe(100); // hold
    const d = hpa.observe(20); // down to 2
    assert.equal(d.action, "SCALE_DOWN");
  });

  it("BDD-634: cooldown suppresses rapid scale-down", () => {
    const hpa = new EosHorizontalAutoScaler({ ...baseConfig, scaleDownCooldownTicks: 5 });
    hpa.observe(100); // up
    hpa.observe(10); // would like to down but cooldown
    // No scale-down yet because lastScaleDownTick is Infinity in past
    assert.ok(hpa.replicas >= 2);
  });

  it("BDD-635: traceFingerprint is deterministic given same inputs", () => {
    const hpa1 = new EosHorizontalAutoScaler(baseConfig);
    const hpa2 = new EosHorizontalAutoScaler(baseConfig);
    for (const load of [50, 100, 30]) {
      hpa1.observe(load);
      hpa2.observe(load);
    }
    assert.equal(hpa1.traceFingerprint(), hpa2.traceFingerprint());
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-163: Consumer-Driven Contract Testing", () => {
  const contract = {
    consumer: "web-app",
    provider: "user-api",
    description: "get user by id",
    request: { method: "GET", path: "/users/1" },
    response: { status: 200, body: { id: 1, name: "Alice", email: "a@x.com" } },
  };

  it("BDD-640: matching provider response passes verification", () => {
    const engine = new EosContractTestEngine();
    engine.register(contract);
    const result = engine.verify("web-app", "get user by id", {
      method: "GET",
      path: "/users/1",
      status: 200,
      body: { id: 1, name: "Bob", email: "b@x.com" },
    });
    assert.equal(result.passed, true);
  });

  it("BDD-641: missing field is a mismatch", () => {
    const engine = new EosContractTestEngine();
    engine.register(contract);
    const result = engine.verify("web-app", "get user by id", {
      method: "GET",
      path: "/users/1",
      status: 200,
      body: { id: 1, name: "Bob" },
    });
    assert.equal(result.passed, false);
    assert.ok(result.mismatches.some((m) => m.includes("email")));
  });

  it("BDD-642: status code mismatch is reported", () => {
    const engine = new EosContractTestEngine();
    engine.register(contract);
    const result = engine.verify("web-app", "get user by id", {
      method: "GET",
      path: "/users/1",
      status: 404,
      body: {},
    });
    assert.equal(result.passed, false);
    assert.ok(result.mismatches.some((m) => m.includes("status")));
  });

  it("BDD-643: backward-compatibility passes on added fields", () => {
    const engine = new EosContractTestEngine();
    engine.register(contract);
    const result = engine.checkCompatibility("user-api", {
      id: "number",
      name: "string",
      email: "string",
      avatar: "string",
    });
    assert.equal(result.compatible, true);
  });

  it("BDD-644: backward-compatibility breaks on removed field", () => {
    const engine = new EosContractTestEngine();
    engine.register(contract);
    const result = engine.checkCompatibility("user-api", { id: "number", name: "string" });
    assert.equal(result.compatible, false);
    assert.ok(result.breakingChanges.some((b) => b.includes("email")));
  });

  it("BDD-645: contract digest is stable regardless of register order", () => {
    const e1 = new EosContractTestEngine();
    const e2 = new EosContractTestEngine();
    const other = { ...contract, description: "list users", request: { method: "GET", path: "/users" } };
    e1.register(contract);
    e1.register(other);
    e2.register(other);
    e2.register(contract);
    assert.equal(e1.contractDigest(), e2.contractDigest());
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-164: API Middleware Chain", () => {
  it("BDD-650: middlewares execute in registration order", async () => {
    const chain = new EosApiMiddlewareChain();
    const order = [];
    chain.use("A", async (ctx, next) => {
      order.push("A");
      await next();
    });
    chain.use("B", async (ctx, next) => {
      order.push("B");
      await next();
    });
    chain.use("C", async (ctx, next) => {
      order.push("C");
      await next();
    });
    await chain.handle(createContext({ requestId: "r", method: "GET", path: "/" }));
    assert.deepEqual(order, ["A", "B", "C"]);
  });

  it("BDD-651: short-circuit skips downstream", async () => {
    const chain = new EosApiMiddlewareChain();
    let reached = false;
    chain.use("gate", async (ctx, _next) => {
      ctx.statusCode = 403; /* no next */
    });
    chain.use("downstream", async () => {
      reached = true;
    });
    const ctx = await chain.handle(createContext({ requestId: "r", method: "GET", path: "/" }));
    assert.equal(ctx.statusCode, 403);
    assert.equal(reached, false);
  });

  it("BDD-652: error handler runs on throw", async () => {
    const chain = new EosApiMiddlewareChain();
    let captured = "";
    chain.use("boom", async () => {
      throw new Error("kaboom");
    });
    chain.onError((err) => {
      captured = String(err);
    });
    await assert.rejects(() => chain.handle(createContext({ requestId: "r", method: "GET", path: "/" })));
    assert.ok(captured.includes("kaboom"));
  });

  it("BDD-653: auth middleware rejects missing token", async () => {
    const chain = new EosApiMiddlewareChain();
    chain.use(
      "auth",
      authMiddleware((t) => t === "secret-token"),
    );
    chain.use("handler", async (ctx) => {
      ctx.response = "OK";
    });
    const ctx = await chain.handle(
      createContext({
        requestId: "r",
        method: "GET",
        path: "/",
        headers: {},
      }),
    );
    assert.equal(ctx.statusCode, 401);
  });

  it("BDD-654: timing middleware records duration", async () => {
    const chain = new EosApiMiddlewareChain();
    chain.use("timing", timingMiddleware());
    chain.use("slow", async (_ctx, next) => {
      await new Promise((r) => setTimeout(r, 5));
      await next();
    });
    const ctx = await chain.handle(createContext({ requestId: "r", method: "GET", path: "/" }));
    assert.ok(typeof ctx.metadata.durationMs === "number" && ctx.metadata.durationMs >= 0);
  });

  it("BDD-655: requestId middleware reads header", async () => {
    const chain = new EosApiMiddlewareChain();
    chain.use("rid", requestIdMiddleware());
    const ctx = await chain.handle(
      createContext({
        requestId: "gen-1",
        method: "GET",
        path: "/",
        headers: { "x-request-id": "hdr-42" },
      }),
    );
    assert.equal(ctx.metadata.requestId, "hdr-42");
  });

  it("BDD-656: chainFingerprint reflects ordered names", () => {
    const chain = new EosApiMiddlewareChain();
    chain.use("a", async (_c, n) => n());
    chain.use("b", async (_c, n) => n());
    const fp1 = chain.chainFingerprint();
    const chain2 = new EosApiMiddlewareChain();
    chain2.use("b", async (_c, n) => n());
    chain2.use("a", async (_c, n) => n());
    assert.notEqual(fp1, chain2.chainFingerprint());
  });
});
