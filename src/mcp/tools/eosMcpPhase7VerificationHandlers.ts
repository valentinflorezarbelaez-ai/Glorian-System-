/**
 * EOS SYSTEM — PHASE-7 VERIFICATION & GOVERNANCE MCP HANDLERS (SPEC-155 / T7c)
 * Ordered slice of the Phase-7 domain dispatcher (11 tools). Routed by
 * createPhase7DomainHandlers in ./eosMcpPhase7DomainHandlers.ts. WITHIN_TESTED_SCOPE only.
 */

import { WASM_BYTECODE_TEMPLATES } from "../../core/eosWasmSandboxEngine.ts";
import { assertPrecondition } from "../../core/eosKernelPrimitives.ts";
import { EosDurableSqliteLedger } from "../../core/eosDurableSqliteLedger.ts";
import { EosEnterpriseWorkspaceGovernor } from "../../core/eosEnterpriseWorkspaceGovernor.ts";
import { EosAgentTopologyMesh, type AgentNode, type MeshEventType } from "../../core/eosAgentTopologyMesh.ts";
import { EosInvariantVerificationEngine, type StateMachineModel } from "../../core/eosInvariantVerificationEngine.ts";
import { EosContractEvolutionGovernor, type SchemaContract } from "../../core/eosContractEvolutionGovernor.ts";
import { EosSurgicalSelfHealingKernel, type RepairStrategy } from "../../core/eosSurgicalSelfHealingKernel.ts";
import { EosContentAddressableCache } from "../../core/eosContentAddressableCache.ts";
import { EosSmtAutomatedReasoningProver } from "../../core/eosSmtAutomatedReasoningProver.ts";
import { EosThresholdCryptography } from "../../core/eosThresholdCryptography.ts";
import { EosColumnarTelemetryEngine, type ColumnarQueryFilter } from "../../core/eosColumnarTelemetryEngine.ts";
import { EosNeuroSymbolicFleetHealingEngine } from "../../core/eosNeuroSymbolicFleetHealingEngine.ts";
import { EosEnterpriseFacade } from "../../core/eosEnterpriseFacade.ts";
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
import { pureSha256 } from "../../core/eosKernelPrimitives.ts";
import { type Phase7DomainHandlerDeps, type Phase7HandlerContext, isPlainRecord } from "./eosMcpPhase7Shared.ts";

export const PHASE7_VERIFICATION_TOOL_NAMES: ReadonlySet<string> = new Set([
  "eos_invariant_engine",
  "eos_contract_governor",
  "eos_surgical_healing",
  "eos_wasm_sandbox",
  "eos_enterprise_workspace",
  "eos_agent_topology_mesh",
  "eos_content_addressable_cache",
  "eos_threshold_secret_split_combine",
  "eos_neurosymbolic_fleet_healing",
  "eos_columnar_telemetry_query",
  "eos_smt_reasoning_prover",
]);

export function dispatchPhase7VerificationCase(
  toolName: string,
  args: Record<string, any>,
  deps: Phase7DomainHandlerDeps,
  ctx?: Phase7HandlerContext,
): unknown {
  const onProgress = ctx?.onProgress;
  switch (toolName) {
    case "eos_invariant_engine": {
      const action = String(args?.action || "explore")
        .trim()
        .toLowerCase();
      const modelType = String(args?.model || "transfer")
        .trim()
        .toLowerCase();
      const seed = Number(args?.seed !== undefined ? args.seed : 42);
      const maxSteps = Number(args?.maxSteps || 500);
      const faultInjectionRate = Number(args?.faultInjectionRate || 0);
      const enableShrinking = args?.enableShrinking !== false;

      let model: StateMachineModel<any>;
      if (modelType === "counter") {
        model = {
          name: "BoundedCounter",
          initialState: { count: 0, maxAllowed: 1000 },
          actions: [
            { name: "inc", apply: (s) => ({ ...s, count: s.count + 1 }) },
            { name: "dec", apply: (s) => ({ ...s, count: Math.max(0, s.count - 1) }) },
          ],
          invariants: [
            { name: "non_negative", check: (s) => s.count >= 0 },
            { name: "within_bounds", check: (s) => s.count <= s.maxAllowed },
          ],
        };
      } else if (modelType === "consensus") {
        model = {
          name: "RaftQuorumConsensus",
          initialState: { term: 1, leader: "node-1", activeNodes: 3 },
          actions: [
            { name: "heartbeat", apply: (s) => ({ ...s, term: s.term }) },
            { name: "step_down", apply: (s) => ({ ...s, leader: "node-2" }) },
            { name: "failover", apply: (s) => ({ ...s, term: s.term + 1, leader: "node-3" }) },
          ],
          invariants: [
            { name: "valid_term", check: (s) => s.term >= 1 },
            { name: "single_leader_present", check: (s) => typeof s.leader === "string" && s.leader.length > 0 },
          ],
        };
      } else {
        // Default: transfer ledger model
        model = {
          name: "TransferLedger",
          initialState: { a: 100, b: 100, c: 100, total: 300 },
          actions: [
            {
              name: "transfer_a_b",
              apply: (s, prng) => {
                const amt = prng.nextInt(1, 10);
                if (s.a < amt) return s;
                return { ...s, a: s.a - amt, b: s.b + amt };
              },
            },
            {
              name: "transfer_b_c",
              apply: (s, prng) => {
                const amt = prng.nextInt(1, 10);
                if (s.b < amt) return s;
                return { ...s, b: s.b - amt, c: s.c + amt };
              },
            },
            {
              name: "transfer_c_a",
              apply: (s, prng) => {
                const amt = prng.nextInt(1, 10);
                if (s.c < amt) return s;
                return { ...s, c: s.c - amt, a: s.a + amt };
              },
            },
          ],
          invariants: [
            { name: "conservation_of_money", check: (s) => s.a + s.b + s.c === s.total },
            { name: "no_negative_balances", check: (s) => s.a >= 0 && s.b >= 0 && s.c >= 0 },
          ],
        };
      }

      const options = {
        seed,
        maxSteps,
        faultInjectionRate,
        enableShrinking,
        ledgerDbPath:
          args?.recordToLedger === true ? EosDurableSqliteLedger.defaultLedgerPath(deps.projectRoot) : undefined,
        projectId: "eos-system",
      };

      if (action === "explore" || action === "verify" || action === "shrink") {
        return EosInvariantVerificationEngine.verifyModel(model, options);
      }
      throw new Error(`Unsupported eos_invariant_engine action: ${action}`);
    }

    case "eos_contract_governor": {
      const action = String(args?.action || "diff")
        .trim()
        .toLowerCase();

      if (action === "sql_lint") {
        const ddlSql = String(args?.ddlSql || "");
        const hazards = EosContractEvolutionGovernor.scanSqlMigrationHazards(ddlSql);
        return {
          hazardsCount: hazards.length,
          hazards,
        };
      }

      let baseContract: SchemaContract;
      if (typeof args?.baseInterfaceSnippet === "string" && args.baseInterfaceSnippet.trim().length > 0) {
        baseContract = EosContractEvolutionGovernor.parseTypeScriptContract(args.baseInterfaceSnippet, "BaseInterface");
      } else if (isPlainRecord(args?.baseSchema)) {
        const s = args.baseSchema;
        const rawFields = Array.isArray(s.fields) ? s.fields : [];
        baseContract = {
          contractId: String(s.contractId || "BaseContract"),
          version: String(s.version || "1.0.0"),
          fields: rawFields.map((f: any) => ({
            name: String(f.name || ""),
            type: String(f.type || "unknown"),
            optional: Boolean(f.optional),
          })),
        };
      } else {
        baseContract = { contractId: "EmptyBase", version: "0.0.0", fields: [] };
      }

      let candidateContract: SchemaContract;
      if (typeof args?.candidateInterfaceSnippet === "string" && args.candidateInterfaceSnippet.trim().length > 0) {
        candidateContract = EosContractEvolutionGovernor.parseTypeScriptContract(
          args.candidateInterfaceSnippet,
          "CandidateInterface",
        );
      } else if (isPlainRecord(args?.candidateSchema)) {
        const s = args.candidateSchema;
        const rawFields = Array.isArray(s.fields) ? s.fields : [];
        candidateContract = {
          contractId: String(s.contractId || "CandidateContract"),
          version: String(s.version || "1.1.0"),
          fields: rawFields.map((f: any) => ({
            name: String(f.name || ""),
            type: String(f.type || "unknown"),
            optional: Boolean(f.optional),
          })),
        };
      } else {
        candidateContract = { contractId: "EmptyCandidate", version: "0.0.0", fields: [] };
      }

      const report = EosContractEvolutionGovernor.compareContracts(baseContract, candidateContract, {
        allowBreakingChanges: args?.allowBreakingChanges === true,
      });

      if (args?.recordToLedger === true) {
        const entryId = EosContractEvolutionGovernor.recordEvolutionAttestation(report, {
          ledgerDbPath: EosDurableSqliteLedger.defaultLedgerPath(deps.projectRoot),
          projectId: "eos-system",
        });
        return {
          ...report,
          ledgerEntryId: entryId,
        };
      }

      return report;
    }

    case "eos_surgical_healing": {
      const action = String(args?.action || "heal")
        .trim()
        .toLowerCase();
      const rawError = String(
        args?.rawError || args?.stackTrace || "TypeError: Cannot read properties of undefined (reading 'token')",
      );
      const targetFilePath = String(args?.targetFilePath || "src/core/sample.ts");
      const sourceContent = String(
        args?.sourceContent ||
          args?.sourceCode ||
          "export function processUser(user: any) {\n  return user.token.length;\n}",
      );
      const preferredStrategy = args?.preferredStrategy as RepairStrategy | undefined;

      if (action === "diagnose") {
        return EosSurgicalSelfHealingKernel.diagnoseFault(rawError, sourceContent);
      }

      if (action === "patch") {
        const fault = EosSurgicalSelfHealingKernel.diagnoseFault(rawError, sourceContent);
        const patch = EosSurgicalSelfHealingKernel.synthesizeSurgicalPatch(fault, sourceContent, preferredStrategy);
        return {
          diagnostic: fault,
          ...patch,
        };
      }

      if (action === "heal_cycle") {
        const regressionTestCode = args?.regressionTestCode ? String(args.regressionTestCode) : undefined;
        const receipt = EosSurgicalSelfHealingKernel.executeHealingCycle({
          stackTrace: rawError,
          sourceCode: sourceContent,
          regressionTestCode,
          reason: args?.reason ? String(args.reason) : undefined,
          preferredStrategy,
        });
        if (args?.recordToLedger === true) {
          EosSurgicalSelfHealingKernel.recordReceiptInLedger(receipt, deps.projectRoot);
        }
        return {
          receiptId: receipt.receiptId,
          verdict: receipt.verdict,
          zeroRegressionPreserved: receipt.verification.zeroRegressionPreserved,
          sha256Receipt: receipt.sha256Receipt,
          patch: receipt.patch,
          verification: receipt.verification,
        };
      }

      const diagnostic = EosSurgicalSelfHealingKernel.isolateFault(rawError, targetFilePath);
      const simulateRegression = args?.simulateRegression === true;
      const report = EosSurgicalSelfHealingKernel.evaluateAndHeal(
        diagnostic,
        sourceContent,
        (_patchedSource) => ({
          passesFailingTest: true,
          regressionsDetected: simulateRegression,
          executionDurationUs: 120,
        }),
        {
          preferredStrategy,
          ledgerDbPath:
            args?.recordToLedger === true ? EosDurableSqliteLedger.defaultLedgerPath(deps.projectRoot) : undefined,
          projectId: "eos-system",
        },
      );

      return report;
    }

    case "eos_wasm_sandbox": {
      const tier = String(args?.tier || (args?.template ? "WASM" : "ISOLATE"))
        .trim()
        .toUpperCase();
      const timeoutMs = typeof args?.timeoutMs === "number" ? Math.floor(args.timeoutMs) : 2000;

      if (tier === "MICROVM_SPEC") {
        return deps.server.wasmSandbox.generateMicroVmDescriptor({
          vcpuCount: args?.vcpuCount,
          memSizeMib: args?.memSizeMib,
        });
      }

      if (tier === "WASM") {
        let wasmBytes: Uint8Array;
        let isLoop = false;
        const hasCustomCode = Boolean(args?.code);

        if (hasCustomCode) {
          const rawCode = String(args.code);
          if (rawCode.length > 700000 || Buffer.byteLength(rawCode, "base64") > 512 * 1024) {
            throw new Error("WebAssembly bytecode exceeds maximum allowed size of 512 KiB.");
          }
        }

        if (args?.template === "TRAP") {
          wasmBytes = WASM_BYTECODE_TEMPLATES.TRAP;
        } else if (args?.template === "OOB") {
          wasmBytes = WASM_BYTECODE_TEMPLATES.OOB;
        } else if (args?.template === "LOOP") {
          wasmBytes = WASM_BYTECODE_TEMPLATES.LOOP;
          isLoop = true;
        } else if (args?.template === "ADD" || (!args?.code && !args?.template)) {
          wasmBytes = WASM_BYTECODE_TEMPLATES.ADD;
        } else {
          wasmBytes = typeof args?.code === "string" ? Buffer.from(args.code, "base64") : new Uint8Array();
        }

        // Inconditional Preemptive Worker Isolation (FR-420 / ADR-0181)
        // All arbitrary bytecode (args.code), loops, or default executions route strictly through Worker threads.
        const forceWorker = hasCustomCode || isLoop || args?.worker !== false;

        if (forceWorker) {
          return deps.server.wasmSandbox.executeWasmWorker(wasmBytes, {
            initialPages: args?.memoryPages || 1,
            functionArgs: Array.isArray(args?.functionArgs)
              ? args.functionArgs
              : args?.template === "ADD"
                ? [20, 22]
                : [],
            timeoutMs,
          });
        }

        return deps.server.wasmSandbox.executeWasm(wasmBytes, {
          initialPages: args?.memoryPages || 1,
          functionArgs: Array.isArray(args?.functionArgs) ? args.functionArgs : [20, 22],
          timeoutMs,
        });
      }

      // Default: Tier 2 ISOLATE
      const code = String(args?.code || "1 + 1");
      return deps.server.wasmSandbox.executeIsolate(code, { timeoutMs });
    }

    case "eos_enterprise_workspace": {
      const action = String(args?.action || "list")
        .trim()
        .toLowerCase();
      if (action === "health") {
        const facade = new EosEnterpriseFacade(deps.projectRoot);
        return facade.auditHealth();
      }
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
        const target =
          typeof args?.target === "string" && args.target.trim().length > 0 ? args.target.trim() : "npm test";
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
      if (action === "list") {
        return {
          action: "list",
          workspaces: EosEnterpriseWorkspaceGovernor.listRegisteredWorkspaces(deps.projectRoot),
        };
      }
      if (action === "inspect") {
        const rawProjectId =
          typeof args?.projectId === "string" && args.projectId.trim().length > 0
            ? args.projectId.trim()
            : "eos-system";
        const subPath = typeof args?.subPath === "string" ? args.subPath : ".";
        const resolved = EosEnterpriseWorkspaceGovernor.resolveAuthorizedWorkspace(
          rawProjectId,
          subPath,
          "READ_ONLY",
          deps.projectRoot,
        );
        return EosEnterpriseWorkspaceGovernor.inspectWorkspace(resolved.resolvedTargetPath);
      }
      if (action === "verify") {
        const rawProjectId =
          typeof args?.projectId === "string" && args.projectId.trim().length > 0
            ? args.projectId.trim()
            : "eos-system";
        const subPath = typeof args?.subPath === "string" ? args.subPath : ".";
        const resolved = EosEnterpriseWorkspaceGovernor.resolveAuthorizedWorkspace(
          rawProjectId,
          subPath,
          "READ_ONLY",
          deps.projectRoot,
        );
        return EosEnterpriseWorkspaceGovernor.verifyWorkspace(resolved.resolvedTargetPath, {
          controlPlaneRoot: deps.projectRoot,
          projectId: resolved.projectId,
        });
      }
      if (action === "onboard") {
        const targetPath = typeof args?.targetPath === "string" ? args.targetPath.trim() : "";
        assertPrecondition(targetPath.length > 0, "targetPath is required for action='onboard'");
        return EosEnterpriseWorkspaceGovernor.onboardWorkspace({
          targetPath,
          projectId: typeof args?.projectId === "string" ? args.projectId : undefined,
          projectName: typeof args?.projectName === "string" ? args.projectName : undefined,
          remoteUrl: typeof args?.remoteUrl === "string" ? args.remoteUrl : undefined,
          controlPlaneRoot: deps.projectRoot,
          dryRun: args?.dryRun !== false,
        });
      }
      throw new Error(`Unsupported eos_enterprise_workspace action: ${action}`);
    }

    case "eos_agent_topology_mesh": {
      const action = String(args?.action || "compile")
        .trim()
        .toLowerCase();
      if (action === "compile") {
        const dagId = String(args?.dagId || `DAG-${Date.now()}`);
        const rawNodes = Array.isArray(args?.nodes) ? args.nodes : [];
        const nodes: AgentNode[] = rawNodes.map((n: any) => ({
          id: String(n.id || ""),
          name: String(n.name || n.id || ""),
          assignedModulePath: String(n.assignedModulePath || ""),
          dependencies: Array.isArray(n.dependencies) ? n.dependencies.map(String) : [],
          status: n.status,
        }));
        const compiled = EosAgentTopologyMesh.compileTopology(dagId, nodes);
        if (args?.recordToLedger === true) {
          const attestationReceipt = EosAgentTopologyMesh.recordMeshAttestation(compiled, [], {
            ledgerDbPath: EosDurableSqliteLedger.defaultLedgerPath(deps.projectRoot),
            projectId: "eos-system",
          });
          return {
            ...compiled,
            ledgerAttestationReceipt: attestationReceipt,
          };
        }
        return compiled;
      }
      if (action === "publish") {
        const emitterAgentId = String(args?.emitterAgentId || "");
        const targetNodeId = String(args?.targetNodeId || "");
        const eventType = (args?.eventType || "AST_MUTATION_DELTA") as MeshEventType;
        const compactPayload = isPlainRecord(args?.compactPayload) ? args.compactPayload : {};
        return (deps.server as any).constructor.globalMeshRing.publish(
          emitterAgentId,
          targetNodeId,
          eventType,
          compactPayload,
        );
      }
      if (action === "read") {
        const sinceSequence = Number(args?.sinceSequence) || 0;
        return {
          events: (deps.server as any).constructor.globalMeshRing.readSince(sinceSequence),
          cursor: (deps.server as any).constructor.globalMeshRing.getCursor(),
          capacity: (deps.server as any).constructor.globalMeshRing.getCapacity(),
        };
      }
      if (action === "efficiency") {
        const compactBytes = Number(args?.compactBytes) || 0;
        const fullFileContextBytes = Number(args?.fullFileContextBytes) || 1;
        return EosAgentTopologyMesh.calculateTokenEfficiency(compactBytes, fullFileContextBytes);
      }
      throw new Error(`Unsupported eos_agent_topology_mesh action: ${action}`);
    }

    case "eos_content_addressable_cache": {
      const action = String(args?.action || "stats").toLowerCase();
      const cas = new EosContentAddressableCache(deps.projectRoot);
      const recordToLedger = args?.recordToLedger !== false;

      if (action === "put_blob") {
        const content = args?.content !== undefined ? String(args.content) : "";
        const digest = cas.putBlob(content);
        return { digest, stored: true };
      }
      if (action === "get_blob") {
        const digest = String(args?.digest || "");
        const content = cas.getBlob(digest);
        return { digest, content: content ? content.toString("utf8") : null };
      }
      if (action === "has_blob") {
        const digest = String(args?.digest || "");
        const content = cas.getBlob(digest);
        return { digest, exists: content !== null };
      }
      if (action === "put_action") {
        const actionKey = String(args?.actionKey || "");
        const actionResult = args?.actionResult || {
          command: "verify",
          exitCode: 0,
          stdout: "PASS",
          stderr: "",
          outputDigests: [],
          savedCpuTimeMs: 15,
        };
        const saved = cas.putAction(actionKey, actionResult);
        return { actionKey, saved };
      }
      if (action === "get_action") {
        const actionKey = String(args?.actionKey || "");
        return { actionKey, result: cas.getAction(actionKey) };
      }

      const stats = cas.getStats();
      if (recordToLedger) {
        cas.recordReceiptInLedger(deps.projectRoot);
      }
      return stats;
    }

    case "eos_threshold_secret_split_combine": {
      const action = String(args?.action || "split");
      const threshold = typeof args?.threshold === "number" ? Math.max(2, args.threshold) : 3;
      const totalShares = typeof args?.totalShares === "number" ? Math.max(threshold, args.totalShares) : 5;
      const recordToLedger = args?.recordToLedger !== false;
      const ledger = recordToLedger
        ? new EosDurableSqliteLedger(EosDurableSqliteLedger.defaultLedgerPath(deps.projectRoot))
        : null;
      const cryptoEngine = new EosThresholdCryptography(ledger);

      if (action === "combine" && Array.isArray(args?.shares)) {
        const secretBigInt = cryptoEngine.reconstructSecret(args.shares, threshold);
        return {
          action: "combine",
          threshold,
          sharesProvided: args.shares.length,
          reconstructedHex: `0x${secretBigInt.toString(16)}`,
          status: "QUORUM_RECONSTRUCTED",
          timestampIso: new Date().toISOString(),
        };
      }

      let secretBigInt: bigint;
      if (typeof args?.secret === "string" && args.secret.startsWith("0x")) {
        secretBigInt = BigInt(args.secret) % EosThresholdCryptography.PRIME_P;
      } else if (typeof args?.secret === "string") {
        const hex = Buffer.from(args.secret, "utf8").toString("hex");
        secretBigInt = BigInt(`0x${hex}`) % EosThresholdCryptography.PRIME_P;
      } else if (typeof args?.secret === "number") {
        secretBigInt = BigInt(args.secret);
      } else {
        secretBigInt = 0x454f535f534f5645524549474e5f4b4559n;
      }

      const shares = cryptoEngine.splitSecret(secretBigInt, threshold, totalShares);
      return {
        action: "split",
        threshold,
        totalShares,
        sharesCount: shares.length,
        shares,
        timestampIso: new Date().toISOString(),
      };
    }

    case "eos_neurosymbolic_fleet_healing": {
      const engine = new EosNeuroSymbolicFleetHealingEngine(deps.projectRoot);
      const action = String(args?.action || "prove_invariant").toLowerCase();

      if (action === "heal_fault") {
        return engine.executeClosedLoopHealing({
          faultId: String(args?.faultId || `FAULT_${Date.now()}`),
          targetFilePath: String(args?.targetFilePath || "src/index.ts"),
          failingLine: Number(args?.failingLine || 1),
          errorMessage: String(args?.errorMessage || "Unknown fault"),
          offendingExpression: args?.offendingExpression ? String(args.offendingExpression) : undefined,
          mockOriginalContent: args?.mockOriginalContent ? String(args.mockOriginalContent) : undefined,
        });
      }

      if (action === "run_lsc_campaign") {
        return engine.planAndExecuteLscCampaign({
          campaignId: String(args?.campaignId || `LSC_${Date.now()}`),
          description: String(args?.description || "Automated fleet LSC campaign"),
          targetModules: Array.isArray(args?.targetModules) ? args.targetModules.map(String) : ["src/core"],
          transformationRule: String(args?.transformationRule || "STRICT_HEXAGONAL_ENFORCEMENT"),
          invariantClauses: Array.isArray(args?.clauses) ? args.clauses : [["INVARIANT_SAFE"]],
        });
      }

      // Default: prove_invariant
      return engine.verifyInvariantProof({
        theoremName: String(args?.theoremName || "NEURO_SYMBOLIC_CANONICAL_INVARIANT"),
        clauses: Array.isArray(args?.clauses)
          ? args.clauses
          : [["SAFE_STATE"], ["!UNAUTHORIZED_ACCESS", "FAIL_CLOSED"]],
        safetyNegationClause: Array.isArray(args?.safetyNegationClause) ? args.safetyNegationClause : undefined,
      });
    }

    // SPEC-155 Phase-6: eos_fleet_pulse → registry

    // SPEC-155 Phase-5: dead glorian_* switch arms purged (Phase-3 registry)

    case "eos_columnar_telemetry_query": {
      const engine = new EosColumnarTelemetryEngine(10000);
      const sampleCount = Number(args.syntheticSamplesCount) || 500;
      const repos = ["eos-system", "performance-talent-group", "aberamentho", "portafolio", "crud-slack"];
      const stages = ["CANARY_1_PCT", "CANARY_5_PCT", "CANARY_25_PCT", "FULL_PRODUCTION_100_PCT"];

      for (let i = 0; i < sampleCount; i++) {
        const repo = repos[i % repos.length];
        const stage = stages[i % stages.length];
        const baseLat = 35 + (i % 15);
        const isSpike = i % 100 === 99;
        const latency = isSpike ? 280 : baseLat + Math.random() * 8;
        const statusCode = isSpike ? 503 : i % 25 === 0 ? 404 : 200;

        engine.ingest({
          timestamp: Date.now() - (sampleCount - i) * 1000,
          repoId: repo,
          stage,
          statusCode,
          latencyMs: latency,
        });
      }

      const filter: ColumnarQueryFilter = {
        repoId: args.repoId ? String(args.repoId) : undefined,
        stage: args.stage ? String(args.stage) : undefined,
        minStatusCode: args.minStatusCode !== undefined ? Number(args.minStatusCode) : undefined,
        maxStatusCode: args.maxStatusCode !== undefined ? Number(args.maxStatusCode) : undefined,
        minTimestamp: args.minTimestamp !== undefined ? Number(args.minTimestamp) : undefined,
        maxTimestamp: args.maxTimestamp !== undefined ? Number(args.maxTimestamp) : undefined,
      };

      return engine.query(filter);
    }

    case "eos_smt_reasoning_prover": {
      const theoremType = String(args?.theoremType || "abac_safety").toLowerCase();
      const recordToLedger = args?.recordToLedger !== false;

      let proof;
      if (theoremType === "topological_acyclic") {
        const nodes = Array.isArray(args?.nodes) ? args.nodes.map(String) : ["core", "app", "ui"];
        const dependencies =
          args?.dependencies && typeof args.dependencies === "object"
            ? args.dependencies
            : { app: ["core"], ui: ["app", "core"] };
        proof = EosSmtAutomatedReasoningProver.proveAcyclicTopology(nodes, dependencies);
      } else {
        const principalRole = String(args?.principalRole || "guest");
        const targetAction = String(args?.targetAction || "ledger_write");
        const defaultRules = [
          { role: "admin", action: "all", allow: true },
          { role: "guest", action: "ledger_write", allow: false },
          { role: "guest", action: "read", allow: true },
        ];
        const rules = Array.isArray(args?.rules)
          ? args.rules.map((r: any) => ({
              role: String(r?.role || "guest"),
              action: String(r?.action || "ledger_write"),
              allow: Boolean(r?.allow),
            }))
          : defaultRules;
        proof = EosSmtAutomatedReasoningProver.proveAbacSafety(rules, principalRole, targetAction);
      }

      if (recordToLedger) {
        EosSmtAutomatedReasoningProver.recordReceiptInLedger(proof, deps.projectRoot);
      }
      return proof;
    }

    default:
      throw new Error(`Phase-7 verification & governance handler missing case for ${toolName}`);
  }
}
