import { EosCrdtStateSyncCore } from "../../src/core/eosCrdtStateSyncCore.ts";

const HANDLERS = {};

async function cmd_crdt_sync_158(commandContext) {
  const { command, args } = commandContext;
  const isJson = args.includes("--json");
  const nodeArg = args.find((a) => a.startsWith("--node="));
  const nodeId = nodeArg ? nodeArg.split("=")[1] : "node-alpha";

  if (command === "crdt:mutate") {
    const node = new EosCrdtStateSyncCore(nodeId);
    node.setRegister("cluster_status", "ACTIVE_LEADER");
    node.addToSet("authorized_peers", "peer-101");
    node.addToSet("authorized_peers", "peer-102");
    node.insertSequence("document", "H");
    node.insertSequence("document", "E");
    node.insertSequence("document", "X");
    const snapshot = node.exportSnapshot();

    if (isJson) {
      console.log(JSON.stringify(snapshot, null, 2));
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN LAYER-0 CRDT STATE MUTATION (SPEC-215)`);
    console.log(`===============================================================`);
    console.log(`  Node ID              : ${snapshot.nodeId}`);
    console.log(`  Vector Clock         : ${JSON.stringify(snapshot.vectorClock)}`);
    console.log(`  LWW Register         : cluster_status = "${node.getRegister("cluster_status")}"`);
    console.log(`  ORSet (peers)        : [${node.readSet("authorized_peers").join(", ")}]`);
    console.log(`  RGA Sequence (doc)   : "${node.readSequence("document").join("")}"`);
    console.log(`  State SHA-256        : sha256:${snapshot.stateHashSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "crdt:delta") {
    const nodeA = new EosCrdtStateSyncCore("node-A");
    const nodeB = new EosCrdtStateSyncCore("node-B");

    nodeA.setRegister("keyA", "valA");
    nodeA.addToSet("items", "item-1");
    const deltaForB = nodeA.getDelta(nodeB.vectorClock);
    const mergeResult = nodeB.mergeDelta(deltaForB);

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            sourceNode: deltaForB.sourceNodeId,
            deltaClock: deltaForB.vectorClock,
            deltaRegisters: Object.keys(deltaForB.registers),
            deltaSets: Object.keys(deltaForB.sets),
            convergedStateHash: mergeResult.stateHashSha256,
            receipt: mergeResult.receipt,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN LAYER-0 CRDT DELTA-STATE SYNCHRONIZATION (SPEC-215)`);
    console.log(`===============================================================`);
    console.log(`  Source Replica       : ${deltaForB.sourceNodeId}`);
    console.log(`  Delta Clock          : ${JSON.stringify(deltaForB.vectorClock)}`);
    console.log(`  Target Converged     : sha256:${mergeResult.stateHashSha256}`);
    console.log(`  Receipt SHA-256      : sha256:${mergeResult.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  // Default: crdt:merge
  const replica1 = new EosCrdtStateSyncCore("replica-1");
  const replica2 = new EosCrdtStateSyncCore("replica-2");

  // Concurrent mutations
  replica1.setRegister("title", "Replica 1 Title");
  replica1.addToSet("tags", "sovereign");
  replica1.insertSequence("log", "A");

  replica2.setRegister("title", "Replica 2 Title");
  replica2.addToSet("tags", "autonomous");
  replica2.insertSequence("log", "B");

  // Bidirectional semilattice merge
  const res1 = replica1.mergeSnapshot(replica2.exportSnapshot());
  const res2 = replica2.mergeSnapshot(replica1.exportSnapshot());
  const strongConsistency = res1.stateHashSha256 === res2.stateHashSha256;

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          strongConsistency,
          convergedHash: res1.stateHashSha256,
          vectorClock: res1.vectorClock,
          title: replica1.getRegister("title"),
          tags: replica1.readSet("tags"),
          log: replica1.readSequence("log"),
          receipt: res1.receipt,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN LAYER-0 CRDT SEMILATTICE CONVERGENCE (SPEC-215)`);
  console.log(`===============================================================`);
  console.log(`  Consistency Verdict  : ${strongConsistency ? "STRONG EVENTUAL CONSISTENCY (SEC)" : "DIVERGED"}`);
  console.log(`  Converged Hash       : sha256:${res1.stateHashSha256}`);
  console.log(`  Converged Registers  : title = "${replica1.getRegister("title")}"`);
  console.log(`  Converged ORSet      : [${replica1.readSet("tags").join(", ")}]`);
  console.log(`  Converged RGA        : [${replica1.readSequence("log").join(", ")}]`);
  console.log(`  Receipt SHA-256      : sha256:${res1.receipt.receiptSha256}`);
  console.log(`===============================================================\n`);
}

HANDLERS["crdt:mutate"] = cmd_crdt_sync_158;
HANDLERS["crdt:merge"] = cmd_crdt_sync_158;
HANDLERS["crdt:delta"] = cmd_crdt_sync_158;

export async function handleCrdtCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
