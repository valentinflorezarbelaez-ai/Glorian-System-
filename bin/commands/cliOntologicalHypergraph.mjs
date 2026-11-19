/**
 * @file cliOntologicalHypergraph.mjs
 * @description CLI handler for SPEC-333 / CHANGE-195: Autonomous Ontological Hypergraph
 * & Bitemporal Entity Resolution Engine.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosOntologicalHypergraphCore } from "../../src/core/eosOntologicalHypergraph.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("ONTOLOGICAL_HYPERGRAPH_RECEIPT.json", root);
}

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_hypergraph_assert(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const entityId = parseFlagValue(args, "--entity=", "svc:quantum-broker");
  const kind = parseFlagValue(args, "--kind=", "Component");
  const classification = parseFlagValue(args, "--classification=", "UNCLASSIFIED");

  const engine = new EosOntologicalHypergraphCore();
  const entity = engine.assertEntity({
    entityId,
    name: "Quantum Telemetry Broker",
    kind,
    classification,
    compartments: classification === "TOP_SECRET" ? ["COMPARTMENT_CYBER"] : [],
    validFrom: 1000,
    validTo: 9000,
  });

  const payload = {
    command: "toolchain:hypergraph:assert",
    assertedEntity: entity,
    txClock: engine.getTxClock(),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Ontological Hypergraph: Bitemporal Entity Assertion ===");
    console.log(`Entity ID     : ${entity.entityId}`);
    console.log(`Canonical ID  : ${entity.canonicalId}`);
    console.log(`Classification: ${entity.classification}`);
    console.log(`Valid Time    : [${entity.temporal.validFrom}, ${entity.temporal.validTo}]`);
    console.log(`Tx Time       : [${entity.temporal.txFrom}, ${entity.temporal.txTo}]`);
    console.log(`SHA-256 Digest: ${entity.checksumSha256}`);
  }
}

async function cmd_hypergraph_query(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const asOfTx = Number(parseFlagValue(args, "--tx=", "5"));
  const validTime = Number(parseFlagValue(args, "--valid=", "2000"));
  const clearance = parseFlagValue(args, "--clearance=", "SECRET");

  const engine = new EosOntologicalHypergraphCore();
  // Populate baseline multi-tier entities
  engine.assertEntity({
    entityId: "comp:public-api",
    name: "Public API Gateway",
    kind: "Component",
    classification: "UNCLASSIFIED",
    validFrom: 1000,
    validTo: 5000,
  });
  engine.assertEntity({
    entityId: "comp:vault-kms",
    name: "Sovereign Vault KMS",
    kind: "SecurityEnclave",
    classification: "SECRET",
    validFrom: 1000,
    validTo: 5000,
  });
  engine.assertEntity({
    entityId: "comp:orbital-defense",
    name: "Orbital Guidance Core",
    kind: "DefenseSystem",
    classification: "TOP_SECRET",
    compartments: ["COMPARTMENT_CYBER"],
    validFrom: 1000,
    validTo: 5000,
  });

  const queryResult = engine.queryAsOf({ validTime, asOfTxTime: asOfTx }, { clearance, compartments: [] });

  const payload = {
    command: "toolchain:hypergraph:query",
    asOfTxTime: queryResult.asOfTxTime,
    validTime: queryResult.validTime,
    requesterClearance: clearance,
    visibleEntitiesCount: queryResult.entities.length,
    visibleEntities: queryResult.entities.map((e) => ({
      entityId: e.entityId,
      classification: e.classification,
      kind: e.kind,
    })),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Ontological Hypergraph: Point-in-Time As-Of Query ===");
    console.log(`As-Of Tx Time : T${asOfTx}`);
    console.log(`Valid Time    : V${validTime}`);
    console.log(`Clearance     : ${clearance}`);
    console.log(`Visible Nodes : ${payload.visibleEntitiesCount}`);
    for (const e of payload.visibleEntities) {
      console.log(`  - [${e.classification}] ${e.entityId} (${e.kind})`);
    }
  }
}

async function cmd_hypergraph_traverse(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const maxDepth = Number(parseFlagValue(args, "--depth=", "3"));
  const rootId = parseFlagValue(args, "--root=", "comp:gateway");

  const engine = new EosOntologicalHypergraphCore();
  engine.assertEntity({ entityId: "comp:gateway", name: "Gateway", kind: "Component", validFrom: 0, validTo: 10000 });
  engine.assertEntity({ entityId: "comp:auth-service", name: "Auth", kind: "Component", validFrom: 0, validTo: 10000 });
  engine.assertEntity({ entityId: "comp:user-db", name: "DB", kind: "Resource", validFrom: 0, validTo: 10000 });
  engine.assertEntity({ entityId: "squad:secops", name: "SecOps", kind: "Squad", validFrom: 0, validTo: 10000 });

  engine.assertHyperedge({
    edgeId: "edge:gw-auth-sec",
    relation: "GOVERNED_TRAFFIC",
    participants: [
      { entityId: "comp:gateway", role: "INGRESS" },
      { entityId: "comp:auth-service", role: "VALIDATOR" },
      { entityId: "squad:secops", role: "MONITOR" },
    ],
    validFrom: 0,
    validTo: 10000,
  });

  engine.assertHyperedge({
    edgeId: "edge:auth-db",
    relation: "DATABASE_READ",
    participants: [
      { entityId: "comp:auth-service", role: "CLIENT" },
      { entityId: "comp:user-db", role: "DATA_STORE" },
    ],
    validFrom: 0,
    validTo: 10000,
  });

  const blastRadius = engine.computeBlastRadius(rootId, maxDepth, { clearance: "SECRET", compartments: [] });

  const payload = {
    command: "toolchain:hypergraph:traverse",
    rootEntityId: blastRadius.rootEntityId,
    maxDepth: blastRadius.maxDepth,
    totalImpacted: blastRadius.totalImpacted,
    impactedEntities: blastRadius.impactedEntities,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Ontological Hypergraph: Traversal & Blast Radius ===");
    console.log(`Root Entity   : ${blastRadius.rootEntityId}`);
    console.log(`Max Depth     : ${blastRadius.maxDepth}`);
    console.log(`Total Reachable: ${blastRadius.totalImpacted}`);
    for (const node of blastRadius.impactedEntities) {
      console.log(`  - Depth ${node.depth}: ${node.entityId} (Path: ${node.path.join(" -> ")})`);
    }
  }
}

async function cmd_hypergraph_resolve(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const rawId = parseFlagValue(args, "--source-id=", "datadog:srv-telemetry");
  const rawName = parseFlagValue(args, "--name=", "Quantum-Telemetry-Broker");

  const engine = new EosOntologicalHypergraphCore();
  engine.assertEntity({
    entityId: "catalog:quantum-telemetry-broker",
    name: "quantum-telemetry-broker",
    kind: "Component",
    aliases: ["github:valentinflorezarbelaez-ai/quantum-telemetry-broker"],
    attributes: { repo: "valentinflorezarbelaez-ai/quantum-telemetry-broker" },
    validFrom: 0,
    validTo: 10000,
  });

  const match = engine.resolveEntity({
    sourceId: rawId,
    name: rawName,
    kind: "Component",
    attributes: { repo: "valentinflorezarbelaez-ai/quantum-telemetry-broker" },
  });

  const payload = {
    command: "toolchain:hypergraph:resolve",
    resolution: match,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Ontological Hypergraph: Entity Resolution & Dedupe ===");
    console.log(`Source ID      : ${match.sourceId}`);
    console.log(`Canonical ID   : ${match.canonicalId}`);
    console.log(`Confidence     : ${(match.confidenceScore * 100).toFixed(1)}%`);
    console.log(`Matching Method: ${match.method}`);
  }
}

async function cmd_hypergraph_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const engine = new EosOntologicalHypergraphCore();
  // Register baseline graph
  engine.assertEntity({ entityId: "comp:alpha", name: "Alpha", kind: "Component", validFrom: 1, validTo: 10 });
  engine.assertEntity({ entityId: "comp:beta", name: "Beta", kind: "Component", validFrom: 1, validTo: 10 });
  engine.assertHyperedge({
    edgeId: "edge:alpha-beta",
    relation: "DIRECT_LINK",
    participants: [
      { entityId: "comp:alpha", role: "SOURCE" },
      { entityId: "comp:beta", role: "TARGET" },
    ],
    validFrom: 1,
    validTo: 10,
  });
  engine.resolveEntity({ sourceId: "ext:alpha", name: "Alpha", kind: "Component" });

  const receipt = engine.auditHypergraph();
  const root = commandContext.root || ROOT;
  const receiptPath = getReceiptPath(root);

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Ontological Hypergraph Audit Receipt ===");
    console.log(`Spec Reference : ${receipt.specRef}`);
    console.log(`Total Entities : ${receipt.totalEntities}`);
    console.log(`Total Hyperedges: ${receipt.totalHyperedges}`);
    console.log(`Bitemporal Mono: ${receipt.bitemporalMonotonicity}`);
    console.log(`MLS Lattice    : ${receipt.mlsLatticeContainment}`);
    console.log(`Referential Int: ${receipt.referentialIntegrity}`);
    console.log(`Dedupe Resolved: ${receipt.deduplicationResolved}`);
    console.log(`SHA-256 Digest : ${receipt.sha256Digest}`);
    console.log(`Receipt Saved  : ${receiptPath}`);
  }
}

HANDLERS["toolchain:hypergraph:assert"] = cmd_hypergraph_assert;
HANDLERS["toolchain:hypergraph:query"] = cmd_hypergraph_query;
HANDLERS["toolchain:hypergraph:traverse"] = cmd_hypergraph_traverse;
HANDLERS["toolchain:hypergraph:resolve"] = cmd_hypergraph_resolve;
HANDLERS["toolchain:hypergraph:audit"] = cmd_hypergraph_audit;

export async function handleOntologicalHypergraphCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:hypergraph command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
