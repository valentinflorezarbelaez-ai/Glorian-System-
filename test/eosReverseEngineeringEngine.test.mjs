/**
 * @file test/eosReverseEngineeringEngine.test.mjs
 * @description BDD test suite for SPEC-327 / CHANGE-189: Universal Reverse Engineering
 * Anything (REA) Engine (Format Detection, ASAR Unpacking, Shannon Entropy, and CFG).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosReverseEngineeringCore } from "../src/core/eosReverseEngineeringEngine.ts";
import { handleReverseEngineeringCommand } from "../bin/commands/cliReverseEngineeringEngine.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/REVERSE_ENGINEERING_RECEIPT.json");

describe("SPEC-327: Universal Reverse Engineering Anything (REA) Engine", () => {
  test("BDD-1737: Magic Byte Identification & Format Classification", () => {
    const engine = new EosReverseEngineeringCore();

    // 1. WebAssembly
    const wasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    const wasmRes = engine.detectTargetFormat(wasm);
    assert.equal(wasmRes.format, "WASM");
    assert.equal(wasmRes.architecture, "wasm32");

    // 2. Linux ELF 64-bit
    const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
    const elfRes = engine.detectTargetFormat(elf);
    assert.equal(elfRes.format, "ELF");
    assert.equal(elfRes.architecture, "x86_64");

    // 3. Windows PE / COFF
    const pe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const peRes = engine.detectTargetFormat(pe);
    assert.equal(peRes.format, "PE_COFF");

    // 4. JavaScript text
    const jsText = new TextEncoder().encode("function greet(name) { var msg = 'hello'; exports.msg = msg; }");
    const jsRes = engine.detectTargetFormat(jsText);
    assert.equal(jsRes.format, "JS_BUNDLE");
  });

  test("BDD-1738: Electron ASAR Unpacking & File Tree Extraction", () => {
    const engine = new EosReverseEngineeringCore();
    const testJson = JSON.stringify({
      files: {
        "main.js": { size: 30, offset: "0" },
        renderer: {
          files: {
            "index.html": { size: 45, offset: "30" },
          },
        },
      },
    });

    const jsonBytes = new TextEncoder().encode(testJson);
    const asarBuffer = new Uint8Array(16 + jsonBytes.length + 75);
    const view = new DataView(asarBuffer.buffer);
    view.setUint32(0, 4, true);
    view.setUint32(4, jsonBytes.length + 8, true);
    view.setUint32(8, jsonBytes.length + 4, true);
    view.setUint32(12, jsonBytes.length, true);
    asarBuffer.set(jsonBytes, 16);

    const result = engine.unpackAsar(asarBuffer);

    assert.equal(result.fileCount, 2);
    assert.equal(result.totalBytes, 75);
    assert.equal(result.files[0].path, "main.js");
    assert.equal(result.files[0].size, 30);
    assert.equal(result.files[1].path, "renderer/index.html");
    assert.equal(result.files[1].size, 45);
  });

  test("BDD-1739: Minified JS AST Module Discovery & Symbol Frequency Analysis", () => {
    const engine = new EosReverseEngineeringCore();
    const bundleSource = `
      var React = { createElement: function() {} };
      function __webpack_require__(id) {}
      1: function(e, t, n) { exports.render = function() { React.createElement(); }; },
      2: function(e, t, n) { exports.util = function() { return 42; }; }
    `;

    const analysis = engine.analyzeJsBundle(bundleSource);

    assert.ok(analysis.detectedFrameworks.includes("React"));
    assert.ok(analysis.detectedFrameworks.includes("Webpack"));
    assert.ok(analysis.moduleCount >= 2);
    assert.ok(analysis.identifierFrequencies["React"] >= 1);
  });

  test("BDD-1740: Section Shannon Entropy Calculation & Packed Anomaly Detection", () => {
    const engine = new EosReverseEngineeringCore();

    // Section 1: Low entropy (single byte repeated)
    const lowEntropy = new Uint8Array(256).fill(0x00);
    const s1 = engine.computeSectionEntropy(lowEntropy, 256)[0];
    assert.equal(s1.entropy, 0.0);
    assert.equal(s1.isPacked, false);

    // Section 2: High entropy (uniform 256 unique bytes -> max entropy = 8.0)
    const highEntropy = new Uint8Array(256);
    for (let i = 0; i < 256; i++) highEntropy[i] = i;
    const s2 = engine.computeSectionEntropy(highEntropy, 256)[0];
    assert.equal(s2.entropy, 8.0);
    assert.equal(s2.isPacked, true, "Uniform distribution must trigger packed anomaly threshold");
  });

  test("BDD-1741: Control-Flow Graph Basic Block DAG Construction", () => {
    const engine = new EosReverseEngineeringCore();
    const instructions = [
      { address: 0x1000, mnemonic: "MOV", operands: "EAX, 1" },
      { address: 0x1005, mnemonic: "CMP", operands: "EAX, 0" },
      { address: 0x100a, mnemonic: "JZ", operands: "0x1020" },
      { address: 0x100f, mnemonic: "ADD", operands: "EBX, 2" },
      { address: 0x1014, mnemonic: "JMP", operands: "0x1025" },
      { address: 0x1020, mnemonic: "SUB", operands: "EBX, 1" },
      { address: 0x1025, mnemonic: "RET", operands: "" },
    ];

    const cfg = engine.recoverControlFlowGraph(instructions);

    assert.equal(cfg.blockCount, 4);
    assert.ok(cfg.edgeCount >= 4);
    assert.ok(cfg.cyclomaticComplexity >= 2);
    assert.equal(cfg.blocks[0].terminatorType, "BRANCH");
    assert.equal(cfg.blocks[3].terminatorType, "RETURN");
  });

  test("BDD-1742: CLI Toolchain Parity & Invariant Audit Receipt", async () => {
    const commands = [
      "toolchain:rea:detect",
      "toolchain:rea:unpack",
      "toolchain:rea:entropy",
      "toolchain:rea:cfg",
      "toolchain:rea:audit",
    ];

    for (const cmd of commands) {
      const ok = await handleReverseEngineeringCommand({
        command: cmd,
        args: ["--json"],
      });
      assert.equal(ok, true, `Command ${cmd} must succeed and return true`);
    }

    assert.ok(fs.existsSync(RECEIPT_PATH), "Receipt file must exist");
    const raw = fs.readFileSync(RECEIPT_PATH, "utf8");
    const receipt = JSON.parse(raw);

    assert.equal(receipt.status, "VERIFIED");
    assert.equal(receipt.asarExtractionVerified, true);
    assert.equal(receipt.entropyAnalysisVerified, true);
    assert.equal(receipt.cfgSynthesisVerified, true);
    assert.equal(receipt.zeroHostContamination, true);
    assert.ok(receipt.sha256 && receipt.sha256.length === 64, "SHA-256 seal must be valid");
  });
});
