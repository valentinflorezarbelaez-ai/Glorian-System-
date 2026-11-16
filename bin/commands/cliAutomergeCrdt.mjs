/**
 * CLI Conflict-Free P2P Mesh Synchronization with Automerge Wasm Handlers
 *
 * Implements toolchain:crdt:* subcommands for decentralized state replication,
 * deterministic tie-breaking, DTN offline buffering, and audit receipts.
 *
 * Conforms to SPEC-300 / CHANGE-162.
 */

import { CrdtDocument, auditCrdtMeshPipeline } from "../../src/core/eosAutomergeCrdtMesh.ts";

const HANDLERS = {};
const globalDoc = new CrdtDocument("doc-fleet-main", "peer-cli");

// Seed initial state
globalDoc.set("system", "Glorian System Sovereign Control Plane");
globalDoc.set("epoch", 1);

async function cmd_crdt_state(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const keyArg = args.find((a) => a.startsWith("--key="))?.split("=")[1];
  const valArg = args.find((a) => a.startsWith("--val="))?.split("=")[1];

  if (keyArg && valArg !== undefined) {
    globalDoc.set(keyArg, valArg);
  }

  const state = globalDoc.getState();

  if (isJson) {
    console.log(JSON.stringify(state, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🧬  EOS AUTOMERGE CRDT DOCUMENT STATE (SPEC-300)              ");
  console.log("===============================================================");
  console.log(`  Document ID         : ${state.docId}`);
  console.log(`  Local Actor ID      : ${state.actorId}`);
  console.log(`  Lamport Clock       : ${state.lamport}`);
  console.log(`  Active Heads (DAG)  : ${state.heads.length} head(s)`);
  for (const h of state.heads) {
    console.log(`    ↳ ${h.slice(0, 16)}...`);
  }
  console.log("---------------------------------------------------------------");
  console.log("  DOCUMENT PROPERTIES:");
  for (const [k, v] of Object.entries(state.data)) {
    console.log(`    - ${k.padEnd(20)} : ${JSON.stringify(v)}`);
  }
  console.log("===============================================================\n");
}

async function cmd_crdt_sync(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const remoteActor = args.find((a) => a.startsWith("--peer="))?.split("=")[1] || "peer-antigravity";

  const remoteDoc = new CrdtDocument("doc-fleet-main", remoteActor);
  remoteDoc.set("remoteCollaborator", remoteActor);
  remoteDoc.set("synchronizedAt", new Date().toISOString());

  const syncMsg = remoteDoc.generateSyncMessage(globalDoc.getHeads());
  const applied = globalDoc.receiveSyncMessage(syncMsg);

  const response = {
    docId: globalDoc.docId,
    syncedWithPeer: remoteActor,
    changesApplied: applied,
    currentHeads: globalDoc.getHeads(),
    convergedState: globalDoc.getState().data,
  };

  if (isJson) {
    console.log(JSON.stringify(response, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔄  EOS P2P CRDT DIFFERENTIAL SYNCHRONIZATION (SPEC-300)      ");
  console.log("===============================================================");
  console.log(`  Target Peer         : ${remoteActor}`);
  console.log(`  Changes Ingested    : ${applied}`);
  console.log(`  Current DAG Heads   : ${globalDoc.getHeads().length}`);
  console.log("---------------------------------------------------------------");
  console.log("  CONVERGED DOCUMENT STATE:");
  for (const [k, v] of Object.entries(globalDoc.getState().data)) {
    console.log(`    - ${k.padEnd(22)} : ${JSON.stringify(v)}`);
  }
  console.log("===============================================================\n");
}

async function cmd_crdt_merge(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const property = args.find((a) => a.startsWith("--key="))?.split("=")[1] || "title";
  const valA = args.find((a) => a.startsWith("--valA="))?.split("=")[1] || "Branch A Architecture";
  const valB = args.find((a) => a.startsWith("--valB="))?.split("=")[1] || "Branch B Architecture";

  const peerA = new CrdtDocument("doc-merge-test", "actor-alpha");
  const peerB = new CrdtDocument("doc-merge-test", "actor-beta");

  peerA.set(property, valA);
  peerB.set(property, valB);

  // Cross sync
  peerB.receiveSyncMessage(peerA.generateSyncMessage(peerB.getHeads()));
  peerA.receiveSyncMessage(peerB.generateSyncMessage(peerA.getHeads()));

  const convergedVal = peerA.get(property);
  const result = {
    property,
    candidateA: { actor: "actor-alpha", value: valA },
    candidateB: { actor: "actor-beta", value: valB },
    winnerValue: convergedVal,
    converged: peerA.get(property) === peerB.get(property),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" ⚖️  EOS CRDT DETERMINISTIC CONFLICT RESOLUTION (SPEC-300)      ");
  console.log("===============================================================");
  console.log(`  Conflict Property   : ${property}`);
  console.log(`  Candidate Alpha     : "${valA}"`);
  console.log(`  Candidate Beta      : "${valB}"`);
  console.log(`  Converged Winner    : "${convergedVal}"`);
  console.log(`  State Matched 100%  : ${result.converged}`);
  console.log("===============================================================\n");
}

async function cmd_crdt_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = await auditCrdtMeshPipeline();

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔒  EOS AUTOMERGE CRDT MESH AUDIT RECEIPT (SPEC-300)          ");
  console.log("===============================================================");
  console.log(`  Specification Ref   : ${receipt.specRef}`);
  console.log(`  Total Peers Tested  : ${receipt.totalPeersTested}`);
  console.log(`  Changes Applied     : ${receipt.changesApplied}`);
  console.log(`  Convergence Proven  : ${receipt.convergenceVerified}`);
  console.log(`  DTN Packets Sent    : ${receipt.dtnPacketsDelivered}`);
  console.log(`  SHA-256 Signature   : ${receipt.sha256Signature}`);
  console.log("===============================================================\n");
}

HANDLERS["toolchain:crdt:state"] = cmd_crdt_state;
HANDLERS["toolchain:crdt:sync"] = cmd_crdt_sync;
HANDLERS["toolchain:crdt:merge"] = cmd_crdt_merge;
HANDLERS["toolchain:crdt:audit"] = cmd_crdt_audit;

export async function handleCrdtCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    return false;
  }
  await handler(commandContext);
  return true;
}
