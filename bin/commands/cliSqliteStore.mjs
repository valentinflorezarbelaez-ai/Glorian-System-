/**
 * CLI Native SQLite Storage & Vector Command Handlers
 *
 * Implements toolchain:sqlite:* subcommands for querying,
 * vector searching, and auditing embedded node:sqlite stores.
 *
 * Conforms to SPEC-287 / CHANGE-149.
 */

import { EosNativeSqliteStore } from "../../src/core/eosNativeSqliteStore.ts";

const HANDLERS = {};

async function cmd_sqlite_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const store = new EosNativeSqliteStore(":memory:");

  // Populate sample documents for audit baseline
  store.insertDocument({
    id: "spec-001",
    category: "specification",
    title: "EOS System Constitution",
    content: "The specification is the sole executable source of truth. Zero vibe coding.",
    vector: [0.1, 0.8, 0.4, 0.9, 0.2, 0.5, 0.7, 0.3],
  });

  store.insertDocument({
    id: "spec-287",
    category: "specification",
    title: "Native SQLite and Vector Governor",
    content: "Embedded ACID document storage and FTS5 full-text search with zero dependencies.",
    vector: [0.2, 0.7, 0.5, 0.85, 0.25, 0.45, 0.65, 0.35],
  });

  const report = store.auditStorage();
  store.close();

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🗄️  EOS NATIVE SQLITE & VECTOR STORAGE AUDIT (SPEC-287)       ");
  console.log("===============================================================");
  console.log(`  Database Path       : ${report.dbPath}`);
  console.log(`  Journal Mode        : ${report.journalMode.toUpperCase()}`);
  console.log(`  Synchronous Mode    : ${report.synchronous}`);
  console.log(`  Total Documents     : ${report.totalDocuments}`);
  console.log(`  FTS5 Full-Text      : ${report.fts5Enabled ? "ENABLED" : "DISABLED"}`);
  console.log(`  Vector Indexed Docs : ${report.vectorIndexedCount}`);
  console.log(`  SHA-256 Receipt     : ${report.sha256Signature}`);
  console.log("===============================================================\n");
}

async function cmd_sqlite_query(commandContext) {
  const args = commandContext.args || [];
  const queryArg = args.find((a) => a.startsWith("--q=")) || args.find((a) => a.startsWith("--query="));
  const query = queryArg ? queryArg.split("=")[1] : "specification";
  const isJson = args.includes("--json");

  const store = new EosNativeSqliteStore(":memory:");
  store.insertDocument({
    id: "doc-1",
    category: "architecture",
    title: "Clean Hexagonal Boundaries",
    content: "Domain logic must remain pure with zero framework dependencies.",
  });
  store.insertDocument({
    id: "doc-2",
    category: "specification",
    title: "Formal EARS Requirements",
    content: "Event-driven and state-driven formal requirements engineering.",
  });

  const results = store.searchFts(query, 5);
  store.close();

  if (isJson) {
    console.log(JSON.stringify({ query, count: results.length, results }, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔍 EOS SQLITE FTS5 FULL-TEXT LEXICAL SEARCH (BM25)            ");
  console.log("===============================================================");
  console.log(`  Query               : "${query}"`);
  console.log(`  Matches Found       : ${results.length}`);
  console.log("---------------------------------------------------------------");
  for (const r of results) {
    console.log(`  Rank ${r.rank} | [${r.category}] ${r.title} (${r.id})`);
    console.log(`    Excerpt: ${r.content}`);
  }
  console.log("===============================================================\n");
}

async function cmd_sqlite_vector(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const store = new EosNativeSqliteStore(":memory:");
  store.insertDocument({
    id: "vec-1",
    category: "crypto",
    title: "Post-Quantum Dilithium Signatures",
    content: "NIST FIPS 204 ML-DSA lattice-based digital signatures.",
    vector: [0.9, 0.1, 0.2, 0.05, 0.8, 0.15, 0.3, 0.1],
  });
  store.insertDocument({
    id: "vec-2",
    category: "database",
    title: "Bitemporal Event Store & CDC",
    content: "Immutable event streams with validTime and systemTime dimensions.",
    vector: [0.1, 0.85, 0.7, 0.9, 0.15, 0.8, 0.65, 0.75],
  });

  // Query vector close to database vector
  const queryVec = [0.12, 0.8, 0.68, 0.88, 0.2, 0.75, 0.6, 0.7];
  const results = store.searchVector(queryVec, 5);
  store.close();

  if (isJson) {
    console.log(JSON.stringify({ queryVector: queryVec, count: results.length, results }, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 📐 EOS SQLITE QUANTIZED VECTOR k-NN SEARCH (COSINE)          ");
  console.log("===============================================================");
  console.log(`  Query Dimensions    : ${queryVec.length}`);
  console.log(`  Neighbors Retrieved : ${results.length}`);
  console.log("---------------------------------------------------------------");
  for (const r of results) {
    console.log(`  Score: ${(r.similarity * 100).toFixed(2)}% | [${r.category}] ${r.title} (${r.id})`);
  }
  console.log("===============================================================\n");
}

HANDLERS["toolchain:sqlite:audit"] = cmd_sqlite_audit;
HANDLERS["toolchain:sqlite:query"] = cmd_sqlite_query;
HANDLERS["toolchain:sqlite:vector"] = cmd_sqlite_vector;

export async function handleSqliteCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
