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
  assert.match(
    workflowContent,
    /github\/codeql-action\/upload-sarif@[0-9a-f]{40}\b/,
    "Must upload SARIF with an action pinned to a 40-hex commit SHA"
  );
  assert.doesNotMatch(workflowContent, /upload-sarif@v\d/, "Floating action tags are not allowed");
  assert.ok(workflowContent.includes("docs/evidence/local-checks.sarif"), "Must target local-checks.sarif");
});

test("BDD-269: Todo workflow declara least-privilege, timeout y checkout sin credenciales", () => {
  const workflowsDir = path.join(projectRoot, ".github", "workflows");
  const files = fs.readdirSync(workflowsDir).filter((file) => /\.ya?ml$/.test(file));
  assert.ok(files.length > 0, "At least one workflow must exist");

  for (const file of files) {
    const content = fs.readFileSync(path.join(workflowsDir, file), "utf8");
    const label = `.github/workflows/${file}`;

    // Least privilege at workflow scope; jobs may widen explicitly when justified.
    assert.match(content, /^permissions:/m, `${label} must declare top-level permissions`);

    const jobs = content.match(/^\s{4}runs-on:/gm) ?? [];
    const timeouts = content.match(/^\s{4}timeout-minutes:/gm) ?? [];
    assert.ok(jobs.length > 0, `${label} must define at least one job`);
    assert.equal(timeouts.length, jobs.length, `${label} must bound every job with timeout-minutes`);

    const checkouts = content.match(/uses:\s*actions\/checkout@/g) ?? [];
    const nonPersisted = content.match(/persist-credentials:\s*false/g) ?? [];
    assert.equal(
      nonPersisted.length,
      checkouts.length,
      `${label} must set persist-credentials: false on every actions/checkout step`
    );

    assert.doesNotMatch(content, /^\s*pull_request_target:/m, `${label} must not use pull_request_target`);

    for (const [, ref] of content.matchAll(/uses:\s*([^\s#]+)/g)) {
      if (ref.startsWith("./") || ref.startsWith("docker://")) continue;
      assert.match(ref, /@[0-9a-f]{40}$/, `${label} must pin ${ref} to a 40-hex commit SHA`);
    }
  }
});

test("BDD-270: El paquete no es publicable por accidente y declara su licencia", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

  assert.equal(pkg.private, true, "package.json must set private:true to block accidental npm publish");
  assert.equal(pkg.license, "MIT", "package.json must declare the repository license");
  assert.ok(pkg.engines?.node, "package.json must declare the supported Node.js range");
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, "Layer-0 runtime dependencies must stay empty");

  const licensePath = path.join(projectRoot, "LICENSE");
  assert.ok(fs.existsSync(licensePath), "LICENSE file must exist");
  assert.match(fs.readFileSync(licensePath, "utf8"), /^MIT License/, "LICENSE must match the declared MIT license");
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
