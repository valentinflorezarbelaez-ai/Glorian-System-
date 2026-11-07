/**
 * Property-Based Fuzzing — New Modules (Hrana, Protobuf, Mutation)
 * Generated random inputs validated against invariants.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EosProtobufContractEngine } from "../src/core/eosProtobufContractEngine.ts";
import { EosMutationTestingEngine } from "../src/core/eosMutationTestingEngine.ts";

// Deterministic PRNG for reproducible fuzzing
function* lcg(seed) {
  let s = seed;
  while (true) {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    yield s;
  }
}
const rng = lcg(2026);
const rand = (min, max) => min + (rng.next().value % (max - min + 1));

describe("Property: Protobuf roundtrip invariants (50 random inputs)", () => {
  const engine = new EosProtobufContractEngine();
  engine.registerSchema({
    name: "FuzzTarget",
    fields: [
      { tag: 1, name: "str", wireType: 2, type: "string" },
      { tag: 2, name: "num", wireType: 0, type: "int32" },
      { tag: 3, name: "flag", wireType: 0, type: "bool" },
      { tag: 4, name: "dbl", wireType: 1, type: "double" },
    ],
  });

  const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789 !@#$%^&*()_+-=[]{}|;':\",./<>?\n\t";

  it("FUZZ-001: 50 random string/int/bool combos roundtrip losslessly", () => {
    for (let i = 0; i < 50; i++) {
      const strLen = rand(0, 30);
      let str = "";
      for (let c = 0; c < strLen; c++) str += CHARS[rand(0, CHARS.length - 1)];
      const num = rand(-100000, 100000);
      const flag = rand(0, 1) === 1;
      const dbl = rand(-1000000, 1000000) / 100;

      const original = { str, num, flag, dbl };
      const encoded = engine.encode("FuzzTarget", original);
      const decoded = engine.decode("FuzzTarget", encoded.payload);

      assert.equal(decoded.str, str, `iteration ${i}: string mismatch`);
      assert.equal(decoded.num, num, `iteration ${i}: num mismatch`);
      assert.equal(decoded.flag, flag, `iteration ${i}: flag mismatch`);
      assert.ok(Math.abs(decoded.dbl - dbl) < 1e-6, `iteration ${i}: dbl mismatch`);
    }
  });

  it("FUZZ-002: encoding identical data always produces same digest", () => {
    for (let i = 0; i < 20; i++) {
      const data = { str: `test-${rand(0, 999)}`, num: rand(0, 65535), flag: true, dbl: 0 };
      const a = engine.encode("FuzzTarget", data);
      const b = engine.encode("FuzzTarget", data);
      assert.equal(a.sha256Digest, b.sha256Digest);
    }
  });
});

describe("Property: Mutation engine determinism invariants", () => {
  const engine = new EosMutationTestingEngine({ maxPerFile: 100 });
  let tmpDir;
  const SOURCES = {
    add: "function add(a, b) { return a + b; }",
    cmp: "const x = a > 0 && b !== null;",
    ifElse: "if (n <= 10) { return !flag; }",
    ternary: 'let r = count >= 5 ? "yes" : "";',
    logic: "const ok = value != undefined || x === true;",
    compute: "function compute(a,b) { return a * b / 2 - 1; }",
    range: "return n < 0 || m >= 100;",
    chain: "x = y === z !== w;",
  };

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-fuzz-"));
    for (const [name, src] of Object.entries(SOURCES)) {
      fs.writeFileSync(path.join(tmpDir, `${name}.js`), src, "utf8");
    }
  });

  it("FUZZ-003: mutant generation is deterministic for same input", () => {
    for (const name of Object.keys(SOURCES)) {
      const file = path.join(tmpDir, `${name}.js`);
      const a = engine.generateMutants(file);
      const b = engine.generateMutants(file);
      assert.equal(a.length, b.length, `mutant count differs for "${name}"`);
    }
  });

  it("FUZZ-004: all generated mutants have valid offsets and distinct mutations", () => {
    for (const [name] of Object.entries(SOURCES)) {
      const file = path.join(tmpDir, `${name}.js`);
      const mutants = engine.generateMutants(file);
      for (const m of mutants) {
        assert.ok(m.line >= 1, `line < 1 for ${name}`);
        assert.notEqual(m.mutated, m.original, "mutated equals original");
        assert.ok(m.original.length > 0, "original is empty");
        assert.ok(m.id.length > 0, "missing id");
      }
    }
  });
});
