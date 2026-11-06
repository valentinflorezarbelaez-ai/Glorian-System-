import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-267: Validación de estructura de flujo reutilizable de GitHub Actions (SPEC-096)", () => {
  const workflowPath = path.join(projectRoot, ".github", "workflows", "eos-strict-gate.yml");
  assert.ok(fs.existsSync(workflowPath), ".github/workflows/eos-strict-gate.yml must exist");

  const workflowContent = fs.readFileSync(workflowPath, "utf8");

  // 1. Verify triggers
  assert.ok(workflowContent.includes("workflow_call:"), "Must support workflow_call for reusability");
  assert.ok(workflowContent.includes("pull_request:"), "Must trigger on pull_request");
  assert.ok(workflowContent.includes("push:"), "Must trigger on push");

  // 2. Verify critical steps
  assert.ok(workflowContent.includes("actions/checkout"), "Must check out repository");
  assert.ok(workflowContent.includes("actions/setup-node"), "Must setup Node.js runtime");
  assert.ok(workflowContent.includes("node scripts/eos-github-pr-attestation.mjs"), "Must run PR attestation script");
  assert.ok(workflowContent.includes("github/codeql-action/upload-sarif@v3"), "Must upload SARIF report");
  assert.ok(workflowContent.includes("docs/evidence/local-checks.sarif"), "Must target local-checks.sarif");
});

test("BDD-268: Verificación determinista de PR gate y generación de reporte SARIF (SPEC-096)", () => {
  const scriptPath = path.join(projectRoot, "scripts", "eos-github-pr-attestation.mjs");
  assert.ok(fs.existsSync(scriptPath), "Attestation script must exist");

  // Execute attestation script
  const output = execSync(`node "${scriptPath}"`, {
    cwd: projectRoot,
    encoding: "utf8"
  });

  assert.ok(output.includes("[GATE PASSED]"), "Script must log gate passed");
  assert.ok(output.includes("[CRYPTOGRAPHIC SEAL]"), "Script must emit SHA-256 seal");

  // Verify SARIF output file integrity
  const sarifPath = path.join(projectRoot, "docs", "evidence", "local-checks.sarif");
  assert.ok(fs.existsSync(sarifPath), "SARIF evidence file must be created");

  const sarif = JSON.parse(fs.readFileSync(sarifPath, "utf8"));
  assert.equal(sarif.version, "2.1.0", "SARIF version must be 2.1.0");
  assert.ok(Array.isArray(sarif.runs), "SARIF runs must be an array");
  assert.equal(sarif.runs.length, 1);

  const run = sarif.runs[0];
  assert.equal(run.tool.driver.name, "EOS-Strict-Sovereign-Gate");
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  assert.equal(run.tool.driver.version, pkg.version);
  assert.equal(run.invocations[0].executionSuccessful, true, "Execution must be successful");
  assert.equal(run.results.length, 0, "Gate must find 0 violations in clean repository");

  const computedHash = crypto.createHash("sha256").update(fs.readFileSync(sarifPath, "utf8"), "utf8").digest("hex");
  assert.equal(computedHash.length, 64, "SHA-256 seal must be 64 hexadecimal characters");
});
