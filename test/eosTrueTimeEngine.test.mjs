/**
 * EOS SYSTEM — SPEC-078 BDD TEST SUITE
 * TrueTime Uncertainty & Commit-Wait Linearizability Engine
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosTrueTimeEngine } from '../src/core/eosTrueTimeEngine.ts';

test('BDD-231: Bounded Time Interval and Invariant Monotonicity', () => {
  const epsilon = 5.0; // 5ms uncertainty
  const tt = new EosTrueTimeEngine(epsilon);

  const t1 = tt.now();
  assert.ok(t1.earliest <= t1.mean);
  assert.ok(t1.mean <= t1.latest);
  assert.equal(Number((t1.latest - t1.earliest).toFixed(2)), 2 * epsilon);
  assert.equal(t1.uncertaintyEpsilonMs, epsilon);
});

test('BDD-232: Commit-Wait Strict Linearizability Guarantee', async () => {
  const epsilon = 3.0;
  const tt = new EosTrueTimeEngine(epsilon);

  // Transaction T1 assigns commit timestamp s = t.latest
  const t1 = tt.now();
  const commitTimestamp = t1.latest;

  // Execute commit-wait
  const waitMs = await tt.commitWait(commitTimestamp);
  assert.ok(waitMs >= 0);

  // After commit-wait, TrueTime.after(commitTimestamp) must be true
  assert.equal(tt.after(commitTimestamp), true);

  // Transaction T2 starts now
  const t2 = tt.now();
  assert.ok(t2.earliest > commitTimestamp);

  // Strict linearizability verified: s(T1) < s(T2)
  const linearizable = EosTrueTimeEngine.verifyLinearizability(commitTimestamp, t2.earliest);
  assert.equal(linearizable, true);
});
