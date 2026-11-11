/**
 * EosUniversalProjectDoctor Test Suite (SPEC-193 / CHANGE-078)
 *
 * Validates:
 * - Polyglot stack fingerprinting across 7 major language ecosystems
 * - Soundcheck 5-Pillar deterministic scoring (Security, Testing, CI/CD, Docs, Hygiene)
 * - Plain secret and credential leakage detection
 * - Hardened CI/CD workflow synthesis and file writing
 * - CLI invocation (glorian doctor / eos doctor)
 *
 * Strict Layer-0 Purity: Node.js test runner and strict assertions.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EosUniversalProjectDoctor } from "../src/core/eosUniversalProjectDoctor.ts";

describe("SPEC-193: EosUniversalProjectDoctor", () => {
  it("detects polyglot stacks accurately", () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "eos-doctor-stacks-"));

    try {
      // 1. Rust
      const rustDir = path.join(tmpBase, "rust-proj");
      fs.mkdirSync(rustDir);
      fs.writeFileSync(path.join(rustDir, "Cargo.toml"), "[package]\nname = 'test'");
      const rustStack = EosUniversalProjectDoctor.detectStack(rustDir);
      assert.equal(rustStack.stack, "RUST");
      assert.equal(rustStack.language, "Rust");
      assert.equal(rustStack.packageManager, "cargo");

      // 2. Go
      const goDir = path.join(tmpBase, "go-proj");
      fs.mkdirSync(goDir);
      fs.writeFileSync(path.join(goDir, "go.mod"), "module example.com/test\ngo 1.23");
      const goStack = EosUniversalProjectDoctor.detectStack(goDir);
      assert.equal(goStack.stack, "GO");
      assert.equal(goStack.language, "Go");
      assert.equal(goStack.packageManager, "go modules");

      // 3. Python
      const pyDir = path.join(tmpBase, "py-proj");
      fs.mkdirSync(pyDir);
      fs.writeFileSync(path.join(pyDir, "pyproject.toml"), "[project]\nname = 'test'");
      const pyStack = EosUniversalProjectDoctor.detectStack(pyDir);
      assert.equal(pyStack.stack, "PYTHON");
      assert.equal(pyStack.language, "Python");

      // 4. Flutter / Dart
      const dartDir = path.join(tmpBase, "dart-proj");
      fs.mkdirSync(dartDir);
      fs.writeFileSync(path.join(dartDir, "pubspec.yaml"), "name: test_app");
      const dartStack = EosUniversalProjectDoctor.detectStack(dartDir);
      assert.equal(dartStack.stack, "FLUTTER_DART");

      // 5. Java (Gradle / Maven)
      const javaDir = path.join(tmpBase, "java-proj");
      fs.mkdirSync(javaDir);
      fs.writeFileSync(path.join(javaDir, "pom.xml"), "<project></project>");
      const javaStack = EosUniversalProjectDoctor.detectStack(javaDir);
      assert.equal(javaStack.stack, "JAVA_GRADLE_MAVEN");
      assert.equal(javaStack.packageManager, "maven");

      // 6. C / C++
      const cppDir = path.join(tmpBase, "cpp-proj");
      fs.mkdirSync(cppDir);
      fs.writeFileSync(path.join(cppDir, "CMakeLists.txt"), "cmake_minimum_required(VERSION 3.20)");
      const cppStack = EosUniversalProjectDoctor.detectStack(cppDir);
      assert.equal(cppStack.stack, "CPP_C");

      // 7. Node / TypeScript
      const nodeDir = path.join(tmpBase, "node-proj");
      fs.mkdirSync(nodeDir);
      fs.writeFileSync(path.join(nodeDir, "package.json"), "{}");
      fs.writeFileSync(path.join(nodeDir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'");
      const nodeStack = EosUniversalProjectDoctor.detectStack(nodeDir);
      assert.equal(nodeStack.stack, "NODE_TYPESCRIPT");
      assert.equal(nodeStack.packageManager, "pnpm");

      // 8. Unknown
      const emptyDir = path.join(tmpBase, "empty-proj");
      fs.mkdirSync(emptyDir);
      const emptyStack = EosUniversalProjectDoctor.detectStack(emptyDir);
      assert.equal(emptyStack.stack, "UNKNOWN");
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  it("evaluates 5-pillar soundcheck scoring deterministically", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-doctor-score-"));

    try {
      // Create a pristine project meeting all criteria
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name": "pristine"}');
      fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "{}");
      fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules/\n");
      fs.writeFileSync(path.join(tmpDir, "README.md"), "# Pristine Project");
      fs.writeFileSync(path.join(tmpDir, "LICENSE"), "MIT License");
      fs.mkdirSync(path.join(tmpDir, "test"));
      fs.writeFileSync(path.join(tmpDir, "test", "index.test.js"), "// test");
      fs.writeFileSync(path.join(tmpDir, "codecov.yml"), "codecov: {}");
      fs.mkdirSync(path.join(tmpDir, ".github", "workflows"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, ".github", "workflows", "ci.yml"), "# ci");

      const report = EosUniversalProjectDoctor.diagnose(tmpDir);

      assert.equal(report.detectedStack, "NODE_TYPESCRIPT");
      assert.equal(report.overallScore, 100);
      assert.equal(report.readinessStatus, "PRODUCTION_READY");
      assert.equal(report.pillars.security.score, 25);
      assert.equal(report.pillars.testing.score, 25);
      assert.equal(report.pillars.cicd.score, 20);
      assert.equal(report.pillars.documentation.score, 15);
      assert.equal(report.pillars.hygiene.score, 15);
      assert.equal(report.detectedVulnerabilities.length, 0);
      assert.equal(report.sha256Receipt.length, 64);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("detects credential leakage and flags HIGH_RISK", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-doctor-leak-"));

    try {
      // Mock leaked AWS secret key in config
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        '{"name": "leaky", "awsKey": "' + "AK" + 'IA1234567890ABCDEF"}',
      );
      fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules/");

      const report = EosUniversalProjectDoctor.diagnose(tmpDir);

      assert.ok(report.detectedVulnerabilities.includes("SECRET_LEAKAGE_DETECTED"));
      assert.equal(report.readinessStatus, "HIGH_RISK");
      assert.equal(report.pillars.security.score, 10); // only .gitignore, lost 15 for secret
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("synthesizes tailored CI workflows and writes to filesystem", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-doctor-ci-"));

    try {
      const goWorkflow = EosUniversalProjectDoctor.generateHardenedCiWorkflow("GO");
      assert.ok(goWorkflow.includes("actions/setup-go@v5"));
      assert.ok(goWorkflow.includes("go test -v -race ./..."));

      const rustWorkflow = EosUniversalProjectDoctor.generateHardenedCiWorkflow("RUST");
      assert.ok(rustWorkflow.includes("cargo clippy"));
      assert.ok(rustWorkflow.includes("cargo test"));

      const pyWorkflow = EosUniversalProjectDoctor.generateHardenedCiWorkflow("PYTHON");
      assert.ok(pyWorkflow.includes("pytest"));

      const nodeWorkflow = EosUniversalProjectDoctor.generateHardenedCiWorkflow("NODE_TYPESCRIPT");
      assert.ok(nodeWorkflow.includes("npm test"));

      const res = EosUniversalProjectDoctor.writeCiWorkflow(tmpDir, goWorkflow);
      assert.equal(res.written, true);
      assert.ok(fs.existsSync(res.path));
      const content = fs.readFileSync(res.path, "utf8");
      assert.equal(content, goWorkflow);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("executes CLI doctor command with valid JSON output", () => {
    const root = path.resolve(".");
    const binPath = path.join(root, "bin", "eos.mjs");

    const stdout = execFileSync("node", [binPath, "doctor", "--json"], {
      cwd: root,
      encoding: "utf8",
    });

    const parsed = JSON.parse(stdout);
    assert.equal(typeof parsed.overallScore, "number");
    assert.ok(parsed.overallScore >= 0 && parsed.overallScore <= 100);
    assert.equal(parsed.detectedStack, "NODE_TYPESCRIPT");
    assert.ok(parsed.pillars.security);
    assert.ok(parsed.pillars.testing);
    assert.ok(parsed.pillars.cicd);
    assert.ok(parsed.pillars.documentation);
    assert.ok(parsed.pillars.hygiene);
  });
});
