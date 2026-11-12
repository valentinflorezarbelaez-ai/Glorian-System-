import { EosTimeLockPuzzleCore, SLOTH_SECP256K1_PRIME } from "../../src/core/eosTimeLockPuzzleCore.ts";

const HANDLERS = {};

async function cmd_timelock_demo(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");

  const secretMsg = "Sovereign Glorian Sealed Attestation (Release at Epoch 2027)";
  const difficultyT = 2000;
  const checkpointInterval = 500;

  // 1. Create RSW96 puzzle with trapdoor in < 5ms
  const createStart = Date.now();
  const puzzle = EosTimeLockPuzzleCore.createPuzzle(secretMsg, difficultyT, undefined, 2n, checkpointInterval);
  const createElapsedMs = Date.now() - createStart;

  // 2. Solve puzzle via sequential squarings
  const solveResult = EosTimeLockPuzzleCore.solvePuzzle(puzzle);

  // 3. Verify checkpoint transition
  let checkpointValid = false;
  if (solveResult.checkpointsHex && solveResult.checkpointsHex.length >= 2) {
    const segmentCheck = EosTimeLockPuzzleCore.verifyCheckpointSegment(
      puzzle.modulusHex,
      solveResult.checkpointsHex[0],
      solveResult.checkpointsHex[1],
      checkpointInterval,
      0,
    );
    checkpointValid = segmentCheck.valid;
  }

  // 4. Test Sloth VDF
  const slothIterations = 50;
  const slothPuzzle = EosTimeLockPuzzleCore.createSlothPuzzle("Sloth-Protected-Payload", slothIterations);
  const slothSolution = EosTimeLockPuzzleCore.solveSlothPuzzle(slothPuzzle);
  const slothVerified = EosTimeLockPuzzleCore.verifySloth(
    slothPuzzle.primeHex,
    slothPuzzle.inputHex,
    slothSolution.outputHex,
    slothIterations,
  );

  const report = {
    rsw96: {
      difficultyT,
      createElapsedMs,
      solveElapsedMs: solveResult.elapsedMs,
      secretMessage: secretMsg,
      decryptedMessage: solveResult.plaintext,
      matches: solveResult.plaintext === secretMsg,
      checkpointsCount: solveResult.checkpointsHex?.length || 0,
      checkpointValid,
    },
    sloth: {
      iterations: slothIterations,
      verified: slothVerified,
      decryptedPayload: slothSolution.plaintext,
    },
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN CRYPTOGRAPHIC TIME-LOCK PUZZLE ENGINE (SPEC-230)`);
  console.log(`===============================================================`);
  console.log(`  Algorithm              : Rivest-Shamir-Wagner (RSW96) + Sloth VDF`);
  console.log(`  Difficulty (T)         : ${difficultyT} sequential squarings`);
  console.log(`  Trapdoor Creation Time : ${createElapsedMs} ms (O(log T) exponentiation)`);
  console.log(`  Sequential Solve Time  : ${solveResult.elapsedMs} ms`);
  console.log(`  Original Secret        : "${secretMsg}"`);
  console.log(`  Decrypted Plaintext    : "${solveResult.plaintext}"`);
  console.log(`  Integrity Verdict      : ${report.rsw96.matches ? "PASS (AUTHENTICATED)" : "FAIL"}`);
  console.log(`  Checkpoints Recorded   : ${report.rsw96.checkpointsCount}`);
  console.log(`  Checkpoint Valid       : ${checkpointValid ? "YES" : "NO"}`);
  console.log(`---------------------------------------------------------------`);
  console.log(`  Sloth Prime Permutation:`);
  console.log(`    Prime Modulus        : SECP256K1 (${SLOTH_SECP256K1_PRIME.toString(16).slice(0, 32)}...)`);
  console.log(`    Square Root Steps    : ${slothIterations}`);
  console.log(`    O(log T) Verification: ${slothVerified ? "PASS (EXACT MATCH)" : "FAIL"}`);
  console.log(`===============================================================\n`);
}

async function cmd_timelock_create(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const msg = args.find((a) => !a.startsWith("-")) || "Sovereign Encrypted Secret";
  const difficultyT = 5000;

  const puzzle = EosTimeLockPuzzleCore.createPuzzle(msg, difficultyT);

  if (isJson) {
    console.log(JSON.stringify(puzzle, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN TIME-LOCK PUZZLE CREATED (SPEC-230)`);
  console.log(`===============================================================`);
  console.log(`  Difficulty (T)         : ${puzzle.difficultyT} squarings`);
  console.log(`  Modulus Bits           : ${BigInt("0x" + puzzle.modulusHex).toString(2).length} bits`);
  console.log(`  Ciphertext Bytes       : ${puzzle.ciphertextHex.length / 2} bytes`);
  console.log(`  AES-GCM Auth Tag       : ${puzzle.authTagHex}`);
  console.log(`===============================================================\n`);
}

async function cmd_timelock_solve(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const msg = "Glorian-CLI-Test-Secret";
  const difficultyT = 1000;

  const puzzle = EosTimeLockPuzzleCore.createPuzzle(msg, difficultyT);
  const solution = EosTimeLockPuzzleCore.solvePuzzle(puzzle);

  const report = {
    plaintext: solution.plaintext,
    difficultyT,
    elapsedMs: solution.elapsedMs,
    keyHex: solution.keyHex,
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN TIME-LOCK PUZZLE SOLVED (SPEC-230)`);
  console.log(`===============================================================`);
  console.log(`  Recovered Plaintext    : "${solution.plaintext}"`);
  console.log(`  Squarings Evaluated    : ${solution.squaringsPerformed}`);
  console.log(`  Solve Duration         : ${solution.elapsedMs} ms`);
  console.log(`  Derived Key            : ${solution.keyHex}`);
  console.log(`===============================================================\n`);
}

HANDLERS["timelock:demo"] = cmd_timelock_demo;
HANDLERS["timelock:create"] = cmd_timelock_create;
HANDLERS["timelock:solve"] = cmd_timelock_solve;

export async function handleTimeLockCommands(command, commandContext) {
  const handler = HANDLERS[command];
  if (!handler) return false;
  await handler(commandContext);
  return true;
}
