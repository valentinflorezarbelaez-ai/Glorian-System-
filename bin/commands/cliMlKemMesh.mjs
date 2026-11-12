import { EosPostQuantumMlKemCore } from "../../src/core/eosPostQuantumMlKemCore.ts";

const HANDLERS = {};

async function cmd_ml_kem_mesh_164(commandContext) {
  const { command, args } = commandContext;
  const isJson = args.includes("--json");

  const kem = new EosPostQuantumMlKemCore();

  if (command === "ml-kem:keygen") {
    const seedZArg = args.find((a) => a.startsWith("--seed-z="));
    const seedDArg = args.find((a) => a.startsWith("--seed-d="));

    const seedZ = seedZArg ? Buffer.from(seedZArg.split("=")[1], "hex") : undefined;
    const seedD = seedDArg ? Buffer.from(seedDArg.split("=")[1], "hex") : undefined;

    const kp = kem.generateKeyPair(seedZ, seedD);
    const ekHex = Buffer.from(kp.encapsulationKey).toString("hex");
    const dkHex = Buffer.from(kp.decapsulationKey).toString("hex");

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            algorithm: "ML-KEM-768",
            standard: "NIST FIPS 203",
            securityCategory: 3,
            encapsulationKeyHex: ekHex,
            encapsulationKeyBytes: kp.encapsulationKey.length,
            decapsulationKeyHex: dkHex,
            decapsulationKeyBytes: kp.decapsulationKey.length,
            receiptSha256: kp.receiptSha256,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN POST-QUANTUM ML-KEM-768 KEYGEN (SPEC-221 / FIPS 203)`);
    console.log(`===============================================================`);
    console.log(`  Standard             : NIST FIPS 203 (ML-KEM-768 / Category 3)`);
    console.log(`  Encapsulation Key (ek): ${ekHex.slice(0, 48)}... (${kp.encapsulationKey.length} bytes)`);
    console.log(`  Decapsulation Key (dk): ${dkHex.slice(0, 48)}... (${kp.decapsulationKey.length} bytes)`);
    console.log(`  Receipt SHA-256      : sha256:${kp.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "ml-kem:encaps") {
    const ekArg = args.find((a) => a.startsWith("--ek="));
    let ek;
    if (ekArg) {
      ek = Buffer.from(ekArg.split("=")[1], "hex");
    } else {
      const kp = kem.generateKeyPair();
      ek = kp.encapsulationKey;
    }

    const msgSeedArg = args.find((a) => a.startsWith("--msg-seed="));
    const msgSeed = msgSeedArg ? Buffer.from(msgSeedArg.split("=")[1], "hex") : undefined;

    const enc = kem.encapsulate(ek, msgSeed);
    const ssHex = Buffer.from(enc.sharedSecret).toString("hex");
    const ctHex = Buffer.from(enc.ciphertext).toString("hex");

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            algorithm: "ML-KEM-768",
            standard: "NIST FIPS 203",
            sharedSecretHex: ssHex,
            sharedSecretBytes: enc.sharedSecret.length,
            ciphertextHex: ctHex,
            ciphertextBytes: enc.ciphertext.length,
            receiptSha256: enc.receiptSha256,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN POST-QUANTUM ML-KEM-768 ENCAPSULATION (SPEC-221)`);
    console.log(`===============================================================`);
    console.log(`  Shared Secret (K)    : 0x${ssHex} (32 bytes / 256 bits)`);
    console.log(`  Ciphertext (c)       : ${ctHex.slice(0, 48)}... (${enc.ciphertext.length} bytes)`);
    console.log(`  Receipt SHA-256      : sha256:${enc.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "ml-kem:decaps") {
    const dkArg = args.find((a) => a.startsWith("--dk="));
    const ctArg = args.find((a) => a.startsWith("--ct="));

    let dk, ct;
    if (dkArg && ctArg) {
      dk = Buffer.from(dkArg.split("=")[1], "hex");
      ct = Buffer.from(ctArg.split("=")[1], "hex");
    } else {
      const kp = kem.generateKeyPair();
      const enc = kem.encapsulate(kp.encapsulationKey);
      dk = kp.decapsulationKey;
      ct = enc.ciphertext;
    }

    const dec = kem.decapsulate(dk, ct);
    const ssHex = Buffer.from(dec.sharedSecret).toString("hex");

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            algorithm: "ML-KEM-768",
            standard: "NIST FIPS 203",
            valid: dec.valid,
            sharedSecretHex: ssHex,
            sharedSecretBytes: dec.sharedSecret.length,
            receiptSha256: dec.receiptSha256,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN POST-QUANTUM ML-KEM-768 DECAPSULATION (SPEC-221)`);
    console.log(`===============================================================`);
    console.log(`  Ciphertext Valid     : ${dec.valid ? "YES (Authentic)" : "NO (Implicit Rejection)"}`);
    console.log(`  Recovered Secret (K) : 0x${ssHex} (32 bytes / 256 bits)`);
    console.log(`  Receipt SHA-256      : sha256:${dec.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "ml-kem:benchmark") {
    const iterArg = args.find((a) => a.startsWith("--iterations="));
    const iterations = iterArg ? parseInt(iterArg.split("=")[1], 10) : 20;

    const bench = kem.benchmark(iterations);
    if (isJson) {
      console.log(JSON.stringify(bench, null, 2));
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN POST-QUANTUM ML-KEM-768 BENCHMARK (SPEC-221)`);
    console.log(`===============================================================`);
    console.log(`  Iterations Evaluated : ${iterations}`);
    console.log(`  KeyGen Throughput    : ${bench.keyGenOpsPerSec} ops/sec`);
    console.log(`  Encaps Throughput    : ${bench.encapsOpsPerSec} ops/sec`);
    console.log(`  Decaps Throughput    : ${bench.decapsOpsPerSec} ops/sec`);
    console.log(`  Total Benchmark Time : ${bench.totalDurationMs.toFixed(2)} ms`);
    console.log(`  Receipt SHA-256      : sha256:${bench.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  console.error(`Unknown ML-KEM command: ${command}`);
}

HANDLERS["ml-kem:keygen"] = cmd_ml_kem_mesh_164;
HANDLERS["ml-kem:encaps"] = cmd_ml_kem_mesh_164;
HANDLERS["ml-kem:decaps"] = cmd_ml_kem_mesh_164;
HANDLERS["ml-kem:benchmark"] = cmd_ml_kem_mesh_164;

export async function handleMlKemCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}

export { HANDLERS };
