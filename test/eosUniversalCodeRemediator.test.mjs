/**
 * EosUniversalCodeRemediator Test Suite (SPEC-194 / CHANGE-079)
 *
 * Validates:
 * - Stack-aware .gitignore synthesis (Python, Rust, Go, Node)
 * - Test harness scaffolding matching ecosystem conventions
 * - Governance documentation (README.md and SPDX LICENSE)
 * - Hardened CI/CD pipeline injection
 * - Full end-to-end remediation and Soundcheck score elevation
 * - Non-destructive dry-run simulation mode
 * - CLI invocation (glorian fix / eos fix)
 *
 * Strict Layer-0 Purity: Node.js test runner and strict assertions.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EosUniversalCodeRemediator } from "../src/core/eosUniversalCodeRemediator.ts";
import { EosUniversalProjectDoctor } from "../src/core/eosUniversalProjectDoctor.ts";

describe("SPEC-194: EosUniversalCodeRemediator", () => {
  it("BDD-989: Stack-aware .gitignore synthesis across polyglot archetypes", () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "eos-remediator-gitignore-"));

    try {
      // 1. Python
      const pyDir = path.join(tmpBase, "python-app");
      fs.mkdirSync(pyDir);
      fs.writeFileSync(path.join(pyDir, "requirements.txt"), "pytest>=8.0");
      const pyReceipt = EosUniversalCodeRemediator.remediate(pyDir);
      assert.equal(pyReceipt.detectedStack, "PYTHON");
      assert.ok(fs.existsSync(path.join(pyDir, ".gitignore")));
      const pyGitignore = fs.readFileSync(path.join(pyDir, ".gitignore"), "utf8");
      assert.ok(pyGitignore.includes("__pycache__"));
      assert.ok(pyGitignore.includes(".pytest_cache"));

      // 2. Rust
      const rustDir = path.join(tmpBase, "rust-app");
      fs.mkdirSync(rustDir);
      fs.writeFileSync(path.join(rustDir, "Cargo.toml"), "[package]\nname = 'app'");
      const rustReceipt = EosUniversalCodeRemediator.remediate(rustDir);
      assert.equal(rustReceipt.detectedStack, "RUST");
      const rustGitignore = fs.readFileSync(path.join(rustDir, ".gitignore"), "utf8");
      assert.ok(rustGitignore.includes("target/"));

      // 3. Go
      const goDir = path.join(tmpBase, "go-app");
      fs.mkdirSync(goDir);
      fs.writeFileSync(path.join(goDir, "go.mod"), "module example.com/goapp\ngo 1.23");
      const goReceipt = EosUniversalCodeRemediator.remediate(goDir);
      assert.equal(goReceipt.detectedStack, "GO");
      const goGitignore = fs.readFileSync(path.join(goDir, ".gitignore"), "utf8");
      assert.ok(goGitignore.includes("bin/"));
      assert.ok(goGitignore.includes("dist/"));
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  it("BDD-990: Automated test scaffolding across polyglot stacks", () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "eos-remediator-tests-"));

    try {
      // 1. Go project
      const goDir = path.join(tmpBase, "go-pkg");
      fs.mkdirSync(goDir);
      fs.writeFileSync(path.join(goDir, "go.mod"), "module example.com/testpkg\ngo 1.23");
      EosUniversalCodeRemediator.remediate(goDir);
      assert.ok(fs.existsSync(path.join(goDir, "test", "smoke_test.go")));

      // 2. Python project
      const pyDir = path.join(tmpBase, "py-pkg");
      fs.mkdirSync(pyDir);
      fs.writeFileSync(path.join(pyDir, "pyproject.toml"), "[project]\nname = 'pkg'");
      EosUniversalCodeRemediator.remediate(pyDir);
      assert.ok(fs.existsSync(path.join(pyDir, "tests", "test_smoke.py")));

      // 3. Rust project
      const rustDir = path.join(tmpBase, "rust-pkg");
      fs.mkdirSync(rustDir);
      fs.writeFileSync(path.join(rustDir, "Cargo.toml"), "[package]\nname = 'pkg'");
      EosUniversalCodeRemediator.remediate(rustDir);
      assert.ok(fs.existsSync(path.join(rustDir, "tests", "smoke_test.rs")));
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  it("BDD-991: Governance and license scaffolding", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-remediator-gov-"));

    try {
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name": "test-gov"}');
      const receipt = EosUniversalCodeRemediator.remediate(tmpDir);
      assert.ok(receipt.actions.length > 0);

      assert.ok(fs.existsSync(path.join(tmpDir, "README.md")));
      assert.ok(fs.existsSync(path.join(tmpDir, "LICENSE")));

      const readme = fs.readFileSync(path.join(tmpDir, "README.md"), "utf8");
      assert.ok(readme.includes("Glorian Sovereign Control Plane"));

      const license = fs.readFileSync(path.join(tmpDir, "LICENSE"), "utf8");
      assert.ok(license.includes("SPDX-License-Identifier: MIT"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("BDD-992: End-to-end repository remediation and score elevation", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-remediator-e2e-"));

    try {
      // Empty unhardened Node project
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name": "unhardened"}');
      fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "{}");

      const beforeReport = EosUniversalProjectDoctor.diagnose(tmpDir);
      assert.ok(beforeReport.overallScore < 50);

      const receipt = EosUniversalCodeRemediator.remediate(tmpDir, { dryRun: false });

      assert.equal(receipt.dryRun, false);
      assert.ok(receipt.projectedOrFinalScore >= 80);
      assert.ok(receipt.projectedOrFinalScore > receipt.initialScore);
      assert.equal(receipt.sha256Receipt.length, 64);

      // Verify files created
      assert.ok(fs.existsSync(path.join(tmpDir, ".gitignore")));
      assert.ok(fs.existsSync(path.join(tmpDir, "test", "smoke.test.mjs")));
      assert.ok(fs.existsSync(path.join(tmpDir, "README.md")));
      assert.ok(fs.existsSync(path.join(tmpDir, "LICENSE")));
      assert.ok(fs.existsSync(path.join(tmpDir, ".github", "workflows", "glorian-ci.yml")));

      // Second run: idempotency check (all skipped)
      const secondReceipt = EosUniversalCodeRemediator.remediate(tmpDir, { dryRun: false });
      const createdActions = secondReceipt.actions.filter((a) => a.status === "CREATED");
      assert.equal(createdActions.length, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("BDD-993: Dry-run mode simulation without disk modification", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-remediator-dry-"));

    try {
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name": "dry-app"}');

      const receipt = EosUniversalCodeRemediator.remediate(tmpDir, { dryRun: true });

      assert.equal(receipt.dryRun, true);
      const plannedActions = receipt.actions.filter((a) => a.status === "PLANNED");
      assert.ok(plannedActions.length > 0);

      // Ensure no files were actually written to disk
      assert.equal(fs.existsSync(path.join(tmpDir, ".gitignore")), false);
      assert.equal(fs.existsSync(path.join(tmpDir, "README.md")), false);
      assert.equal(fs.existsSync(path.join(tmpDir, "LICENSE")), false);
      assert.equal(fs.existsSync(path.join(tmpDir, "test")), false);
      assert.equal(fs.existsSync(path.join(tmpDir, ".github")), false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("executes CLI remediate command with --dry-run and --json flags", () => {
    const root = path.resolve(".");
    const binPath = path.join(root, "bin", "eos.mjs");

    const stdout = execFileSync("node", [binPath, "remediate", "--dry-run", "--json"], {
      cwd: root,
      encoding: "utf8",
    });

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.dryRun, true);
    assert.equal(typeof parsed.initialScore, "number");
    assert.equal(typeof parsed.projectedOrFinalScore, "number");
    assert.ok(Array.isArray(parsed.actions));
  });
});
