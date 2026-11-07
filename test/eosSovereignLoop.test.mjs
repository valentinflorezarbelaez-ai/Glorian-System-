import test from "node:test";
import assert from "node:assert/strict";

import { EosSovereignLoop, SOVEREIGN_21_STAGES } from "../src/core/eosSovereignLoop.ts";

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
});
