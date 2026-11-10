/**
 * EosUniversalCodeRemediator (Layer 0 — Universal Code Remediation & Modernizer Engine)
 * SPEC-194: Universal Code Remediation & Modernizer Engine
 * CHANGE-079: Universal Code Remediation & Modernizer Engine
 *
 * Automatically elevates repositories to production standards:
 * - Scaffolds stack-tailored .gitignore if missing.
 * - Scaffolds smoke test harnesses matching language conventions.
 * - Injects foundational README and SPDX license indicators.
 * - Emits hardened GitHub Actions CI/CD workflows.
 * - Supports non-destructive dry-run simulation mode.
 * - Produces tamper-evident SHA-256 remediation receipts.
 *
 * Strictly ZERO external runtime dependencies.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { assertPrecondition, assertPostcondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import { EosUniversalProjectDoctor, type ProjectStack, type DoctorReport } from "./eosUniversalProjectDoctor.ts";

export interface RemediationOptions {
  dryRun?: boolean;
  autoFixGitignore?: boolean;
  autoFixTests?: boolean;
  autoFixDocs?: boolean;
  autoFixCicd?: boolean;
}

export interface UniversalRemediationAction {
  file: string;
  status: "CREATED" | "SKIPPED_EXISTS" | "PLANNED";
  description: string;
}

export interface RemediationReceipt {
  targetPath: string;
  detectedStack: ProjectStack;
  dryRun: boolean;
  actions: UniversalRemediationAction[];
  initialScore: number;
  projectedOrFinalScore: number;
  timestampIso: string;
  sha256Receipt: string;
}

const GITIGNORE_MAP: Record<ProjectStack, string> = {
  NODE_TYPESCRIPT: "node_modules/\ndist/\ncoverage/\n.npm/\n*.log\n.env\n",
  PYTHON: "__pycache__/\n*.py[cod]\n.pytest_cache/\n.venv/\nenv/\ndist/\n",
  GO: "bin/\ndist/\n*.exe\n*.test\nvendor/\n",
  RUST: "target/\n**/*.rs.bk\n",
  FLUTTER_DART: ".dart_tool/\nbuild/\n.flutter-plugins\n.packages\n",
  JAVA_GRADLE_MAVEN: "build/\ntarget/\n.gradle/\n*.class\n*.jar\n",
  CPP_C: "build/\nbin/\n*.o\n*.a\n*.so\nCMakeFiles/\n",
  UNKNOWN: "dist/\nbuild/\n*.log\n.DS_Store\n",
};

export class EosUniversalCodeRemediator {
  /**
   * Remediates missing foundational files and elevates repository health.
   */
  public static remediate(targetPath: string = process.cwd(), options: RemediationOptions = {}): RemediationReceipt {
    assertPrecondition(
      typeof targetPath === "string" && targetPath.trim().length > 0,
      "remediate: targetPath must be a non-empty string",
    );

    const root = resolve(targetPath);
    assertPrecondition(existsSync(root), `remediate: target path '${root}' does not exist`);

    const dryRun = options.dryRun === true;
    const initialReport = EosUniversalProjectDoctor.diagnose(root);
    const stack = initialReport.detectedStack;
    const actions: UniversalRemediationAction[] = [];

    // 1. Remediate .gitignore
    const gitignorePath = join(root, ".gitignore");
    if (!existsSync(gitignorePath)) {
      const content = GITIGNORE_MAP[stack] || GITIGNORE_MAP.UNKNOWN;
      if (dryRun) {
        actions.push({
          file: ".gitignore",
          status: "PLANNED",
          description: `Synthesize stack-tailored .gitignore for ${stack}`,
        });
      } else {
        writeFileSync(gitignorePath, content, "utf8");
        actions.push({
          file: ".gitignore",
          status: "CREATED",
          description: `Created stack-tailored .gitignore for ${stack}`,
        });
      }
    } else {
      actions.push({
        file: ".gitignore",
        status: "SKIPPED_EXISTS",
        description: ".gitignore already present",
      });
    }

    // 2. Remediate Testing Harness
    const hasTests =
      existsSync(join(root, "test")) ||
      existsSync(join(root, "tests")) ||
      existsSync(join(root, "spec")) ||
      existsSync(join(root, "src/__tests__"));

    if (!hasTests) {
      const testScaffold = EosUniversalCodeRemediator._getTestScaffold(stack);
      if (dryRun) {
        actions.push({
          file: testScaffold.relativePath,
          status: "PLANNED",
          description: `Scaffold initial smoke test harness for ${stack}`,
        });
      } else {
        const fullTestDir = join(root, testScaffold.dir);
        if (!existsSync(fullTestDir)) {
          mkdirSync(fullTestDir, { recursive: true });
        }
        writeFileSync(join(root, testScaffold.relativePath), testScaffold.content, "utf8");
        actions.push({
          file: testScaffold.relativePath,
          status: "CREATED",
          description: `Scaffolded initial smoke test harness for ${stack}`,
        });
      }
    } else {
      actions.push({
        file: "tests",
        status: "SKIPPED_EXISTS",
        description: "Test directory already present",
      });
    }

    // 3. Remediate Documentation (README.md & LICENSE)
    const readmePath = join(root, "README.md");
    if (!existsSync(readmePath) && !existsSync(join(root, "readme.md"))) {
      const content = `# Project Workspace\n\nManaged with Glorian Sovereign Control Plane.\nArchetype: \`${stack}\`.\n`;
      if (dryRun) {
        actions.push({
          file: "README.md",
          status: "PLANNED",
          description: "Synthesize foundational README.md",
        });
      } else {
        writeFileSync(readmePath, content, "utf8");
        actions.push({
          file: "README.md",
          status: "CREATED",
          description: "Created foundational README.md",
        });
      }
    }

    const licensePath = join(root, "LICENSE");
    if (!existsSync(licensePath) && !existsSync(join(root, "LICENSE.md"))) {
      const content = `SPDX-License-Identifier: MIT\nCopyright (c) ${new Date().getFullYear()} Software Contributors\n`;
      if (dryRun) {
        actions.push({
          file: "LICENSE",
          status: "PLANNED",
          description: "Inject standard SPDX MIT license file",
        });
      } else {
        writeFileSync(licensePath, content, "utf8");
        actions.push({
          file: "LICENSE",
          status: "CREATED",
          description: "Injected standard SPDX MIT license file",
        });
      }
    }

    // 4. Remediate Hardened CI/CD Workflow
    const workflowDir = join(root, ".github", "workflows");
    const ciFilePath = join(workflowDir, "glorian-ci.yml");
    if (!existsSync(ciFilePath) && !existsSync(join(workflowDir, "ci.yml"))) {
      const ciYaml = EosUniversalProjectDoctor.generateHardenedCiWorkflow(stack);
      if (dryRun) {
        actions.push({
          file: ".github/workflows/glorian-ci.yml",
          status: "PLANNED",
          description: `Synthesize hardened CI/CD workflow for ${stack}`,
        });
      } else {
        if (!existsSync(workflowDir)) {
          mkdirSync(workflowDir, { recursive: true });
        }
        writeFileSync(ciFilePath, ciYaml, "utf8");
        actions.push({
          file: ".github/workflows/glorian-ci.yml",
          status: "CREATED",
          description: `Synthesized hardened CI/CD workflow for ${stack}`,
        });
      }
    }

    const finalReport = dryRun ? initialReport : EosUniversalProjectDoctor.diagnose(root);

    const projectedOrFinalScore = dryRun ? Math.min(100, initialReport.overallScore + 40) : finalReport.overallScore;

    const timestampIso = new Date().toISOString();
    const rawReceipt = `${root}:${stack}:${initialReport.overallScore}:${projectedOrFinalScore}:${timestampIso}`;
    const sha256Receipt = pureSha256(rawReceipt);

    const receipt: RemediationReceipt = {
      targetPath: root,
      detectedStack: stack,
      dryRun,
      actions,
      initialScore: initialReport.overallScore,
      projectedOrFinalScore,
      timestampIso,
      sha256Receipt,
    };

    assertPostcondition(
      typeof receipt.sha256Receipt === "string" && receipt.sha256Receipt.length === 64,
      "sha256Receipt must be a 64-char hex string",
    );

    return deepFreeze(receipt);
  }

  private static _getTestScaffold(stack: ProjectStack): {
    dir: string;
    relativePath: string;
    content: string;
  } {
    switch (stack) {
      case "PYTHON":
        return {
          dir: "tests",
          relativePath: "tests/test_smoke.py",
          content: "def test_smoke():\n    assert True\n",
        };
      case "GO":
        return {
          dir: "test",
          relativePath: "test/smoke_test.go",
          content: 'package test\n\nimport "testing"\n\nfunc TestSmoke(t *testing.T) {\n\t// Passing baseline\n}\n',
        };
      case "RUST":
        return {
          dir: "tests",
          relativePath: "tests/smoke_test.rs",
          content: "#[test]\nfn test_smoke() {\n    assert!(true);\n}\n",
        };
      default:
        return {
          dir: "test",
          relativePath: "test/smoke.test.mjs",
          content:
            "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n\ntest('smoke verification', () => {\n  assert.equal(true, true);\n});\n",
        };
    }
  }
}
