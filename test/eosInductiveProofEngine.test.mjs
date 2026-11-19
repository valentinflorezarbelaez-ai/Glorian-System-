/**
 * @file eosInductiveProofEngine.test.mjs
 * @description Automated test suite for SPEC-360 / CHANGE-222: Autonomous Formal Verification & Metamorphic Proof Engine.
 *
 * Verifies BDD-1939 through BDD-1944:
 * - BDD-1939: Verificación del Paso Base y Detección de Violaciones Iniciales
 * - BDD-1940: Detección de Contraejemplos de Transición (Non-Inductive Invariant)
 * - BDD-1941: Síntesis Automatizada de Lemas Auxiliares de Fortalecimiento (CEGIS)
 * - BDD-1942: Evaluación de Relaciones Metamórficas y Preservación de Invariantes
 * - BDD-1943: Orquestación Híbrida de Co-Prover TLC y Verificación Inductiva
 * - BDD-1944: Benchmark de Throughput de Síntesis y Recibo Formal de Auditoría
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";
import {
  EosInductiveInvariantSynthesizer,
  EosInductiveProofEngineCore,
  EosMetamorphicRelationEngine,
} from "../src/core/eosInductiveProofEngine.ts";

test("BDD-1939: Verificación del Paso Base y Detección de Violaciones Iniciales", () => {
  const validInit = [{ count: 0, flag: true }];
  const invalidInit = [{ count: -1, flag: true }];
  const property = {
    name: "NonNegativeCount",
    predicate: (s) => Number(s.count) >= 0,
  };

  // Valid init passes base case
  const res = EosInductiveInvariantSynthesizer.synthesize(validInit, validInit, [(s) => s], property, 1);
  assert.equal(res.baseCaseVerified, true);

  // Invalid init throws immediately fail-closed
  assert.throws(
    () => EosInductiveInvariantSynthesizer.synthesize(invalidInit, invalidInit, [(s) => s], property, 1),
    /BASE_CASE_VIOLATION/,
  );
});

test("BDD-1940: Detección de Contraejemplos de Transición (Non-Inductive Invariant)", () => {
  const init = [{ x: 0 }];
  // Reachable states: x in 0..2. Property: x < 5.
  // But suppose unconstrained state space contains x = 4, and transition does x + 2 = 6, violating x < 5.
  const candidateStates = [{ x: 0 }, { x: 4 }];
  const transitions = [(s) => ({ x: Number(s.x) + 2 })];
  const property = {
    name: "BoundedX",
    predicate: (s) => Number(s.x) < 5,
  };

  // On iteration 1, (x=4 -> x=6) is detected as counterexample and pruned via lemma synthesis
  const res = EosInductiveInvariantSynthesizer.synthesize(init, candidateStates, transitions, property, 2);

  assert.equal(res.totalCounterexamplesPruned, 1);
  assert.equal(res.synthesizedLemmas.length, 1);
  assert.equal(res.converged, true);
});

test("BDD-1941: Síntesis Automatizada de Lemas Auxiliares de Fortalecimiento (CEGIS)", () => {
  const init = [{ stage: "READY", error: false }];
  const candidateStates = [
    { stage: "READY", error: false },
    { stage: "RUNNING", error: false },
    { stage: "UNGUARDED", error: true },
  ];
  const transitions = [
    (s) => ({
      stage: s.stage === "UNGUARDED" ? "FATAL" : "RUNNING",
      error: s.error,
    }),
  ];
  const property = {
    name: "NoFatalStage",
    predicate: (s) => s.stage !== "FATAL",
  };

  const res = EosInductiveInvariantSynthesizer.synthesize(init, candidateStates, transitions, property, 5);

  assert.equal(res.converged, true);
  assert.equal(res.inductiveStepVerified, true);
  assert.ok(res.synthesizedLemmas.length >= 1);
  assert.equal(res.synthesizedLemmas[0].id, "LEMMA-1");
});

test("BDD-1942: Evaluación de Relaciones Metamórficas y Preservación de Invariantes", () => {
  const states = [
    { a: 1, b: 2, timestamp: 1000 },
    { a: 3, b: 4, timestamp: 2000 },
  ];
  const transition = (s) => ({
    ...s,
    a: Number(s.a) + 1,
    b: Number(s.b) + 1,
  });
  const invariant = (s) => Number(s.a) > 0 && Number(s.b) > 0;

  const report = EosMetamorphicRelationEngine.testMetamorphicRelations(states, transition, invariant);

  assert.equal(report.symmetryPreserved, true);
  assert.equal(report.violations.length, 0);
  assert.ok(report.transformationsTested >= 4);
});

test("BDD-1943: Orquestación Híbrida de Co-Prover TLC y Verificación Inductiva", () => {
  const receipt = EosInductiveProofEngineCore.generateAuditReceipt();

  assert.equal(receipt.specId, "SPEC-360");
  assert.equal(receipt.changeId, "CHANGE-222");
  assert.equal(receipt.tlcModelVerified, true);
  assert.equal(receipt.cegisResult.converged, true);
  assert.equal(receipt.metamorphicReport.symmetryPreserved, true);
  assert.equal(receipt.verdict, "CONFORMANT");
});

test("BDD-1944: Benchmark de Throughput de Síntesis y Recibo Formal de Auditoría", () => {
  const bench = EosInductiveProofEngineCore.runBenchmark(500);

  assert.equal(bench.transitionsEvaluated, 500);
  assert.ok(bench.throughputTransitionsSec > 10000); // Exceeds 10k trans/sec
  assert.ok(bench.avgLemmaSynthesisLatencyUs > 0);

  const receipt = EosInductiveProofEngineCore.audit(process.cwd());
  assert.equal(receipt.specId, "SPEC-360");
  assert.equal(receipt.changeId, "CHANGE-222");
  assert.equal(receipt.verdict, "CONFORMANT");
  assert.equal(receipt.epistemicState, "PRODUCTION_READY_WITHIN_TESTED_SCOPE");

  const receiptPath = resolveEvidencePath("INDUCTIVE_PROOF_ENGINE_RECEIPT.json", process.cwd());
  assert.ok(fs.existsSync(receiptPath));
});
