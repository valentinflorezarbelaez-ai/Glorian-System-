import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { EosUniversalProjectAdapter } from "../src/core/eosUniversalProjectAdapter.ts";

describe("EOS Universal Polyglot Repository Inventory Suite (SPEC-019, BDD-049)", () => {
  const adapter = new EosUniversalProjectAdapter(process.cwd());

  describe("Suite 1: Polyglot Stack Fingerprinting & Local Signal Inventory", () => {
    it("fingerprints current Glorian/EOS repository with high architectural fidelity", () => {
      const report = adapter.audit();

      assert.ok(report, "Expected valid audit report");
      assert.ok(
        /eos|glorian/i.test(report.projectName),
        `Expected project name to match EOS/Glorian, got ${report.projectName}`,
      );
      assert.ok(["typescript", "javascript"].includes(report.fingerprint.primaryLanguage));
      assert.ok(report.fingerprint.totalSourceFiles > 20);
      assert.ok(report.fingerprint.hasAgentScaffolding, "Expected AGENTS.md/CLAUDE.md to be detected");
      assert.ok(report.fingerprint.hasBackstageDescriptor, "Expected catalog-info.yaml to be detected");
      assert.ok(["dockerfile", "distroless"].includes(report.fingerprint.containerization));
      assert.equal(report.fingerprint.ciCd, "github_actions");
    });

    it("relabels a generic workspace checkout when the Glorian catalog is present", () => {
      const parent = fs.mkdtempSync(path.join(os.tmpdir(), "eos-checkout-"));
      const checkout = path.join(parent, "workspace");
      const unrelated = path.join(parent, "real-app");
      try {
        fs.mkdirSync(checkout);
        fs.writeFileSync(path.join(checkout, "catalog-info.yaml"), "metadata:\n  name: eos-system-control-plane\n");
        fs.mkdirSync(unrelated);
        fs.writeFileSync(path.join(unrelated, "catalog-info.yaml"), "metadata:\n  name: other\n");

        assert.equal(new EosUniversalProjectAdapter(checkout).audit().projectName, "Eos-System");
        assert.equal(new EosUniversalProjectAdapter(unrelated).audit().projectName, "real-app");
      } finally {
        fs.rmSync(parent, { recursive: true, force: true });
      }
    });

    it("reports bounded signal groups and states that production readiness is not assessed", () => {
      const report = adapter.audit();
      const { pillars } = report;

      // Check pillar properties
      for (const pillarKey of [
        "layerPurity",
        "testInfrastructure",
        "secretSecurity",
        "ciCdGateways",
        "aiScaffolding",
      ]) {
        const pillar = pillars[pillarKey];
        assert.ok(pillar, `Missing pillar: ${pillarKey}`);
        assert.ok(pillar.score >= 0 && pillar.score <= 20, `Score out of bounds for ${pillarKey}: ${pillar.score}`);
        assert.equal(pillar.maxScore, 20);
        assert.ok(["MANY_SIGNALS", "SOME_SIGNALS", "FEW_SIGNALS"].includes(pillar.signalBand));
        assert.ok(Array.isArray(pillar.findings));
      }

      assert.ok(report.localSignalScore >= 0 && report.localSignalScore <= 100);
      assert.ok(["MANY_SIGNALS", "SOME_SIGNALS", "FEW_SIGNALS"].includes(report.localSignalBand));
      assert.equal(report.productionReadiness, "NOT_ASSESSED");
      assert.ok(report.assessmentLimitations.some((item) => item.includes("does not execute")));
      assert.ok(typeof report.sha256ReportDigest === "string" && report.sha256ReportDigest.length === 64);
    });
  });

  describe("Suite 2: Cross-Language Polyglot Fingerprinting (Go, Rust, Python, Flutter)", () => {
    it("correctly identifies a Go microservice project with distroless container", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-go-mock-"));
      try {
        fs.writeFileSync(path.join(tmpDir, "go.mod"), "module github.com/spotify/recommend\ngo 1.24\n");
        fs.writeFileSync(path.join(tmpDir, "main.go"), "package main\nfunc main() {}\n");
        fs.writeFileSync(
          path.join(tmpDir, "main_test.go"),
          'package main\nimport "testing"\nfunc TestMain(t *testing.T) {}\n',
        );
        fs.writeFileSync(path.join(tmpDir, "Dockerfile"), "FROM gcr.io/distroless/static-debian12\n");
        fs.writeFileSync(path.join(tmpDir, ".gitignore"), ".env\n*.exe\n");

        const mockAdapter = new EosUniversalProjectAdapter(tmpDir);
        const report = mockAdapter.audit();

        assert.equal(report.fingerprint.primaryLanguage, "go");
        assert.equal(report.fingerprint.packageManager, "go_mod");
        assert.equal(report.fingerprint.testFramework, "go_test");
        assert.equal(report.fingerprint.containerization, "distroless");
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("correctly identifies a Rust DSP project with cargo test", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-rust-mock-"));
      try {
        fs.writeFileSync(path.join(tmpDir, "Cargo.toml"), '[package]\nname = "dsp-kernel"\nversion = "0.1.0"\n');
        const srcDir = path.join(tmpDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(path.join(srcDir, "lib.rs"), "#[test]\nfn test_filter() {}\n");
        fs.writeFileSync(path.join(tmpDir, ".gitignore"), "target/\n.env\n");

        const mockAdapter = new EosUniversalProjectAdapter(tmpDir);
        const report = mockAdapter.audit();

        assert.equal(report.fingerprint.primaryLanguage, "rust");
        assert.equal(report.fingerprint.packageManager, "cargo");
        assert.equal(report.fingerprint.testFramework, "cargo_test");
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("correctly identifies a Python data pipeline project", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-python-mock-"));
      try {
        fs.writeFileSync(path.join(tmpDir, "pyproject.toml"), '[tool.poetry]\nname = "pipeline"\n');
        fs.writeFileSync(path.join(tmpDir, "poetry.lock"), "# lockfile\n");
        const testsDir = path.join(tmpDir, "tests");
        fs.mkdirSync(testsDir, { recursive: true });
        fs.writeFileSync(path.join(testsDir, "test_pipeline.py"), "def test_ok(): pass\n");
        fs.writeFileSync(path.join(tmpDir, ".gitignore"), ".venv/\n.env\n");

        const mockAdapter = new EosUniversalProjectAdapter(tmpDir);
        const report = mockAdapter.audit();

        assert.equal(report.fingerprint.primaryLanguage, "python");
        assert.equal(report.fingerprint.packageManager, "poetry");
        assert.equal(report.fingerprint.testFramework, "pytest");
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("correctly identifies a Flutter / Dart application", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-flutter-mock-"));
      try {
        fs.writeFileSync(path.join(tmpDir, "pubspec.yaml"), "name: spotify_mobile\nversion: 1.0.0\n");
        const libDir = path.join(tmpDir, "lib");
        fs.mkdirSync(libDir, { recursive: true });
        fs.writeFileSync(path.join(libDir, "main.dart"), "void main() {}\n");
        fs.writeFileSync(path.join(tmpDir, ".gitignore"), ".dart_tool/\n.env\n");

        const mockAdapter = new EosUniversalProjectAdapter(tmpDir);
        const report = mockAdapter.audit();

        assert.equal(report.fingerprint.primaryLanguage, "flutter_dart");
        assert.equal(report.fingerprint.packageManager, "pub");
        assert.equal(report.fingerprint.testFramework, "flutter_test");
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("Suite 3: Golden Path Synthesis & Safe Dry-Run (EARS Error-Driven & State-Driven)", () => {
    it("guarantees zero disk writes during dry-run elevation", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-dryrun-mock-"));
      try {
        fs.writeFileSync(path.join(tmpDir, "go.mod"), "module github.com/test/service\n");
        const mockAdapter = new EosUniversalProjectAdapter(tmpDir);

        const result = mockAdapter.elevate(tmpDir, { dryRun: true });

        assert.equal(result.dryRun, true);
        assert.ok(result.filesScaffolded.length >= 3, "Expected at least 3 files to be proposed");
        assert.ok(result.message.includes("[PLAN ONLY]"));

        // Verify NO files were actually written to disk
        assert.equal(fs.existsSync(path.join(tmpDir, "catalog-info.yaml")), false);
        assert.equal(fs.existsSync(path.join(tmpDir, "AGENTS.md")), false);
        assert.equal(fs.existsSync(path.join(tmpDir, ".github/workflows/ci.yml")), false);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("materializes standardized Golden Path files when dryRun is false", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-write-mock-"));
      try {
        fs.writeFileSync(path.join(tmpDir, "Cargo.toml"), '[package]\nname = "dsp-service"\n');
        const mockAdapter = new EosUniversalProjectAdapter(tmpDir);

        const result = mockAdapter.elevate(tmpDir, { dryRun: false });

        assert.equal(result.dryRun, false);
        assert.ok(result.message.includes("[WRITE COMPLETED]"));

        // Verify files were written
        assert.ok(fs.existsSync(path.join(tmpDir, "catalog-info.yaml")), "Missing catalog-info.yaml");
        assert.ok(fs.existsSync(path.join(tmpDir, "AGENTS.md")), "Missing AGENTS.md");
        assert.ok(fs.existsSync(path.join(tmpDir, ".github/workflows/ci.yml")), "Missing .github/workflows/ci.yml");
        assert.ok(fs.existsSync(path.join(tmpDir, ".githooks/pre-commit")), "Missing .githooks/pre-commit");

        // Verify catalog contents
        const catalogContent = fs.readFileSync(path.join(tmpDir, "catalog-info.yaml"), "utf8");
        assert.ok(catalogContent.includes("kind: Component"));
        assert.ok(catalogContent.includes("spotify.com/golden-path-certified"));

        // Verify AGENTS.md contents
        const agentsContent = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");
        assert.ok(agentsContent.includes("Extreme Ownership"));
        assert.ok(agentsContent.includes("FinOps & Zero-Allocation"));
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
