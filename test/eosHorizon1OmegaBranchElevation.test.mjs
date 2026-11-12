/**
 * EOS SYSTEM — HORIZON 1 OMEGA BRANCH COVERAGE ELEVATION TEST SUITE
 * Governed by Law I, Law II, Law III, Law V (Tier S-1 Omega Perfection)
 *
 * Exercises deep boundary conditions, error paths, and edge branches across:
 * - eosRaftConsensusEngine.types.ts (defaultFsmReducer, computeFsmHash, computeLogEntryHash)
 * - api/metrics.js (Express-style vs pure Node.js http.ServerResponse, GET/HEAD vs 405)
 * - eosGeneticAstSynthesizer.ts (parseAst, printAst, mutateAst, AST operators, walkAndMutate)
 * - eosWasmBytecodeDecompilerProver.ts (parseModule preconditions, export kinds, CFI, memory bounds)
 * - EosAstral.ts (Silver Cord integrity, dissolution, invalid commits, constructor defaults)
 * - eosHermeticSeaCompiler.ts (sea-config options, binary signature rejection on missing/tampered files)
 * - eosBigTechProductFactory.ts (IAM policy loading, least-privilege checks, null delivery receipt)
 *
 * Strictly ZERO external runtime dependencies. Node 24 native test runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { defaultFsmReducer, computeLogEntryHash, computeFsmHash } from "../src/core/eosRaftConsensusEngine.types.ts";

import metricsHandler from "../api/metrics.js";

import { EosGeneticAstSynthesizer } from "../src/core/eosGeneticAstSynthesizer.ts";

import { EosWasmBytecodeDecompilerProver } from "../src/core/eosWasmBytecodeDecompilerProver.ts";

import { EosAstral } from "../src/core/EosAstral.ts";

import { EosHermeticSeaCompiler } from "../src/core/eosHermeticSeaCompiler.ts";

import {
  loadDefaultIamPolicyPack,
  isLeastPrivilegeProductPolicyPack,
  writeBigTechFactoryReceipt,
} from "../src/core/eosBigTechProductFactory.ts";

import { EosDynamicFuzzingOracle } from "../src/core/eosDynamicFuzzingOracle.ts";

import { EosUniversalAgentSessionContract } from "../src/core/eosUniversalAgentSessionContract.ts";

import { EosGoDaemonIpc } from "../src/core/eosGoDaemonIpc.ts";

import { EosSpotifyCodex } from "../src/core/eosSpotifyCodex.ts";

import { EosSpotifyAgenticFactory } from "../src/core/eosSpotifyAgenticFactory.ts";

describe("Horizon 1 Omega: Deep Branch Coverage Elevation Suite", () => {
  describe("Subsuite 1: eosRaftConsensusEngine.types pure reducers and hashers", () => {
    it("defaultFsmReducer handles SET, DELETE, APPEND, and boundary commands", () => {
      const initial = { foo: "bar", list: [1, 2] };

      // SET command
      const s1 = defaultFsmReducer(initial, { type: "SET", key: "foo", value: "baz" });
      assert.equal(s1.foo, "baz");

      // DELETE command
      const s2 = defaultFsmReducer(initial, { type: "DELETE", key: "foo" });
      assert.equal(s2.foo, undefined);
      assert.equal("foo" in s2, false);

      // APPEND command when array exists
      const s3 = defaultFsmReducer(initial, { type: "APPEND", key: "list", value: 3 });
      assert.deepEqual(s3.list, [1, 2, 3]);

      // APPEND command when key is not an array (noop)
      const s4 = defaultFsmReducer(initial, { type: "APPEND", key: "foo", value: "ignored" });
      assert.deepEqual(s4, initial);

      // Non-object or null command (noop)
      assert.deepEqual(defaultFsmReducer(initial, null), initial);
      assert.deepEqual(defaultFsmReducer(initial, "invalid"), initial);
      assert.deepEqual(defaultFsmReducer(initial, 12345), initial);
      assert.deepEqual(defaultFsmReducer(initial, undefined), initial);
      assert.deepEqual(defaultFsmReducer(initial, true), initial);

      // Unknown command type (noop)
      assert.deepEqual(defaultFsmReducer(initial, { type: "UNKNOWN", key: "foo" }), initial);

      // Object without key string (noop)
      assert.deepEqual(defaultFsmReducer(initial, { type: "SET", key: 123 }), initial);
      assert.deepEqual(defaultFsmReducer(initial, { type: "DELETE" }), initial);
    });

    it("computeLogEntryHash and computeFsmHash produce deterministic hashes", () => {
      const hash1 = computeLogEntryHash(1, 10, { type: "SET", key: "a", value: 1 });
      const hash2 = computeLogEntryHash(1, 10, { type: "SET", key: "a", value: 1 });
      assert.equal(hash1, hash2);
      assert.equal(hash1.length, 64);

      // Test key sorting in computeFsmHash
      const stateA = { z: 26, a: 1, m: 13 };
      const stateB = { a: 1, m: 13, z: 26 };
      assert.equal(computeFsmHash(stateA), computeFsmHash(stateB));
      assert.equal(computeFsmHash(stateA).length, 64);
    });
  });

  describe("Subsuite 2: api/metrics dual HTTP server response ergonomics", () => {
    it("handles HEAD requests and responses without res.send (falling through to res.end)", async () => {
      let statusCode = 0;
      let endedBody = "";
      const headers = {};

      const req = { method: "HEAD", url: "/api/metrics" };
      const res = {
        setHeader(k, v) {
          headers[k.toLowerCase()] = v;
        },
        status(code) {
          statusCode = code;
          return this;
        },
        end(body) {
          endedBody = body;
          return this;
        },
      };

      await metricsHandler(req, res);
      assert.equal(statusCode, 200);
      assert.ok(headers["content-type"].includes("text/plain"));
      assert.ok(endedBody.includes("glorian_requests_total"));
    });

    it("handles plain Node.js http.ServerResponse (without res.status function)", async () => {
      let endedBody = "";
      const headers = {};

      const req = { method: "GET", url: "/api/metrics" };
      const res = {
        statusCode: 0,
        setHeader(k, v) {
          headers[k.toLowerCase()] = v;
        },
        end(body) {
          endedBody = body;
          return this;
        },
      };

      await metricsHandler(req, res);
      assert.equal(res.statusCode, 200);
      assert.ok(endedBody.includes("glorian_requests_total"));
    });

    it("handles 405 Method Not Allowed on plain Node.js http.ServerResponse (without res.status)", async () => {
      let endedBody = "";
      const headers = {};

      const req = { method: "DELETE", url: "/api/metrics" };
      const res = {
        statusCode: 0,
        setHeader(k, v) {
          headers[k.toLowerCase()] = v;
        },
        end(body) {
          endedBody = body;
          return this;
        },
      };

      await metricsHandler(req, res);
      assert.equal(res.statusCode, 405);
      assert.equal(headers["content-type"], "application/json");
      assert.ok(endedBody.includes("Method Not Allowed"));
    });

    it("handles requests without method property", async () => {
      let statusCode = 0;
      let bodyText = "";

      const req = { url: "/api/metrics" };
      const res = {
        setHeader() {},
        status(c) {
          statusCode = c;
          return this;
        },
        send(b) {
          bodyText = b;
          return this;
        },
        end() {},
      };

      await metricsHandler(req, res);
      assert.equal(statusCode, 200);
      assert.ok(bodyText.includes("glorian_requests_total"));
    });
  });

  describe("Subsuite 3: eosGeneticAstSynthesizer AST parsing, printing, and mutation", () => {
    it("parseAst parses IfStatement with and without alternate blocks", () => {
      // If without else
      const ifAst = EosGeneticAstSynthesizer.parseAst("if (x > 0) { return 1; }");
      assert.equal(ifAst.type, "IfStatement");
      assert.equal(ifAst.test?.type, "BinaryExpression");
      assert.equal(ifAst.consequent?.type, "BlockStatement");
      assert.equal(ifAst.alternate, undefined);

      // If with else
      const ifElseAst = EosGeneticAstSynthesizer.parseAst("if (x > 0) { return 1; } else { return 0; }");
      assert.equal(ifElseAst.type, "IfStatement");
      assert.equal(ifElseAst.alternate?.type, "BlockStatement");

      // Literals
      const trueAst = EosGeneticAstSynthesizer.parseAst("true");
      assert.deepEqual(trueAst, { type: "Literal", value: true });

      const falseAst = EosGeneticAstSynthesizer.parseAst("false");
      assert.deepEqual(falseAst, { type: "Literal", value: false });

      const nullAst = EosGeneticAstSynthesizer.parseAst("null");
      assert.deepEqual(nullAst, { type: "Literal", value: null });

      const strAst = EosGeneticAstSynthesizer.parseAst('"hello world"');
      assert.deepEqual(strAst, { type: "Literal", value: "hello world" });

      const numAst = EosGeneticAstSynthesizer.parseAst("-42.5");
      assert.deepEqual(numAst, { type: "Literal", value: -42.5 });
    });

    it("printAst handles Program, BlockStatement, IfStatement, Unary, and null cases", () => {
      assert.equal(EosGeneticAstSynthesizer.printAst(null), "");

      const blockNode = {
        type: "BlockStatement",
        body: [{ type: "ReturnStatement", argument: { type: "Literal", value: 42 } }],
      };
      const blockPrinted = EosGeneticAstSynthesizer.printAst(blockNode);
      assert.ok(blockPrinted.includes("return 42;"));

      const programNode = {
        type: "Program",
        body: [blockNode],
      };
      const progPrinted = EosGeneticAstSynthesizer.printAst(programNode);
      assert.ok(progPrinted.includes("return 42;"));

      const unaryNode = {
        type: "UnaryExpression",
        operator: "!",
        argument: { type: "Identifier", name: "valid" },
      };
      assert.equal(EosGeneticAstSynthesizer.printAst(unaryNode), "!valid");

      const idWithoutName = { type: "Identifier" };
      assert.equal(EosGeneticAstSynthesizer.printAst(idWithoutName), "x");

      const unknownNode = { type: "CustomUnknown" };
      assert.equal(EosGeneticAstSynthesizer.printAst(unknownNode), "");
    });

    it("mutateAst exercises GUARD_NULL_CHECK, MUTATE_CONSTANT, and edge operators", () => {
      // GUARD_NULL_CHECK
      const retAst = EosGeneticAstSynthesizer.parseAst("return a + b;");
      const guarded = EosGeneticAstSynthesizer.mutateAst(retAst, "GUARD_NULL_CHECK");
      assert.equal(guarded.type, "IfStatement");
      const printedGuard = EosGeneticAstSynthesizer.printAst(guarded);
      assert.ok(printedGuard.includes("if (input !== null)"));

      // MUTATE_CONSTANT on numbers (0 -> 1, 1 -> 0, 5 -> 10)
      const numZero = EosGeneticAstSynthesizer.parseAst("x + 0");
      const mutZero = EosGeneticAstSynthesizer.mutateAst(numZero, "MUTATE_CONSTANT");
      assert.equal(EosGeneticAstSynthesizer.printAst(mutZero), "x + 1");

      const numOne = EosGeneticAstSynthesizer.parseAst("x + 1");
      const mutOne = EosGeneticAstSynthesizer.mutateAst(numOne, "MUTATE_CONSTANT");
      assert.equal(EosGeneticAstSynthesizer.printAst(mutOne), "x + 0");

      const numTen = EosGeneticAstSynthesizer.parseAst("x + 5");
      const mutTen = EosGeneticAstSynthesizer.mutateAst(numTen, "MUTATE_CONSTANT");
      assert.equal(EosGeneticAstSynthesizer.printAst(mutTen), "x + 10");

      // MUTATE_CONSTANT on booleans
      const boolTrue = EosGeneticAstSynthesizer.parseAst("x === true");
      const mutBool = EosGeneticAstSynthesizer.mutateAst(boolTrue, "MUTATE_CONSTANT");
      assert.equal(EosGeneticAstSynthesizer.printAst(mutBool), "x === false");

      // OFF_BY_ONE_REPAIR on >, >=, <=
      const gtAst = EosGeneticAstSynthesizer.parseAst("a > 10");
      assert.equal(
        EosGeneticAstSynthesizer.printAst(EosGeneticAstSynthesizer.mutateAst(gtAst, "OFF_BY_ONE_REPAIR")),
        "a >= 10",
      );

      const gteAst = EosGeneticAstSynthesizer.parseAst("a >= 10");
      assert.equal(
        EosGeneticAstSynthesizer.printAst(EosGeneticAstSynthesizer.mutateAst(gteAst, "OFF_BY_ONE_REPAIR")),
        "a > 10",
      );

      const lteAst = EosGeneticAstSynthesizer.parseAst("a <= 10");
      assert.equal(
        EosGeneticAstSynthesizer.printAst(EosGeneticAstSynthesizer.mutateAst(lteAst, "OFF_BY_ONE_REPAIR")),
        "a < 10",
      );

      // INVERT_CONDITION on >, <, >=, <=, !==
      const neqAst = EosGeneticAstSynthesizer.parseAst("a !== b");
      assert.equal(
        EosGeneticAstSynthesizer.printAst(EosGeneticAstSynthesizer.mutateAst(neqAst, "INVERT_CONDITION")),
        "a === b",
      );

      const ltAst = EosGeneticAstSynthesizer.parseAst("a < b");
      assert.equal(
        EosGeneticAstSynthesizer.printAst(EosGeneticAstSynthesizer.mutateAst(ltAst, "INVERT_CONDITION")),
        "a >= b",
      );

      const invGte = EosGeneticAstSynthesizer.parseAst("a >= b");
      assert.equal(
        EosGeneticAstSynthesizer.printAst(EosGeneticAstSynthesizer.mutateAst(invGte, "INVERT_CONDITION")),
        "a < b",
      );

      const invGt = EosGeneticAstSynthesizer.parseAst("a > b");
      assert.equal(
        EosGeneticAstSynthesizer.printAst(EosGeneticAstSynthesizer.mutateAst(invGt, "INVERT_CONDITION")),
        "a <= b",
      );

      const invLte = EosGeneticAstSynthesizer.parseAst("a <= b");
      assert.equal(
        EosGeneticAstSynthesizer.printAst(EosGeneticAstSynthesizer.mutateAst(invLte, "INVERT_CONDITION")),
        "a > b",
      );

      // REPLACE_OPERATOR on -, *, &&, ||
      const minusAst = EosGeneticAstSynthesizer.parseAst("a - b");
      assert.equal(
        EosGeneticAstSynthesizer.printAst(EosGeneticAstSynthesizer.mutateAst(minusAst, "REPLACE_OPERATOR")),
        "a + b",
      );

      const mulAst = EosGeneticAstSynthesizer.parseAst("a * b");
      assert.equal(
        EosGeneticAstSynthesizer.printAst(EosGeneticAstSynthesizer.mutateAst(mulAst, "REPLACE_OPERATOR")),
        "a / b",
      );

      const andAst = EosGeneticAstSynthesizer.parseAst("a && b");
      assert.equal(
        EosGeneticAstSynthesizer.printAst(EosGeneticAstSynthesizer.mutateAst(andAst, "REPLACE_OPERATOR")),
        "a || b",
      );

      const orAst = EosGeneticAstSynthesizer.parseAst("a || b");
      assert.equal(
        EosGeneticAstSynthesizer.printAst(EosGeneticAstSynthesizer.mutateAst(orAst, "REPLACE_OPERATOR")),
        "a && b",
      );
    });
  });

  describe("Subsuite 4: eosWasmBytecodeDecompilerProver preconditions, exports, CFI", () => {
    it("rejects invalid WASM binaries with strict preconditions", () => {
      // Too short (< 8 bytes)
      assert.throws(
        () => EosWasmBytecodeDecompilerProver.parseModule(new Uint8Array([0x00, 0x61, 0x73])),
        /WASM module too short/,
      );

      // Bad magic byte
      assert.throws(
        () => EosWasmBytecodeDecompilerProver.parseModule(new Uint8Array([0x00, 0x00, 0x00, 0x00, 1, 0, 0, 0])),
        /Invalid WASM magic byte at index 1/,
      );

      // Unsupported version
      assert.throws(
        () => EosWasmBytecodeDecompilerProver.parseModule(new Uint8Array([0x00, 0x61, 0x73, 0x6d, 2, 0, 0, 0])),
        /Unsupported WASM version 2/,
      );
    });

    it("proves control-flow integrity failure when branch target exceeds block nesting", () => {
      // Disassemble br instruction targeting depth 5 when nesting is 0
      const brInstr = EosWasmBytecodeDecompilerProver.disassembleFunction(new Uint8Array([0x0c, 0x05, 0x0b]));
      assert.equal(brInstr[0].mnemonic, "br");
      assert.equal(brInstr[0].operands[0], 5);

      const mockModule = {
        version: 1,
        types: [{ params: [], results: [] }],
        functions: [
          {
            index: 0,
            typeIndex: 0,
            exportName: "bad_br",
            signature: { params: [], results: [] },
            locals: [],
            instructions: brInstr,
          },
        ],
        exports: { bad_br: { kind: "func", index: 0 } },
        rawByteLength: 3,
        sha256Checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      };

      const proof = EosWasmBytecodeDecompilerProver.proveModuleSafety(mockModule);
      assert.equal(proof.controlFlowSafe, false);
      assert.equal(proof.verified, false);
      assert.ok(proof.issues.some((iss) => iss.includes("Illegal branch target depth 5")));
    });

    it("disassembles control flow, variables, and memory opcodes cleanly", () => {
      // [0x01 (nop), 0x02, 0x40 (block void), 0x03, 0x40 (loop void), 0x04, 0x40 (if void), 0x05 (else), 0x0b (end), 0x1a (drop), 0x21, 0x00 (local.set 0), 0x22, 0x01 (local.tee 1), 0x0f (return)]
      const bytecodes = new Uint8Array([
        0x01, 0x02, 0x40, 0x03, 0x40, 0x04, 0x40, 0x05, 0x0b, 0x1a, 0x21, 0x00, 0x22, 0x01, 0x0f,
      ]);
      const instrs = EosWasmBytecodeDecompilerProver.disassembleFunction(bytecodes);
      const mnemonics = instrs.map((i) => i.mnemonic);
      assert.ok(mnemonics.includes("nop"));
      assert.ok(mnemonics.includes("block"));
      assert.ok(mnemonics.includes("loop"));
      assert.ok(mnemonics.includes("if"));
      assert.ok(mnemonics.includes("else"));
      assert.ok(mnemonics.includes("drop"));
      assert.ok(mnemonics.includes("local.set"));
      assert.ok(mnemonics.includes("local.tee"));
      assert.ok(mnemonics.includes("return"));
    });
  });

  describe("Subsuite 5: EosAstral Silver Cord verification and error branches", () => {
    it("handles inactive, tampered, and missing threads deterministically", () => {
      const astral = new EosAstral();
      assert.equal(astral.getActiveThreadsCount(), 0);

      // Verify null or inactive thread
      assert.equal(astral.verifySilverCord(null), false);
      assert.equal(
        astral.verifySilverCord({
          threadId: "ASTRAL-fake",
          parentPath: process.cwd(),
          projectionPath: process.cwd(),
          createdAtIso: new Date().toISOString(),
          silverCordToken: "abc",
          active: false,
        }),
        false,
      );

      // Dissolve nonexistent thread
      const dissNonExistent = astral.dissolveAstralThread("ASTRAL-nonexistent");
      assert.equal(dissNonExistent.dissolved, false);
      assert.equal(dissNonExistent.rollbackVerified, false);

      // Project thread and dissolve it
      const thread = astral.projectAstralThread(".worktrees/temp-dissolve");
      assert.equal(astral.getActiveThreadsCount(), 1);
      const dissValid = astral.dissolveAstralThread(thread.threadId);
      assert.equal(dissValid.dissolved, true);
      assert.equal(dissValid.rollbackVerified, true);
      assert.equal(astral.getActiveThreadsCount(), 0);

      // Commit on nonexistent thread
      assert.throws(
        () => astral.commitAstralMutation("ASTRAL-nonexistent", "dummy-diff-hash"),
        /not found or already dissolved/,
      );

      // Commit on tampered thread
      const thread2 = astral.projectAstralThread(".worktrees/temp-tampered");
      const badToken = crypto.randomBytes(32).toString("hex");
      astral.activeThreads.set(thread2.threadId, { ...thread2, silverCordToken: badToken });
      assert.throws(
        () => astral.commitAstralMutation(thread2.threadId, "diff-hash"),
        /VIOLATION: Silver Cord severed or tampered/,
      );
    });
  });

  describe("Subsuite 6: eosHermeticSeaCompiler config options and signature rejection", () => {
    it("generates hermetic config with disableWarning: false", () => {
      const testDist = path.resolve(process.cwd(), "dist/test-sea-opts");
      const { config } = EosHermeticSeaCompiler.generateHermeticSeaConfig({
        outputDir: testDist,
        disableWarning: false,
      });
      assert.equal(config.disableExperimentalSEAWarning, false);
    });

    it("verifyBinarySignature rejects nonexistent binary or invalid signature", () => {
      const nonexistent = path.resolve(process.cwd(), "dist/does-not-exist.bin");
      assert.equal(EosHermeticSeaCompiler.verifyBinarySignature(nonexistent, "deadbeef", "dummy-pem"), false);

      // Existing file with invalid signature format
      const dummyPath = path.resolve(process.cwd(), "dist/test-sea-opts/dummy.bin");
      fs.mkdirSync(path.dirname(dummyPath), { recursive: true });
      fs.writeFileSync(dummyPath, "DUMMY");
      assert.equal(EosHermeticSeaCompiler.verifyBinarySignature(dummyPath, "invalid-sig-hex", "dummy-pem"), false);
    });
  });

  describe("Subsuite 7: eosBigTechProductFactory policy checks and receipt generation", () => {
    it("handles missing policy packs and evaluates least privilege rules", () => {
      // Nonexistent directory returns empty array
      const emptyPack = loadDefaultIamPolicyPack(path.resolve(process.cwd(), "nonexistent-dir"));
      assert.deepEqual(emptyPack, []);

      // Empty policies fail least privilege
      assert.equal(isLeastPrivilegeProductPolicyPack([]), false);

      // Broad prefix fails least privilege
      assert.equal(
        isLeastPrivilegeProductPolicyPack([
          { id: "p1", tenantId: "t1", roles: ["admin"], actions: ["*"], resourcePrefix: "mcp/tools/" },
        ]),
        false,
      );

      // Missing fine prefixes fails least privilege
      assert.equal(
        isLeastPrivilegeProductPolicyPack([
          {
            id: "p1",
            tenantId: "t1",
            roles: ["admin"],
            actions: ["*"],
            resourcePrefix: "mcp/tools/eos_manage_worktree",
          },
        ]),
        false,
      );
    });

    it("writeBigTechFactoryReceipt generates receipt with null delivery and denied IAM", () => {
      const mockResult = {
        status: "BLOCKED",
        reason: "IAM_DENIED",
        dryRun: true,
        iam: {
          required: true,
          allowed: false,
          decision: {
            allowed: false,
            code: "RULE_DENIED",
            sha256Receipt: "abc123receipt",
          },
          sha256Receipt: "abc123receipt",
        },
        delivery: null,
        productId: "demo-product",
        epistemicState: "BLOCKED",
        sha256Receipt: "final-sha256-receipt",
        durationMs: 12.34,
      };

      const outPath = writeBigTechFactoryReceipt(process.cwd(), mockResult, "dist/test-factory-receipt.json");
      assert.ok(fs.existsSync(outPath));
      const parsed = JSON.parse(fs.readFileSync(outPath, "utf8"));
      assert.equal(parsed.status, "BLOCKED");
      assert.equal(parsed.iamCode, "RULE_DENIED");
      assert.equal(parsed.deliveryStatus, null);
      assert.equal(parsed.scorecardScore, null);
    });
  });

  describe("Subsuite 8: EosDynamicFuzzingOracle corpus, errors, and representation branches", () => {
    it("handles non-Error exceptions, stopOnFirstCrash, and complex representations", () => {
      // Preconditions
      assert.throws(() => EosDynamicFuzzingOracle.runCampaign(null, "target"), /must be a function/);
      assert.throws(() => EosDynamicFuzzingOracle.runCampaign(() => {}, ""), /non-empty string/);

      // Target throwing non-Error primitive
      let runs = 0;
      const resultStrErr = EosDynamicFuzzingOracle.runCampaign(
        () => {
          runs++;
          throw "STRING_BASED_EXCEPTION";
        },
        "target_string_err",
        { iterations: 5, stopOnFirstCrash: true },
      );

      assert.equal(resultStrErr.crashCount, 1);
      assert.equal(runs, 1);
      assert.equal(resultStrErr.crashes[0].errorMessage, "STRING_BASED_EXCEPTION");

      // Compiles all corpuses
      const numCorpus = EosDynamicFuzzingOracle.compileCorpus("NUMERIC");
      assert.ok(numCorpus.length > 0);
      const strCorpus = EosDynamicFuzzingOracle.compileCorpus("STRING_UNICODE");
      assert.ok(strCorpus.length > 0);
      const objCorpus = EosDynamicFuzzingOracle.compileCorpus("STRUCTURAL_OBJECT");
      assert.ok(objCorpus.length > 0);
    });
  });

  describe("Subsuite 9: EosUniversalAgentSessionContract boundaries and formatting", () => {
    it("validates constructor TTL bounds and unsupported IDE families", () => {
      // TTL out of bounds
      assert.throws(() => new EosUniversalAgentSessionContract(process.cwd(), 500), /ttlMs out of bounds/);
      assert.throws(() => new EosUniversalAgentSessionContract(process.cwd(), 100_000_000), /ttlMs out of bounds/);

      const contract = new EosUniversalAgentSessionContract(process.cwd());

      // Unsupported IDE family
      assert.throws(
        () => contract.openSession({ ideFamily: "eclipse", directive: "test" }),
        /Unsupported ideFamily: eclipse/,
      );

      // Non-preferred IDE family in ensurePreferredIdeSession
      assert.throws(
        () => contract.ensurePreferredIdeSession({ ideFamily: "vscode" }),
        /ensurePreferredIdeSession requires cursor or antigravity/,
      );

      // getActiveSessionForIde with invalid IDE
      assert.equal(contract.getActiveSessionForIde("unknown-ide"), null);
    });
  });

  describe("Subsuite 10: EosGoDaemonIpc lifecycle, dispatches, fallback, and stats", () => {
    it("exercises fallback routing, benchmark, ping, status, and stats telemetry", async () => {
      // Use dummy project root where Go binary is absent to exercise pure L0 fallback
      const dummyRoot = path.join(process.cwd(), "data", "test-ipc-sandbox");
      const ipc = new EosGoDaemonIpc(dummyRoot, 250);

      assert.equal(ipc.isBinaryAvailable(), false);
      const initialStats = ipc.getStats();
      assert.equal(initialStats.running, false);
      assert.equal(initialStats.pid, null);
      assert.equal(initialStats.totalDispatches, 0);
      assert.equal(initialStats.averageLatencyUs, 0);
      assert.equal(initialStats.fallbackCount, 0);
      assert.equal(initialStats.binaryExists, false);

      // Ping dispatch
      const pingRes = await ipc.dispatch("ping");
      assert.equal(pingRes.status, "PASS");
      assert.equal(pingRes.nativeGo, false);
      assert.equal(pingRes.data.pong, true);

      // Benchmark dispatch
      const benchRes = await ipc.dispatch("benchmark");
      assert.equal(benchRes.status, "PASS");
      assert.equal(benchRes.data.status, "PASS");
      assert.equal(benchRes.data.throughputMbSec, 18500);

      // Route dispatch with explicit task
      const routeExplicit = await ipc.dispatch("route", { task: "dsp-frequency-synthesis" });
      assert.equal(routeExplicit.status, "PASS");
      assert.equal(routeExplicit.data.task, "dsp-frequency-synthesis");
      assert.equal(routeExplicit.data.selectedModel, "claude-3-7-sonnet");

      // Route dispatch with default fallback task
      const routeDefault = await ipc.dispatch("route", {});
      assert.equal(routeDefault.status, "PASS");
      assert.equal(routeDefault.data.task, "core-architecture");

      // Status dispatch (default action branch)
      const statusRes = await ipc.dispatch("status");
      assert.equal(statusRes.status, "PASS");
      assert.equal(statusRes.data.tier, "BIG_TECH_TIER_0");
      assert.equal(statusRes.data.status, "ONLINE");

      // Stats inspection
      const postStats = ipc.getStats();
      assert.equal(postStats.totalDispatches, 5);
      assert.ok(postStats.averageLatencyUs >= 0);
      assert.equal(postStats.fallbackCount, 5);

      // Terminate cleanly
      ipc.terminate();
      const termStats = ipc.getStats();
      assert.equal(termStats.running, false);
    });
  });

  describe("Subsuite 11: EosSpotifyCodex and EosSpotifyAgenticFactory audio & factory branches", () => {
    it("exercises loudness codecs, zero-vector similarity, harmonic transitions, and backoff", () => {
      const codex = new EosSpotifyCodex(process.cwd());

      // computeLoudnessProfile: loud with limiter required -> OGG_VORBIS_320
      const loudLimiter = codex.computeLoudnessProfile(-10.0, 5.0);
      assert.equal(loudLimiter.limiterRequired, true);
      assert.equal(loudLimiter.recommendedCodec, "OGG_VORBIS_320");

      // computeLoudnessProfile: quiet audio -> FLAC_LOSSLESS
      const quiet = codex.computeLoudnessProfile(-18.0, -5.0);
      assert.equal(quiet.recommendedCodec, "FLAC_LOSSLESS");

      // calculateCosineSimilarity: zero vectors (normA === 0 || normB === 0)
      const zeroVec = {
        tempo: 50,
        energy: 0,
        danceability: 0,
        valence: 0,
        acousticness: 0,
        instrumentalness: 0,
        liveness: 0,
        speechiness: 0,
      };
      assert.equal(codex.calculateCosineSimilarity(zeroVec, zeroVec), 0);

      // evaluateHarmonicTransition: perfect match
      const perfectMatch = codex.evaluateHarmonicTransition(0, 1, 0, 1);
      assert.equal(perfectMatch.compatible, true);
      assert.equal(perfectMatch.harmonicRelationship, "PERFECT_MATCH");

      // evaluateHarmonicTransition: energy boost (8B to 9B)
      const boostTransition = codex.evaluateHarmonicTransition(0, 1, 7, 1);
      assert.equal(boostTransition.compatible, true);
      assert.equal(boostTransition.harmonicRelationship, "ENERGY_BOOST");

      // evaluateHarmonicTransition: energy drop (8B to 7B)
      const dropTransition = codex.evaluateHarmonicTransition(0, 1, 5, 1);
      assert.equal(dropTransition.compatible, true);
      assert.equal(dropTransition.harmonicRelationship, "ENERGY_DROP");

      // evaluateHarmonicTransition: mode shift (same key number, different mode letter)
      const modeShift = codex.evaluateHarmonicTransition(0, 1, 9, 0);
      assert.equal(modeShift.compatible, true);
      assert.equal(modeShift.harmonicRelationship, "MODE_SHIFT");

      // evaluateHarmonicTransition: dissonant (different key number and letter)
      const dissonant = codex.evaluateHarmonicTransition(0, 1, 2, 0);
      assert.equal(dissonant.compatible, false);
      assert.equal(dissonant.harmonicRelationship, "DISSONANT");

      // calculateBackoffMs: with retryAfterHeaderSec
      const retryMs = codex.calculateBackoffMs(1, 200, 8000, 3);
      assert.equal(retryMs, 3000);

      // calculateBackoffMs: default jittered exponential
      const jitterMs = codex.calculateBackoffMs(2, 100, 1000);
      assert.ok(jitterMs >= 0 && jitterMs <= 1000);

      // auditUniversalProject on non-existent directory
      const nonExistentAudit = codex.auditUniversalProject("data/nonexistent-audit-dir");
      assert.equal(nonExistentAudit.catalogInfoExists, false);
      assert.equal(nonExistentAudit.catalogInfoMarkersPresent, false);
      assert.ok(nonExistentAudit.localInventoryScore >= 0);
    });

    it("exercises EosSpotifyAgenticFactory dispatchHonk and progressive canary", () => {
      const factory = new EosSpotifyAgenticFactory(process.cwd());

      // dispatchHonk across supported stacks
      for (const stack of ["rust", "go", "node", "java"]) {
        const report = factory.dispatchHonk({
          taskName: `test-honk-${stack}`,
          stack,
          specDescription: `Test spec for ${stack}`,
        });
        assert.ok(report.taskId);
        assert.equal(report.status, "PLAN_ONLY");
        assert.equal(report.steps.length > 0, true);
        assert.ok(report.pullRequestDraft.includes("Draft pull request"));
      }

      // generateProgressiveCanary
      const canary = factory.generateProgressiveCanary("eos-test-canary", "audio-infra", 150, 0.05);
      assert.equal(canary.serviceName, "eos-test-canary");
      assert.equal(canary.squad, "audio-infra");
      assert.equal(canary.p99LatencyMs, 150);
      assert.ok(canary.flaggerCanaryYaml.includes("eos-test-canary-canary"));
      assert.ok(canary.argoRolloutYaml.includes("eos-test-canary-rollout"));
      assert.ok(canary.prometheusRuleYaml.includes("ServiceP99LatencyBreach"));
    });
  });
});
