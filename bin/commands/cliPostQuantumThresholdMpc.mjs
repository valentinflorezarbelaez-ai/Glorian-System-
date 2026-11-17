/**
 * @file cliPostQuantumThresholdMpc.mjs
 * @description CLI handler for SPEC-335 / CHANGE-197: Threshold Secret Sharing &
 * Ring-LWE Homomorphic Secure Aggregation Engine (reference implementation).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosPostQuantumThresholdMpcCore, PQMPC_SECURITY_NOTICE } from "../../src/core/eosPostQuantumThresholdMpc.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/PQMPC_RECEIPT.json");

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

function parseIntFlag(args, prefix, defaultValue) {
  const value = Number(parseFlagValue(args, prefix, String(defaultValue)));
  return Number.isInteger(value) ? value : defaultValue;
}

function buildEngine(args) {
  const parties = parseIntFlag(args, "--parties=", 5);
  const threshold = parseIntFlag(args, "--threshold=", 3);
  const seed = parseFlagValue(args, "--seed=", undefined);
  return new EosPostQuantumThresholdMpcCore({ parties, threshold, seed });
}

/** BigInt-safe JSON output. */
function printJson(payload) {
  console.log(JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
}

const HANDLERS = {};

async function cmd_pqmpc_share(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const engine = buildEngine(args);
  const { parties, threshold } = engine.getParameters();
  const secret = BigInt(parseFlagValue(args, "--secret=", "424242"));

  const shares = engine.shamirSplit(secret);
  const reconstructed = engine.shamirReconstruct(shares.slice(0, threshold));
  const payload = {
    command: "toolchain:pqmpc:share",
    parties,
    threshold,
    shareCommitments: shares.map((s) => ({ x: s.x, commitment: s.commitment })),
    reconstructedMatches: reconstructed === secret,
    securityNotice: PQMPC_SECURITY_NOTICE,
  };

  if (isJson) {
    printJson(payload);
  } else {
    console.log("=== PQ-MPC: Shamir Threshold Secret Sharing ===");
    console.log(`Scheme          : ${threshold}-of-${parties} over F_(2^61-1)`);
    for (const s of payload.shareCommitments) console.log(` - x=${s.x} commitment=${s.commitment.slice(0, 16)}…`);
    console.log(`Reconstruction  : ${payload.reconstructedMatches ? "MATCH" : "MISMATCH"}`);
    console.log(`Notice          : ${PQMPC_SECURITY_NOTICE}`);
  }
}

async function cmd_pqmpc_keygen(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const engine = buildEngine(args);
  const params = engine.getParameters();
  const keys = engine.generateThresholdKeys();

  const payload = {
    command: "toolchain:pqmpc:keygen",
    ringDegree: params.ringDegree,
    ciphertextModulus: params.ciphertextModulus,
    plaintextModulus: params.plaintextModulus,
    parties: params.parties,
    threshold: params.threshold,
    publishedCommitments: keys.publishedCommitments,
    securityNotice: PQMPC_SECURITY_NOTICE,
  };

  if (isJson) {
    printJson(payload);
  } else {
    console.log("=== PQ-MPC: Ring-LWE Threshold Key Generation (trusted dealer) ===");
    console.log(`Ring            : Z_q[x]/(x^${params.ringDegree} + 1), q = 2^61 - 1`);
    console.log(`Plaintext mod t : ${params.plaintextModulus}`);
    console.log(`Custodians      : ${params.threshold}-of-${params.parties}`);
    for (const [id, c] of Object.entries(keys.publishedCommitments)) console.log(` - ${id}: ${c.slice(0, 16)}…`);
    console.log(`Notice          : ${PQMPC_SECURITY_NOTICE}`);
  }
}

async function cmd_pqmpc_aggregate(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const engine = buildEngine(args);
  const { threshold, parties } = engine.getParameters();
  const contributors = parseIntFlag(args, "--contributors=", 4);
  const keys = engine.generateThresholdKeys();

  const inputs = Array.from({ length: Math.max(1, contributors) }, (_v, i) => [i + 1, (i + 1) * 10, 7]);
  const custodians = keys.keyShares.slice(0, threshold).map((ks) => ks.partyId);
  const result = engine.secureAggregate(keys, inputs, custodians);

  const payload = {
    command: "toolchain:pqmpc:aggregate",
    contributors: result.contributors,
    decryptingParties: result.decryptingParties,
    parties,
    aggregateSum: result.sum,
    aggregateDigest: result.aggregateDigest,
    securityNotice: PQMPC_SECURITY_NOTICE,
  };

  if (isJson) {
    printJson(payload);
  } else {
    console.log("=== PQ-MPC: Homomorphic Secure Aggregation ===");
    console.log(`Contributors    : ${result.contributors}`);
    console.log(`Decrypted by    : ${result.decryptingParties.join(", ")}`);
    console.log(`Aggregate sum   : [${result.sum.join(", ")}]`);
    console.log(`Aggregate digest: ${result.aggregateDigest}`);
  }
}

async function cmd_pqmpc_threshold(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const engine = buildEngine(args);
  const { threshold, parties } = engine.getParameters();
  const keys = engine.generateThresholdKeys();
  const ct = engine.aggregateCiphertexts([
    engine.encryptVector(keys.publicKey, [11, 22]),
    engine.encryptVector(keys.publicKey, [33, 44]),
  ]);

  const all = keys.keyShares.map((ks) => engine.partialDecrypt(ct, ks));
  const first = engine.combinePartialDecryptions(ct, all.slice(0, threshold));
  const last = engine.combinePartialDecryptions(ct, all.slice(-threshold));
  let belowThreshold = "NOT_REJECTED";
  try {
    engine.combinePartialDecryptions(ct, all.slice(0, threshold - 1));
  } catch (err) {
    belowThreshold = err.code ?? "ERROR";
  }

  const payload = {
    command: "toolchain:pqmpc:threshold",
    parties,
    threshold,
    firstQuorumResult: first,
    lastQuorumResult: last,
    quorumsAgree: first.every((v, i) => v === last[i]),
    belowThresholdOutcome: belowThreshold,
  };

  if (isJson) {
    printJson(payload);
  } else {
    console.log("=== PQ-MPC: Threshold Decryption & Dropout Tolerance ===");
    console.log(`First ${threshold} custodians : [${first.join(", ")}]`);
    console.log(`Last ${threshold} custodians  : [${last.join(", ")}]`);
    console.log(`Quorums agree        : ${payload.quorumsAgree}`);
    console.log(`${threshold - 1} custodians        : ${belowThreshold}`);
  }
}

async function cmd_pqmpc_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const engine = buildEngine(args.some((a) => a.startsWith("--seed=")) ? args : [...args, "--seed=pqmpc-audit"]);
  const receipt = engine.audit();

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    printJson(receipt);
  } else {
    console.log("=== PQ-MPC: Audit Receipt ===");
    console.log(`Shamir round trip      : ${receipt.shamirRoundTrip}`);
    console.log(`Below-threshold reject : ${receipt.belowThresholdRejected}`);
    console.log(`Tamper detection       : ${receipt.tamperDetected}`);
    console.log(`Randomized encryption  : ${receipt.encryptionRandomized}`);
    console.log(`Homomorphic aggregation: ${receipt.homomorphicAggregation}`);
    console.log(`Threshold decryption   : ${receipt.thresholdDecryption}`);
    console.log(`All passed             : ${receipt.allPassed}`);
    console.log(`SHA-256 digest         : ${receipt.sha256Digest}`);
    console.log(`Notice                 : ${receipt.securityNotice}`);
    console.log(`Receipt saved          : ${RECEIPT_PATH}`);
  }
}

HANDLERS["toolchain:pqmpc:share"] = cmd_pqmpc_share;
HANDLERS["toolchain:pqmpc:keygen"] = cmd_pqmpc_keygen;
HANDLERS["toolchain:pqmpc:aggregate"] = cmd_pqmpc_aggregate;
HANDLERS["toolchain:pqmpc:threshold"] = cmd_pqmpc_threshold;
HANDLERS["toolchain:pqmpc:audit"] = cmd_pqmpc_audit;

export async function handlePostQuantumThresholdMpcCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:pqmpc command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
