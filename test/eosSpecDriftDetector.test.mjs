import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosSpecDriftDetector } from "../src/core/eosSpecDriftDetector.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

for (const scenario of [
  {
    name: "a shared phrase outranks generic contract matches",
    module: "eosGoalDrivenDevelopmentContract.ts",
    alternatives: ["SPEC-050-CONTRACT-EVOLUTION.md", "SPEC-163-CONSUMER-DRIVEN-CONTRACT.md"],
    expected: "SPEC-378-goal-driven-factory-engine.md",
  },
  {
    name: "an exact name outranks a shorter substring",
    module: "eosMetricLedger.ts",
    alternatives: ["SPEC-010-LEDGER.md"],
    expected: "SPEC-020-METRIC-LEDGER.md",
  },
]) {
  test(scenario.name, (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eos-drift-match-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const core = path.join(root, "src", "core");
    const specs = path.join(root, "openspec", "specs");
    fs.mkdirSync(core, { recursive: true });
    fs.mkdirSync(specs, { recursive: true });
    const old = new Date("2026-01-01T00:00:00Z");
    const recent = new Date("2026-01-20T00:00:00Z");
    const moduleFile = path.join(core, scenario.module);
    fs.writeFileSync(moduleFile, "export const ready = true;\n");
    fs.utimesSync(moduleFile, recent, recent);
    for (const name of [...scenario.alternatives, scenario.expected]) {
      const file = path.join(specs, name);
      const date = name === scenario.expected ? recent : old;
      fs.writeFileSync(file, `# ${name}\n`);
      fs.utimesSync(file, date, date);
    }
    const detector = new EosSpecDriftDetector(root);
    const options = { driftThresholdDays: 14, checkOrphanSpecs: false };
    assert.deepEqual(detector.detect(options).violations, []);

    const expectedSpec = path.join(specs, scenario.expected);
    fs.utimesSync(expectedSpec, old, old);
    const { violations } = detector.detect(options);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].type, "CODE_NEWER_THAN_SPEC");
    assert.equal(violations[0].specPath, path.relative(root, expectedSpec));
    assert.equal(violations[0].driftDays, 19);
  });
}

test("BDD-273: EosSpecDriftDetector enforces Constitutional Law I zero-drift invariant across all 261 core modules and 172 specs", () => {
  const detector = new EosSpecDriftDetector(projectRoot);
  const report = detector.detect({ driftThresholdDays: 14 });

  assert.ok(report.totalModulesScanned >= 261, `Expected at least 261 modules, got ${report.totalModulesScanned}`);
  assert.ok(report.totalSpecsScanned >= 170, `Expected at least 170 specs, got ${report.totalSpecsScanned}`);
  assert.equal(report.criticalCount, 0, "Expected 0 critical drift violations");
  assert.equal(report.highCount, 0, "Expected 0 high drift violations");
  assert.equal(report.driftScore, 0, "Expected drift score to be 0 (clean)");
  assert.equal(report.isClean, true, "Expected repository to be clean of drift");
  assert.ok(report.sha256.startsWith("sha256:"), "Report must include SHA-256 cryptographic receipt");
});

test("BDD-274: EosSpecDriftDetector flags MODULE_WITHOUT_SPEC in isolated synthetic environment", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-drift-test-"));

  try {
    const srcCore = path.join(tempDir, "src", "core");
    const openspecSpecs = path.join(tempDir, "openspec", "specs");
    fs.mkdirSync(srcCore, { recursive: true });
    fs.mkdirSync(openspecSpecs, { recursive: true });

    // 1. Module with matching spec
    fs.writeFileSync(path.join(srcCore, "eosValidModule.ts"), "export const x = 1;\n");
    fs.writeFileSync(path.join(openspecSpecs, "SPEC-001-VALID-MODULE.md"), "# Spec 1\n");

    // 2. Orphan module without spec
    fs.writeFileSync(path.join(srcCore, "eosUnspeccedComponent.ts"), "export const y = 2;\n");

    const detector = new EosSpecDriftDetector(tempDir);
    const report = detector.detect();

    assert.equal(report.isClean, false);
    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].type, "MODULE_WITHOUT_SPEC");
    assert.equal(report.violations[0].modulePath, "src/core/eosUnspeccedComponent.ts");
    assert.equal(report.violations[0].severity, "HIGH");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
