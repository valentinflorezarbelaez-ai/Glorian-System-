import { EosMerklePatriciaTrieCore } from "../../src/core/eosMerklePatriciaTrieCore.ts";

const HANDLERS = {};

async function cmd_trie_demo(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");

  const trie = new EosMerklePatriciaTrieCore();

  // Insert state keys with shared prefixes
  const entries = [
    { key: "dog", value: "puppy" },
    { key: "doge", value: "coin" },
    { key: "dove", value: "peace" },
    { key: "door", value: "wood" },
  ];

  for (const { key, value } of entries) {
    trie.put(key, value);
  }

  const rootHash = trie.getRootHash();
  const proof = trie.prove("doge");
  const verifiedVal = EosMerklePatriciaTrieCore.verifyProof(rootHash, "doge", proof.proofNodesHex);

  const report = {
    rootHash,
    keyCount: trie.stats().keyCount,
    testedKey: "doge",
    expectedValue: "coin",
    recoveredValue: verifiedVal ? verifiedVal.toString("utf8") : null,
    proofNodesCount: proof.proofNodesHex.length,
    valid: verifiedVal ? verifiedVal.toString("utf8") === "coin" : false,
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN MODIFIED MERKLE PATRICIA TRIE (SPEC-229)`);
  console.log(`===============================================================`);
  console.log(`  Trie Key Count         : ${report.keyCount}`);
  console.log(`  Root Hash (SHA-256)    : sha256:${report.rootHash}`);
  console.log(`  Target Key Tested      : "${report.testedKey}"`);
  console.log(`  Expected Value         : "${report.expectedValue}"`);
  console.log(`  Recovered Value        : "${report.recoveredValue}"`);
  console.log(`  Proof Nodes Length     : ${report.proofNodesCount} node(s)`);
  console.log(`  Verification Verdict   : ${report.valid ? "PASS (CRYPTOGRAPHICALLY VERIFIED)" : "FAIL"}`);
  console.log(`===============================================================\n`);
}

async function cmd_trie_prove(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const targetKey = args.find((a) => !a.startsWith("-")) || "glorian:state:sovereignty";

  const trie = new EosMerklePatriciaTrieCore();
  trie.put(targetKey, "verified-sovereign-payload");
  trie.put("glorian:state:other", "other-data");

  const proof = trie.prove(targetKey);

  if (isJson) {
    console.log(JSON.stringify(proof, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN MPT CRYPTOGRAPHIC PROOF GENERATION (SPEC-229)`);
  console.log(`===============================================================`);
  console.log(`  Target Key             : "${targetKey}"`);
  console.log(`  Root Hash              : sha256:${proof.rootHashHex}`);
  console.log(`  Inclusion Status       : ${proof.inclusion ? "INCLUDED" : "EXCLUDED"}`);
  console.log(`  Proof Nodes Count      : ${proof.proofNodesHex.length}`);
  console.log(`===============================================================\n`);
}

async function cmd_trie_verify(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const targetKey = args.find((a) => !a.startsWith("-")) || "glorian:test:key";

  const trie = new EosMerklePatriciaTrieCore();
  trie.put(targetKey, "state-attestation");

  const rootHash = trie.getRootHash();
  const proof = trie.prove(targetKey);
  const result = EosMerklePatriciaTrieCore.verifyProof(rootHash, targetKey, proof.proofNodesHex);

  const report = {
    key: targetKey,
    rootHash,
    valid: result !== null,
    value: result ? result.toString("utf8") : null,
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN MPT PROOF VERIFICATION (SPEC-229)`);
  console.log(`===============================================================`);
  console.log(`  Key                    : "${targetKey}"`);
  console.log(`  Root Hash              : sha256:${rootHash}`);
  console.log(`  Verification Verdict   : ${report.valid ? "PASS (VALID)" : "FAIL (INVALID)"}`);
  console.log(`  Recovered Value        : "${report.value}"`);
  console.log(`===============================================================\n`);
}

HANDLERS["trie:demo"] = cmd_trie_demo;
HANDLERS["trie:prove"] = cmd_trie_prove;
HANDLERS["trie:verify"] = cmd_trie_verify;

export async function handleTrieCommands(command, commandContext) {
  const handler = HANDLERS[command];
  if (!handler) return false;
  await handler(commandContext);
  return true;
}
