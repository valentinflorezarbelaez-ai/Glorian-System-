/**
 * CLI Vector LSM-Tree Segment Storage Handlers
 *
 * Implements toolchain:lsm:* subcommands for append-only vector write buffering,
 * immutable L0/L1 SSTable segment flushing, double-hashing Bloom filters,
 * sparse block index binary search, and background k-way compaction with tombstone purging.
 *
 * Conforms to SPEC-316 / CHANGE-178.
 */

import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { EosVectorLsmStorageCore } from "../../src/core/eosVectorLsmStorage.ts";
import { resolveEvidenceDir } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const EVIDENCE_DIR = resolveEvidenceDir(ROOT);

const HANDLERS = {};

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

function generateRandomVector(dim, seed = 1) {
  const vec = new Float32Array(dim);
  let s = seed;
  for (let i = 0; i < dim; i++) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    vec[i] = (s / 4294967296) * 2 - 1;
  }
  return vec;
}

async function cmd_lsm_memtable(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const capacity = Number(parseFlagValue(args, "--capacity=", "50"));
  const insertCount = Number(parseFlagValue(args, "--insert=", "10"));

  const lsm = new EosVectorLsmStorageCore({ memTableCapacity: capacity });

  for (let i = 1; i <= insertCount; i++) {
    const raw = generateRandomVector(32, 100 + i);
    lsm.insertVector(`vec-key-${String(i).padStart(3, "0")}`, raw, { tag: "memtable-eval" });
  }

  const entries = lsm.getMemTableEntries();
  const stats = lsm.getStats();

  const payload = {
    status: "MEMTABLE_ACTIVE",
    capacity,
    currentEntries: entries.length,
    totalLiveVectors: stats.totalLiveVectors,
    sampleKeys: entries.slice(0, 5).map((e) => e.id),
    latestSequence: stats.latestSequence,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS VECTOR LSM-TREE — MEMTABLE INSPECTION (SPEC-316)          `);
  console.log(`===============================================================`);
  console.log(`  Configured Capacity : ${payload.capacity}`);
  console.log(`  Current Entries     : ${payload.currentEntries}`);
  console.log(`  Total Live Vectors  : ${payload.totalLiveVectors}`);
  console.log(`  Latest Sequence     : ${payload.latestSequence}`);
  console.log(`  Sample Keys         : ${payload.sampleKeys.join(", ")}`);
  console.log(`===============================================================\n`);
}

async function cmd_lsm_flush(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const count = Number(parseFlagValue(args, "--count=", "30"));

  const lsm = new EosVectorLsmStorageCore({ memTableCapacity: 100, blockSize: 8 });

  for (let i = 1; i <= count; i++) {
    const raw = generateRandomVector(32, 200 + i);
    lsm.insertVector(`item-${String(i).padStart(3, "0")}`, raw);
  }

  const segment = lsm.flushMemTable();

  const payload = {
    status: segment ? "FLUSH_SUCCESS" : "MEMTABLE_EMPTY",
    segmentId: segment?.segmentId || null,
    level: segment?.level ?? null,
    minKey: segment?.minKey || null,
    maxKey: segment?.maxKey || null,
    totalRecords: segment?.totalRecords || 0,
    totalBlocks: segment?.sparseIndex.length || 0,
    bloomFilterBits: segment?.bloomFilter.bitSize || 0,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS VECTOR LSM-TREE — FLUSH SSTABLE (SPEC-316)                `);
  console.log(`===============================================================`);
  console.log(`  Status              : ${payload.status}`);
  console.log(`  Segment ID          : ${payload.segmentId}`);
  console.log(`  Hierarchy Level     : L${payload.level}`);
  console.log(`  Key Range           : [${payload.minKey} .. ${payload.maxKey}]`);
  console.log(`  Indexed Records     : ${payload.totalRecords}`);
  console.log(`  Sparse Blocks       : ${payload.totalBlocks}`);
  console.log(`===============================================================\n`);
}

async function cmd_lsm_compact(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const l0Count = Number(parseFlagValue(args, "--l0count=", "3"));

  const lsm = new EosVectorLsmStorageCore({ memTableCapacity: 15, maxL0Segments: 10 });

  // Generate overlapping L0 segments with updates and deletes
  for (let s = 1; s <= l0Count; s++) {
    for (let i = 1; i <= 10; i++) {
      const raw = generateRandomVector(16, s * 100 + i);
      lsm.insertVector(`shared-key-${i}`, raw);
    }
    // Delete some keys in later segments
    if (s === l0Count) {
      lsm.deleteVector("shared-key-2");
      lsm.deleteVector("shared-key-4");
    }
    lsm.flushMemTable();
  }

  const beforeStats = lsm.getStats();
  const compacted = lsm.compactL0ToL1();
  const afterStats = lsm.getStats();

  const payload = {
    status: compacted ? "COMPACTION_SUCCESS" : "NO_SEGMENTS_TO_COMPACT",
    l0SegmentsBefore: beforeStats.l0SegmentCount,
    l0SegmentsAfter: afterStats.l0SegmentCount,
    l1SegmentsAfter: afterStats.l1SegmentCount,
    totalRecordsInL1: compacted?.totalRecords || 0,
    tombstonesPurged: beforeStats.totalTombstones,
    sampleCompactedKeys: compacted?.records.slice(0, 5).map((r) => r.id) || [],
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS VECTOR LSM-TREE — K-WAY COMPACTION (SPEC-316)             `);
  console.log(`===============================================================`);
  console.log(`  Status              : ${payload.status}`);
  console.log(`  L0 Segments Before  : ${payload.l0SegmentsBefore}`);
  console.log(`  L0 Segments After   : ${payload.l0SegmentsAfter}`);
  console.log(`  L1 Segments Created : ${payload.l1SegmentsAfter}`);
  console.log(`  Consolidated Records: ${payload.totalRecordsInL1}`);
  console.log(`  Tombstones Purged   : ${payload.tombstonesPurged}`);
  console.log(`===============================================================\n`);
}

async function cmd_lsm_search(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const targetKey = parseFlagValue(args, "--key=", "sample-key-005");

  const lsm = new EosVectorLsmStorageCore({ memTableCapacity: 10 });

  for (let i = 1; i <= 15; i++) {
    const key = `sample-key-${String(i).padStart(3, "0")}`;
    const raw = generateRandomVector(32, 500 + i);
    lsm.insertVector(key, raw);
  }

  const t0 = performance.now();
  const record = lsm.getVector(targetKey);
  const latencyMs = Number((performance.now() - t0).toFixed(4));

  const payload = {
    status: record ? "KEY_FOUND" : "KEY_NOT_FOUND",
    key: targetKey,
    found: Boolean(record),
    dimension: record?.vector?.length || 0,
    norm: record?.norm ? Number(record.norm.toFixed(4)) : null,
    sequence: record?.sequence || null,
    latencyMs,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS VECTOR LSM-TREE — POINT LOOKUP (SPEC-316)                 `);
  console.log(`===============================================================`);
  console.log(`  Target Key          : ${payload.key}`);
  console.log(`  Found               : ${payload.found ? "YES" : "NO"}`);
  console.log(`  Vector Dimension    : ${payload.dimension}`);
  console.log(`  Vector Norm         : ${payload.norm}`);
  console.log(`  Lookup Latency      : ${payload.latencyMs} ms`);
  console.log(`===============================================================\n`);
}

async function cmd_lsm_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const lsm = new EosVectorLsmStorageCore({ memTableCapacity: 10, blockSize: 4 });

  for (let i = 1; i <= 25; i++) {
    const raw = generateRandomVector(32, 700 + i);
    lsm.insertVector(`audit-key-${String(i).padStart(3, "0")}`, raw);
  }
  lsm.flushMemTable();

  const receipt = lsm.auditLsmInvariants(EVIDENCE_DIR);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS VECTOR LSM-TREE AUDIT RECEIPT (SPEC-316)                  `);
  console.log(`===============================================================`);
  console.log(`  Status              : ${receipt.status}`);
  console.log(`  Total Live Vectors  : ${receipt.totalLiveVectors}`);
  console.log(`  L0 Segments         : ${receipt.l0Segments}`);
  console.log(`  L1 Segments         : ${receipt.l1Segments}`);
  console.log(`  Key Monotonicity    : ${receipt.monotonicityVerified ? "PASSED" : "FAILED"}`);
  console.log(`  SHA-256 Signature   : ${receipt.sha256Signature.slice(0, 32)}...`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:lsm:memtable"] = cmd_lsm_memtable;
HANDLERS["toolchain:lsm:flush"] = cmd_lsm_flush;
HANDLERS["toolchain:lsm:compact"] = cmd_lsm_compact;
HANDLERS["toolchain:lsm:search"] = cmd_lsm_search;
HANDLERS["toolchain:lsm:audit"] = cmd_lsm_audit;

export async function handleVectorLsmCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:lsm command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
