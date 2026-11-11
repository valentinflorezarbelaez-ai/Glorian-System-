/**
 * EOS SYSTEM — PHASE-7 ENTERPRISE FRONTIER ACTIONS MCP HANDLER
 * Governed by SPEC-155, SPEC-186..SPEC-209.
 */

import { WASM_BYTECODE_TEMPLATES } from "../../core/eosWasmSandboxEngine.ts";
import { EosNeuroSymbolicVerifier } from "../../core/eosNeuroSymbolicVerifier.ts";
import { EosSlsaSupplyChainAttestation } from "../../core/eosSlsaSupplyChainAttestation.ts";
import { EosHardwareMemoryArena } from "../../core/eosHardwareMemoryArena.ts";
import { EosDelayTolerantMesh } from "../../core/eosDelayTolerantMesh.ts";
import { EosUniversalProjectDoctor } from "../../core/eosUniversalProjectDoctor.ts";
import { EosUniversalCodeRemediator } from "../../core/eosUniversalCodeRemediator.ts";
import { EosDynamicFuzzingOracle } from "../../core/eosDynamicFuzzingOracle.ts";
import { EosSwarmAdversarialArena } from "../../core/eosSwarmAdversarialArena.ts";
import { EosZkStateProof } from "../../core/eosZkStateProof.ts";
import { EosHermeticSeaCompiler } from "../../core/eosHermeticSeaCompiler.ts";
import { EosPostQuantumCryptography } from "../../core/eosPostQuantumCryptography.ts";
import { EosGeneticAstSynthesizer } from "../../core/eosGeneticAstSynthesizer.ts";
import { EosHnswVectorIndex } from "../../core/eosHnswVectorIndex.ts";
import { EosTemporalKnowledgeGraph } from "../../core/eosTemporalKnowledgeGraph.ts";
import { EosWasmBytecodeDecompilerProver } from "../../core/eosWasmBytecodeDecompilerProver.ts";
import { EosMctsPolicyValueMesh } from "../../core/eosMctsPolicyValueMesh.ts";
import { EosAutonomousTlaModelChecker } from "../../core/eosAutonomousTlaModelChecker.ts";
import { EosRaftCluster } from "../../core/eosRaftConsensusEngine.ts";
import { EosAnsEntropyCompressor } from "../../core/eosAnsEntropyCompressor.ts";
import { EosTensor, EosReverseModeAutodiff, EosSgdOptimizer } from "../../core/eosReverseModeAutodiff.ts";
import { EosIsolationForest, EosStreamingIsolationForest } from "../../core/eosIsolationForestDetector.ts";
import { EosPbftCluster } from "../../core/eosPbftConsensusEngine.ts";
import { EosHomomorphicLatticeCore, DEFAULT_HOMOMORPHIC_PARAMS } from "../../core/eosHomomorphicLatticeCore.ts";
import { pureSha256 } from "../../core/eosKernelPrimitives.ts";
import { type Phase7DomainHandlerDeps, isPlainRecord } from "./eosMcpPhase7Shared.ts";

export function dispatchPhase7FrontierAction(
  action: string,
  args: Record<string, any> | undefined,
  deps: Phase7DomainHandlerDeps,
): unknown | undefined {
  if (action === "verify_action") {
    const verifier = new EosNeuroSymbolicVerifier();
    return verifier.verifyAction({
      actionId: String(args?.actionId || `ACT-${Date.now()}`),
      actionType: args?.actionType || "SHELL_COMMAND",
      target: String(args?.target || ""),
      payload: args?.payload ? String(args.payload) : undefined,
      declaredPreconditions: args?.declaredPreconditions,
    });
  }
  if (action === "slsa_attest") {
    const { privateKeyPem, keyId } = EosSlsaSupplyChainAttestation.generateEd25519KeyPair();
    const statement = EosSlsaSupplyChainAttestation.generateProvenanceStatement({
      subjects: Array.isArray(args?.subjects)
        ? args.subjects
        : [{ name: "workspace", digest: { sha256: pureSha256("workspace") } }],
    });
    return EosSlsaSupplyChainAttestation.signStatement(statement, privateKeyPem, keyId);
  }
  if (action === "arena_stats") {
    const arena = new EosHardwareMemoryArena(65536, 16);
    return {
      bump: arena.bump.getStats(),
      slabs: arena.slabs.getStats(),
    };
  }
  if (action === "dtn_status") {
    const mesh = new EosDelayTolerantMesh("local-control-plane");
    return mesh.getMeshMetrics();
  }
  if (action === "doctor") {
    const targetPath =
      typeof args?.targetPath === "string" && args.targetPath.trim().length > 0
        ? args.targetPath.trim()
        : deps.projectRoot;
    const report = EosUniversalProjectDoctor.diagnose(targetPath);
    let ciResult: { written: boolean; path: string } | undefined = undefined;
    if (args?.writeCi === true) {
      const workflow = EosUniversalProjectDoctor.generateHardenedCiWorkflow(report.detectedStack);
      ciResult = EosUniversalProjectDoctor.writeCiWorkflow(targetPath, workflow);
    }
    return {
      ...report,
      ciResult,
    };
  }
  if (action === "remediate") {
    const targetPath =
      typeof args?.targetPath === "string" && args.targetPath.trim().length > 0
        ? args.targetPath.trim()
        : deps.projectRoot;
    const dryRun = args?.dryRun === true;
    return EosUniversalCodeRemediator.remediate(targetPath, { dryRun });
  }
  if (action === "fuzz") {
    const iterations = typeof args?.iterations === "number" ? Math.floor(args.iterations) : 50;
    const corpusType = args?.corpusType || "ALL";
    return EosDynamicFuzzingOracle.runCampaign(
      (input) => {
        const repr = typeof input === "object" ? JSON.stringify(input) : String(input);
        pureSha256(repr || "empty");
      },
      String(args?.targetName || "kernel:pureSha256"),
      { iterations, corpusType },
    );
  }
  if (action === "arena") {
    const rounds = typeof args?.rounds === "number" ? Math.floor(args.rounds) : 3;
    const target = typeof args?.target === "string" && args.target.trim().length > 0 ? args.target.trim() : "npm test";
    return EosSwarmAdversarialArena.executeTournament(target, rounds);
  }
  if (action === "zk_prove") {
    const spec = typeof args?.specId === "string" ? args.specId.trim() : "SPEC-193";
    return EosZkStateProof.generateDefaultRepositoryProof(spec);
  }
  if (action === "zk_verify") {
    const proof = args?.proof;
    const publicRoot = typeof args?.publicMerkleRoot === "string" ? args.publicMerkleRoot : undefined;
    return {
      verified: EosZkStateProof.verifyInclusionProof(proof, publicRoot),
    };
  }
  if (action === "compile_sea") {
    const dryRun = Boolean(args?.dryRun);
    const targetPlatform = typeof args?.targetPlatform === "string" ? args.targetPlatform.trim() : undefined;
    return EosHermeticSeaCompiler.compileStandaloneBinary({
      projectRoot: deps.projectRoot,
      dryRun,
      targetPlatform,
    });
  }
  if (action === "pq_kem") {
    const isHybrid = Boolean(args?.hybrid);
    if (isHybrid) {
      const kp = EosPostQuantumCryptography.generateHybridKemKeyPair();
      const enc = EosPostQuantumCryptography.encapsulateHybridKem(kp.publicKey);
      const dec = EosPostQuantumCryptography.decapsulateHybridKem(enc.ciphertext, kp.privateKey);
      return {
        mode: "HYBRID",
        verified: enc.sharedSecretHex === dec.sharedSecretHex,
        sharedSecretHex: enc.sharedSecretHex,
        sha256Receipt: enc.sha256Receipt,
      };
    }
    const kp = EosPostQuantumCryptography.generateMlKemKeyPair("ML-KEM-768");
    const enc = EosPostQuantumCryptography.encapsulateMlKem(kp.publicKeyHex);
    const dec = EosPostQuantumCryptography.decapsulateMlKem(enc.ciphertextHex, kp.privateKeyHex);
    return {
      mode: "ML-KEM-768",
      verified: enc.sharedSecretHex === dec.sharedSecretHex,
      sharedSecretHex: enc.sharedSecretHex,
      sha256Receipt: enc.sha256Receipt,
    };
  }
  if (action === "pq_verify") {
    const msg = String(args?.message || "test");
    const sig = String(args?.signatureHex || "");
    const vk = String(args?.verificationKeyHex || "");
    return {
      verified: EosPostQuantumCryptography.verifyMlDsa(msg, sig, vk),
    };
  }
  if (action === "synthesize_code") {
    const initialCode = String(args?.initialCode || "return a + b;");
    const generations = typeof args?.generations === "number" ? Math.floor(args.generations) : 6;
    const populationSize = typeof args?.populationSize === "number" ? Math.floor(args.populationSize) : 10;
    return EosGeneticAstSynthesizer.synthesize({
      initialCode,
      generations,
      populationSize,
    });
  }
  if (action === "vector_index") {
    const id = String(args?.id || "doc_01");
    const code = String(args?.code || "function test() {}");
    const dim = typeof args?.dimension === "number" ? Math.floor(args.dimension) : 64;
    const index = new EosHnswVectorIndex({ dimension: dim, metric: "cosine" });
    index.indexCodeSnippet(id, code, { indexedAt: new Date().toISOString() });
    const serialized = index.serialize();
    return {
      action: "vector_index",
      id,
      dimension: dim,
      size: index.size(),
      sha256Receipt: serialized.sha256Checksum,
    };
  }
  if (action === "vector_search") {
    const query = String(args?.query || "authentication");
    const k = typeof args?.k === "number" ? Math.floor(args.k) : 3;
    const dim = typeof args?.dimension === "number" ? Math.floor(args.dimension) : 64;
    const index = new EosHnswVectorIndex({ dimension: dim, metric: "cosine" });
    const defaultCorpus = [
      { id: "core/auth", code: "function verifyJwtToken(token) { return jwt.verify(token); }" },
      { id: "core/hnsw", code: "function searchAnn(vec, k) { return graph.search(vec, k); }" },
      { id: "core/crypto", code: "function signLattice(msg) { return mlDsaSign(msg); }" },
    ];
    const corpus = Array.isArray(args?.corpus) ? args.corpus : defaultCorpus;
    for (const item of corpus) {
      if (item && item.id && item.code) {
        index.indexCodeSnippet(String(item.id), String(item.code));
      }
    }
    const matches = index.searchCode(query, k);
    const receipt = pureSha256(`MCP_VECTOR_SEARCH:${query}:${JSON.stringify(matches)}`);
    return {
      action: "vector_search",
      query,
      k,
      matches,
      indexSize: index.size(),
      sha256Receipt: receipt,
    };
  }
  if (action === "tkg_assert") {
    const subject = String(args?.subject || "service_a");
    const predicate = String(args?.predicate || "calls_api");
    const object = String(args?.object || "service_b");
    const validFrom = typeof args?.validFrom === "number" ? args.validFrom : 0;
    const validTo = typeof args?.validTo === "number" ? args.validTo : Infinity;
    const graph = new EosTemporalKnowledgeGraph();
    const fact = graph.assertFact(subject, predicate, object, validFrom, validTo);
    const receipt = pureSha256(`MCP_TKG_ASSERT:${fact.id}:${fact.subject}:${fact.predicate}:${fact.object}`);
    return {
      action: "tkg_assert",
      fact,
      sha256Receipt: receipt,
    };
  }
  if (action === "tkg_query") {
    const predicate = String(args?.predicate || "depends_on");
    const asOf = typeof args?.asOf === "number" ? args.asOf : undefined;
    const graph = new EosTemporalKnowledgeGraph();

    if (Array.isArray(args?.facts)) {
      for (const f of args.facts) {
        if (f && f.subject && f.predicate && f.object) {
          graph.assertFact(
            String(f.subject),
            String(f.predicate),
            String(f.object),
            f.validFrom ?? 0,
            f.validTo ?? Infinity,
          );
        }
      }
    } else {
      // Default architectural lineage facts
      graph.assertFact("gateway", "depends_on", "auth", 0, Infinity);
      graph.assertFact("auth", "depends_on", "db", 0, Infinity);
    }

    // Add transitive dependency rules
    graph.addRule({ predicate: "transitive_depends", terms: ["?X", "?Y"] }, [
      { predicate: "depends_on", terms: ["?X", "?Y"] },
    ]);
    graph.addRule({ predicate: "transitive_depends", terms: ["?X", "?Y"] }, [
      { predicate: "depends_on", terms: ["?X", "?Z"] },
      { predicate: "transitive_depends", terms: ["?Z", "?Y"] },
    ]);

    const derivation = graph.evaluateRules(asOf);
    const sFilter = args?.subject ? String(args.subject) : null;
    const oFilter = args?.object ? String(args.object) : null;
    const bindings = graph.query(predicate, [sFilter, oFilter], { asOf });
    const receipt = pureSha256(`MCP_TKG_QUERY:${predicate}:${JSON.stringify(bindings)}`);

    return {
      action: "tkg_query",
      predicate,
      asOf: asOf ?? "CURRENT",
      bindings,
      derivation,
      sha256Receipt: receipt,
    };
  }
  if (action === "wasm_decompile") {
    const target = String(args?.target || "ADD").toUpperCase();
    let wasmBytes: Uint8Array = WASM_BYTECODE_TEMPLATES.ADD;
    if (target in WASM_BYTECODE_TEMPLATES) {
      wasmBytes = (WASM_BYTECODE_TEMPLATES as Record<string, Uint8Array>)[target]!;
    } else if (typeof args?.base64Bytes === "string") {
      wasmBytes = Buffer.from(args.base64Bytes, "base64");
    }
    const parsed = EosWasmBytecodeDecompilerProver.parseModule(wasmBytes);
    const wat = EosWasmBytecodeDecompilerProver.decompileToWat(parsed);
    return {
      action: "wasm_decompile",
      target,
      byteLength: parsed.rawByteLength,
      version: parsed.version,
      functionCount: parsed.functions.length,
      wat,
      sha256Checksum: parsed.sha256Checksum,
    };
  }
  if (action === "wasm_prove") {
    const target = String(args?.target || "ADD").toUpperCase();
    let wasmBytes: Uint8Array = WASM_BYTECODE_TEMPLATES.ADD;
    if (target in WASM_BYTECODE_TEMPLATES) {
      wasmBytes = (WASM_BYTECODE_TEMPLATES as Record<string, Uint8Array>)[target]!;
    } else if (typeof args?.base64Bytes === "string") {
      wasmBytes = Buffer.from(args.base64Bytes, "base64");
    }
    const parsed = EosWasmBytecodeDecompilerProver.parseModule(wasmBytes);
    const proof = EosWasmBytecodeDecompilerProver.proveModuleSafety(parsed);
    return {
      action: "wasm_prove",
      target,
      ...proof,
    };
  }
  if (action === "mcts_search") {
    const simulations = typeof args?.simulations === "number" ? Math.floor(args.simulations) : 50;
    const cPuct = typeof args?.cPuct === "number" ? args.cPuct : 1.414;
    const temperature = typeof args?.temperature === "number" ? args.temperature : 0.0;

    const initialState = {
      id: String(args?.stateId || "root_state"),
      legalActions: Array.isArray(args?.legalActions)
        ? args.legalActions.map(String)
        : ["action_a", "action_b", "action_c"],
      isTerminal: false,
      metadata: { step: 0, fitness: 0.1 },
    };

    const transitionFn = (state: any, action: string) => {
      const step = (state.metadata?.step ?? 0) + 1;
      const isTerminal = step >= 3;
      const addedReward = action === "action_b" ? 0.4 : 0.2;
      const fitness = Math.min(1.0, (state.metadata?.fitness ?? 0) + addedReward);
      return {
        id: `${state.id}->${action}`,
        legalActions: isTerminal ? [] : ["action_a", "action_b"],
        isTerminal,
        reward: isTerminal ? fitness : undefined,
        metadata: { step, fitness },
      };
    };

    const mcts = new EosMctsPolicyValueMesh({ cPuct, simulations, temperature });
    const result = mcts.search(initialState, transitionFn, simulations);
    return {
      action: "mcts_search",
      ...result,
    };
  }
  if (action === "mcts_evaluate") {
    const state = {
      id: String(args?.stateId || "eval_state"),
      legalActions: Array.isArray(args?.legalActions) ? args.legalActions.map(String) : ["left", "right"],
      isTerminal: Boolean(args?.isTerminal),
      reward: typeof args?.reward === "number" ? args.reward : undefined,
      metadata: isPlainRecord(args?.metadata) ? args.metadata : {},
    };
    const mcts = new EosMctsPolicyValueMesh();
    const evaluation = mcts.evaluateState(state);
    const receipt = pureSha256(`MCTS_EVAL:${state.id}:${evaluation.value}:${JSON.stringify(evaluation.priors)}`);
    return {
      action: "mcts_evaluate",
      stateId: state.id,
      ...evaluation,
      sha256Receipt: receipt,
    };
  }
  if (action === "tla_check") {
    const maxDepth = typeof args?.maxDepth === "number" ? Math.floor(args.maxDepth) : 20;
    const maxStates = typeof args?.maxStates === "number" ? Math.floor(args.maxStates) : 2000;
    const model = EosAutonomousTlaModelChecker.generateDefaultDistributedLockModel();
    const result = EosAutonomousTlaModelChecker.checkModel(model, { maxDepth, maxStates, checkDeadlocks: true });
    return {
      action: "tla_check",
      ...result,
    };
  }
  if (action === "tla_synthesize") {
    const model = EosAutonomousTlaModelChecker.generateDefaultDistributedLockModel();
    const tlaCode = EosAutonomousTlaModelChecker.synthesizeTlaModule(model);
    const receipt = pureSha256(`TLA_SYNTH:${model.moduleName}:${tlaCode.length}`);
    return {
      action: "tla_synthesize",
      moduleName: model.moduleName,
      tlaCode,
      sha256Receipt: receipt,
    };
  }
  if (action === "raft_cluster") {
    const nodeCount = typeof args?.nodeCount === "number" ? Math.max(1, Math.floor(args.nodeCount)) : 3;
    const nodeIds = Array.from({ length: nodeCount }, (_, i) => `node-${i + 1}`);
    const cluster = new EosRaftCluster("mcp-raft-cluster", nodeIds);
    const election = cluster.startElection(nodeIds[0]);
    const status = cluster.getClusterStatus();
    const receipt = cluster.generateReceipt();
    return {
      action: "raft_cluster",
      election,
      status,
      receipt,
    };
  }
  if (action === "raft_propose") {
    const nodeCount = typeof args?.nodeCount === "number" ? Math.max(1, Math.floor(args.nodeCount)) : 3;
    const nodeIds = Array.from({ length: nodeCount }, (_, i) => `node-${i + 1}`);
    const cluster = new EosRaftCluster("mcp-raft-cluster", nodeIds);
    cluster.startElection(nodeIds[0]);
    const cmd = args?.command ?? { type: "SET", key: "mcp_key", value: "mcp_value" };
    const proposal = cluster.propose(cmd);
    const status = cluster.getClusterStatus();
    const receipt = cluster.generateReceipt();
    return {
      action: "raft_propose",
      proposal,
      status,
      receipt,
    };
  }
  if (action === "ans_compress") {
    const payload = typeof args?.payload === "string" ? args.payload : "GLORIAN_MCP_ANS_PAYLOAD_2026";
    const result = EosAnsEntropyCompressor.compress(payload);
    return {
      action: "ans_compress",
      metadata: result.metadata,
      compressedBase64: Buffer.from(result.compressed).toString("base64"),
      sha256Receipt: result.sha256Receipt,
    };
  }
  if (action === "ans_decompress") {
    const base64 = typeof args?.base64 === "string" ? args.base64 : "";
    const buf = Buffer.from(base64, "base64");
    const result = EosAnsEntropyCompressor.decompress(buf);
    return {
      action: "ans_decompress",
      verified: result.verified,
      decompressedText: Buffer.from(result.decompressed).toString("utf8"),
      originalSha256: result.originalSha256,
      sha256Receipt: result.sha256Receipt,
    };
  }
  if (action === "autodiff_grad") {
    const rawVals = Array.isArray(args?.values) ? args.values : [1.5, -2.0, 3.0, 0.5];
    const x = EosTensor.from(rawVals, [rawVals.length], true);
    const gradCheck = EosReverseModeAutodiff.checkGradient((p) => p.pow(2).add(p.mul(2.0)).sum(), x);
    x.zeroGrad();
    const loss = x.pow(2).add(x.mul(2.0)).sum();
    loss.backward();
    const receipt = pureSha256(`AUTODIFF_GRAD:${x.id}:${loss.item()}`);
    return {
      action: "autodiff_grad",
      lossValue: loss.item(),
      analyticalGrad: x.grad ? Array.from(x.grad) : [],
      gradientCheck: gradCheck,
      sha256Receipt: receipt,
    };
  }
  if (action === "autodiff_train") {
    const epochs = typeof args?.epochs === "number" ? Math.max(1, Math.floor(args.epochs)) : 10;
    const X = EosTensor.from([1.0, 2.0, 3.0, 4.0], [2, 2], false);
    const target = EosTensor.from([5.0, 11.0], [2, 1], false);
    const W = EosTensor.from([0.1, 0.1], [2, 1], true);
    const optimizer = new EosSgdOptimizer([W], 0.05);
    const receipt = EosReverseModeAutodiff.trainStep(
      () => {
        const pred = X.matmul(W);
        return EosReverseModeAutodiff.mseLoss(pred, target);
      },
      optimizer,
      epochs,
    );
    return {
      action: "autodiff_train",
      receipt,
      trainedWeights: W.toArray(),
    };
  }
  if (action === "anomaly_detect") {
    const threshold = typeof args?.threshold === "number" ? args.threshold : 0.6;
    const nTrees = typeof args?.trees === "number" ? Math.floor(args.trees) : 50;
    const rawData = Array.isArray(args?.data)
      ? (args.data as number[][])
      : [
          [20.0, 25.0],
          [22.0, 24.0],
          [19.0, 26.0],
          [21.0, 25.0],
          [400.0, 99.0],
        ];
    const forest = new EosIsolationForest({ nTrees, threshold, seed: 1064 });
    forest.fit(rawData);
    const report = forest.predict(rawData);
    return {
      action: "anomaly_detect",
      report,
    };
  }
  if (action === "anomaly_forest") {
    const streaming = new EosStreamingIsolationForest({ windowCapacity: 100, retrainInterval: 20 });
    for (let i = 0; i < 35; i++) {
      streaming.ingest([20 + Math.sin(i), 25 + Math.cos(i)]);
    }
    const outlierScore = streaming.ingest([500.0, 999.0]);
    return {
      action: "anomaly_forest",
      isReady: streaming.isReady,
      windowSize: streaming.windowSize,
      ingestedCount: streaming.ingestedCount,
      outlierScore,
    };
  }
  if (action === "pbft_cluster") {
    const nodeCount = typeof args?.nodeCount === "number" ? Math.max(4, Math.floor(args.nodeCount)) : 4;
    const nodeIds = Array.from({ length: nodeCount }, (_, i) => `node-${i}`);
    const cluster = new EosPbftCluster(nodeIds);
    const status = cluster.getClusterStatus();
    return {
      action: "pbft_cluster",
      status,
    };
  }
  if (action === "pbft_propose") {
    const nodeCount = typeof args?.nodeCount === "number" ? Math.max(4, Math.floor(args.nodeCount)) : 4;
    const nodeIds = Array.from({ length: nodeCount }, (_, i) => `node-${i}`);
    const cluster = new EosPbftCluster(nodeIds);
    const command = args?.proposal || { type: "SET", key: "mcp_key", value: "active" };
    const receipt = cluster.propose(command);
    return {
      action: "pbft_propose",
      receipt,
      fsmState: cluster.getNode(nodeIds[0])?.fsmState,
    };
  }
  if (action === "pbft_slash") {
    const cluster = new EosPbftCluster(["node-0", "node-1", "node-2", "node-3"]);
    const slashingReceipt = cluster.simulateEquivocation(
      "node-0",
      { type: "SET", key: "state", value: "valid" },
      { type: "SET", key: "state", value: "forged" },
    );
    return {
      action: "pbft_slash",
      slashingReceipt,
    };
  }
  if (action === "homomorphic_keygen") {
    const polyDegree = typeof args?.polyDegree === "number" ? args.polyDegree : 32;
    const core = new EosHomomorphicLatticeCore({ ...DEFAULT_HOMOMORPHIC_PARAMS, polyDegree });
    const keypair = core.generateKeypair();
    return {
      action: "homomorphic_keygen",
      keypair,
    };
  }
  if (action === "homomorphic_encrypt") {
    const polyDegree = typeof args?.polyDegree === "number" ? args.polyDegree : 32;
    const core = new EosHomomorphicLatticeCore({ ...DEFAULT_HOMOMORPHIC_PARAMS, polyDegree });
    const keypair = core.generateKeypair(1337);
    const message = Array.isArray(args?.message) ? args.message : [42, 100, 7];
    const ct = core.encrypt(keypair.publicKey, message);
    return {
      action: "homomorphic_encrypt",
      ciphertext: ct,
    };
  }
  if (action === "homomorphic_add") {
    const polyDegree = typeof args?.polyDegree === "number" ? args.polyDegree : 32;
    const core = new EosHomomorphicLatticeCore({ ...DEFAULT_HOMOMORPHIC_PARAMS, polyDegree, errorBound: 1 });
    const keypair = core.generateKeypair(999);
    const msgA = Array.isArray(args?.msgA) ? args.msgA : [10, 20, 30];
    const msgB = Array.isArray(args?.msgB) ? args.msgB : [5, 15, 25];
    const ctA = core.encrypt(keypair.publicKey, msgA, 101);
    const ctB = core.encrypt(keypair.publicKey, msgB, 102);
    const ctSum = core.add(ctA, ctB);
    const decResult = core.decrypt(keypair.secretKey, ctSum);
    return {
      action: "homomorphic_add",
      sumPlaintext: decResult.plaintext.slice(0, Math.max(msgA.length, msgB.length)),
      noiseBudgetBits: decResult.noiseBudgetBits,
      receipt: decResult.receipt,
    };
  }
  return undefined;
}
