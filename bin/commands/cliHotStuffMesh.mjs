import { EosHotStuffConsensusEngine } from "../../src/core/eosHotStuffConsensusEngine.ts";

const DEFAULT_NODES = ["node-1", "node-2", "node-3", "node-4"];
const activeEngines = new Map();

function getOrCreateEngine(nodeId = "node-1", cluster = DEFAULT_NODES) {
  let eng = activeEngines.get(nodeId);
  if (!eng) {
    eng = new EosHotStuffConsensusEngine(nodeId, cluster);
    activeEngines.set(nodeId, eng);
  }
  return eng;
}

const HANDLERS = {};

async function cmd_hotstuff_mesh_166(commandContext) {
  const { command, args } = commandContext;
  const isJson = args.includes("--json");

  const nodeArg = args.find((a) => a.startsWith("--node="));
  const clusterArg = args.find((a) => a.startsWith("--cluster="));
  const payloadArg = args.find((a) => a.startsWith("--payload="));

  const nodeId = nodeArg ? nodeArg.split("=")[1] : "node-1";
  const cluster = clusterArg ? clusterArg.split("=")[1].split(",") : DEFAULT_NODES;

  const engine = getOrCreateEngine(nodeId, cluster);

  if (command === "hotstuff:propose") {
    const payload = payloadArg ? payloadArg.split("=")[1] : { action: "sync_state", ts: Date.now() };
    const block = engine.createProposal(payload);

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            algorithm: "HotStuff Pipelined BFT",
            nodeId: engine.nodeId,
            currentView: engine.currentView,
            isLeader: engine.isLeader(),
            blockHash: block.hash,
            parentHash: block.parentHash,
            proposer: block.proposer,
            justifyQcHash: block.justify.qcHash,
            justifyView: block.justify.view,
            timestamp: block.timestamp,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN HOTSTUFF PIPELINED BFT PROPOSAL (SPEC-223)`);
    console.log(`===============================================================`);
    console.log(`  Proposer Node        : ${block.proposer} (Leader: ${engine.isLeader() ? "YES" : "NO"})`);
    console.log(`  View Number          : ${block.view}`);
    console.log(`  Block Hash           : ${block.hash}`);
    console.log(`  Parent Hash          : ${block.parentHash}`);
    console.log(`  Justify QC View      : ${block.justify.view} (${block.justify.qcHash.slice(0, 24)}...)`);
    console.log(`  Timestamp            : ${block.timestamp}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "hotstuff:vote") {
    const proposal = engine.createProposal({ tx: "cli-tx", time: Date.now() });
    const vote = engine.vote(proposal);

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            algorithm: "HotStuff Pipelined BFT",
            voter: vote ? vote.voter : null,
            view: vote ? vote.view : null,
            blockHash: vote ? vote.blockHash : null,
            phase: vote ? vote.phase : null,
            signature: vote ? vote.signature : null,
            accepted: vote !== null,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN HOTSTUFF VOTE EMITTED (SPEC-223)`);
    console.log(`===============================================================`);
    console.log(`  Voter Node           : ${vote ? vote.voter : "REJECTED"}`);
    console.log(`  Voted View           : ${vote ? vote.view : "N/A"}`);
    console.log(`  Target Block Hash    : ${vote ? vote.blockHash : "N/A"}`);
    console.log(`  Phase                : ${vote ? vote.phase : "N/A"}`);
    console.log(`  Signature Digest     : ${vote ? vote.signature : "N/A"}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "hotstuff:status") {
    const status = engine.getStatus();

    if (isJson) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN HOTSTUFF CONSENSUS ENGINE STATUS (SPEC-223)`);
    console.log(`===============================================================`);
    console.log(`  Node ID              : ${status.nodeId}`);
    console.log(`  Current View         : ${status.currentView}`);
    console.log(`  Designated Leader    : ${status.currentLeader}`);
    console.log(`  High QC View         : ${status.highQC.view} (${status.highQC.qcHash.slice(0, 24)}...)`);
    console.log(`  Locked QC View       : ${status.lockedQC.view} (${status.lockedQC.qcHash.slice(0, 24)}...)`);
    console.log(`  Committed Blocks     : ${status.committedCount}`);
    console.log(`  Cluster Size (n)     : ${status.clusterNodes.length} nodes (Quorum: ${status.quorumSize})`);
    console.log(`  Receipt SHA-256      : sha256:${status.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }
}

HANDLERS["hotstuff:propose"] = cmd_hotstuff_mesh_166;
HANDLERS["hotstuff:vote"] = cmd_hotstuff_mesh_166;
HANDLERS["hotstuff:status"] = cmd_hotstuff_mesh_166;

export async function handleHotStuffCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
