import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();

test("BDD-366: Acumulación y Emisión Ineludible de SARIF en verify-cicd-pipeline.mjs", () => {
  const scriptContent = fs.readFileSync(path.join(root, "scripts/verify-cicd-pipeline.mjs"), "utf8");
  
  // Verifies try ... finally fail-safe execution
  assert.match(scriptContent, /try\s*\{/);
  assert.match(scriptContent, /finally\s*\{/);
  
  // Verifies dynamic findings accumulator
  assert.match(scriptContent, /const\s+sarifFindings\s*=\s*\[\]/);
  assert.match(scriptContent, /results:\s*sarifFindings/);
  assert.doesNotMatch(scriptContent, /results:\s*\[\]\s*\n\s*\}\s*\n\s*\]/);

  // Verifies local-checks.sarif emission path
  const sarifPath = path.join(root, "docs/evidence/local-checks.sarif");
  assert.ok(fs.existsSync(sarifPath), "docs/evidence/local-checks.sarif must exist");
  const sarif = JSON.parse(fs.readFileSync(sarifPath, "utf8"));
  assert.equal(sarif.version, "2.1.0", "SARIF version must be 2.1.0");
  assert.ok(Array.isArray(sarif.runs), "SARIF runs must be an array");
  assert.ok(sarif.runs.length > 0, "SARIF runs must contain at least one run");
  assert.ok(Array.isArray(sarif.runs[0].results), "SARIF results must be an array");
});

test("BDD-367: Bloqueo Estricto por Especificación No Conforme y Escaneo Universal en eos-github-pr-attestation.mjs", () => {
  const scriptContent = fs.readFileSync(path.join(root, "scripts/eos-github-pr-attestation.mjs"), "utf8");

  // Verifies 100% strict spec ratio assertion
  assert.match(scriptContent, /compliantSpecs\s*!==\s*specFiles\.length/);
  assert.match(scriptContent, /VIOLATION:\s*Strict\s*Specification\s*Gate\s*failed/);

  // Verifies universal secret scanner integration
  assert.match(scriptContent, /eos-secret-scan\.mjs/);
  assert.doesNotMatch(scriptContent, /const\s+candidateFiles\s*=\s*\["package\.json",\s*"index\.html"/);

  // Verifies all specs in openspec/specs/ are evaluated
  const specsDir = path.join(root, "openspec/specs");
  const specFiles = fs.readdirSync(specsDir).filter((f) => f.endsWith(".md"));
  let compliantCount = 0;
  for (const sf of specFiles) {
    const text = fs.readFileSync(path.join(specsDir, sf), "utf8");
    const hasEars = /(?:THE\s+SYSTEM\s+SHALL|WHEN\s+|WHILE\s+|IF\s+.+\s+THEN|EL\s+SISTEMA|CUANDO\s+|MIENTRAS\s+|SI\s+.+\s+ENTONCES)/i.test(text);
    const hasBdd = /(?:SCENARIO:|GIVEN\s+|WHEN\s+|THEN\s+|ESCENARIO:|DADO\s+|CUANDO\s+|ENTONCES\s+)/i.test(text);
    if (hasEars && hasBdd) compliantCount++;
  }
  assert.equal(compliantCount, specFiles.length, `All ${specFiles.length} specifications must conform to EARS/BDD`);
});

test("BDD-368: Unificación Soberana de CI en GitHub Actions", () => {
  const workflowsDir = path.join(root, ".github/workflows");
  
  // Verifies single unified CI workflow
  assert.ok(fs.existsSync(path.join(workflowsDir, "eos-sovereign-cicd.yml")), "eos-sovereign-cicd.yml must exist");
  assert.ok(!fs.existsSync(path.join(workflowsDir, "eos-gate.yml")), "Redundant eos-gate.yml must be removed");
  assert.ok(fs.existsSync(path.join(workflowsDir, "eos-strict-gate.yml")), "eos-strict-gate.yml must exist as reusable workflow");

  const strictContent = fs.readFileSync(path.join(workflowsDir, "eos-strict-gate.yml"), "utf8");
  assert.ok(strictContent.includes("workflow_call:"), "eos-strict-gate.yml must support workflow_call");

  const workflowContent = fs.readFileSync(path.join(workflowsDir, "eos-sovereign-cicd.yml"), "utf8");
  assert.match(workflowContent, /cancel-in-progress:\s*true/);
  assert.match(workflowContent, /timeout-minutes:\s*10/);
  assert.match(workflowContent, /timeout-minutes:\s*20/);
  assert.match(workflowContent, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
});
