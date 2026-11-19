/**
 * @file cliAgenticContextEngine.mjs
 * @description CLI handler for SPEC-344 / CHANGE-206: Autonomous Agentic Context Engine & Multimodal Prompt Ingestion.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chunkText,
  compressContext,
  EosAgenticContextEngineCore,
  ingestCorpus,
  retrieveContext,
} from "../../src/core/eosAgenticContextEngine.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("AGENTIC_CONTEXT_ENGINE_RECEIPT.json", root);
}

function parseStringFlag(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  return arg ? arg.split("=")[1] : defaultValue;
}

function parseIntFlag(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  const parsed = parseInt(arg.split("=")[1], 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

const HANDLERS = {};

async function cmd_agentic_ingest(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const id = parseStringFlag(args, "--id=", "agentic-doc");
  const rawText = parseStringFlag(
    args,
    "--text=",
    "# Agentic Architecture\nInvariant: Law I is supreme.\nRule: 100% type safety.\nRequirement: Zero runtime dependencies.",
  );
  const maxTokens = parseIntFlag(args, "--max-tokens=", 512);

  const corpus = ingestCorpus(id, rawText, { maxChunkTokens: maxTokens });

  if (isJson) {
    console.log(JSON.stringify(corpus, null, 2));
  } else {
    console.log("=== Agentic Context Engine: Corpus Ingestion (SPEC-344) ===");
    console.log(`Corpus ID          : ${corpus.id}`);
    console.log(`Title              : ${corpus.sourceTitle}`);
    console.log(`Total Tokens       : ${corpus.totalTokens}`);
    console.log(`Chunks Created     : ${corpus.chunks.length}`);
    console.log(`Indexed Symbols    : ${corpus.indexedSymbols.length}`);
    console.log(`Ingested At        : ${corpus.ingestedAt}`);
  }
}

async function cmd_agentic_chunk(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const rawText = parseStringFlag(
    args,
    "--text=",
    "Section 1.\nFirst paragraph.\n\nSection 2.\nSecond paragraph with invariants.\nLaw I: Supreme.",
  );
  const maxTokens = parseIntFlag(args, "--max-tokens=", 256);
  const overlap = parseIntFlag(args, "--overlap=", 32);

  const chunks = chunkText(rawText, { maxChunkTokens: maxTokens, overlapTokens: overlap });

  if (isJson) {
    console.log(JSON.stringify(chunks, null, 2));
  } else {
    console.log("=== Agentic Context Engine: Sliding-Window Chunking ===");
    console.log(`Total Chunks       : ${chunks.length}`);
    for (const c of chunks) {
      console.log(`  - [${c.id}] ${c.heading} (~${c.tokenEstimate} tokens, ${c.invariants.length} invariants)`);
    }
  }
}

async function cmd_agentic_compress(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const rawText = parseStringFlag(
    args,
    "--text=",
    "# Overview\nSome filler words and introductory comments.\nInvariant: Law V Layer-0 purity.\nMore descriptive text.\nRule: BDD scenarios mandatory.",
  );
  const maxTokens = parseIntFlag(args, "--budget=", 20);

  const result = compressContext(rawText, maxTokens);

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Agentic Context Engine: Priority Token Compaction ===");
    console.log(`Original Tokens    : ${result.originalTokens}`);
    console.log(`Compacted Tokens   : ${result.compactedTokens}`);
    console.log(`Compression Ratio  : ${Math.round(result.compressionRatio * 100)}%`);
    console.log(`Preserved Invars   : ${result.preservedInvariantsCount}`);
    console.log("--- Compacted Output ---");
    console.log(result.text);
  }
}

async function cmd_agentic_eval(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const query = parseStringFlag(args, "--query=", "Law V purity Layer-0");

  const sampleCorpus = ingestCorpus(
    "eval-corpus",
    "# Architecture\nInvariant: Law V Layer-0 purity is strictly enforced.\nRule: Zero runtime npm packages.\n\n# Security\nLaw VI: Absolute security.",
  );

  const res = retrieveContext(sampleCorpus, query, 2);

  if (isJson) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log("=== Agentic Context Engine: Semantic Retrieval Eval ===");
    console.log(`Query              : ${res.query}`);
    console.log(`Recall Score       : ${Math.round(res.recallScore * 100)}%`);
    console.log(`Matches Found      : ${res.matches.length}`);
    console.log(`Latency            : ${res.latencyMs} ms`);
    for (const m of res.matches) {
      console.log(
        `  - Chunk: ${m.chunk.id} (Score: ${Math.round(m.score * 100) / 100}, Keywords: ${m.matchedKeywords.join(", ")})`,
      );
    }
  }
}

async function cmd_agentic_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosAgenticContextEngineCore.audit(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Agentic Context Engine Audit Receipt (SPEC-344) ===");
    console.log(`Spec               : ${receipt.spec}`);
    console.log(`Chunks Evaluated   : ${receipt.totalChunksEvaluated}`);
    console.log(`Mean Recall Score  : ${Math.round(receipt.meanRecallScore * 100)}%`);
    console.log(`Injection Defense  : ${receipt.promptInjectionDefensePassed ? "PASS" : "FAIL"}`);
    console.log(`Budget Compaction  : ${receipt.tokenBudgetCompactionPassed ? "PASS" : "FAIL"}`);
    console.log(`All Passed         : ${receipt.allPassed}`);
    console.log(`SHA-256 Digest     : ${receipt.sha256}`);
    console.log(`Receipt Saved      : ${receiptPath}`);
  }
}

HANDLERS["toolchain:agentic:ingest"] = cmd_agentic_ingest;
HANDLERS["toolchain:agentic:chunk"] = cmd_agentic_chunk;
HANDLERS["toolchain:agentic:compress"] = cmd_agentic_compress;
HANDLERS["toolchain:agentic:eval"] = cmd_agentic_eval;
HANDLERS["toolchain:agentic:audit"] = cmd_agentic_audit;

export async function handleAgenticContextCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:agentic command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
