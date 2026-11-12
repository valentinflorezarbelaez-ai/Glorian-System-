import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import {
  EosPostQuantumMlKemCore,
  ML_KEM_768_PARAMS,
  ntt,
  intt,
  multiplyNTTs,
  sampleNTTMatrixEntry,
  samplePolyCBD2,
} from "../src/core/eosPostQuantumMlKemCore.ts";
import { dispatchPhase7FrontierActionExt } from "../src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts";

test("BDD-1124: NTT Ring Arithmetic and Polynomial Multiplication", () => {
  const q = 3329;

  // 1. NTT invertibility (INTT(NTT(f)) == f)
  const original = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    original[i] = (i * 37 + 13) % q;
  }
  const fHat = ntt(original);
  const recovered = intt(fHat);
  for (let i = 0; i < 256; i++) {
    assert.strictEqual(recovered[i], original[i], `Coefficients at ${i} must match`);
  }

  // 2. NTT multiplication equivalence to classical polynomial ring mul mod (X^256 + 1)
  const a = new Int32Array(256);
  const b = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    a[i] = (i * 11 + 5) % q;
    b[i] = (i * 23 + 17) % q;
  }

  // Classical multiplication
  const expected = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    for (let j = 0; j < 256; j++) {
      const idx = i + j;
      const term = a[i] * b[j];
      if (idx < 256) {
        expected[idx] = (((expected[idx] + term) % q) + q) % q;
      } else {
        expected[idx - 256] = (((expected[idx - 256] - term) % q) + q) % q;
      }
    }
  }

  const aHat = ntt(a);
  const bHat = ntt(b);
  const cHat = multiplyNTTs(aHat, bHat);
  const actual = intt(cHat);

  for (let i = 0; i < 256; i++) {
    assert.strictEqual(actual[i], expected[i], `Product coefficient at ${i} must match classical ring mul`);
  }
});

test("BDD-1125: Matrix Generation and Centered Binomial Distribution Sampling", () => {
  const rho = crypto.randomBytes(32);
  const sigma = crypto.randomBytes(32);

  // 1. Matrix sampling determinism
  const a00_1 = sampleNTTMatrixEntry(rho, 0, 0);
  const a00_2 = sampleNTTMatrixEntry(rho, 0, 0);
  assert.strictEqual(a00_1.length, 256);
  for (let i = 0; i < 256; i++) {
    assert.strictEqual(a00_1[i], a00_2[i], "Same seed and indices must yield identical polynomial");
    assert.ok(a00_1[i] >= 0 && a00_1[i] < 3329, "Coefficients must be in [0, q-1]");
  }

  // Divergent indices yield different polynomials
  const a01 = sampleNTTMatrixEntry(rho, 1, 0);
  assert.notDeepStrictEqual(Array.from(a00_1), Array.from(a01));

  // 2. Centered Binomial Distribution bounds (eta = 2 -> coeffs in [-2, 2] mod q)
  const e = samplePolyCBD2(sigma, 0);
  assert.strictEqual(e.length, 256);
  for (let i = 0; i < 256; i++) {
    const val = e[i];
    const inRange = val <= 2 || val >= 3329 - 2;
    assert.ok(inRange, `CBD(eta=2) coefficient at ${i} (${val}) must fall within [-2, 2] mod q`);
  }
});

test("BDD-1126: Honest Encapsulation and Decapsulation Round-Trip", () => {
  const kem = new EosPostQuantumMlKemCore();

  // 1. Key generation produces canonical NIST FIPS 203 sizes
  const kp = kem.generateKeyPair();
  assert.strictEqual(kp.encapsulationKey.length, ML_KEM_768_PARAMS.publicKeyBytes);
  assert.strictEqual(kp.decapsulationKey.length, ML_KEM_768_PARAMS.secretKeyBytes);
  assert.strictEqual(kp.receiptSha256.length, 64);

  // 2. Encapsulation against encapsulationKey
  const enc = kem.encapsulate(kp.encapsulationKey);
  assert.strictEqual(enc.sharedSecret.length, ML_KEM_768_PARAMS.sharedSecretBytes);
  assert.strictEqual(enc.ciphertext.length, ML_KEM_768_PARAMS.ciphertextBytes);
  assert.strictEqual(enc.receiptSha256.length, 64);

  // 3. Decapsulation recovers exact 32-byte shared secret
  const dec = kem.decapsulate(kp.decapsulationKey, enc.ciphertext);
  assert.strictEqual(dec.valid, true);
  assert.strictEqual(dec.sharedSecret.length, 32);
  assert.strictEqual(dec.receiptSha256.length, 64);
  assert.deepStrictEqual(Buffer.from(dec.sharedSecret), Buffer.from(enc.sharedSecret));

  // 4. Static method parity
  const staticKp = EosPostQuantumMlKemCore.generateKeyPair();
  const staticEnc = EosPostQuantumMlKemCore.encapsulate(staticKp.encapsulationKey);
  const staticDec = EosPostQuantumMlKemCore.decapsulate(staticKp.decapsulationKey, staticEnc.ciphertext);
  assert.strictEqual(staticDec.valid, true);
  assert.deepStrictEqual(Buffer.from(staticDec.sharedSecret), Buffer.from(staticEnc.sharedSecret));
});

test("BDD-1127: IND-CCA2 Active Attack and Constant-Time Implicit Rejection", () => {
  const kem = new EosPostQuantumMlKemCore();
  const kp = kem.generateKeyPair();
  const enc = kem.encapsulate(kp.encapsulationKey);

  // 1. Bit-flip in ciphertext triggers implicit rejection
  const forgedCiphertext = new Uint8Array(enc.ciphertext);
  forgedCiphertext[0] ^= 0x01;

  const decForged = kem.decapsulate(kp.decapsulationKey, forgedCiphertext);
  assert.strictEqual(decForged.valid, false, "Forged ciphertext must not be considered valid");
  assert.strictEqual(decForged.sharedSecret.length, 32);
  assert.notDeepStrictEqual(
    Buffer.from(decForged.sharedSecret),
    Buffer.from(enc.sharedSecret),
    "Implicitly rejected secret must NOT match authentic shared secret",
  );

  // 2. Re-decapsulating the same forged ciphertext yields deterministic pseudo-random secret
  const decForgedRepeat = kem.decapsulate(kp.decapsulationKey, forgedCiphertext);
  assert.deepStrictEqual(
    Buffer.from(decForged.sharedSecret),
    Buffer.from(decForgedRepeat.sharedSecret),
    "Implicit rejection output must be deterministic based on seed z and forged ciphertext",
  );

  // 3. Invalid key or ciphertext sizes fail-closed with clear contract errors
  assert.throws(() => kem.encapsulate(new Uint8Array(100)), /Invalid encapsulation key/);
  assert.throws(() => kem.decapsulate(new Uint8Array(100), enc.ciphertext), /Invalid decapsulation key/);
  assert.throws(() => kem.decapsulate(kp.decapsulationKey, new Uint8Array(50)), /Invalid ciphertext/);
});

test("BDD-1128: CLI, MCP Dispatch and Monotonic Ledger Receipt", () => {
  // 1. CLI keygen output
  const outKeyGen = execSync("node bin/eos.mjs ml-kem:keygen --json", { encoding: "utf8" });
  const jsonKeyGen = JSON.parse(outKeyGen);
  assert.strictEqual(jsonKeyGen.algorithm, "ML-KEM-768");
  assert.strictEqual(jsonKeyGen.standard, "NIST FIPS 203");
  assert.strictEqual(jsonKeyGen.encapsulationKeyBytes, 1184);
  assert.strictEqual(jsonKeyGen.decapsulationKeyBytes, 2400);
  assert.strictEqual(jsonKeyGen.receiptSha256.length, 64);

  // 2. CLI encaps output
  const outEncaps = execSync(`node bin/eos.mjs ml-kem:encaps --ek=${jsonKeyGen.encapsulationKeyHex} --json`, {
    encoding: "utf8",
  });
  const jsonEncaps = JSON.parse(outEncaps);
  assert.strictEqual(jsonEncaps.sharedSecretBytes, 32);
  assert.strictEqual(jsonEncaps.ciphertextBytes, 1088);
  assert.strictEqual(jsonEncaps.receiptSha256.length, 64);

  // 3. CLI decaps output
  const outDecaps = execSync(
    `node bin/eos.mjs ml-kem:decaps --dk=${jsonKeyGen.decapsulationKeyHex} --ct=${jsonEncaps.ciphertextHex} --json`,
    { encoding: "utf8" },
  );
  const jsonDecaps = JSON.parse(outDecaps);
  assert.strictEqual(jsonDecaps.valid, true);
  assert.strictEqual(jsonDecaps.sharedSecretHex, jsonEncaps.sharedSecretHex);

  // 4. CLI benchmark output
  const outBench = execSync("node bin/eos.mjs ml-kem:benchmark --iterations=5 --json", { encoding: "utf8" });
  const jsonBench = JSON.parse(outBench);
  assert.ok(jsonBench.keyGenOpsPerSec > 0);
  assert.ok(jsonBench.encapsOpsPerSec > 0);
  assert.ok(jsonBench.decapsOpsPerSec > 0);
  assert.strictEqual(jsonBench.receiptSha256.length, 64);

  // 5. MCP Tool dispatch
  const mcpKeyGen = dispatchPhase7FrontierActionExt("ml_kem_keygen", {}, {});
  assert.strictEqual(mcpKeyGen.action, "ml_kem_keygen");
  assert.strictEqual(mcpKeyGen.algorithm, "ML-KEM-768");

  const mcpEncaps = dispatchPhase7FrontierActionExt("ml_kem_encaps", { ek: mcpKeyGen.encapsulationKeyHex }, {});
  assert.strictEqual(mcpEncaps.action, "ml_kem_encaps");

  const mcpDecaps = dispatchPhase7FrontierActionExt(
    "ml_kem_decaps",
    { dk: mcpKeyGen.decapsulationKeyHex, ct: mcpEncaps.ciphertextHex },
    {},
  );
  assert.strictEqual(mcpDecaps.action, "ml_kem_decaps");
  assert.strictEqual(mcpDecaps.valid, true);
  assert.strictEqual(mcpDecaps.sharedSecretHex, mcpEncaps.sharedSecretHex);
});
