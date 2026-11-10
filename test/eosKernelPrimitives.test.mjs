/**
 * EOS SYSTEM — KERNEL PRIMITIVES UNIT TEST SUITE (SPEC-041)
 * Validates Design by Contract (DbC), pure SHA-256, Mulberry32 PRNG, and Result containers.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ContractError,
  assertPrecondition,
  assertPostcondition,
  assertInvariant,
  deepFreeze,
  pureSha256,
  createMulberry32,
  Ok,
  Err,
} from "../src/core/eosKernelPrimitives.ts";

test("BDD-115: Design by Contract & ContractError Validation", () => {
  // Precondition
  assert.doesNotThrow(() => assertPrecondition(true, "valid"));
  assert.throws(
    () => assertPrecondition(false, "precondition violated"),
    (err) =>
      err instanceof ContractError &&
      err.contractType === "PRECONDITION" &&
      err.message.includes("[PRECONDITION_FAILED]"),
  );

  // Postcondition
  assert.doesNotThrow(() => assertPostcondition(true, "valid"));
  assert.throws(
    () => assertPostcondition(false, "postcondition violated"),
    (err) =>
      err instanceof ContractError &&
      err.contractType === "POSTCONDITION" &&
      err.message.includes("[POSTCONDITION_FAILED]"),
  );

  // Invariant
  assert.doesNotThrow(() => assertInvariant(true, "valid"));
  assert.throws(
    () => assertInvariant(false, "invariant violated"),
    (err) =>
      err instanceof ContractError && err.contractType === "INVARIANT" && err.message.includes("[INVARIANT_FAILED]"),
  );
});

test("BDD-116: Deep Immutability & View Bypass in deepFreeze", () => {
  // Primitives and null return as-is
  assert.equal(deepFreeze(null), null);
  assert.equal(deepFreeze(undefined), undefined);
  assert.equal(deepFreeze(42), 42);
  assert.equal(deepFreeze("hello"), "hello");

  // TypedArray / ArrayBuffer views are bypassed cleanly
  const uint8 = new Uint8Array([1, 2, 3]);
  const frozenView = deepFreeze(uint8);
  assert.equal(frozenView, uint8);

  // Deep nested object freezing
  const preFrozen = Object.freeze({ already: "frozen" });
  const obj = {
    level1: {
      level2: {
        val: "test",
      },
    },
    arr: [1, 2, { inner: true }],
    fn: () => "func",
    preFrozen,
  };
  const frozen = deepFreeze(obj);
  assert.ok(Object.isFrozen(frozen));
  assert.ok(Object.isFrozen(frozen.level1));
  assert.ok(Object.isFrozen(frozen.level1.level2));
  assert.ok(Object.isFrozen(frozen.arr));
  assert.ok(Object.isFrozen(frozen.arr[2]));
  assert.equal(frozen.fn(), "func");
});

test("BDD-117: FIPS 180-4 Pure SHA-256 Multi-Byte Unicode & Surrogate Pairs", () => {
  // ASCII
  assert.equal(pureSha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(pureSha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

  // 2-byte UTF-8: ñ, é, ü (code < 0x800)
  assert.equal(pureSha256("español"), "0c7ab686d80cf896676d2c6e09c7853c0b1a2c1477789cc8030e8abf978edf85");

  // 3-byte UTF-8: 日本語 (code < 0xd800)
  assert.equal(pureSha256("日本語"), "77710aedc74ecfa33685e33a6c7df5cc83004da1bdcef7fb280f5c2b2e97e0a5");

  // 4-byte UTF-8: Emoji surrogate pairs: 🚀🔥 (code >= 0x10000)
  assert.equal(pureSha256("🚀 Glorian System 🔥"), "784a9409a6df80379fe00ca345489d905149568f738b4e646890f1492d1a3c2f");

  // Multi-block payloads spanning multiple 64-byte chunks and boundary conditions
  assert.equal(pureSha256("a".repeat(65)), "635361c48bb9eab14198e76ea8ab7f1a41685d6ad62aa9146d301d4f17eb0ae0");
  assert.equal(pureSha256("b".repeat(128)), "70ae1c5307f5250d5cb9e40742ba9613fcdf9b8d9eb6dd393330443b2d5effbd");
});

test("BDD-118: Mulberry32 PRNG and Result Functional Containers", () => {
  // Mulberry32 determinism
  const prng1 = createMulberry32(42);
  const prng2 = createMulberry32(42);
  const val1a = prng1();
  const val1b = prng1();
  const val2a = prng2();
  const val2b = prng2();

  assert.equal(val1a, val2a);
  assert.equal(val1b, val2b);
  assert.ok(val1a >= 0 && val1a < 1);

  // Default seed
  const defaultPrng = createMulberry32();
  assert.ok(defaultPrng() >= 0);

  // Result Ok container
  const okResult = Ok("success-payload");
  assert.equal(okResult.ok, true);
  if (okResult.ok) {
    assert.equal(okResult.value, "success-payload");
  }
  assert.ok(Object.isFrozen(okResult));

  // Result Err container
  const customError = new Error("simulated failure");
  const errResult = Err(customError);
  assert.equal(errResult.ok, false);
  if (!errResult.ok) {
    assert.equal(errResult.error, customError);
  }
  assert.ok(Object.isFrozen(errResult));
});
