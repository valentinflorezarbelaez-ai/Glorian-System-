import test from "node:test";
import assert from "node:assert/strict";
import { simulateCicdGateExecution } from "../src/core/eosCicdPipeline.ts";

test("CI/CD demo identifies every result as simulated and never authorizes deployment", () => {
  const receipt = simulateCicdGateExecution("SHIP_SOVEREIGN_AUTO_DEPLOY");

  assert.equal(receipt.simulation, true);
  assert.equal(receipt.scope, "ILLUSTRATIVE_STAGES_ONLY");
  assert.equal(receipt.trigger, "BROWSER_DEMO");
  assert.equal(receipt.deploymentPerformed, false);
  assert.equal(receipt.sbomGenerated, false);
  assert.equal(receipt.allStagesSimulatedPass, true);
  assert.equal(receipt.stages.length, 7);
  assert.ok(receipt.stages.every((stage) => stage.status === "SIMULATED_PASS" && stage.summary.includes("simulated only")));
  assert.match(receipt.simulationFingerprintSha256, /^sha256:[a-f0-9]{64}$/);
});

test("CI/CD demo fingerprint is deterministic for the illustrative stage catalog", () => {
  assert.equal(
    simulateCicdGateExecution().simulationFingerprintSha256,
    simulateCicdGateExecution().simulationFingerprintSha256
  );
});
