/**
 * CLI Speculative Multi-Token Draft Verification & Paged KV-Cache Handlers
 *
 * Implements toolchain:speculative:* subcommands for virtual memory page table mapping,
 * fixed-size physical block allocation, speculative candidate multi-token draft projection,
 * and parallel target verification with token acceptance telemetry.
 *
 * Conforms to SPEC-317 / CHANGE-179.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosSpeculativePagedKvCacheCore } from "../../src/core/eosSpeculativePagedKvCache.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const EVIDENCE_DIR = path.join(ROOT, "docs/evidence");
const DEFAULT_RECEIPT_PATH = path.join(EVIDENCE_DIR, "SPECULATIVE_PAGED_KV_CACHE_RECEIPT.json");

const HANDLERS = {};

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

async function cmd_speculative_pagetable(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const seqId = args.find((a) => !a.startsWith("--")) || "seq-eval-001";
  const initialTokensCount = Number(parseFlagValue(args, "--tokens=", "28"));

  const engine = new EosSpeculativePagedKvCacheCore({ totalBlocks: 32, blockSizeTokens: 16 });
  const initialTokens = Array.from({ length: initialTokensCount }, (_, i) => 100 + i);
  engine.allocateSequence(seqId, initialTokens);

  const seq = engine.getSequence(seqId);
  const pageTable = engine.getPageTable(seqId) || [];
  const audit = engine.getAuditReport();

  const payload = {
    status: "PAGETABLE_ACTIVE",
    sequenceId: seqId,
    tokenCount: seq ? seq.tokens.length : 0,
    allocatedPhysicalBlocks: pageTable.length,
    pageTableMapping: pageTable.map((blockId, pageIdx) => ({
      logicalPage: pageIdx,
      physicalBlockId: blockId,
      tokenRange: `[${pageIdx * 16}..${Math.min((pageIdx + 1) * 16 - 1, seq ? seq.tokens.length - 1 : 0)}]`,
    })),
    totalCapacityTokens: seq ? seq.totalCapacityTokens : 0,
    externalFragmentationRatio: audit.externalFragmentationRatio,
    freeBlocksRemaining: audit.freeBlocks,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS SPECULATIVE PAGED KV-CACHE — PAGE TABLE (SPEC-317)       `);
  console.log(`===============================================================`);
  console.log(`  Sequence ID         : ${payload.sequenceId}`);
  console.log(`  Token Count         : ${payload.tokenCount}`);
  console.log(`  Allocated Blocks    : ${payload.allocatedPhysicalBlocks} (16 tokens/block)`);
  console.log(`  Total Capacity      : ${payload.totalCapacityTokens} tokens`);
  console.log(`  Page Table Mapping  : ${JSON.stringify(pageTable)}`);
  console.log(`  Fragmentation Ratio : ${(payload.externalFragmentationRatio * 100).toFixed(2)}%`);
  console.log(`  Free Blocks Pool    : ${payload.freeBlocksRemaining} blocks`);
  console.log(`===============================================================\n`);
}

async function cmd_speculative_allocate(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const seqId = args.find((a) => !a.startsWith("--")) || "seq-alloc-001";
  const numTokens = Number(parseFlagValue(args, "--tokens=", "35"));

  const engine = new EosSpeculativePagedKvCacheCore({ totalBlocks: 64, blockSizeTokens: 16 });
  const tokens = Array.from({ length: numTokens }, (_, i) => 1000 + i);
  const result = engine.allocateSequence(seqId, tokens);

  const payload = {
    status: "SEQUENCE_ALLOCATED",
    sequenceId: result.sequenceId,
    allocatedBlocksCount: result.allocatedBlocks,
    pageTable: result.pageTable,
    tokensStored: numTokens,
    totalBlocks: engine.totalBlocks,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS PAGED KV-CACHE — BLOCK ALLOCATION (SPEC-317)             `);
  console.log(`===============================================================`);
  console.log(`  Sequence ID         : ${payload.sequenceId}`);
  console.log(`  Tokens Stored       : ${payload.tokensStored}`);
  console.log(`  Allocated Blocks    : ${payload.allocatedBlocksCount}`);
  console.log(`  Page Table          : [${payload.pageTable.join(", ")}]`);
  console.log(`===============================================================\n`);
}

async function cmd_speculative_draft(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const seqId = args.find((a) => !a.startsWith("--")) || "seq-draft-001";
  const k = Number(parseFlagValue(args, "--k=", "4"));

  const engine = new EosSpeculativePagedKvCacheCore({ totalBlocks: 32, blockSizeTokens: 16 });
  engine.allocateSequence(seqId, [10, 20, 30]);

  const draftResult = engine.generateDraft(seqId, k);

  const payload = {
    status: "DRAFT_PROJECTED",
    sequenceId: draftResult.sequenceId,
    lookaheadK: k,
    candidateTokens: draftResult.candidateTokens,
    draftProbabilities: draftResult.draftProbabilities,
    draftLatencyMs: draftResult.draftLatencyMs,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS SPECULATIVE DECODING — DRAFT TOKENS (SPEC-317)          `);
  console.log(`===============================================================`);
  console.log(`  Sequence ID         : ${payload.sequenceId}`);
  console.log(`  Lookahead K         : ${payload.lookaheadK}`);
  console.log(`  Candidate Tokens    : [${payload.candidateTokens.join(", ")}]`);
  console.log(`  Draft Probabilities : [${payload.draftProbabilities.map((p) => p.toFixed(2)).join(", ")}]`);
  console.log(`  Draft Latency       : ${payload.draftLatencyMs} ms`);
  console.log(`===============================================================\n`);
}

async function cmd_speculative_verify(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const seqId = args.find((a) => !a.startsWith("--")) || "seq-verify-001";
  const k = Number(parseFlagValue(args, "--k=", "4"));

  const engine = new EosSpeculativePagedKvCacheCore({ totalBlocks: 32, blockSizeTokens: 16 });
  engine.allocateSequence(seqId, [10, 20, 30]);

  const draft = engine.generateDraft(seqId, k);

  // Target model evaluates in parallel: matches first 3 tokens, fourth diverges
  const verifyResult = engine.verifyDraft(seqId, draft.candidateTokens, (_prefix) => {
    return [
      draft.candidateTokens[0],
      draft.candidateTokens[1],
      draft.candidateTokens[2] ?? 9999,
      8888, // Divergence at position 3
      7777,
    ];
  });

  const payload = {
    status: "VERIFICATION_COMPLETE",
    sequenceId: verifyResult.sequenceId,
    candidateTokens: verifyResult.candidateTokens,
    acceptedTokens: verifyResult.acceptedTokens,
    correctionToken: verifyResult.correctionToken,
    totalEmittedTokens: verifyResult.totalEmittedTokens,
    acceptanceRate: verifyResult.acceptanceRate,
    theoreticalSpeedup: verifyResult.theoreticalSpeedup,
    verifiedLatencyMs: verifyResult.verifiedLatencyMs,
    finalSequenceLength: verifyResult.finalSequenceLength,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS SPECULATIVE DECODING — VERIFICATION RESULT (SPEC-317)   `);
  console.log(`===============================================================`);
  console.log(`  Sequence ID         : ${payload.sequenceId}`);
  console.log(`  Candidates Evaluated: [${payload.candidateTokens.join(", ")}]`);
  console.log(`  Accepted Tokens     : [${payload.acceptedTokens.join(", ")}]`);
  console.log(`  Correction Token    : ${payload.correctionToken}`);
  console.log(`  Total Emitted       : [${payload.totalEmittedTokens.join(", ")}]`);
  console.log(`  Acceptance Rate     : ${(payload.acceptanceRate * 100).toFixed(1)}%`);
  console.log(`  Theoretical Speedup : ${payload.theoreticalSpeedup}x`);
  console.log(`  Verification Latency: ${payload.verifiedLatencyMs} ms`);
  console.log(`===============================================================\n`);
}

async function cmd_speculative_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const engine = new EosSpeculativePagedKvCacheCore({ totalBlocks: 32, blockSizeTokens: 16 });

  // Allocate 3 sequences with varied lengths
  engine.allocateSequence(
    "seq-alpha",
    Array.from({ length: 24 }, (_, i) => i + 1),
  );
  engine.allocateSequence(
    "seq-beta",
    Array.from({ length: 40 }, (_, i) => i + 100),
  );
  engine.allocateSequence(
    "seq-gamma",
    Array.from({ length: 12 }, (_, i) => i + 200),
  );

  // Run a speculative draft & verify cycle
  const draft = engine.generateDraft("seq-alpha", 4);
  engine.verifyDraft("seq-alpha", draft.candidateTokens, () => [
    draft.candidateTokens[0],
    draft.candidateTokens[1],
    9999,
    8888,
  ]);

  // Free one sequence to test reclamation
  engine.freeSequence("seq-gamma");

  const report = engine.getAuditReport();

  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }

  const receipt = {
    schemaVersion: "1.0.0",
    specRef: "SPEC-317",
    changeRef: "CHANGE-179",
    auditStatus: report.conservationVerified ? "VERIFIED" : "AUDIT_FAILED",
    totalBlocks: report.totalBlocks,
    allocatedBlocks: report.allocatedBlocks,
    freeBlocks: report.freeBlocks,
    activeSequences: report.activeSequences,
    externalFragmentationRatio: report.externalFragmentationRatio,
    conservationVerified: report.conservationVerified,
    pageTableMonotonicityVerified: report.pageTableMonotonicityVerified,
    noSharedBlocksVerified: report.noSharedBlocksVerified,
    sha256Receipt: report.sha256Receipt,
    timestampIso: new Date().toISOString(),
  };

  fs.writeFileSync(DEFAULT_RECEIPT_PATH, JSON.stringify(receipt, null, 2) + "\n", "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS SPECULATIVE PAGED KV-CACHE AUDIT RECEIPT (SPEC-317)      `);
  console.log(`===============================================================`);
  console.log(`  Status              : ${receipt.auditStatus}`);
  console.log(`  Total Blocks        : ${receipt.totalBlocks}`);
  console.log(`  Allocated Blocks    : ${receipt.allocatedBlocks}`);
  console.log(`  Free Blocks Pool    : ${receipt.freeBlocks}`);
  console.log(`  Active Sequences    : ${receipt.activeSequences}`);
  console.log(`  Block Conservation  : ${receipt.conservationVerified ? "PASSED" : "FAILED"}`);
  console.log(`  Page Table Monotonic: ${receipt.pageTableMonotonicityVerified ? "PASSED" : "FAILED"}`);
  console.log(`  No Shared Blocks    : ${receipt.noSharedBlocksVerified ? "PASSED" : "FAILED"}`);
  console.log(`  SHA-256 Signature   : ${receipt.sha256Receipt.slice(0, 32)}...`);
  console.log(`  Receipt Path        : ${DEFAULT_RECEIPT_PATH}`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:speculative:pagetable"] = cmd_speculative_pagetable;
HANDLERS["toolchain:speculative:allocate"] = cmd_speculative_allocate;
HANDLERS["toolchain:speculative:draft"] = cmd_speculative_draft;
HANDLERS["toolchain:speculative:verify"] = cmd_speculative_verify;
HANDLERS["toolchain:speculative:audit"] = cmd_speculative_audit;

export async function handleSpeculativePagedKvCacheCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:speculative command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
