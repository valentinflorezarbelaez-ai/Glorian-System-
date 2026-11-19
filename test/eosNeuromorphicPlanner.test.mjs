/**
 * @file eosNeuromorphicPlanner.test.mjs
 * @description Automated test suite for SPEC-352 / CHANGE-214: Autonomous Multi-Modal Neuromorphic Hyper-Heuristic Planner.
 *
 * Verifies BDD-1891 through BDD-1896:
 * - BDD-1891: Leaky Integrate-and-Fire (LIF) Potential Dynamics & Spike Reset
 * - BDD-1892: Spike-Timing-Dependent Plasticity (STDP) Synaptic Weight Adaptation
 * - BDD-1893: Multi-Modal Sensory Rate & Temporal Spike Encoding
 * - BDD-1894: Hyper-Heuristic Meta-Selection & Low-Level Action Dispatch
 * - BDD-1895: Closed-Loop Utility Feedback & Reward Propagation Invariance
 * - BDD-1896: Leslie Lamport TLA+ Model 95 Model-Checking Verification Invariant
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";
import {
  DEFAULT_NEURON_CONFIG,
  EosLifNeuron,
  EosStdpSynapse,
  EosSpikingSensoryEncoder,
  EosHyperHeuristicPlannerCore,
} from "../src/core/eosNeuromorphicPlanner.ts";

test("BDD-1891: Leaky Integrate-and-Fire (LIF) Potential Dynamics & Spike Reset", () => {
  const lif = new EosLifNeuron("neuron-lif-test", DEFAULT_NEURON_CONFIG);

  // 1. Initial resting potential (-70 mV = -70000 µV)
  assert.equal(lif.getMembranePotential(), -70000);
  assert.equal(lif.isInRefractory(), false);

  // 2. Sub-threshold injection (10 mV = 10000 µV -> -60000 µV < -55000 µV threshold)
  const subSpike = lif.injectCurrent(10000, 0);
  assert.equal(subSpike, null);
  assert.equal(lif.getMembranePotential(), -60000);

  // 3. Supra-threshold injection (fires spike!)
  const firedSpike = lif.injectCurrent(10000, 1);
  assert.ok(firedSpike !== null);
  assert.equal(firedSpike.neuronId, "neuron-lif-test");
  assert.equal(firedSpike.amplitudeUv, 15000);

  // 4. Instant reset to V_reset and refractory activation
  assert.equal(lif.getMembranePotential(), -70000);
  assert.equal(lif.isInRefractory(), true);

  // 5. Clamping during refractory window (refractoryPeriodMs = 2ms)
  const blockedSpike = lif.injectCurrent(50000, 2);
  assert.equal(blockedSpike, null);
  assert.equal(lif.getMembranePotential(), -70000);
});

test("BDD-1892: Spike-Timing-Dependent Plasticity (STDP) Synaptic Weight Adaptation", () => {
  const syn = new EosStdpSynapse({
    sourceId: "pre-syn",
    targetId: "post-syn",
    weight: 50,
    minWeight: 10,
    maxWeight: 100,
    ltpRate: 8,
    ltdRate: 6,
  });

  assert.equal(syn.weight, 50);

  // 1. Long-Term Potentiation (LTP): pre before post (deltaT = 3ms > 0)
  const weightAfterLtp = syn.applyPlasticity(3);
  assert.ok(weightAfterLtp > 50);

  // 2. Long-Term Depression (LTD): post before pre (deltaT = -3ms < 0)
  const weightAfterLtd = syn.applyPlasticity(-3);
  assert.ok(weightAfterLtd < weightAfterLtp);

  // 3. Boundary bounds [minWeight, maxWeight]
  for (let i = 0; i < 20; i++) syn.applyPlasticity(1);
  assert.equal(syn.weight, 100);

  for (let i = 0; i < 30; i++) syn.applyPlasticity(-1);
  assert.equal(syn.weight, 10);
});

test("BDD-1893: Multi-Modal Sensory Rate & Temporal Spike Encoding", () => {
  const telemetry = {
    cpuSaturation: 0.95,
    memoryPressure: 0.2,
    agentQueueDepth: 0.8,
    latencyVariance: 0.5,
    errorRate: 0.05,
  };

  const encoded = EosSpikingSensoryEncoder.encodeTelemetry(telemetry, 10);
  assert.equal(encoded.size, 5);

  const cpuSpikes = encoded.get("cpu") ?? [];
  const errSpikes = encoded.get("err") ?? [];

  // Higher intensity produces higher firing frequency (rate coding)
  assert.ok(cpuSpikes.length > errSpikes.length);
});

test("BDD-1894: Hyper-Heuristic Meta-Selection & Low-Level Action Dispatch", () => {
  const planner = new EosHyperHeuristicPlannerCore();
  const telemetry = {
    cpuSaturation: 0.9,
    memoryPressure: 0.85,
    agentQueueDepth: 0.95,
    latencyVariance: 0.7,
    errorRate: 0.1,
  };

  const decision = planner.plan(telemetry);

  assert.ok(decision.cycleId.startsWith("cycle-"));
  assert.ok(
    ["BATCH_COALESCE", "SPECULATIVE_DEDUPLICATION", "PROACTIVE_BACKPRESSURE", "CACHE_PREWARM", "LOAD_SHED"].includes(
      decision.selectedHeuristic,
    ),
  );
  assert.ok(decision.confidence > 0 && decision.confidence <= 1.0);
  assert.ok(typeof decision.parameters === "object");
});

test("BDD-1895: Closed-Loop Utility Feedback & Reward Propagation Invariance", () => {
  const planner = new EosHyperHeuristicPlannerCore();
  const descriptor = planner.getHeuristic("CACHE_PREWARM");
  assert.ok(descriptor);

  const initialScore = descriptor.utilityScore;

  // Reward feedback
  const mockDecision = {
    cycleId: "test-cycle",
    timestamp: new Date().toISOString(),
    selectedHeuristic: "CACHE_PREWARM",
    spikeTrainLength: 10,
    activeNeuronsCount: 5,
    confidence: 0.8,
    parameters: {},
  };

  planner.recordFeedback(mockDecision, 20);
  assert.equal(descriptor.utilityScore, initialScore + 20);

  // Penalty feedback
  planner.recordFeedback(mockDecision, -35);
  assert.equal(descriptor.utilityScore, initialScore - 15);
});

test("BDD-1896: Leslie Lamport TLA+ Model 95 Model-Checking Verification Invariant", () => {
  const receipt = EosHyperHeuristicPlannerCore.audit(process.cwd());

  assert.equal(receipt.status, "HEALTHY");
  assert.equal(receipt.specId, "SPEC-352");
  assert.equal(receipt.lifDynamicsVerified, true);
  assert.equal(receipt.stdpPlasticityVerified, true);
  assert.equal(receipt.sensoryEncodingVerified, true);
  assert.equal(receipt.hyperHeuristicSelectionVerified, true);
  assert.equal(receipt.feedbackConvergenceVerified, true);
  assert.equal(receipt.tlcModelPass, true);

  const receiptPath = resolveEvidencePath("NEUROMORPHIC_PLANNER_RECEIPT.json", process.cwd());
  assert.ok(fs.existsSync(receiptPath));
  const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  assert.equal(saved.status, "HEALTHY");
});
