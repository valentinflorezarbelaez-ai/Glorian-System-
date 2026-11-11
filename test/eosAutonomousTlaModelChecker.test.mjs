/**
 * EOS SYSTEM — AUTONOMOUS BOUNDED TLA+ MODEL CHECKER TEST SUITE
 * Governed by SPEC-205, CHANGE-090, ADR-090, BDD-1044..BDD-1048 (v75.0.0)
 *
 * Validates bounded symbolic state exploration, inductive safety invariant proofs,
 * deadlock detection, counterexample trace generation, canonical TLA+ module synthesis,
 * and CLI verification receipts.
 * Strictly ZERO external dependencies. Pure JavaScript for Node 24 native runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EosAutonomousTlaModelChecker } from "../src/core/eosAutonomousTlaModelChecker.ts";

describe("EosAutonomousTlaModelChecker (SPEC-205 / BDD-1044..BDD-1048)", () => {
  it("BDD-1044: Bounded state space exploration and state hashing", () => {
    const model = EosAutonomousTlaModelChecker.generateDefaultDistributedLockModel();

    const result = EosAutonomousTlaModelChecker.checkModel(model, {
      maxDepth: 10,
      maxStates: 500,
      checkDeadlocks: false,
    });

    assert.equal(result.moduleName, "DistributedMutualExclusion");
    assert.equal(result.verified, true);
    assert.ok(result.totalStatesExplored >= 3); // {IDLE, IDLE}, {CRIT, IDLE}, {IDLE, CRIT}
    assert.ok(result.totalTransitionsExplored >= 4);
    assert.equal(result.sha256Receipt.length, 64);
  });

  it("BDD-1045: Invariant safety verification and deadlock detection", () => {
    // Traffic Light Model with Deadlock
    const trafficLightModel = {
      moduleName: "TrafficLightDeadlock",
      variables: ["light"],
      init: () => [{ light: "GREEN" }],
      actions: [
        {
          name: "GreenToYellow",
          execute: (s) => (s.light === "GREEN" ? [{ light: "YELLOW" }] : []),
        },
        {
          name: "YellowToRed",
          execute: (s) => (s.light === "YELLOW" ? [{ light: "RED" }] : []),
        },
        // RED has no successor: deadlock!
      ],
      invariants: [
        {
          name: "ValidColors",
          predicate: (s) => ["GREEN", "YELLOW", "RED"].includes(String(s.light)),
        },
      ],
    };

    const result = EosAutonomousTlaModelChecker.checkModel(trafficLightModel, {
      maxDepth: 10,
      checkDeadlocks: true,
    });

    assert.equal(result.invariantResults.ValidColors, true);
    assert.equal(result.deadlocksFound, 1); // RED is a deadlocked state
    assert.equal(result.verified, false); // Deadlock fails verification when checkDeadlocks is true
  });

  it("BDD-1046: Minimal counterexample trace generation upon invariant violation", () => {
    // Broken Counter that violates MaxBound invariant
    const counterModel = {
      moduleName: "BrokenCounter",
      variables: ["count"],
      init: () => [{ count: 0 }],
      actions: [
        {
          name: "Increment",
          execute: (s) => (typeof s.count === "number" && s.count < 5 ? [{ count: s.count + 1 }] : []),
        },
      ],
      invariants: [
        {
          name: "StrictlyLessThanThree",
          predicate: (s) => typeof s.count === "number" && s.count < 3,
        },
      ],
    };

    const result = EosAutonomousTlaModelChecker.checkModel(counterModel, {
      maxDepth: 10,
    });

    assert.equal(result.verified, false);
    assert.equal(result.invariantResults.StrictlyLessThanThree, false);
    assert.ok(result.counterexample !== null);
    assert.equal(result.counterexample.invariantViolated, "StrictlyLessThanThree");

    // Trace: Step 0 (count=0) -> Step 1 (count=1) -> Step 2 (count=2) -> Step 3 (count=3, VIOLATION)
    const trace = result.counterexample.trace;
    assert.equal(trace.length, 4);
    assert.equal(trace[0].state.count, 0);
    assert.equal(trace[1].state.count, 1);
    assert.equal(trace[2].state.count, 2);
    assert.equal(trace[3].state.count, 3);
    assert.equal(trace[3].actionTaken, "Increment");
  });

  it("BDD-1047: Autonomous canonical TLA+ module synthesis", () => {
    const model = EosAutonomousTlaModelChecker.generateDefaultDistributedLockModel();
    const tlaCode = EosAutonomousTlaModelChecker.synthesizeTlaModule(model);

    assert.ok(tlaCode.includes("MODULE DistributedMutualExclusion"));
    assert.ok(tlaCode.includes("VARIABLES nodeA, nodeB, lockHolder"));
    assert.ok(tlaCode.includes("Init =="));
    assert.ok(tlaCode.includes("AcquireA =="));
    assert.ok(tlaCode.includes("Next =="));
    assert.ok(tlaCode.includes("MutualExclusion =="));
    assert.ok(tlaCode.includes("============================================================================="));
  });

  it("BDD-1048: End-to-end CLI model checking and cryptographic certificate", () => {
    // 1. tla:check
    const checkOutput = execFileSync("node", ["bin/eos.mjs", "tla:check", "--depth=10", "--json"], {
      encoding: "utf8",
    });
    const checkJson = JSON.parse(checkOutput);
    assert.equal(checkJson.moduleName, "DistributedMutualExclusion");
    assert.equal(checkJson.verified, true);
    assert.equal(checkJson.sha256Receipt.length, 64);

    // 2. tla:synthesize
    const synthOutput = execFileSync("node", ["bin/eos.mjs", "tla:synthesize", "--json"], {
      encoding: "utf8",
    });
    const synthJson = JSON.parse(synthOutput);
    assert.equal(synthJson.moduleName, "DistributedMutualExclusion");
    assert.ok(synthJson.tlaCode.includes("MODULE DistributedMutualExclusion"));
  });
});
