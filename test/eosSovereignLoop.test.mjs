import test from "node:test";
import assert from "node:assert/strict";

import { EosSovereignLoop, SOVEREIGN_21_STAGES } from "../src/core/eosSovereignLoop.ts";
import {
  HashChainBlock,
  EosMonotonicHashChain,
  MonotonicClock,
  pureSha256,
  GENESIS_PREVIOUS_HASH,
} from "../src/core/eosMonotonicHashChain.ts";

test("EosSovereignLoop — 21-Stage Inventory & Structural Integrity", () => {
  assert.equal(SOVEREIGN_21_STAGES.length, 21);

  // Invariant: Stage IDs must be strictly 1 through 21
  for (let i = 0; i < 21; i++) {
    const s = SOVEREIGN_21_STAGES[i];
    assert.equal(s.id, i + 1);
    assert.ok(s.code.length > 0);
    assert.ok(s.name.length > 0);
    assert.ok(["INTEL", "GOVERNANCE", "EXECUTION", "VERIFICATION", "RELEASE"].includes(s.phaseGroup));
  }
});

test("EosSovereignLoop — Law VI Absolute Security & Zero Plain Secrets", () => {
  const engine = new EosSovereignLoop();

  // Clean prompt should initialize without issue
  assert.doesNotThrow(() => {
    engine.initializePipeline({
      projectId: "test-project",
      title: "Valid Feature Request",
      userPrompt: "Implement high performance caching layer.",
    });
  });

  // Prompt containing OpenAI secret key must be blocked immediately
  assert.throws(() => {
    engine.initializePipeline({
      projectId: "breach-project",
      title: "Secret Leak",
      userPrompt: "Use this secret key: sk-1234567890abcdef1234567890",
    });
  }, /SECURITY_BREACH_DETECTED/);
});

test("EosSovereignLoop — Law II Strict Gate Enforcement (No Code Before Auth)", () => {
  const engine = new EosSovereignLoop();
  const context = engine.initializePipeline({
    projectId: "gate-test",
    title: "Unauthorized Implementation",
    userPrompt: "Build something quickly without authorization.",
    authLevel: 0, // Explicitly unauthorized
  });

  // Stages 1 to 7 should execute smoothly
  for (let i = 1; i <= 7; i++) {
    const res = engine.executeStage(i, context);
    assert.equal(res.status, "COMPLETED");
  }

  // Attempting stage 10 (IMPLEMENTATION) without authorization must fail closed
  assert.throws(() => {
    engine.executeStage(10, context);
  }, /GATE_INVARIANT_VIOLATION/);
});

test("EosSovereignLoop — Full 21-Step Pipeline Execution & Cryptographic Receipt", () => {
  const engine = new EosSovereignLoop();
  const progressLogs = [];

  const summary = engine.runFullPipeline(
    {
      projectId: "sovereign-core",
      title: "High Assurance Kernel",
      userPrompt: "Build sovereign kernel memory protection layer.",
      authLevel: 3,
      authorizedBy: "Valentín Flórez Arbeláez",
    },
    {
      onStageProgress: (id, name) => {
        progressLogs.push(`Stage ${id}: ${name}`);
      },
    },
  );

  assert.equal(summary.totalStages, 21);
  assert.equal(summary.completedStages, 21);
  assert.equal(summary.epistemicState, "PRODUCTION_READY");
  assert.equal(progressLogs.length, 21);
  assert.ok(summary.sha256Receipt.length === 64);

  // Validate cryptographic receipt
  assert.equal(engine.verifyReceipt(summary), true);

  // Tampered summary must fail receipt validation
  const tamperedSummary = { ...summary, completedStages: 20 };
  assert.equal(engine.verifyReceipt(tamperedSummary), false);

  // Verify internal hash-chain ledger
  const ledger = engine.getLedger();
  const ledgerVerification = ledger.verify();
  assert.equal(ledgerVerification.valid, true);
  assert.equal(ledgerVerification.totalBlocks, 21);
});

test("EosSovereignLoop — EARS, BDD & ADR Scaffolding Synthesis", () => {
  // Test EARS generation
  const ears = EosSovereignLoop.scaffoldEarsSpec("Autotuner Engine", [
    { type: "event", trigger: "recibe carga de 100K ops/s", systemResponse: "amplía el buffer pool" },
    { type: "state", condition: "la memoria está al 90%", systemResponse: "ejecuta purga L0" },
    { type: "error", condition: "falla la firma de integridad", systemResponse: "aísla el módulo" },
    { type: "ubiquitous", systemResponse: "mantiene latencia sub-milisegundo" },
  ]);

  assert.ok(ears.includes("CUANDO recibe carga de 100K ops/s"));
  assert.ok(ears.includes("MIENTRAS la memoria está al 90%"));
  assert.ok(ears.includes("SI falla la firma de integridad"));
  assert.ok(ears.includes("EL SISTEMA mantiene latencia sub-milisegundo"));

  // Test BDD generation
  const bdd = EosSovereignLoop.scaffoldBddScenario(
    "Auto-escalado reactivo",
    "un cluster bajo carga nominal",
    "se inyecta una ráfaga masiva",
    "el sistema procesa la ráfaga sin descartes",
    ["el tiempo de respuesta se mantiene bajo 5ms"],
  );
  assert.ok(bdd.includes("DADO un cluster bajo carga nominal"));
  assert.ok(bdd.includes("ENTONCES el sistema procesa la ráfaga sin descartes"));

  // Test ADR generation
  const adr = EosSovereignLoop.generateAdrPlan(
    "Layer 0 Buffer Pooling",
    "Alta tasa de asignación en heap provoca pausas GC",
    "Implementar buffer pooling estático en Capa 0",
    [{ name: "Garbage Collector dinámico de V8", rationale: "Pausas Stop-The-World inaceptables" }],
  );
  assert.ok(adr.includes("## Rejected Alternatives"));
  assert.ok(adr.includes("Pausas Stop-The-World inaceptables"));

  // Test Atomic Task DAG generation
  const dag = EosSovereignLoop.generateAtomicTasksDag([
    { id: "TASK-01", name: "Domain Kernel", dependencies: [], doneCriteria: "100% tests pass" },
    { id: "TASK-02", name: "Adapter Layer", dependencies: ["TASK-01"], doneCriteria: "Hexagonal purity" },
  ]);
  assert.ok(dag.includes("# ATOMIC TASK DAG"));
  assert.ok(dag.includes("Depends on: None"));
  assert.ok(dag.includes("Depends on: TASK-01"));
  assert.ok(dag.includes("Done criteria: 100% tests pass"));

  // Test EARS defaults
  const earsDefaults = EosSovereignLoop.scaffoldEarsSpec("Defaults Engine", [
    { type: "event", systemResponse: "default trigger" },
    { type: "state", systemResponse: "default condition" },
    { type: "error", systemResponse: "default error" },
    { type: "ubiquitous", systemResponse: "always active" },
  ]);
  assert.ok(earsDefaults.includes("CUANDO evento, EL SISTEMA default trigger."));
  assert.ok(earsDefaults.includes("MIENTRAS estado activo, EL SISTEMA default condition."));
  assert.ok(earsDefaults.includes("SI condición anómala, ENTONCES EL SISTEMA default error."));
  assert.ok(earsDefaults.includes("EL SISTEMA always active."));
});

test("EosSovereignLoop — Error Boundaries and Boundary Conditions", () => {
  const engine = new EosSovereignLoop();

  // Missing title or prompt
  assert.throws(
    () => engine.initializePipeline({ projectId: "p", title: "", userPrompt: "prompt" }),
    /Sovereign request must provide both 'title' and 'userPrompt'/,
  );
  assert.throws(
    () => engine.initializePipeline({ projectId: "p", title: "title", userPrompt: "" }),
    /Sovereign request must provide both 'title' and 'userPrompt'/,
  );

  // All Law VI secret detection regex patterns
  assert.throws(
    () =>
      engine.initializePipeline({
        projectId: "p",
        title: "t",
        userPrompt: ["ghp_", "0123456789abcdef0123456789"].join(""),
      }),
    /SECURITY_BREACH_DETECTED/,
  );
  assert.throws(
    () => engine.initializePipeline({ projectId: "p", title: "t", userPrompt: ["AK", "IA0123456789ABCDEF"].join("") }),
    /SECURITY_BREACH_DETECTED/,
  );
  assert.throws(
    () =>
      engine.initializePipeline({
        projectId: "p",
        title: "t",
        userPrompt: ["pass", 'word = "mysecretpassword123"'].join(""),
      }),
    /SECURITY_BREACH_DETECTED/,
  );
  assert.throws(
    () =>
      engine.initializePipeline({
        projectId: "p",
        title: "t",
        userPrompt: ["bear", "er tokenabcdef0123456789abcdef0123456789"].join(""),
      }),
    /SECURITY_BREACH_DETECTED/,
  );

  const ctx = engine.initializePipeline({ projectId: "p", title: "t", userPrompt: "clean prompt" });

  // Invalid stage ID
  assert.throws(() => engine.executeStage(999, ctx), /Invalid pipeline stage ID: 999/);

  // Partial pipeline execution with stopAtStage and no options
  const partialSummary = engine.runFullPipeline(
    { projectId: "p-part", title: "Partial Run", userPrompt: "Do stages 1 to 5" },
    { stopAtStage: 5 },
  );
  assert.equal(partialSummary.totalStages, 5);
  assert.equal(partialSummary.completedStages, 5);

  const defaultSummary = engine.runFullPipeline({
    projectId: "p-def",
    title: "Default Run",
    userPrompt: "Run everything",
    authLevel: 3,
  });
  assert.equal(defaultSummary.totalStages, 21);
  assert.equal(defaultSummary.completedStages, 21);
});

test("EosMonotonicHashChain — Exhaustive Cryptographic & Tamper Tests", () => {
  // UTF-8 multi-byte encoding in pureSha256
  assert.equal(pureSha256("café").length, 64);
  assert.equal(pureSha256("precio: 100€").length, 64);
  assert.equal(pureSha256("Rocket 🚀 and kanji 𠮷").length, 64);

  // MonotonicClock fallback and reset
  let count = 0;
  const mockClock = new MonotonicClock({
    monotonicProvider: () => {
      count++;
      return count === 2 ? 100n : 100n; // second call produces identical monotonicNs, triggering <= condition
    },
    wallClockProvider: () => "2026-01-01T00:00:00.000Z",
  });
  const t1 = mockClock.now();
  const t2 = mockClock.now();
  assert.ok(t2.monotonicNs > t1.monotonicNs);

  mockClock.reset(500n);
  const t3 = mockClock.now();
  assert.ok(t3.monotonicNs >= 500n);

  // HashChainBlock constructor invariant checks
  const payload = {
    recordId: "rec-1",
    type: "TEST",
    payloadHash: pureSha256("rec-1:TEST:sum:{}"),
    summary: "sum",
  };

  assert.throws(
    () =>
      new HashChainBlock({
        index: -1,
        previousHash: GENESIS_PREVIOUS_HASH,
        payload,
        wallClockIso: "2026-01-01T00:00:00.000Z",
        monotonicNs: 1n,
      }),
    /index cannot be negative/,
  );

  assert.throws(
    () =>
      new HashChainBlock({
        index: 0,
        previousHash: "invalid_prev_hash",
        payload,
        wallClockIso: "2026-01-01T00:00:00.000Z",
        monotonicNs: 1n,
      }),
    /Genesis block \(index 0\) must have previousHash equal to/,
  );

  assert.throws(
    () =>
      new HashChainBlock({
        index: 0,
        previousHash: GENESIS_PREVIOUS_HASH,
        payload,
        wallClockIso: "2026-01-01T00:00:00.000Z",
        monotonicNs: 1n,
        currentHash: "tampered_hash_1234567890abcdef1234567890abcdef1234567890abcdef12345678",
      }),
    /Block hash mismatch for index 0/,
  );

  const genesis = HashChainBlock.createGenesis(payload, "2026-01-01T00:00:00.000Z", 1000n);

  // createNextBlock with decreasing monotonicNs
  assert.throws(
    () => HashChainBlock.createNextBlock(genesis, payload, "2026-01-01T00:00:00.000Z", 500n),
    /Monotonic time cannot decrease in hash chain/,
  );

  // verifyChain empty
  assert.equal(HashChainBlock.verifyChain([]).valid, true);

  // verifyChain first block index !== 0
  const fakeBlock1 = new HashChainBlock({
    index: 1,
    previousHash: genesis.currentHash,
    payload,
    wallClockIso: "2026-01-01T00:00:00.000Z",
    monotonicNs: 2000n,
  });
  const resBadFirst = HashChainBlock.verifyChain([fakeBlock1]);
  assert.equal(resBadFirst.valid, false);
  assert.ok(resBadFirst.reason?.includes("First block must be genesis with index 0"));

  // verifyChain tampered genesis payload
  const tamperedGenPayload = {
    ...genesis,
    payload: { ...genesis.payload, summary: "tampered_summary" },
  };
  const resTamperedGenPayload = HashChainBlock.verifyChain([tamperedGenPayload]);
  assert.equal(resTamperedGenPayload.valid, false);
  assert.ok(resTamperedGenPayload.reason?.includes("Genesis payload content hash mismatch"));

  // verifyChain tampered genesis hash
  const tamperedGenHash = { ...genesis, currentHash: "deadbeef".repeat(8) };
  const resTamperedGenHash = HashChainBlock.verifyChain([tamperedGenHash]);
  assert.equal(resTamperedGenHash.valid, false);
  assert.ok(resTamperedGenHash.reason?.includes("Genesis hash verification failed"));

  // 2-block chain checks
  const payload2 = {
    recordId: "rec-2",
    type: "TEST",
    payloadHash: pureSha256("rec-2:TEST:sum2:{}"),
    summary: "sum2",
  };
  const block1 = HashChainBlock.createNextBlock(genesis, payload2, "2026-01-01T00:00:01.000Z", 2000n);
  const block2 = HashChainBlock.createNextBlock(block1, payload2, "2026-01-01T00:00:02.000Z", 3000n);

  // Gap in index (0, 2)
  const resGap = HashChainBlock.verifyChain([genesis, block2]);
  assert.equal(resGap.valid, false);
  assert.ok(resGap.reason?.includes("Non-consecutive index gap"));

  // Predicate previousHash mismatch
  const badPrev = { ...block1, previousHash: "wrong_previous_hash_value" };
  const resBadPrev = HashChainBlock.verifyChain([genesis, badPrev]);
  assert.equal(resBadPrev.valid, false);
  assert.ok(resBadPrev.reason?.includes("does not match predecessor hash"));

  // Decreased monotonicNs in block 1
  const decreasedMono = { ...block1, monotonicNs: 500n };
  const resDecreasedMono = HashChainBlock.verifyChain([genesis, decreasedMono]);
  assert.equal(resDecreasedMono.valid, false);
  assert.ok(resDecreasedMono.reason?.includes("Monotonic clock decreased at block 1"));

  // Tampered payload in block 1
  const tamperedPayloadBlock1 = {
    ...block1,
    payload: { ...block1.payload, summary: "tampered_p1" },
  };
  const resTamperedPayloadBlock1 = HashChainBlock.verifyChain([genesis, tamperedPayloadBlock1]);
  assert.equal(resTamperedPayloadBlock1.valid, false);
  assert.ok(resTamperedPayloadBlock1.reason?.includes("payload content hash mismatch"));

  // Tampered block hash in block 1
  const tamperedHashBlock1 = { ...block1, currentHash: "deadbeef".repeat(8) };
  const resTamperedHashBlock1 = HashChainBlock.verifyChain([genesis, tamperedHashBlock1]);
  assert.equal(resTamperedHashBlock1.valid, false);
  assert.ok(resTamperedHashBlock1.reason?.includes("hash mismatch (tampered payload or header)"));

  // toJSON and fromJSON
  const jsonBlock = block1.toJSON();
  const restoredBlock = HashChainBlock.fromJSON(jsonBlock);
  assert.equal(restoredBlock.index, block1.index);
  assert.equal(restoredBlock.currentHash, block1.currentHash);

  // EosMonotonicHashChain helper methods
  const chain = new EosMonotonicHashChain();
  assert.equal(chain.getLatestBlock(), null);
  assert.equal(chain.getBlocks().length, 0);

  chain.append("id-1", "EVENT", "First entry", { foo: "bar" });
  chain.append("id-2", "EVENT", "Second entry");

  assert.equal(chain.getBlocks().length, 2);
  assert.equal(chain.getLatestBlock()?.index, 1);

  const chainJson = chain.toJSON();
  assert.equal(chainJson.length, 2);

  const loadedChain = new EosMonotonicHashChain();
  loadedChain.loadFromJSON(chainJson);
  assert.equal(loadedChain.getBlocks().length, 2);
  assert.equal(loadedChain.verify().valid, true);
});
