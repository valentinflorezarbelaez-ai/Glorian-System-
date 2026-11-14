/**
 * SPEC-230 / CHANGE-115: Layer-0 Cryptographic Time-Lock Puzzle Engine (RSW96 & Sloth)
 * Test Suite verifying BDD-1169 through BDD-1173.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EosTimeLockPuzzleCore,
  STANDARD_RSW_TRAPDOOR,
  SLOTH_SECP256K1_PRIME,
} from "../src/core/eosTimeLockPuzzleCore.ts";

test("BDD-1169: Fast Trapdoor Puzzle Generation (RSW96)", () => {
  const secret = "Glorian Sovereign Quantum Escrow Key";
  const difficultyT = 10000;

  const start = performance.now();
  const puzzle = EosTimeLockPuzzleCore.createPuzzle(secret, difficultyT, STANDARD_RSW_TRAPDOOR, 2n, 2000);
  const elapsedMs = performance.now() - start;

  assert.ok(
    elapsedMs < 100,
    `Trapdoor generation must complete sub-100ms under CI load (actual: ${elapsedMs.toFixed(2)}ms)`,
  );
  assert.equal(puzzle.difficultyT, difficultyT);
  assert.equal(puzzle.checkpointInterval, 2000);
  assert.ok(typeof puzzle.modulusHex === "string" && puzzle.modulusHex.length > 0);
  assert.ok(typeof puzzle.generatorHex === "string" && puzzle.generatorHex.length > 0);
  assert.equal(puzzle.ivHex.length, 24, "IV must be 12 bytes (24 hex characters)");
  assert.equal(puzzle.authTagHex.length, 32, "Auth tag must be 16 bytes (32 hex characters)");
  assert.ok(puzzle.ciphertextHex.length > 0);
});

test("BDD-1170: Sequential Solver Execution and Secret Recovery", () => {
  const secret = "Decentralized Sealed-Bid Auction: Bid = $50,000,000";
  const difficultyT = 2000;

  const puzzle = EosTimeLockPuzzleCore.createPuzzle(secret, difficultyT);
  const solution = EosTimeLockPuzzleCore.solvePuzzle(puzzle);

  assert.equal(solution.plaintext, secret, "Recovered plaintext must match original secret");
  assert.equal(solution.squaringsPerformed, difficultyT);
  assert.equal(solution.keyHex.length, 64, "Derived key must be 32 bytes (64 hex characters)");
  assert.ok(solution.elapsedMs >= 0);
});

test("BDD-1171: Tamper Detection and Decryption Integrity", () => {
  const secret = "Confidential Governance Vote: YES on Proposal #42";
  const difficultyT = 500;

  const puzzle = EosTimeLockPuzzleCore.createPuzzle(secret, difficultyT);

  // 1. Corrupted ciphertext must throw integrity error
  const corruptedCiphertext =
    puzzle.ciphertextHex.slice(0, -2) + (puzzle.ciphertextHex.slice(-2) === "00" ? "ff" : "00");
  const badCiphertextPuzzle = { ...puzzle, ciphertextHex: corruptedCiphertext };

  assert.throws(
    () => EosTimeLockPuzzleCore.solvePuzzle(badCiphertextPuzzle),
    /Decryption integrity verification failed/,
    "Corrupted ciphertext must trigger decryption error",
  );

  // 2. Corrupted auth tag must throw integrity error
  const corruptedTag = puzzle.authTagHex.slice(0, -2) + (puzzle.authTagHex.slice(-2) === "00" ? "ff" : "00");
  const badTagPuzzle = { ...puzzle, authTagHex: corruptedTag };

  assert.throws(
    () => EosTimeLockPuzzleCore.solvePuzzle(badTagPuzzle),
    /Decryption integrity verification failed/,
    "Corrupted auth tag must trigger decryption error",
  );
});

test("BDD-1172: Checkpoint Sampling and Verification", () => {
  const secret = "Verifiable Delay Progress Milestone";
  const difficultyT = 1000;
  const checkpointInterval = 200;

  const puzzle = EosTimeLockPuzzleCore.createPuzzle(secret, difficultyT, STANDARD_RSW_TRAPDOOR, 2n, checkpointInterval);
  const solution = EosTimeLockPuzzleCore.solvePuzzle(puzzle);

  assert.ok(solution.checkpointsHex !== undefined);
  // Snapshots at 0, 200, 400, 600, 800, 1000 -> 6 checkpoints
  assert.equal(solution.checkpointsHex.length, 6);

  // Verify all 5 consecutive segments
  for (let i = 0; i < solution.checkpointsHex.length - 1; i++) {
    const fromState = solution.checkpointsHex[i];
    const toState = solution.checkpointsHex[i + 1];

    const res = EosTimeLockPuzzleCore.verifyCheckpointSegment(
      puzzle.modulusHex,
      fromState,
      toState,
      checkpointInterval,
      i,
    );

    assert.equal(res.valid, true, `Segment ${i} transition must be valid`);
  }

  // Corrupted toState must fail verification
  const badToState =
    solution.checkpointsHex[1].slice(0, -2) + (solution.checkpointsHex[1].slice(-2) === "00" ? "ff" : "00");
  const badRes = EosTimeLockPuzzleCore.verifyCheckpointSegment(
    puzzle.modulusHex,
    solution.checkpointsHex[0],
    badToState,
    checkpointInterval,
    0,
  );
  assert.equal(badRes.valid, false, "Corrupted checkpoint state must fail verification");
});

test("BDD-1173: Sloth Modular Square Root Time-Lock Permutation", () => {
  const secret = "Sloth-VDF-Payload-Secp256k1";
  const iterations = 30;

  const slothPuzzle = EosTimeLockPuzzleCore.createSlothPuzzle(secret, iterations);
  assert.equal(slothPuzzle.primeHex, SLOTH_SECP256K1_PRIME.toString(16));
  const slothSolution = EosTimeLockPuzzleCore.solveSlothPuzzle(slothPuzzle);

  assert.equal(slothSolution.plaintext, secret, "Sloth decrypted message must match");
  assert.equal(slothSolution.iterations, iterations);

  // Fast O(log T) verification
  const startVerify = Date.now();
  const isValid = EosTimeLockPuzzleCore.verifySloth(
    slothPuzzle.primeHex,
    slothPuzzle.inputHex,
    slothSolution.outputHex,
    iterations,
  );
  const verifyElapsed = Date.now() - startVerify;

  assert.equal(isValid, true, "Sloth square root sequence must verify via fast exponentiation");
  assert.ok(verifyElapsed < 10, `Fast verification must take < 10ms (actual: ${verifyElapsed}ms)`);

  // Verification with wrong output must return false
  const badOutput = slothSolution.outputHex.slice(0, -2) + (slothSolution.outputHex.slice(-2) === "00" ? "ff" : "00");
  const isInvalid = EosTimeLockPuzzleCore.verifySloth(
    slothPuzzle.primeHex,
    slothPuzzle.inputHex,
    badOutput,
    iterations,
  );
  assert.equal(isInvalid, false, "Tampered output must fail Sloth verification");
});
