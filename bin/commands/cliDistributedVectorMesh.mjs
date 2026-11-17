/**
 * CLI Distributed Consistent Hashing Vector Partition Mesh Handlers
 *
 * Implements toolchain:mesh:* subcommands for consistent hashing virtual token rings,
 * primary and replica vector shard placement, Raft-replicated membership logs,
 * dynamic churn rebalancing, and federated scatter-gather search.
 *
 * Conforms to SPEC-315 / CHANGE-177.
 */

import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { EosDistributedVectorMeshCore } from "../../src/core/eosDistributedVectorMesh.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const EVIDENCE_DIR = path.join(ROOT, "docs/evidence");

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

async function cmd_mesh_ring(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const nodesCount = Number(parseFlagValue(args, "--nodes=", "3"));
  const vnodes = Number(parseFlagValue(args, "--vnodes=", "64"));
  const replication = Number(parseFlagValue(args, "--replication=", "2"));

  const mesh = new EosDistributedVectorMeshCore({
    vnodesPerNode: vnodes,
    replicationFactor: replication,
  });

  for (let i = 1; i <= nodesCount; i++) {
    mesh.addNode({
      nodeId: `node-${i}`,
      host: `10.0.0.${i}`,
      port: 9000 + i,
      state: "ACTIVE",
      vnodeCount: vnodes,
      faultDomain: `zone-${i % 2 === 0 ? "b" : "a"}`,
    });
  }

  const ringTokens = mesh.getRingTokens();
  const stats = mesh.getClusterStats();

  const payload = {
    status: "RING_INITIALIZED",
    totalPhysicalNodes: stats.totalPhysicalNodes,
    activeNodes: stats.activeNodes,
    totalVnodes: stats.totalVnodes,
    replicationFactor: replication,
    loadVariancePct: stats.loadVariancePct,
    sampleRingTokens: ringTokens.slice(0, 10).map((t) => ({ token: t.token, nodeId: t.nodeId })),
    ringContinuity: ringTokens.length === nodesCount * vnodes,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS DISTRIBUTED VECTOR MESH — RING TOPOLOGY (SPEC-315)       `);
  console.log(`===============================================================`);
  console.log(`  Physical Nodes    : ${payload.totalPhysicalNodes}`);
  console.log(`  Active Nodes      : ${payload.activeNodes}`);
  console.log(`  Total Vnodes      : ${payload.totalVnodes}`);
  console.log(`  Replication Factor: ${payload.replicationFactor}`);
  console.log(`  Load Variance     : ${payload.loadVariancePct.toFixed(2)}%`);
  console.log(`  Ring Continuity   : ${payload.ringContinuity ? "PASSED" : "FAILED"}`);
  console.log(`===============================================================\n`);
}

async function cmd_mesh_insert(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const key = parseFlagValue(args, "--key=", "sample-vec-key-1");
  const dim = Number(parseFlagValue(args, "--dim=", "128"));

  const mesh = new EosDistributedVectorMeshCore({ vnodesPerNode: 32, replicationFactor: 2 });
  mesh.addNode({ nodeId: "node-1", host: "10.0.0.1", port: 9001, state: "ACTIVE", vnodeCount: 32 });
  mesh.addNode({ nodeId: "node-2", host: "10.0.0.2", port: 9002, state: "ACTIVE", vnodeCount: 32 });
  mesh.addNode({ nodeId: "node-3", host: "10.0.0.3", port: 9003, state: "ACTIVE", vnodeCount: 32 });
  mesh.electLeader("node-1");

  const rawVec = generateRandomVector(dim, 101);
  const placement = mesh.insertVector(key, rawVec, { tag: "cli-insertion" });
  const stats = mesh.getClusterStats();

  const payload = {
    status: "INSERT_SUCCESS",
    key,
    dimension: dim,
    primaryNodeId: placement.primary,
    replicaNodeIds: placement.replicas,
    totalShards: stats.totalShards,
    totalVectors: stats.totalVectors,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS DISTRIBUTED VECTOR MESH — INSERTION (SPEC-315)           `);
  console.log(`===============================================================`);
  console.log(`  Key               : ${payload.key}`);
  console.log(`  Dimension         : ${payload.dimension}`);
  console.log(`  Primary Node      : ${payload.primaryNodeId}`);
  console.log(`  Replica Nodes     : ${payload.replicaNodeIds.join(", ")}`);
  console.log(`  Cluster Vectors   : ${payload.totalVectors}`);
  console.log(`===============================================================\n`);
}

async function cmd_mesh_search(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const k = Number(parseFlagValue(args, "--k=", "5"));
  const dim = Number(parseFlagValue(args, "--dim=", "64"));

  const mesh = new EosDistributedVectorMeshCore({ vnodesPerNode: 32, replicationFactor: 2 });
  mesh.addNode({ nodeId: "node-1", host: "10.0.0.1", port: 9001, state: "ACTIVE", vnodeCount: 32 });
  mesh.addNode({ nodeId: "node-2", host: "10.0.0.2", port: 9002, state: "ACTIVE", vnodeCount: 32 });
  mesh.addNode({ nodeId: "node-3", host: "10.0.0.3", port: 9003, state: "ACTIVE", vnodeCount: 32 });
  mesh.electLeader("node-1");

  // Populate 30 vectors
  for (let i = 0; i < 30; i++) {
    const raw = generateRandomVector(dim, 500 + i);
    mesh.insertVector(`vec-${i}`, raw, { index: i });
  }

  const queryVec = generateRandomVector(dim, 9999);
  const t0 = performance.now();
  const searchResults = mesh.searchFederated(queryVec, k);
  const latencyMs = Number((performance.now() - t0).toFixed(4));

  const payload = {
    status: "FEDERATED_SEARCH_SUCCESS",
    k,
    latencyMs,
    totalHits: searchResults.length,
    results: searchResults.map((r) => ({
      id: r.id,
      distance: Number(r.distance.toFixed(6)),
      primaryShard: r.primaryShard,
      nodeId: r.nodeId,
    })),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS DISTRIBUTED VECTOR MESH — SCATTER-GATHER (SPEC-315)      `);
  console.log(`===============================================================`);
  console.log(`  Top-K Requested   : ${payload.k}`);
  console.log(`  Hits Found        : ${payload.totalHits}`);
  console.log(`  Search Latency    : ${payload.latencyMs} ms`);
  console.log(`  Top 3 Matches     :`);
  payload.results.slice(0, 3).forEach((r, idx) => {
    console.log(`    [${idx + 1}] ID: ${r.id.padEnd(10)} Dist: ${r.distance.toFixed(4)} Node: ${r.nodeId}`);
  });
  console.log(`===============================================================\n`);
}

async function cmd_mesh_rebalance(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const initialNodes = Number(parseFlagValue(args, "--initial=", "3"));
  const keysCount = Number(parseFlagValue(args, "--keys=", "60"));
  const churn = parseFlagValue(args, "--churn=", "join");

  const mesh = new EosDistributedVectorMeshCore({ vnodesPerNode: 32, replicationFactor: 2 });
  for (let i = 1; i <= initialNodes; i++) {
    mesh.addNode({ nodeId: `node-${i}`, host: `10.0.0.${i}`, port: 9000 + i, state: "ACTIVE", vnodeCount: 32 });
  }
  mesh.electLeader("node-1");

  for (let i = 0; i < keysCount; i++) {
    const raw = generateRandomVector(32, 1000 + i);
    mesh.insertVector(`item-${i}`, raw);
  }

  let migratedKeys = 0;
  if (churn === "join") {
    migratedKeys = mesh.rebalanceOnNodeJoin({
      nodeId: `node-${initialNodes + 1}`,
      host: `10.0.0.${initialNodes + 1}`,
      port: 9000 + initialNodes + 1,
      state: "ACTIVE",
      vnodeCount: 32,
    });
  } else {
    migratedKeys = mesh.rebalanceOnNodeLeave(`node-${initialNodes}`);
  }

  const migrationRatio = Number((migratedKeys / keysCount).toFixed(4));
  const expectedRatioMax = Number((1.5 / initialNodes).toFixed(4));

  const payload = {
    status: "REBALANCE_SUCCESS",
    churnType: churn,
    totalKeys: keysCount,
    migratedKeys,
    migrationRatio,
    expectedRatioMax,
    minimalChurnBoundSatisfied: migrationRatio <= expectedRatioMax,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS DISTRIBUTED VECTOR MESH — REBALANCE CHURN (SPEC-315)     `);
  console.log(`===============================================================`);
  console.log(`  Churn Type        : ${payload.churnType.toUpperCase()}`);
  console.log(`  Total Keys        : ${payload.totalKeys}`);
  console.log(`  Migrated Keys     : ${payload.migratedKeys} (${(payload.migrationRatio * 100).toFixed(1)}%)`);
  console.log(`  Expected Max Ratio: ${(payload.expectedRatioMax * 100).toFixed(1)}%`);
  console.log(`  Minimal Churn Sat : ${payload.minimalChurnBoundSatisfied ? "PASSED" : "FAILED"}`);
  console.log(`===============================================================\n`);
}

async function cmd_mesh_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const mesh = new EosDistributedVectorMeshCore({ vnodesPerNode: 32, replicationFactor: 2 });
  mesh.addNode({
    nodeId: "node-1",
    host: "10.0.0.1",
    port: 9001,
    state: "ACTIVE",
    vnodeCount: 32,
    faultDomain: "us-east-1a",
  });
  mesh.addNode({
    nodeId: "node-2",
    host: "10.0.0.2",
    port: 9002,
    state: "ACTIVE",
    vnodeCount: 32,
    faultDomain: "us-east-1b",
  });
  mesh.addNode({
    nodeId: "node-3",
    host: "10.0.0.3",
    port: 9003,
    state: "ACTIVE",
    vnodeCount: 32,
    faultDomain: "us-east-1c",
  });
  mesh.electLeader("node-1");

  for (let i = 0; i < 40; i++) {
    const raw = generateRandomVector(32, 3000 + i);
    mesh.insertVector(`audit-key-${i}`, raw);
  }

  const receipt = mesh.auditMeshInvariants(EVIDENCE_DIR);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS DISTRIBUTED VECTOR MESH AUDIT RECEIPT (SPEC-315)         `);
  console.log(`===============================================================`);
  console.log(`  Status            : ${receipt.status}`);
  console.log(`  Total Nodes       : ${receipt.totalNodes}`);
  console.log(`  Total Vnodes      : ${receipt.totalVnodes}`);
  console.log(`  Total Keys        : ${receipt.totalKeys}`);
  console.log(`  Replication Factor: ${receipt.replicationFactor}`);
  console.log(`  Quorum Satisfied  : ${receipt.quorumSatisfied ? "PASSED" : "FAILED"}`);
  console.log(`  Ring Continuity   : ${receipt.ringContinuityVerified ? "PASSED" : "FAILED"}`);
  console.log(`  SHA-256 Signature : ${receipt.sha256Signature.slice(0, 32)}...`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:mesh:ring"] = cmd_mesh_ring;
HANDLERS["toolchain:mesh:insert"] = cmd_mesh_insert;
HANDLERS["toolchain:mesh:search"] = cmd_mesh_search;
HANDLERS["toolchain:mesh:rebalance"] = cmd_mesh_rebalance;
HANDLERS["toolchain:mesh:audit"] = cmd_mesh_audit;

export async function handleDistributedVectorMeshCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:mesh command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
