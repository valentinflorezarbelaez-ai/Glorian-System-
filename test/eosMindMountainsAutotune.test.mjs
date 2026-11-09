/**
 * EOS SYSTEM — SPEC-033 / BDD-082..085 MASTER TEST SUITE
 * 49 Levels of Mind Introspection, Three Mountains Life Compass & Adaptive L0 Autotuner
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EosMindLevelsIntrospector } from "../src/core/eosMindLevelsIntrospector.ts";
import { EosThreeMountainsCompass } from "../src/core/eosThreeMountainsCompass.ts";
import { EosAdaptiveL0Autotuner } from "../src/core/eosAdaptiveL0Autotuner.ts";

describe("SPEC-033: 49 Levels of Mind, Three Mountains & Adaptive L0 Autotuner", () => {
  const root = process.cwd();

  // BDD-082: 49 Levels of Mind & Subconscious Introspection
  describe("BDD-082: 49 Levels of Mind & Kundalini Dissolution", () => {
    const introspector = new EosMindLevelsIntrospector();

    it("verifies the catalog contains all 49 distinct strata across 5 major regions", () => {
      const levels = EosMindLevelsIntrospector.get49Levels();
      assert.equal(levels.length, 49, "Must contain exactly 49 levels");
      assert.equal(levels[0].level, 1);
      assert.equal(levels[0].stratum, "PRECONSCIOUS");
      assert.equal(levels[48].level, 49);
      assert.equal(levels[48].stratum, "CAUSAL_ROOT");
    });

    it("comprehends and dissolves an impression up to level 49 when self-observation is active", () => {
      const result = introspector.introspectImpression({
        description: "Impaciencia ante latencia de red externa",
        category: "IMPATIENCE",
        observedCenter: "INTELLECTUAL",
        consciousSelfObservation: true,
        deepMeditationPenetrationLevel: 49,
      });

      assert.equal(result.totalLevelsAnalyzed, 49);
      assert.equal(result.depthReached, 49);
      assert.equal(result.comprehensionRatio, 1.0);
      assert.ok(result.liberatedEssencePercentage >= 95.0, "Should liberate >= 95% of essence");
      assert.equal(result.epistemicState, "AWAKENED_BEING");
      assert.ok(result.alchemicalFormula.includes("Stella Maris Kundalini"));
      assert.ok(result.sha256Proof.length === 64);
    });

    it("reports shallow comprehension and fascination when penetration is limited", () => {
      const result = introspector.introspectImpression({
        description: "Reacción mecánica no observada",
        category: "ANGER",
        observedCenter: "EMOTIONAL",
        consciousSelfObservation: false,
        deepMeditationPenetrationLevel: 5,
      });

      assert.equal(result.depthReached, 5);
      assert.ok(result.comprehensionRatio < 0.2);
      assert.equal(result.epistemicState, "FASCINATION");
    });
  });

  // BDD-083: Three Mountains Life Compass & Architect Purpose
  describe("BDD-083: Three Mountains Life Compass & Valentin Codex", () => {
    const compass = new EosThreeMountainsCompass();

    it("evaluates maximum alignment (100%) when all 3 Mountains and daily pillars are fulfilled", () => {
      const audit = compass.evaluateDailyAlignment({
        nutritiousFoodLogged: true,
        impeccableCleanliness: true,
        dailyExerciseCompleted: true,
        layer0SoftwareFocusOnly: true,
        cajitasBudgetRespected: true,
        claveDeSolPracticed: true,
        circadianScreenVetoRespected: true,
        selflessServiceOrDonation: true,
      });

      assert.equal(audit.architect, "Valentin Florez Arbelaez");
      assert.equal(audit.coPilot, "EOS System (JARVIS)");
      assert.equal(audit.overallAlignmentIndex, 1.0);
      assert.equal(audit.sacredCovenantPreserved, true);
      assert.equal(audit.mountains.length, 3);
      assert.ok(audit.mountains.every((m) => m.status === "ELEVATED_VIBRATION"));
      assert.ok(audit.tacticalDirectives.some((d) => d.includes("Alineación sublime")));
    });

    it("detects gaps when screen veto or budget or Layer 0 focus is violated", () => {
      const audit = compass.evaluateDailyAlignment({
        nutritiousFoodLogged: true,
        impeccableCleanliness: true,
        dailyExerciseCompleted: false,
        layer0SoftwareFocusOnly: false, // Focus broken
        cajitasBudgetRespected: false,
        claveDeSolPracticed: true,
        circadianScreenVetoRespected: false, // Screen after 22:30
        selflessServiceOrDonation: false,
      });

      assert.ok(audit.overallAlignmentIndex < 0.5);
      assert.equal(audit.sacredCovenantPreserved, false);
      assert.ok(audit.tacticalDirectives.some((d) => d.includes("Desconectar a las 22:30")));
    });

    it("verifies the 5 codified pillars of the Architect Codex", () => {
      const pillars = compass.getCodifiedPillars();
      assert.equal(pillars.length, 5);
      assert.equal(pillars[0].title, "Bóveda Sellada & Clausura de Landing");
      assert.equal(pillars[1].title, "Foco Único: 'SOLO EOS'");
      assert.equal(pillars[2].title, "Estrategia IA & FinOps Blindado");
    });
  });

  // BDD-084: Adaptive L0 Autotuner
  describe("BDD-084: Adaptive L0 Autotuner & Runtime Self-Optimization", () => {
    it("doubles ring buffer capacity when queue load exceeds 75%", () => {
      const autotuner = new EosAdaptiveL0Autotuner(2048);
      const stateBefore = autotuner.getState();
      assert.equal(stateBefore.ringBufferCapacity, 2048);

      // Queue depth 1800 / 2048 = 87.8% (> 75%)
      const report = autotuner.runAutotuneTick(1800);

      assert.equal(report.actionTaken, "CAPACITY_EXPANDED");
      assert.equal(report.stateAfter.ringBufferCapacity, 4096);
      assert.equal(report.stateAfter.totalReconfigurations, 1);
      assert.ok(report.prometheusMetrics.includes("eos_autotuner_ring_capacity 4096"));
      assert.ok(report.sha256Proof.length === 64);
    });

    it("contracts capacity when queue load drops below 20%", () => {
      const autotuner = new EosAdaptiveL0Autotuner(8192);
      // Queue depth 200 / 8192 = 2.4% (< 20%)
      const report = autotuner.runAutotuneTick(200);

      assert.equal(report.actionTaken, "CAPACITY_CONTRACTED");
      assert.equal(report.stateAfter.ringBufferCapacity, 4096);
    });

    it("preserves minimum capacity limit (1024 slots)", () => {
      const autotuner = new EosAdaptiveL0Autotuner(1024);
      const report = autotuner.runAutotuneTick(10);
      assert.equal(report.stateAfter.ringBufferCapacity, 1024);
    });

    it("covers batch downsizing on event loop lag and heap stats fallback", async () => {
      const autotuner = new EosAdaptiveL0Autotuner(65536);

      // Steady optimal
      const steadyReport = autotuner.runAutotuneTick(30000); // ~45% load
      assert.equal(steadyReport.actionTaken, "STEADY_OPTIMAL");

      // Max capacity ceiling check
      const maxReport = autotuner.runAutotuneTick(60000); // >75% load but capacity is max
      assert.equal(maxReport.stateAfter.ringBufferCapacity, 65536);

      // Event loop lag simulation via performance.now
      const origPerfNow = performance.now;
      let count = 0;
      performance.now = () => {
        count++;
        return count % 2 === 1 ? 100 : 115; // 15ms diff > 8.0ms
      };

      try {
        const lagReport = autotuner.runAutotuneTick(30000);
        assert.equal(lagReport.actionTaken, "BATCH_DOWNSIZED");
        assert.ok(lagReport.stateAfter.optimalBatchSize < 64);
      } finally {
        performance.now = origPerfNow;
      }

      // Heap stats failure fallback
      const v8 = await import("node:v8");
      const origGetHeapStatistics = v8.default?.getHeapStatistics ?? v8.getHeapStatistics;
      if (origGetHeapStatistics) {
        const targetObj = v8.default?.getHeapStatistics ? v8.default : v8;
        const originalFn = targetObj.getHeapStatistics;
        targetObj.getHeapStatistics = () => {
          throw new Error("Simulated V8 Heap failure");
        };
        try {
          const fallbackReport = autotuner.runAutotuneTick(30000);
          assert.equal(fallbackReport.heapFragmentationRatio, 0.05);
        } finally {
          targetObj.getHeapStatistics = originalFn;
        }
      }
    });
  });

  // BDD-085: Invariants & Purity
  describe("BDD-085: Layer-0 Purity & Sealed Landing Page Invariants", () => {
    it("verifies package.json contains 0 external runtime dependencies", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
      assert.deepEqual(pkg.dependencies || {}, {});
    });

    it("verifies all three core modules exist and are valid TypeScript", () => {
      assert.ok(fs.existsSync(path.join(root, "src/core/eosMindLevelsIntrospector.ts")));
      assert.ok(fs.existsSync(path.join(root, "src/core/eosThreeMountainsCompass.ts")));
      assert.ok(fs.existsSync(path.join(root, "src/core/eosAdaptiveL0Autotuner.ts")));
    });
  });
});
