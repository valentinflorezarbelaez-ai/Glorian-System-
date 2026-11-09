import test from "node:test";
import assert from "node:assert/strict";
import { EosGnosticTemple } from "../src/core/eosGnosticTemple.ts";
import { EosFinOpsBudget } from "../src/core/eosFinOpsBudget.ts";

test("SPEC-031 / BDD-074: Three-Brain Energy Harmonization & Triamonia", async (t) => {
  const temple = new EosGnosticTemple();

  await t.test("Subsuite 1: Detects Intellectual Hypertrophy (> 70%)", () => {
    // 8 hours coding, 1 hour music, 1 hour motor -> 80% intellectual
    const report = temple.auditThreeBrains(8, 1, 1);
    assert.equal(report.status, "INTELLECTUAL_HYPERTROPHY");
    assert.ok(report.intellectualRatio >= 0.7);
    assert.ok(report.prescriptions.some((p) => p.includes("Cerebro Motor")));
  });

  await t.test("Subsuite 2: Harmonic Balance Preserved", () => {
    // 4 hours intellectual, 3 hours emotional, 3 hours motor/gym -> 40% intellectual
    const report = temple.auditThreeBrains(4, 3, 3);
    assert.equal(report.status, "HARMONIC_EQUILIBRIUM");
    assert.ok(report.prescriptions.some((p) => p.includes("Equilibrio armónico")));
  });
});

test("SPEC-031 / BDD-075: Clave de SOL & Psychological Impression Ledger", async (t) => {
  const temple = new EosGnosticTemple();

  await t.test("Subsuite 1: Full Self-Remembering Evaluates to Awake (100%)", () => {
    const res = temple.evaluateClaveDeSol({
      subjectAware: true,
      objectFocused: true,
      placePresent: true,
    });
    assert.equal(res.consciousnessAwakeScore, 100);
    assert.equal(res.state, "DESPIERTO");
    assert.ok(res.theurgicAdvice.includes("Conciencia despierta"));
  });

  await t.test("Subsuite 2: Absent Mind Evaluates to Fascination", () => {
    const res = temple.evaluateClaveDeSol({
      subjectAware: false,
      objectFocused: false,
      placePresent: false,
    });
    assert.equal(res.consciousnessAwakeScore, 0);
    assert.equal(res.state, "FASCINADO_SUEÑO_CONCIENCIA");
    assert.ok(res.theurgicAdvice.includes("¡Alto!"));
  });

  await t.test("Subsuite 3: Impression Logging & Kundalini Dissolution Formula", () => {
    const imp = temple.recordImpression("Prisa por compilar rápido", "IMPACIENCIA", 7);
    assert.ok(imp.id.startsWith("IMP-"));
    assert.equal(imp.identifiedEgo, "IMPACIENCIA");
    assert.ok(imp.dissolutionFormula.includes("Madre Divina"));

    const log = temple.getImpressionLog();
    assert.ok(log.length >= 1);
  });
});

test("SPEC-031 / BDD-076: Circadian Nightly Screen Veto & Octave Shocks", async (t) => {
  const temple = new EosGnosticTemple();

  await t.test("Subsuite 1: Night Hour Triggers Circadian Rest Veto", () => {
    const nightDate = new Date("2026-10-25T23:30:00");
    const check = temple.checkCircadianVeto(nightDate);
    assert.equal(check.vetoActive, true);
    assert.equal(check.status, "CIRCADIAN_REST_VETO_ACTIVE");
    assert.ok(check.suggestedAction.includes("Ham-Sah"));
  });

  await t.test("Subsuite 2: Morning Hour Authorizes Solar Work", () => {
    const morningDate = new Date("2026-10-25T09:30:00");
    const check = temple.checkCircadianVeto(morningDate);
    assert.equal(check.vetoActive, false);
    assert.equal(check.status, "SOLAR_ACTIVITY_AUTHORIZED");
  });

  await t.test("Subsuite 3: Law of Octaves Semi-Tone Shocks", () => {
    const miShock = temple.prescribeOctaveShock("MI");
    assert.equal(miShock.needsConsciousShock, true);
    assert.equal(miShock.shockType, "PHYSICAL_POWER");

    const siShock = temple.prescribeOctaveShock("SI");
    assert.equal(siShock.needsConsciousShock, true);
    assert.equal(siShock.shockType, "THIRD_FACTOR_SERVICE");

    const reShock = temple.prescribeOctaveShock("RE");
    assert.equal(reShock.needsConsciousShock, false);
  });
});

test("SPEC-031 / BDD-077: Inviolable FinOps Budget Shield & Cajitas", async (t) => {
  const finops = new EosFinOpsBudget(15.0);

  await t.test("Subsuite 1: Micro-Cent Cost Calculation for Models", () => {
    // 100,000 prompt tokens + 20,000 completion tokens on deepseek-reasoner
    // (100k / 1M) * $0.14 = $0.014
    // (20k / 1M) * $0.28 = $0.0056
    // Total = $0.0196
    const cost = finops.calculateCost("deepseek-reasoner", 100_000, 20_000);
    assert.equal(cost, 0.0196);
  });

  await t.test("Subsuite 2: Records Usage Within $15 Budget", () => {
    const res = finops.recordUsage("deepseek", "deepseek-reasoner", 50_000, 10_000);
    assert.equal(res.allowed, true);
    assert.equal(res.breakerTripped, false);

    const report = finops.getReport();
    assert.ok(report.accumulatedSpendUsd > 0);
    assert.equal(report.circuitBreakerState, "CLOSED_BUDGET_HEALTHY");
  });

  await t.test("Subsuite 3: Fail-Closed Circuit Breaker Tripped at Limit", () => {
    const strictBudget = new EosFinOpsBudget(0.01); // 1 cent limit
    strictBudget.recordUsage("claude", "claude-3-7-sonnet", 1000, 500); // costs ~$0.01

    // Exceeding request
    const blocked = strictBudget.recordUsage("gpt", "gpt-4o", 50_000, 50_000);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.breakerTripped, true);

    const report = strictBudget.getReport();
    assert.equal(report.fallbackToLocalEngine, true);
  });

  await t.test("Subsuite 4: Sacred Cajitas State Verification", () => {
    const report = finops.getReport();
    assert.ok(report.cajitas.some((c) => c.name === "El Refugio"));
    assert.ok(report.cajitas.some((c) => c.name === "Comida Nutritiva"));
    assert.ok(report.cajitas.some((c) => c.name === "Tercer Factor / Donaciones"));
    assert.ok(report.cajitas.some((c) => c.name === "IA & Herramientas de Cúspide"));
  });
});
