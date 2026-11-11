/**
 * EOS SYSTEM — LAYER-0 REVERSE-MODE AUTODIFF & TENSOR CORE TEST SUITE
 * Governed by SPEC-208, CHANGE-093, ADR-093, BDD-1059..BDD-1063 (v78.0.0)
 *
 * Validates:
 * - BDD-1059: Multidimensional tensor allocation, strides, and shape contracts.
 * - BDD-1060: Computational DAG tape construction and multivariable chain rule.
 * - BDD-1061: Nonlinear activations (ReLU, Sigmoid, Tanh) and 2D matmul backpropagation.
 * - BDD-1062: Numerical gradient checking oracle against central finite differences (< 1e-4).
 * - BDD-1063: Closed-loop SGD parameter training and SHA-256 gradient receipts.
 *
 * Strictly ZERO external dependencies. Pure JavaScript for Node 24 native runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EosTensor, EosReverseModeAutodiff, EosSgdOptimizer } from "../src/core/eosReverseModeAutodiff.ts";

describe("EosReverseModeAutodiff (SPEC-208 / BDD-1059..BDD-1063)", () => {
  it("BDD-1059: Multidimensional tensor operations and shape contract enforcement", () => {
    // 2x3 tensor
    const t = EosTensor.from([1, 2, 3, 4, 5, 6], [2, 3]);
    assert.equal(t.rank, 2);
    assert.deepEqual(t.shape, [2, 3]);
    assert.deepEqual(t.strides, [3, 1]);
    assert.equal(t.size, 6);

    // Matrix multiplication: [2, 3] x [3, 2] -> [2, 2]
    const other = EosTensor.from([7, 8, 9, 10, 11, 12], [3, 2]);
    const prod = t.matmul(other);
    assert.deepEqual(prod.shape, [2, 2]);
    assert.deepEqual(prod.toArray(), [58, 64, 139, 154]);

    // Incompatible inner dimensions must reject with contract error
    const invalidOther = EosTensor.from([1, 2, 3, 4], [2, 2]);
    assert.throws(() => {
      t.matmul(invalidOther);
    });
  });

  it("BDD-1060: Computational graph tape construction and backward chain rule", () => {
    // z = (x + y) * (x - y) = x^2 - y^2
    // dz/dx = 2x, dz/dy = -2y
    const x = EosTensor.from([3.0, 4.0], [2], true);
    const y = EosTensor.from([1.0, 2.0], [2], true);

    const sum = x.add(y);
    const diff = x.sub(y);
    const z = sum.mul(diff); // [3+1, 4+2] * [3-1, 4-2] = [4, 6] * [2, 2] = [8, 12]
    assert.deepEqual(z.toArray(), [8, 12]);

    const loss = z.sum(); // 8 + 12 = 20
    assert.equal(loss.item(), 20);

    loss.backward();

    // Verify analytical gradients: dz/dx = 2x = [6, 8], dz/dy = -2y = [-2, -4]
    assert.ok(x.grad);
    assert.ok(y.grad);
    assert.deepEqual(Array.from(x.grad), [6.0, 8.0]);
    assert.deepEqual(Array.from(y.grad), [-2.0, -4.0]);
  });

  it("BDD-1061: Nonlinear activation functions and matrix backpropagation", () => {
    // MLP step: X: [2, 2], W: [2, 2], b: [1]
    const X = EosTensor.from([1.0, -1.0, 2.0, 0.5], [2, 2], false);
    const W = EosTensor.from([0.5, -0.5, 1.0, 0.2], [2, 2], true);
    const b = EosTensor.scalar(0.1, true);

    const Z = X.matmul(W).add(b);
    const A = Z.relu();
    const sig = A.sigmoid();
    const loss = sig.sum();

    loss.backward();

    assert.ok(W.grad);
    assert.ok(b.grad);
    assert.equal(W.grad.length, 4);
    assert.equal(b.grad.length, 1);
    assert.ok(!Number.isNaN(W.grad[0]));
    assert.ok(!Number.isNaN(b.grad[0]));
  });

  it("BDD-1062: Numerical gradient checking against finite differences", () => {
    const w = EosTensor.from([0.8, -1.2, 2.5], [3], true);

    // Test polynomial function: f(w) = sum(w^3 - 3*w^2 + 5*w)
    const check1 = EosReverseModeAutodiff.checkGradient((param) => {
      const cubic = param.pow(3);
      const quad = param.pow(2).mul(3.0);
      const lin = param.mul(5.0);
      return cubic.sub(quad).add(lin).sum();
    }, w);

    assert.equal(check1.passed, true);
    assert.ok(check1.maxRelativeError < 1e-4);

    // Test Tanh activation function: f(w) = sum(tanh(w))
    const check2 = EosReverseModeAutodiff.checkGradient((param) => {
      return param.tanh().sum();
    }, w);

    assert.equal(check2.passed, true);
    assert.ok(check2.maxRelativeError < 1e-4);
  });

  it("BDD-1063: Closed-loop parameter optimization and cryptographic gradient receipt", () => {
    // Linear regression: target y = 2*x1 + 3*x2
    const X = EosTensor.from([1.0, 1.0, 2.0, 1.0, 1.0, 2.0, 2.0, 2.0], [4, 2], false);
    const target = EosTensor.from([5.0, 7.0, 8.0, 10.0], [4, 1], false);
    const W = EosTensor.from([0.1, 0.1], [2, 1], true);
    const optimizer = new EosSgdOptimizer([W], 0.05);

    const receipt = EosReverseModeAutodiff.trainStep(
      () => {
        const pred = X.matmul(W);
        return EosReverseModeAutodiff.mseLoss(pred, target);
      },
      optimizer,
      20,
    );

    assert.equal(receipt.stepsExecuted, 20);
    assert.equal(receipt.lossDecreased, true);
    assert.ok(receipt.finalLoss < receipt.initialLoss);
    assert.equal(receipt.sha256Receipt.length, 64);

    // CLI execution validation
    const gradStdout = execFileSync(process.execPath, ["bin/eos.mjs", "autodiff:grad", "--json"], { encoding: "utf8" });
    const gradJson = JSON.parse(gradStdout);
    assert.equal(gradJson.gradientCheck.passed, true);
    assert.equal(gradJson.analyticalGrad.length, 4);

    const trainStdout = execFileSync(process.execPath, ["bin/eos.mjs", "autodiff:train", "--epochs=10", "--json"], {
      encoding: "utf8",
    });
    const trainJson = JSON.parse(trainStdout);
    assert.equal(trainJson.receipt.lossDecreased, true);
    assert.equal(trainJson.receipt.sha256Receipt.length, 64);
  });
});
