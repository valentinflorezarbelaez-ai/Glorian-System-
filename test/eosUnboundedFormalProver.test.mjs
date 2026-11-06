import test from "node:test";
import assert from "node:assert/strict";

import { EosUnboundedFormalProver } from "../src/core/eosUnboundedFormalProver.ts";

test("BDD-261: Demostración inductiva de invariantes de seguridad para consenso Spanner (SPEC-093)", () => {
  const prover = new EosUnboundedFormalProver("SpannerLinearizabilityModel", [
    { clockTime: 100, commitTimestamp: 0, lockHeld: false }
  ]);

  // Transition 1: Advance clock monotonically
  prover.addTransition({
    actionName: "AdvanceClock",
    guard: (s) => s.clockTime < 105,
    apply: (s) => ({ ...s, clockTime: s.clockTime + 1 })
  });

  // Transition 2: Commit-Wait transaction
  prover.addTransition({
    actionName: "CommitWaitTransaction",
    guard: (s) => !s.lockHeld && s.clockTime >= 102,
    apply: (s) => ({ ...s, commitTimestamp: s.clockTime, lockHeld: true })
  });

  // Safety Invariant: Commit timestamp must be <= current clock (monotonic linearizability)
  prover.addInvariant({
    name: "LinearizabilityGuarantee",
    check: (s) => s.commitTimestamp <= s.clockTime
  });

  const cert = prover.verifyInductiveModel(20);

  assert.equal(cert.verified, true);
  assert.equal(cert.inductiveBaseHolds, true);
  assert.equal(cert.inductiveStepHolds, true);
  assert.ok(cert.totalStatesExplored >= 5);
  assert.equal(cert.counterexampleTrace, null);
  assert.ok(cert.proofSha256.length === 64);
});

test("BDD-262: Detección y reducción de contraejemplos mínimos ante violaciones forzadas (SPEC-093)", () => {
  const prover = new EosUnboundedFormalProver("FlawedTransitionModel", [
    { counter: 0 }
  ]);

  // Transition increments counter
  prover.addTransition({
    actionName: "Increment",
    guard: (s) => s.counter < 5,
    apply: (s) => ({ counter: s.counter + 1 })
  });

  // Flawed transition that jumps to an illegal state
  prover.addTransition({
    actionName: "FaultyJump",
    guard: (s) => s.counter === 2,
    apply: (_s) => ({ counter: -99 })
  });

  // Invariant: counter must always be non-negative
  prover.addInvariant({
    name: "NonNegativeCounter",
    check: (s) => s.counter >= 0
  });

  const cert = prover.verifyInductiveModel(10);

  assert.equal(cert.verified, false);
  assert.equal(cert.inductiveBaseHolds, true);
  assert.equal(cert.inductiveStepHolds, false);
  assert.ok(cert.counterexampleTrace !== null);
  assert.equal(cert.counterexampleTrace.length, 4); // [0 -> 1 -> 2 -> -99]
  assert.equal(cert.counterexampleTrace[3].counter, -99);
});
