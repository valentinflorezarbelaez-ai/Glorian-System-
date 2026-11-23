/**
 * CLI Byzantine Quorum Attestation & Cross-Fleet Deterministic Snapshot Handlers
 *
 * Implements toolchain:quorum:* subcommands for epoch snapshot proposal,
 * supermajority (2f + 1) Quorum Certificate attestation, double-signing
 * equivocation slashing, and cryptographic audit receipt emission.
 *
 * Conforms to SPEC-379 / CHANGE-241.
 */

import { EosByzantineQuorumGovernorCore } from "../../src/core/eosByzantineQuorumGovernor.ts";
import { pureSha256 } from "../../src/core/eosKernelPrimitives.ts";

const HANDLERS = {};

async function cmd_quorum_propose(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const governor = new EosByzantineQuorumGovernorCore();
  const geometry = governor.getGeometry();
  const proposal = governor.proposeEpochSnapshot({
    epochHeight: 1,
    fleetMerkleRoot: pureSha256("FLEET_MERKLE_ROOT_EPOCH_1"),
    crdtConvergenceHash: pureSha256("CRDT_CONVERGENCE_EPOCH_1"),
    proposerId: "validator-eos-system",
  });

  if (isJson) {
    console.log(JSON.stringify({ geometry, proposal }, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN BYZANTINE QUORUM PROPOSAL (SPEC-379)                 `);
  console.log(`===============================================================`);
  console.log(`  Total Validators  : ${geometry.totalValidators}`);
  console.log(`  Max Faults (f)    : ${geometry.maxByzantineFaults}`);
  console.log(`  Quorum Threshold  : ${geometry.supermajorityQuorum} (2f + 1)`);
  console.log(`  Proposal ID       : ${proposal.proposalId.slice(0, 24)}...`);
  console.log(`  Epoch Height      : ${proposal.epochHeight}`);
  console.log(`===============================================================\n`);
}

async function cmd_quorum_attest(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const validators = [
    "validator-aberamentho",
    "validator-atp-strength",
    "validator-biblioteca-gnostica",
    "validator-abopack",
    "validator-crud-slack",
    "validator-donaciones",
    "validator-eos-system",
  ];
  const governor = new EosByzantineQuorumGovernorCore(validators);
  const fleetMerkleRoot = pureSha256("FLEET_MERKLE_ROOT_EPOCH_1");
  const crdtConvergenceHash = pureSha256("CRDT_CONVERGENCE_EPOCH_1");

  const proposal = governor.proposeEpochSnapshot({
    epochHeight: 1,
    fleetMerkleRoot,
    crdtConvergenceHash,
  });

  let outcome = null;
  for (let i = 0; i < 5; i++) {
    const vote = governor.signVote({
      validatorId: validators[i],
      epochHeight: 1,
      proposalId: proposal.proposalId,
      stateRootHash: fleetMerkleRoot,
      crdtConvergenceHash,
    });
    outcome = governor.submitVote(vote);
  }

  if (isJson) {
    console.log(JSON.stringify(outcome, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN QUORUM CERTIFICATE ATTESTATION (SPEC-379)            `);
  console.log(`===============================================================`);
  console.log(`  Quorum Reached    : ${outcome?.quorumReached}`);
  console.log(`  Certificate Status: ${outcome?.certificate?.status}`);
  console.log(`  Valid Votes       : ${outcome?.certificate?.validVotesCount}`);
  console.log(`  Voter Bitmask     : ${outcome?.certificate?.bitmaskResult.bitmaskHex}`);
  console.log(`  Hamming Popcount  : ${outcome?.certificate?.bitmaskResult.popcountHammingWeight}`);
  console.log(`===============================================================\n`);
}

async function cmd_quorum_slash(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const governor = new EosByzantineQuorumGovernorCore();
  const rootA = pureSha256("HONEST_MERKLE_ROOT_A");
  const rootB = pureSha256("CONFLICTING_BYZANTINE_ROOT_B");
  const crdtHash = pureSha256("CRDT_CONVERGENCE_EPOCH_2");

  const proposal = governor.proposeEpochSnapshot({
    epochHeight: 2,
    fleetMerkleRoot: rootA,
    crdtConvergenceHash: crdtHash,
  });

  const voteA = governor.signVote({
    validatorId: "validator-donaciones",
    epochHeight: 2,
    proposalId: proposal.proposalId,
    stateRootHash: rootA,
    crdtConvergenceHash: crdtHash,
  });
  const voteB = governor.signVote({
    validatorId: "validator-donaciones",
    epochHeight: 2,
    proposalId: proposal.proposalId,
    stateRootHash: rootB,
    crdtConvergenceHash: crdtHash,
  });

  governor.submitVote(voteA);
  const slashResult = governor.submitVote(voteB);

  if (isJson) {
    console.log(JSON.stringify(slashResult, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN BYZANTINE EQUIVOCATION SLASHER (SPEC-379)            `);
  console.log(`===============================================================`);
  console.log(`  Equivocation Found: ${slashResult.equivocationDetected}`);
  console.log(`  Slashed Validator : ${slashResult.slashProof?.validatorId}`);
  console.log(`  Slash Proof ID    : ${slashResult.slashProof?.slashProofId}`);
  console.log(`  Evidence SHA-256  : ${slashResult.slashProof?.sha256Evidence.slice(0, 32)}...`);
  console.log(`===============================================================\n`);
}

async function cmd_quorum_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = EosByzantineQuorumGovernorCore.auditByzantineQuorumPipeline({
    projectRoot: commandContext.root || process.cwd(),
  });

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN BYZANTINE QUORUM AUDIT RECEIPT (SPEC-379)            `);
  console.log(`===============================================================`);
  console.log(`  Spec Reference    : ${receipt.specRef}`);
  console.log(`  Change Reference  : ${receipt.changeRef}`);
  console.log(`  Status            : ${receipt.status}`);
  console.log(`  Fleet Projects    : ${receipt.fleetProjectsSnapshotCount}`);
  console.log(
    `  Quorum Threshold  : ${receipt.geometryVerified.supermajorityQuorum}/${receipt.geometryVerified.totalValidators}`,
  );
  console.log(`  Quorum Committed  : ${receipt.quorumCommitted ? "VERIFIED" : "FAILED"}`);
  console.log(`  Slashed Actors    : ${receipt.equivocationSlashedCount}`);
  console.log(`  SHA-256 Signature : ${receipt.sha256Signature.slice(0, 32)}...`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:quorum:propose"] = cmd_quorum_propose;
HANDLERS["toolchain:quorum:attest"] = cmd_quorum_attest;
HANDLERS["toolchain:quorum:slash"] = cmd_quorum_slash;
HANDLERS["toolchain:quorum:audit"] = cmd_quorum_audit;

export async function handleQuorumCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    return false;
  }
  await handler(commandContext);
  return true;
}
