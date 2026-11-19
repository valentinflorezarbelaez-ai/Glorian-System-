/**
 * @file cliReverseEngineeringEngine.mjs
 * @description CLI handler for SPEC-327 / CHANGE-189: Universal Reverse Engineering
 * Anything (REA) Engine (Format Detection, ASAR Unpacking, Shannon Entropy, and CFG).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosReverseEngineeringCore } from "../../src/core/eosReverseEngineeringEngine.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("REVERSE_ENGINEERING_RECEIPT.json", root);
}

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_rea_detect(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const targetType = parseFlagValue(args, "--target=", "wasm");

  const engine = new EosReverseEngineeringCore();
  let buffer;

  if (targetType === "wasm") {
    buffer = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
  } else if (targetType === "elf") {
    buffer = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
  } else if (targetType === "pe") {
    buffer = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
  } else {
    buffer = new TextEncoder().encode("function main() { const x = 1; exports.main = main; }");
  }

  const result = engine.detectTargetFormat(buffer);

  const payload = {
    command: "toolchain:rea:detect",
    targetType,
    result,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Reverse Engineering Format Detection ===");
    console.log(`Format       : ${result.format}`);
    console.log(`Magic        : ${result.magic}`);
    console.log(`Architecture : ${result.architecture || "N/A"}`);
  }
}

async function cmd_rea_unpack(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const engine = new EosReverseEngineeringCore();
  const testJson = JSON.stringify({
    files: {
      "app.js": { size: 24, offset: "0" },
      "manifest.json": { size: 16, offset: "24" },
    },
  });
  const jsonBytes = new TextEncoder().encode(testJson);
  const asarBuffer = new Uint8Array(16 + jsonBytes.length + 40);
  const view = new DataView(asarBuffer.buffer);
  view.setUint32(0, 4, true);
  view.setUint32(4, jsonBytes.length + 8, true);
  view.setUint32(8, jsonBytes.length + 4, true);
  view.setUint32(12, jsonBytes.length, true);
  asarBuffer.set(jsonBytes, 16);

  const result = engine.unpackAsar(asarBuffer);

  const payload = {
    command: "toolchain:rea:unpack",
    headerSize: result.headerSize,
    fileCount: result.fileCount,
    totalBytes: result.totalBytes,
    files: result.files,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Electron ASAR Virtual Unpacker ===");
    console.log(`Files Extracted : ${result.fileCount}`);
    console.log(`Total Bytes     : ${result.totalBytes}`);
    console.log(`Header Size     : ${result.headerSize} bytes`);
  }
}

async function cmd_rea_entropy(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const mode = parseFlagValue(args, "--mode=", "mixed");

  const engine = new EosReverseEngineeringCore();
  const buffer = new Uint8Array(512);

  // Section 1: Low entropy (repeated bytes)
  buffer.fill(0x20, 0, 256);
  // Section 2: High entropy (uniform distribution)
  for (let i = 256; i < 512; i++) {
    buffer[i] = i - 256;
  }

  const sections = engine.computeSectionEntropy(buffer, 256);

  const payload = {
    command: "toolchain:rea:entropy",
    mode,
    sectionsScanned: sections.length,
    sections,
    packedAnomalyDetected: sections.some((s) => s.isPacked),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Section Shannon Entropy Profiler ===");
    console.log(`Sections Scanned : ${sections.length}`);
    for (const s of sections) {
      console.log(`  Section ${s.sectionIndex}: ${s.entropy} bits/byte (${s.isPacked ? "PACKED" : "NORMAL"})`);
    }
  }
}

async function cmd_rea_cfg(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

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

  const payload = {
    command: "toolchain:rea:cfg",
    entryBlock: cfg.entryBlockId,
    blockCount: cfg.blockCount,
    edgeCount: cfg.edgeCount,
    cyclomaticComplexity: cfg.cyclomaticComplexity,
    blocks: cfg.blocks.map((b) => ({
      id: b.id,
      range: `0x${b.startAddress.toString(16)} - 0x${b.endAddress.toString(16)}`,
      instructionCount: b.instructions.length,
      terminator: b.terminatorType,
      successors: b.successors,
    })),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Control-Flow Graph (CFG) Synthesis ===");
    console.log(`Entry Block : ${cfg.entryBlockId}`);
    console.log(`Blocks      : ${cfg.blockCount}`);
    console.log(`Edges       : ${cfg.edgeCount}`);
    console.log(`Complexity  : ${cfg.cyclomaticComplexity}`);
  }
}

async function cmd_rea_audit(commandContext) {
  const args = commandContext.args || [];
  const root = commandContext.root || ROOT;
  const isJson = args.includes("--json");

  const engine = new EosReverseEngineeringCore();
  const receipt = engine.audit();
  const receiptPath = getReceiptPath(root);

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== REA Engine Invariant Audit ===");
    console.log(`Status         : ${receipt.status}`);
    console.log(`Formats Found  : ${receipt.formatsDetected.join(", ")}`);
    console.log(`ASAR Extraction: ${receipt.asarExtractionVerified}`);
    console.log(`Entropy Profile: ${receipt.entropyAnalysisVerified}`);
    console.log(`CFG Synthesis  : ${receipt.cfgSynthesisVerified}`);
    console.log(`SHA-256 Seal   : ${receipt.sha256}`);
    console.log(`Receipt Saved  : ${receiptPath}`);
  }
}

HANDLERS["toolchain:rea:detect"] = cmd_rea_detect;
HANDLERS["toolchain:rea:unpack"] = cmd_rea_unpack;
HANDLERS["toolchain:rea:entropy"] = cmd_rea_entropy;
HANDLERS["toolchain:rea:cfg"] = cmd_rea_cfg;
HANDLERS["toolchain:rea:audit"] = cmd_rea_audit;

export async function handleReverseEngineeringCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:rea command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
