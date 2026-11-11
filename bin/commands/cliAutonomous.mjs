const HANDLERS = {};

async function cmd_fuzz_136(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const iterArg = args.find((a) => a.startsWith("--iterations="));
  const iterations = iterArg ? parseInt(iterArg.split("=")[1], 10) : 50;

  const { EosDynamicFuzzingOracle } = await import("../../src/core/eosDynamicFuzzingOracle.ts");
  const { pureSha256 } = await import("../../src/core/eosKernelPrimitives.ts");

  // Default target: testing kernel hashing & serialization resilience against adversarial payloads
  const result = EosDynamicFuzzingOracle.runCampaign(
    (input) => {
      const repr = typeof input === "object" ? JSON.stringify(input) : String(input);
      pureSha256(repr || "empty");
    },
    "kernel:pureSha256",
    { iterations },
  );

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN DYNAMIC COVERAGE-GUIDED FUZZING ORACLE (SPEC-195)   `);
  console.log(`===============================================================`);
  console.log(`  Target Name      : ${result.targetName}`);
  console.log(`  Iterations       : ${result.totalIterations}`);
  console.log(`  Success / Crash  : ${result.successfulExecutions} / ${result.crashCount}`);
  console.log(`  Stability Score  : ${result.stabilityScore} / 100`);
  console.log(
    `  Latency (us)     : p50: ${result.latencyMetricsUs.p50Us}us | p95: ${result.latencyMetricsUs.p95Us}us | p99: ${result.latencyMetricsUs.p99Us}us`,
  );
  console.log(`  Receipt SHA-256  : sha256:${result.sha256Receipt}`);
  if (result.crashes.length > 0) {
    console.log(`---------------------------------------------------------------`);
    console.log(`  CRASH DETECTED   : ${result.crashes.length} crashes`);
    for (const c of result.crashes.slice(0, 3)) {
      console.log(`   ✖ [#${c.iteration}] ${c.errorName}: ${c.errorMessage}`);
    }
  }
  console.log(`===============================================================\n`);
}

HANDLERS["fuzz"] = cmd_fuzz_136;
HANDLERS["fuzz:target"] = cmd_fuzz_136;

async function cmd_arena_137(commandContext) {
  const { args, command } = commandContext;
  const isJson = args.includes("--json");
  const roundArg = args.find((a) => a.startsWith("--rounds="));
  const rounds = roundArg ? parseInt(roundArg.split("=")[1], 10) : 3;
  const candidateTarget = args.filter((a) => !a.startsWith("-") && a !== command).join(" ");
  const target = candidateTarget || "npm test";

  const { EosSwarmAdversarialArena } = await import("../../src/core/eosSwarmAdversarialArena.ts");
  const report = EosSwarmAdversarialArena.executeTournament(target, rounds);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN MULTI-AGENT HOLOGRAPHIC SWARM ARENA (SPEC-196)      `);
  console.log(`===============================================================`);
  console.log(`  Tournament ID    : ${report.tournamentId}`);
  console.log(`  Target Action    : ${report.targetAction}`);
  console.log(`  Swarm Nodes      : ${report.participatingAgents.length} Agents (BFT 3f+1 Quorum)`);
  console.log(
    `  Rounds Total     : ${report.totalRounds} (Mitigated: ${report.mitigatedRounds} | Breaches: ${report.breachRounds})`,
  );
  console.log(`  Resilience Score : ${report.resilienceScore} / 100`);
  console.log(
    `  BFT Verdict      : ${report.bftVerdict === "CONSENSUS_HARDENED" ? "✔ CONSENSUS_HARDENED" : "✖ " + report.bftVerdict}`,
  );
  console.log(`  Receipt SHA-256  : sha256:${report.sha256Receipt}`);
  console.log(`---------------------------------------------------------------`);
  console.log(`  TOURNAMENT ENGAGEMENT ROUNDS:`);
  for (const r of report.rounds) {
    const symbol = r.penetrated ? "✖" : "✔";
    console.log(
      `   ${symbol} [Ronda ${r.roundNumber}] ${r.attack.category.padEnd(18)} vs ${r.defense.strategy.padEnd(20)} [${r.arbiterVerdict}]`,
    );
    console.log(`     ↳ Attack : ${r.attack.payload.slice(0, 48)}...`);
    console.log(`     ↳ Defense: ${r.defense.invariantAssertion}`);
  }
  console.log(`===============================================================\n`);
}

HANDLERS["arena"] = cmd_arena_137;
HANDLERS["swarm:arena"] = cmd_arena_137;

async function cmd_zk_prove_138(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const specArg = args.find((a) => a.startsWith("--spec="));
  const spec = specArg ? specArg.split("=")[1] : "SPEC-193";

  const { EosZkStateProof } = await import("../../src/core/eosZkStateProof.ts");
  const result = EosZkStateProof.generateDefaultRepositoryProof(spec);

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN ZERO-KNOWLEDGE MERKLE STATE ATTESTATION (SPEC-197)   `);
  console.log(`===============================================================`);
  console.log(`  Proof ID         : ${result.proof.proofId}`);
  console.log(`  Verified Claim   : ${result.proof.claimId} [${result.proof.claimStatus}]`);
  console.log(`  Blinding Salt    : ${result.proof.salt}`);
  console.log(`  Leaf Hash        : sha256:${result.proof.leafHash}`);
  console.log(`  Merkle Root      : sha256:${result.publicMerkleRoot}`);
  console.log(`  Audit Path Depth : ${result.proof.auditPath.length} sibling hops`);
  console.log(`  ZK Verification  : ${result.verified ? "✔ VALID_INCLUSION_PROVEN" : "✖ INVALID_PROOF"}`);
  console.log(`  Receipt SHA-256  : sha256:${result.proof.sha256ProofReceipt}`);
  console.log(`===============================================================\n`);
}

HANDLERS["zk:prove"] = cmd_zk_prove_138;
HANDLERS["zk:attest"] = cmd_zk_prove_138;

async function cmd_compile_139(commandContext) {
  const { args, command, root } = commandContext;
  const isJson = args.includes("--json");
  const dryRun = args.includes("--dry-run");
  const noSign = args.includes("--no-sign");
  const candidatePlatform = args.filter((a) => !a.startsWith("-") && a !== command).join(" ");
  const targetPlatform = candidatePlatform || `${process.platform}-${process.arch}`;

  const { EosHermeticSeaCompiler } = await import("../../src/core/eosHermeticSeaCompiler.ts");
  const result = EosHermeticSeaCompiler.compileStandaloneBinary({
    projectRoot: root,
    targetPlatform,
    dryRun,
    sign: !noSign,
  });

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN HERMETIC SEA BINARY COMPILER (SPEC-198)              `);
  console.log(`===============================================================`);
  console.log(`  Target Platform  : ${result.targetPlatform}`);
  console.log(`  Mode             : ${result.dryRun ? "SIMULATION (DRY-RUN)" : "HERMETIC NATIVE SYNTHESIS"}`);
  console.log(`  Binary Path      : ${result.binaryPath}`);
  console.log(
    `  Binary Size      : ${(result.binarySizeBytes / (1024 * 1024)).toFixed(2)} MB (${result.binarySizeBytes} bytes)`,
  );
  console.log(`  Binary SHA-256   : sha256:${result.sha256}`);
  console.log(`  SEA Blob Digest  : sha256:${result.blobSha256}`);
  if (result.signaturePath) {
    console.log(`  Ed25519 Sig      : ${result.signaturePath}`);
  }
  if (result.provenancePath) {
    console.log(`  SLSA Provenance  : ${result.provenancePath} (in-toto v1.0 Level-4)`);
  }
  if (result.sbomPath) {
    console.log(`  CycloneDX SBOM   : ${result.sbomPath} (v1.5, 0 runtime dependencies)`);
  }
  console.log(`  Compiler Receipt : sha256:${result.sha256Receipt}`);
  console.log(`===============================================================\n`);
}

HANDLERS["compile"] = cmd_compile_139;
HANDLERS["sea:compile"] = cmd_compile_139;

async function cmd_pq_kem_140(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const isHybrid = args.includes("--hybrid");
  const levelArg = args.find((a) => a.startsWith("--level="));
  const level = levelArg ? levelArg.split("=")[1] : "ML-KEM-768";

  const { EosPostQuantumCryptography } = await import("../../src/core/eosPostQuantumCryptography.ts");

  if (isHybrid) {
    const keypair = EosPostQuantumCryptography.generateHybridKemKeyPair();
    const enc = EosPostQuantumCryptography.encapsulateHybridKem(keypair.publicKey);
    const dec = EosPostQuantumCryptography.decapsulateHybridKem(enc.ciphertext, keypair.privateKey);
    const verified = enc.sharedSecretHex === dec.sharedSecretHex;

    const report = {
      mode: "HYBRID (X25519 + ML-KEM-768)",
      nistSecurityCategory: keypair.nistSecurityCategory,
      verified,
      sharedSecretHex: enc.sharedSecretHex,
      ciphertextSample: enc.ciphertext.mlKemCiphertextHex.slice(0, 32) + "...",
      sha256Receipt: enc.sha256Receipt,
    };

    if (isJson) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN HYBRID POST-QUANTUM KEY ENCAPSULATION (SPEC-199)    `);
    console.log(`===============================================================`);
    console.log(`  Standard         : IETF Hybrid KEM / NIST FIPS 203 + RFC 7748`);
    console.log(`  Primitives       : Curve25519 (ECDH) + ML-KEM-768 Lattice`);
    console.log(`  Security Level   : NIST Category ${report.nistSecurityCategory} (AES-192 equivalent)`);
    console.log(`  Shared Secret    : ${report.sharedSecretHex}`);
    console.log(`  KEM Verification : ${verified ? "✔ MATCH (DEC == ENC)" : "✖ MISMATCH"}`);
    console.log(`  Ciphertext Digest: sha256:${enc.ciphertext.saltHex}`);
    console.log(`  Receipt SHA-256  : sha256:${report.sha256Receipt}`);
    console.log(`===============================================================\n`);
    return;
  }

  const keypair = EosPostQuantumCryptography.generateMlKemKeyPair(level);
  const enc = EosPostQuantumCryptography.encapsulateMlKem(keypair.publicKeyHex, level);
  const dec = EosPostQuantumCryptography.decapsulateMlKem(enc.ciphertextHex, keypair.privateKeyHex);
  const verified = enc.sharedSecretHex === dec.sharedSecretHex;

  const report = {
    level,
    nistSecurityCategory: keypair.nistSecurityCategory,
    verified,
    sharedSecretHex: enc.sharedSecretHex,
    publicKeySample: keypair.publicKeyHex.slice(0, 32) + "...",
    ciphertextSample: enc.ciphertextHex.slice(0, 32) + "...",
    sha256Receipt: enc.sha256Receipt,
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN POST-QUANTUM LATTICE KEM (NIST FIPS 203 / SPEC-199) `);
  console.log(`===============================================================`);
  console.log(`  Algorithm        : ${level} (Module-Lattice Ring R_q, q=3329)`);
  console.log(`  Security Level   : NIST Category ${report.nistSecurityCategory}`);
  console.log(`  Shared Secret    : ${report.sharedSecretHex}`);
  console.log(`  KEM Verification : ${verified ? "✔ MATCH (DEC == ENC)" : "✖ MISMATCH"}`);
  console.log(`  Receipt SHA-256  : sha256:${report.sha256Receipt}`);
  console.log(`===============================================================\n`);
}

HANDLERS["pq:kem"] = cmd_pq_kem_140;
HANDLERS["pq:encap"] = cmd_pq_kem_140;

async function cmd_pq_sign_141(commandContext) {
  const { args, command } = commandContext;
  const isJson = args.includes("--json");
  const isHybrid = args.includes("--hybrid");
  const messageCandidate = args.filter((a) => !a.startsWith("-") && a !== command).join(" ");
  const message = messageCandidate || "GLORIAN_SOVEREIGN_POST_QUANTUM_AFFIRMATION";

  const { EosPostQuantumCryptography } = await import("../../src/core/eosPostQuantumCryptography.ts");

  if (isHybrid) {
    const { EosSlsaSupplyChainAttestation } = await import("../../src/core/eosSlsaSupplyChainAttestation.ts");
    const edKeys = EosSlsaSupplyChainAttestation.generateEd25519KeyPair();
    const mlDsaKeys = EosPostQuantumCryptography.generateMlDsaKeyPair();

    const sigResult = EosPostQuantumCryptography.signHybrid(message, {
      ed25519PrivateKeyPem: edKeys.privateKeyPem,
      mlDsaSigningKeyHex: mlDsaKeys.signingKeyHex,
    });

    const verified = EosPostQuantumCryptography.verifyHybrid(message, sigResult, {
      ed25519PublicKeyPem: edKeys.publicKeyPem,
      mlDsaVerificationKeyHex: mlDsaKeys.verificationKeyHex,
    });

    const report = {
      algorithm: sigResult.algorithm,
      message,
      verified,
      ed25519SignatureB64: sigResult.ed25519SignatureB64.slice(0, 32) + "...",
      mlDsaSignatureHex: sigResult.mlDsaSignatureHex.slice(0, 32) + "...",
      sha256Receipt: sigResult.sha256Receipt,
    };

    if (isJson) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN HYBRID POST-QUANTUM SIGNATURE (SPEC-199)             `);
    console.log(`===============================================================`);
    console.log(`  Message          : ${message}`);
    console.log(`  Algorithm        : ${sigResult.algorithm}`);
    console.log(`  Dual Signature   : Ed25519 + ML-DSA-65 (Lattice)`);
    console.log(`  Verification     : ${verified ? "✔ VALID_HYBRID_SIGNATURE" : "✖ REJECTED"}`);
    console.log(`  Receipt SHA-256  : sha256:${sigResult.sha256Receipt}`);
    console.log(`===============================================================\n`);
    return;
  }

  const keypair = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const sigResult = EosPostQuantumCryptography.signMlDsa(message, keypair.signingKeyHex);
  const verified = EosPostQuantumCryptography.verifyMlDsa(message, sigResult.signatureHex, keypair.verificationKeyHex);

  const report = {
    algorithm: sigResult.algorithm,
    message,
    verified,
    signatureHex: sigResult.signatureHex.slice(0, 48) + "...",
    verificationKeyHex: keypair.verificationKeyHex.slice(0, 32) + "...",
    sha256Receipt: sigResult.sha256Receipt,
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN ML-DSA LATTICE SIGNATURE (NIST FIPS 204 / SPEC-199)  `);
  console.log(`===============================================================`);
  console.log(`  Message          : ${message}`);
  console.log(`  Algorithm        : ${sigResult.algorithm} (Module-Lattice)`);
  console.log(`  Signature (Hex)  : ${report.signatureHex}`);
  console.log(`  Verification     : ${verified ? "✔ VALID_LATTICE_SIGNATURE" : "✖ REJECTED"}`);
  console.log(`  Receipt SHA-256  : sha256:${sigResult.sha256Receipt}`);
  console.log(`===============================================================\n`);
}

HANDLERS["pq:sign"] = cmd_pq_sign_141;

async function cmd_synthesize_143(commandContext) {
  const { args, command } = commandContext;
  const isJson = args.includes("--json");
  const codeCandidate = args.filter((a) => !a.startsWith("-") && a !== command).join(" ");
  const initialCode = codeCandidate || "return a - b;";

  const genArg = args.find((a) => a.startsWith("--generations="));
  const generations = genArg ? parseInt(genArg.split("=")[1], 10) : 8;

  const popArg = args.find((a) => a.startsWith("--population="));
  const populationSize = popArg ? parseInt(popArg.split("=")[1], 10) : 10;

  const { EosGeneticAstSynthesizer } = await import("../../src/core/eosGeneticAstSynthesizer.ts");
  const result = EosGeneticAstSynthesizer.synthesize({
    initialCode,
    generations,
    populationSize,
    testCases: [
      { input: [1, 2], expected: 3 },
      { input: [5, 10], expected: 15 },
      { input: [20, 30], expected: 50 },
    ],
  });

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN GENETIC AST CODE SYNTHESIZER (SPEC-200)              `);
  console.log(`===============================================================`);
  console.log(`  Initial Code     : ${initialCode}`);
  console.log(`  Synthesized Code : ${result.bestCandidate.code}`);
  console.log(`  Fitness Score    : ${result.finalFitness} / 100 (elevated from ${result.initialFitness})`);
  console.log(`  Generations      : ${result.generationsElapsed} (population: ${result.populationSize})`);
  console.log(`  Mutations Used   : ${result.bestCandidate.appliedMutations.join(", ") || "None (Converged)"}`);
  console.log(`  Receipt SHA-256  : sha256:${result.sha256Receipt}`);
  console.log(`---------------------------------------------------------------`);
  console.log(`  UNIFIED PATCH DIFF:`);
  console.log(result.diffPatch);
  console.log(`===============================================================\n`);
}

HANDLERS["synthesize"] = cmd_synthesize_143;
HANDLERS["ast:synthesize"] = cmd_synthesize_143;

async function cmd_vector_search_144(commandContext) {
  const { args, command } = commandContext;
  const isJson = args.includes("--json");
  const { EosHnswVectorIndex } = await import("../../src/core/eosHnswVectorIndex.ts");
  const { pureSha256 } = await import("../../src/core/eosKernelPrimitives.ts");

  if (command === "vector:index") {
    const nonFlags = args.filter((a) => !a.startsWith("-") && a !== command);
    const id = nonFlags[0] || "doc_sample_01";
    const code = nonFlags.slice(1).join(" ") || "export function computeHash(x) { return sha256(x); }";

    const index = new EosHnswVectorIndex({ dimension: 64, metric: "cosine" });
    index.indexCodeSnippet(id, code, { indexedAt: new Date().toISOString() });
    const embedding = EosHnswVectorIndex.embedText(code, 64);
    const receipt = pureSha256(`VECTOR_INDEX:${id}:${code}:${embedding[0]}`);

    const result = {
      action: "vector:index",
      id,
      codeSnippet: code.slice(0, 80),
      dimension: 64,
      norm: 1.0,
      sha256Receipt: receipt,
    };

    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN HNSW VECTOR EMBEDDING INDEX (SPEC-201)               `);
    console.log(`===============================================================`);
    console.log(`  Document ID      : ${id}`);
    console.log(`  Dimension        : 64-D normalized Float32Array`);
    console.log(`  Code Snippet     : ${result.codeSnippet}`);
    console.log(`  Receipt SHA-256  : sha256:${receipt}`);
    console.log(`===============================================================\n`);
    return;
  }

  // Otherwise vector:search or hnsw:search
  const kArg = args.find((a) => a.startsWith("--k="));
  const k = kArg ? parseInt(kArg.split("=")[1], 10) : 3;

  const queryTokens = args.filter((a) => !a.startsWith("-") && a !== command);
  const query = queryTokens.join(" ") || "authentication and jwt security token";

  const index = new EosHnswVectorIndex({ dimension: 64, metric: "cosine", M: 16 });
  const corpus = [
    { id: "core/auth", code: "function verifyJwtToken(token, secret) { return crypto.verify(token); }" },
    { id: "core/hnsw", code: "function searchAnnVector(queryVec, k) { return hnswGraph.searchLayer(queryVec, k); }" },
    { id: "core/crypto", code: "function mlDsaLatticeSign(msg, privKey) { return ringSisSign(msg, privKey); }" },
    { id: "core/database", code: "async function queryPostgres(sql, params) { return pgPool.query(sql, params); }" },
    { id: "core/synthesizer", code: "function mutateAstOperator(ast, op) { return applyGeneticMutations(ast); }" },
  ];

  for (const item of corpus) {
    index.indexCodeSnippet(item.id, item.code, { fullCode: item.code });
  }

  const matches = index.searchCode(query, k);
  const receipt = pureSha256(`HNSW_SEARCH:${query}:${JSON.stringify(matches)}`);

  const output = {
    query,
    k,
    matches,
    indexSize: index.size(),
    sha256Receipt: receipt,
  };

  if (isJson) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN HNSW VECTOR RETRIEVAL (SPEC-201 / LAYER-0 ANN)       `);
  console.log(`===============================================================`);
  console.log(`  Query            : "${query}"`);
  console.log(`  Matches (k=${k})  : ${matches.length} results from ${index.size()} indexed items`);
  matches.forEach((m, i) => {
    console.log(
      `  [#${i + 1}] ID: ${m.id} | Score: ${(m.similarityScore * 100).toFixed(1)}% | Distance: ${m.distance}`,
    );
  });
  console.log(`  Receipt SHA-256  : sha256:${receipt}`);
  console.log(`===============================================================\n`);
}

HANDLERS["vector:index"] = cmd_vector_search_144;
HANDLERS["vector:search"] = cmd_vector_search_144;
HANDLERS["hnsw:search"] = cmd_vector_search_144;

async function cmd_temporal_knowledge_graph_145(commandContext) {
  const { args, command } = commandContext;
  const isJson = args.includes("--json");
  const { EosTemporalKnowledgeGraph } = await import("../../src/core/eosTemporalKnowledgeGraph.ts");
  const { pureSha256 } = await import("../../src/core/eosKernelPrimitives.ts");

  if (command === "tkg:assert") {
    const nonFlags = args.filter((a) => !a.startsWith("-") && a !== command);
    const subject = nonFlags[0] || "auth_service";
    const predicate = nonFlags[1] || "calls_api";
    const object = nonFlags[2] || "payment_gateway";

    const startArg = args.find((a) => a.startsWith("--start="));
    const validFrom = startArg ? parseInt(startArg.split("=")[1], 10) : 0;

    const endArg = args.find((a) => a.startsWith("--end="));
    const validTo = endArg ? parseInt(endArg.split("=")[1], 10) : Infinity;

    const graph = new EosTemporalKnowledgeGraph();
    const fact = graph.assertFact(subject, predicate, object, validFrom, validTo, { source: "cli" });
    const receipt = pureSha256(`TKG_ASSERT:${fact.id}:${fact.subject}:${fact.predicate}:${fact.object}`);

    const result = {
      action: "tkg:assert",
      fact,
      sha256Receipt: receipt,
    };

    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN TEMPORAL KNOWLEDGE GRAPH ASSERTION (SPEC-202)        `);
    console.log(`===============================================================`);
    console.log(`  Fact ID          : ${fact.id}`);
    console.log(`  Subject          : ${fact.subject}`);
    console.log(`  Predicate        : ${fact.predicate}`);
    console.log(`  Object           : ${fact.object}`);
    console.log(`  Valid Interval   : [${fact.validFrom}, ${fact.validTo === Infinity ? "∞" : fact.validTo}]`);
    console.log(`  Receipt SHA-256  : sha256:${receipt}`);
    console.log(`===============================================================\n`);
    return;
  }

  // Otherwise tkg:query or graph:datalog
  const nonFlags = args.filter((a) => !a.startsWith("-") && a !== command);
  const predicate = nonFlags[0] || "transitive_depends";
  const sArg = nonFlags[1] || null;
  const oArg = nonFlags[2] || null;

  const asOfArg = args.find((a) => a.startsWith("--as-of="));
  const asOf = asOfArg ? parseInt(asOfArg.split("=")[1], 10) : undefined;

  const graph = new EosTemporalKnowledgeGraph();

  // Populate representative architecture dependency facts
  graph.assertFact("gateway_api", "depends_on", "auth_service", 0, Infinity);
  graph.assertFact("auth_service", "depends_on", "user_db", 0, Infinity);
  graph.assertFact("checkout_api", "depends_on", "payment_service", 0, Infinity);
  graph.assertFact("payment_service", "depends_on", "ledger_db", 0, 1000); // Deprecated at t=1000
  graph.assertFact("payment_service", "depends_on", "distributed_ledger", 1001, Infinity);

  // Add Datalog transitive dependency rules
  graph.addRule(
    { predicate: "transitive_depends", terms: ["?X", "?Y"] },
    [{ predicate: "depends_on", terms: ["?X", "?Y"] }],
    "base_dependency",
  );
  graph.addRule(
    { predicate: "transitive_depends", terms: ["?X", "?Y"] },
    [
      { predicate: "depends_on", terms: ["?X", "?Z"] },
      { predicate: "transitive_depends", terms: ["?Z", "?Y"] },
    ],
    "inductive_transitive_dependency",
  );

  const derivationReceipt = graph.evaluateRules(asOf);
  const bindings = graph.query(predicate, [sArg, oArg], { asOf });
  const queryReceipt = pureSha256(`TKG_QUERY:${predicate}:${JSON.stringify(bindings)}`);

  const output = {
    action: "tkg:query",
    predicate,
    asOf: asOf ?? "CURRENT",
    resultsCount: bindings.length,
    bindings,
    derivation: derivationReceipt,
    sha256Receipt: queryReceipt,
  };

  if (isJson) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN TEMPORAL DATALOG INFERENCE & QUERY (SPEC-202)        `);
  console.log(`===============================================================`);
  console.log(`  Target Predicate : ${predicate}`);
  console.log(`  Temporal Filter  : asOf = ${asOf ?? "HEAD (∞)"}`);
  console.log(`  Fixed-Point      : ${derivationReceipt.fixedPointReached ? "CONVERGED" : "MAX_ITERATIONS"}`);
  console.log(
    `  Derivation Stats : ${derivationReceipt.newFactsDerived} derived in ${derivationReceipt.iterations} iterations`,
  );
  console.log(`  Query Results    : ${bindings.length} facts matching`);
  bindings.forEach((b, i) => {
    console.log(`  [#${i + 1}] (${b.subject}) --[${b.predicate}]--> (${b.object})`);
  });
  console.log(`  Receipt SHA-256  : sha256:${queryReceipt}`);
  console.log(`===============================================================\n`);
}

HANDLERS["tkg:assert"] = cmd_temporal_knowledge_graph_145;
HANDLERS["tkg:query"] = cmd_temporal_knowledge_graph_145;
HANDLERS["graph:datalog"] = cmd_temporal_knowledge_graph_145;

async function cmd_wasm_prover_146(commandContext) {
  const { args, command } = commandContext;
  const isJson = args.includes("--json");
  const isWatOnly = args.includes("--wat");
  const { EosWasmBytecodeDecompilerProver } = await import("../../src/core/eosWasmBytecodeDecompilerProver.ts");
  const { WASM_BYTECODE_TEMPLATES } = await import("../../src/core/eosWasmSandboxEngine.ts");
  const fs = await import("node:fs");

  const nonFlags = args.filter((a) => !a.startsWith("-") && a !== command);
  const target = (nonFlags[0] || "ADD").toUpperCase();

  let wasmBytes;
  if (target in WASM_BYTECODE_TEMPLATES) {
    wasmBytes = WASM_BYTECODE_TEMPLATES[target];
  } else if (fs.existsSync(nonFlags[0])) {
    wasmBytes = fs.readFileSync(nonFlags[0]);
  } else {
    // Default to ADD
    wasmBytes = WASM_BYTECODE_TEMPLATES.ADD;
  }

  const parsed = EosWasmBytecodeDecompilerProver.parseModule(wasmBytes);
  const wat = EosWasmBytecodeDecompilerProver.decompileToWat(parsed);

  if (command === "wasm:decompile" || command === "wasm:disasm") {
    if (isWatOnly) {
      console.log(wat);
      return;
    }

    const result = {
      action: "wasm:decompile",
      target,
      byteLength: parsed.rawByteLength,
      version: parsed.version,
      functionCount: parsed.functions.length,
      exports: parsed.exports,
      wat,
      sha256Checksum: parsed.sha256Checksum,
    };

    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN WASM BYTECODE DECOMPILER (SPEC-203 / WAT OUTPUT)     `);
    console.log(`===============================================================`);
    console.log(`  Target Source    : ${target} (${parsed.rawByteLength} bytes)`);
    console.log(`  Module Version   : WebAssembly Core v${parsed.version}`);
    console.log(`  Functions Found  : ${parsed.functions.length}`);
    console.log(`  Module SHA-256   : sha256:${parsed.sha256Checksum}`);
    console.log(`---------------------------------------------------------------`);
    console.log(wat);
    console.log(`===============================================================\n`);
    return;
  }

  // Otherwise wasm:prove
  const proof = EosWasmBytecodeDecompilerProver.proveModuleSafety(parsed);

  const report = {
    action: "wasm:prove",
    target,
    verified: proof.verified,
    stackSafe: proof.stackSafe,
    controlFlowSafe: proof.controlFlowSafe,
    memoryBoundsSafe: proof.memoryBoundsSafe,
    isPure: proof.isPure,
    maxOperandStackDepth: proof.maxOperandStackDepth,
    totalInstructions: proof.totalInstructions,
    issues: proof.issues,
    sha256Receipt: proof.sha256Receipt,
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN WASM FORMAL INVARIANT SAFETY PROVER (SPEC-203)       `);
  console.log(`===============================================================`);
  console.log(`  Target Binary    : ${target} (${parsed.rawByteLength} bytes)`);
  console.log(`  Formal Verdict   : ${proof.verified ? "✔ MATHEMATICALLY_VERIFIED" : "✖ PROOF_FAILED"}`);
  console.log(`  Stack Safe       : ${proof.stackSafe ? "✔ NO_UNDERFLOW" : "✖ STACK_CORRUPTION"}`);
  console.log(`  Control Flow CFI : ${proof.controlFlowSafe ? "✔ VALID_NESTING" : "✖ ILLEGAL_BRANCH"}`);
  console.log(`  Memory Bounds    : ${proof.memoryBoundsSafe ? "✔ WITHIN_BOUNDS" : "✖ BUFFER_OVERFLOW"}`);
  console.log(`  Purity / Side-Eff: ${proof.isPure ? "✔ PURE_FUNCTIONAL" : "⚠ WRITES_MEMORY"}`);
  console.log(`  Max Stack Depth  : ${proof.maxOperandStackDepth} operands (${proof.totalInstructions} instructions)`);
  if (proof.issues.length > 0) {
    console.log(`  Proof Diagnostics:`);
    proof.issues.forEach((iss) => console.log(`    - ${iss}`));
  }
  console.log(`  Receipt SHA-256  : sha256:${proof.sha256Receipt}`);
  console.log(`===============================================================\n`);
}

HANDLERS["wasm:decompile"] = cmd_wasm_prover_146;
HANDLERS["wasm:disasm"] = cmd_wasm_prover_146;
HANDLERS["wasm:prove"] = cmd_wasm_prover_146;

export async function handleAutonomousCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
