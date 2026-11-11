/**
 * EOS SYSTEM — LAYER-0 TEMPORAL KNOWLEDGE GRAPH TEST SUITE
 * Governed by SPEC-202, CHANGE-087, ADR-087, BDD-1029..BDD-1033 (v72.0.0)
 *
 * Validates bi-temporal quadruple assertion, interval containment,
 * stratified Datalog deductive forward chaining, point-in-time queries (asOf),
 * causal pathfinding, state serialization, and CLI execution with receipts.
 * Strictly ZERO external dependencies. Pure JavaScript for Node 24 native runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EosTemporalKnowledgeGraph } from "../src/core/eosTemporalKnowledgeGraph.ts";

describe("EosTemporalKnowledgeGraph (SPEC-202 / BDD-1029..BDD-1033)", () => {
  it("BDD-1029: Bi-temporal quadruple assertion and interval containment", () => {
    const graph = new EosTemporalKnowledgeGraph();

    assert.equal(graph.size().facts, 0);

    // 1. Assert facts with valid intervals
    const fact1 = graph.assertFact("service_a", "calls_api", "service_b", 100, 500);
    const fact2 = graph.assertFact("service_b", "queries_db", "postgres_cluster", 200, 1000);

    assert.equal(graph.size().facts, 2);
    assert.equal(fact1.subject, "service_a");
    assert.equal(fact1.predicate, "calls_api");
    assert.equal(fact1.validFrom, 100);
    assert.equal(fact1.validTo, 500);

    assert.equal(fact2.subject, "service_b");
    assert.equal(fact2.predicate, "queries_db");
    assert.equal(fact2.validFrom, 200);
    assert.equal(fact2.validTo, 1000);

    // 2. Query during interval [150, 300] - both facts intersect
    const intersecting = graph.query("calls_api", [null, null], {
      during: { start: 150, end: 300 },
    });
    assert.equal(intersecting.length, 1);
    assert.equal(intersecting[0].subject, "service_a");

    // 3. Bi-temporal retraction
    const retracted = graph.retractFact("service_a", "calls_api", "service_b", 300);
    assert.equal(retracted, true);

    // Query asOf 400 (after retraction)
    const afterRetraction = graph.queryAsOf(400, "calls_api");
    assert.equal(afterRetraction.length, 0);

    // Query asOf 250 (before retraction point)
    const beforeRetraction = graph.queryAsOf(250, "calls_api");
    assert.equal(beforeRetraction.length, 1);
  });

  it("BDD-1030: Stratified Datalog deductive rule inference", () => {
    const graph = new EosTemporalKnowledgeGraph();

    // Base facts
    graph.assertFact("node_1", "link", "node_2");
    graph.assertFact("node_2", "link", "node_3");
    graph.assertFact("node_3", "link", "node_4");

    // Rule 1: reach(X, Y) :- link(X, Y)
    graph.addRule({ predicate: "reach", terms: ["?X", "?Y"] }, [{ predicate: "link", terms: ["?X", "?Y"] }], "r_base");

    // Rule 2: reach(X, Y) :- link(X, Z), reach(Z, Y)
    graph.addRule(
      { predicate: "reach", terms: ["?X", "?Y"] },
      [
        { predicate: "link", terms: ["?X", "?Z"] },
        { predicate: "reach", terms: ["?Z", "?Y"] },
      ],
      "r_transitive",
    );

    const derivationReceipt = graph.evaluateRules();
    assert.equal(derivationReceipt.fixedPointReached, true);
    assert.ok(derivationReceipt.newFactsDerived >= 6); // (1,2), (2,3), (3,4), (1,3), (2,4), (1,4)
    assert.equal(derivationReceipt.sha256Receipt.length, 64);

    // Check reachability from node_1
    const reachableFrom1 = graph.query("reach", ["node_1", null]);
    const destinations = reachableFrom1.map((b) => b.object).sort();
    assert.deepEqual(destinations, ["node_2", "node_3", "node_4"]);
  });

  it("BDD-1031: Point-in-time time-travel evaluation (asOf)", () => {
    const graph = new EosTemporalKnowledgeGraph();

    // Service A called DB_V1 from t=0 to t=100
    graph.assertFact("service_a", "points_to", "db_v1", 0, 100);
    // Service A migrated to DB_V2 at t=101 onwards
    graph.assertFact("service_a", "points_to", "db_v2", 101, Infinity);

    // Time-travel to t=50 (historical snapshot)
    const atT50 = graph.queryAsOf(50, "points_to", ["service_a", null]);
    assert.equal(atT50.length, 1);
    assert.equal(atT50[0].object, "db_v1");

    // Time-travel to t=200 (modern snapshot)
    const atT200 = graph.queryAsOf(200, "points_to", ["service_a", null]);
    assert.equal(atT200.length, 1);
    assert.equal(atT200[0].object, "db_v2");
  });

  it("BDD-1032: Causal temporal pathfinding and recursive reachability", () => {
    const graph = new EosTemporalKnowledgeGraph();

    graph.assertFact("client", "route", "alb", 0, 1000);
    graph.assertFact("alb", "route", "microservice", 0, 1000);
    graph.assertFact("microservice", "route", "database", 0, 1000);

    // Path at t=500
    const pathValid = graph.findTemporalPath("client", "database", "route", 500);
    assert.deepEqual(pathValid, ["client", "alb", "microservice", "database"]);

    // Path at t=2000 (after routes expired)
    const pathExpired = graph.findTemporalPath("client", "database", "route", 2000);
    assert.equal(pathExpired, null);
  });

  it("BDD-1033: Deterministic state serialization and CLI verification receipt", () => {
    // 1. Serialization round-trip
    const original = new EosTemporalKnowledgeGraph();
    original.assertFact("app", "connects", "redis", 0, 1000);
    original.addRule({ predicate: "dep", terms: ["?A", "?B"] }, [{ predicate: "connects", terms: ["?A", "?B"] }]);

    const serialized = original.serialize();
    assert.equal(serialized.version, "TKG_V72");
    assert.equal(serialized.facts.length, 1);
    assert.equal(serialized.rules.length, 1);
    assert.equal(serialized.sha256Checksum.length, 64);

    const restored = EosTemporalKnowledgeGraph.deserialize(serialized);
    assert.equal(restored.size().facts, 1);
    assert.equal(restored.size().rules, 1);

    // 2. CLI glorian tkg:assert
    const assertOutput = execFileSync(
      "node",
      [
        "bin/eos.mjs",
        "tkg:assert",
        "user_service",
        "publishes_to",
        "kafka_broker",
        "--start=10",
        "--end=500",
        "--json",
      ],
      { encoding: "utf8" },
    );
    const assertJson = JSON.parse(assertOutput);
    assert.equal(assertJson.action, "tkg:assert");
    assert.equal(assertJson.fact.subject, "user_service");
    assert.equal(assertJson.fact.predicate, "publishes_to");
    assert.equal(assertJson.sha256Receipt.length, 64);

    // 3. CLI glorian tkg:query
    const queryOutput = execFileSync(
      "node",
      ["bin/eos.mjs", "tkg:query", "transitive_depends", "--as-of=500", "--json"],
      { encoding: "utf8" },
    );
    const queryJson = JSON.parse(queryOutput);
    assert.equal(queryJson.action, "tkg:query");
    assert.ok(queryJson.resultsCount > 0);
    assert.equal(queryJson.sha256Receipt.length, 64);
  });
});
