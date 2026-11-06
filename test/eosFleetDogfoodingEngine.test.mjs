import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EosFleetDogfoodingEngine,
  LawIvExternalWriteBarrierViolation
} from "../src/core/eosFleetDogfoodingEngine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-275: Descubrimiento y auditoría no invasiva de proyectos en la flota (SPEC-100)", () => {
  const engine = new EosFleetDogfoodingEngine(projectRoot);

  // 1. Load registry
  const registry = engine.loadRegistry();
  assert.ok(Array.isArray(registry.projects));
  assert.ok(registry.projects.length >= 5, "Must discover at least 5 registered fleet projects");

  // 2. Audit crud-slack project
  const crudSlackResult = engine.auditTargetProject("crud-slack");
  assert.equal(crudSlackResult.projectId, "crud-slack");
  assert.equal(crudSlackResult.lawIvCompliant, true);
  assert.equal(crudSlackResult.healthScore, 100);
  assert.equal(crudSlackResult.epistemicState, "PRODUCTION_READY_WITHIN_TESTED_SCOPE");

  // 3. Audit portafolio project
  const portafolioResult = engine.auditTargetProject("portafolio");
  assert.equal(portafolioResult.projectId, "portafolio");
  assert.equal(portafolioResult.healthScore, 100);

  // 4. Test Law IV External Write Barrier guard
  assert.throws(
    () => {
      engine.assertWritePermission("C:/Users/valen/Documents/Fundacion", false);
    },
    LawIvExternalWriteBarrierViolation,
    "Must throw LawIvExternalWriteBarrierViolation on unauthorized write"
  );
});

test("BDD-276: Consolidación y sellado criptográfico del reporte SARIF de la flota (SPEC-100)", () => {
  const engine = new EosFleetDogfoodingEngine(projectRoot);

  const summary = engine.auditEntireFleet();
  assert.ok(summary.totalProjects >= 5);
  assert.ok(summary.averageHealthScore >= 95);
  assert.equal(summary.sha256Seal.length, 64, "SHA-256 seal must be 64 characters");

  // Verify generated SARIF report
  assert.ok(fs.existsSync(summary.sarifPath));
  const sarif = JSON.parse(fs.readFileSync(summary.sarifPath, "utf8"));
  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs[0].tool.driver.name, "EOS-Fleet-Dogfooding-Auditor");
  assert.equal(sarif.runs[0].tool.driver.version, "75.0.0");
  assert.equal(sarif.runs[0].results.length, 0, "Clean fleet audit must have zero findings");
  assert.equal(sarif.runs[0].invocations[0].executionSuccessful, true);
});
