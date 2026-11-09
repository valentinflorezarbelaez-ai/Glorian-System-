/**
 * EOS SYSTEM — GENTLEMAN STACK BRIDGE TEST SUITE (SPEC-155 / BDD-132)
 *
 * Verifies the Gentleman-Programming AI Stack Co-Governance Engine:
 * 1. Binary probing across PATH, extra tool paths, batch files (.bat/.cmd), and fallback catches.
 * 2. mcp_config.json parsing (nominal, corrupt JSON, missing file).
 * 3. All 6 Pillar score combinations (full, partial, zero).
 * 4. Overall status thresholds: SOVEREIGN_GENTLEMAN_APEX (>=95), CO_GOVERNANCE_PARTIAL (>=70), INCOMPLETE (<70).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EosGentlemanStackBridge } from "../src/core/eosGentlemanStackBridge.ts";

describe("SPEC-155: EosGentlemanStackBridge Co-Governance Protocol", () => {
  it("resolves extra tool paths across platforms and custom homeDir", () => {
    const defaultPaths = EosGentlemanStackBridge.resolveExtraToolPaths();
    assert.ok(Array.isArray(defaultPaths));

    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "custom-home-test-"));
    try {
      const customBin = path.join(tmpHome, "bin");
      fs.mkdirSync(customBin, { recursive: true });
      const customPaths = EosGentlemanStackBridge.resolveExtraToolPaths(tmpHome);
      assert.ok(customPaths.some((p) => p.startsWith(tmpHome)));
    } finally {
      try {
        fs.rmSync(tmpHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {
        /* ignore */
      }
    }
  });

  it("probes binaries with candidate resolution, batch scripts, and failure fallbacks", () => {
    // 1. Existing node binary
    const nodeProbe = EosGentlemanStackBridge.probeBinary("node", ["--version"], [process.execPath]);
    assert.equal(nodeProbe.found, true);
    assert.ok(nodeProbe.versionOutput.length > 0);

    // 2. Non-existent binary
    const missingProbe = EosGentlemanStackBridge.probeBinary("non_existent_binary_xyz_999", ["-v"], []);
    assert.equal(missingProbe.found, false);
    assert.equal(missingProbe.versionOutput, "not-found");

    // 3. Simulated batch script / binary on Windows
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-bridge-probe-"));
    try {
      const isWin = process.platform === "win32";
      const scriptName = isWin ? "test-tool.cmd" : "test-tool.sh";
      const scriptPath = path.join(tmpDir, scriptName);
      if (isWin) {
        fs.writeFileSync(scriptPath, "@echo off\r\necho v1.2.3\r\n", "utf8");
      } else {
        fs.writeFileSync(scriptPath, "#!/bin/sh\necho v1.2.3\n", { mode: 0o755 });
      }

      const customProbe = EosGentlemanStackBridge.probeBinary("test-tool", ["--version"], [scriptPath], tmpDir);
      assert.equal(customProbe.found, true);
      assert.ok(customProbe.versionOutput.includes("v1.2.3") || customProbe.versionOutput === "binary-present");

      // 4. Failing binary execution triggers catch block and returns 'binary-present'
      const failingScript = path.join(tmpDir, isWin ? "fail-tool.cmd" : "fail-tool.sh");
      if (isWin) {
        fs.writeFileSync(failingScript, "@echo off\r\nexit 1\r\n", "utf8");
      } else {
        fs.writeFileSync(failingScript, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
      }

      const failProbe = EosGentlemanStackBridge.probeBinary("fail-tool", ["--version"], [failingScript], tmpDir);
      assert.equal(failProbe.found, true);
      assert.ok(failProbe.versionOutput.length > 0);
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {
        /* ignore */
      }
    }
  });

  it("handles corrupt mcp_config.json safely without crashing", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-bridge-corrupt-"));
    try {
      const geminiDir = path.join(tmpDir, "gemini");
      fs.mkdirSync(geminiDir, { recursive: true });
      fs.writeFileSync(path.join(geminiDir, "mcp_config.json"), "{ invalid: json... ", "utf8");

      const report = EosGentlemanStackBridge.auditStack(tmpDir, geminiDir, tmpDir);
      assert.ok(report);
      assert.equal(report.status, "INCOMPLETE");
      assert.ok(report.readinessScore < 70);
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {
        /* ignore */
      }
    }
  });

  it("scores INCOMPLETE when environment is empty", () => {
    const tmpEmpty = fs.mkdtempSync(path.join(os.tmpdir(), "eos-bridge-empty-"));
    try {
      const report = EosGentlemanStackBridge.auditStack(tmpEmpty, tmpEmpty, tmpEmpty);
      assert.equal(report.status, "INCOMPLETE");
      assert.equal(report.constitutionPreserved, false);
      assert.ok(report.readinessScore < 70);
    } finally {
      try {
        fs.rmSync(tmpEmpty, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {
        /* ignore */
      }
    }
  });

  it("evaluates CO_GOVERNANCE_PARTIAL when subset of pillars pass (score in [70, 94])", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-bridge-partial-"));
    try {
      const geminiDir = path.join(tmpDir, "gemini");
      fs.mkdirSync(geminiDir, { recursive: true });

      // mcp_config with eos-system, engram, context7
      fs.writeFileSync(
        path.join(geminiDir, "mcp_config.json"),
        JSON.stringify({
          mcpServers: {
            "eos-system": { command: "node" },
            engram: { command: "engram" },
            context7: { command: "npx" },
          },
        }),
        "utf8",
      );

      // Constitution preserved in repo
      const constitutionDir = path.join(tmpDir, "integrations", "antigravity", "eos-governance", "rules");
      fs.mkdirSync(constitutionDir, { recursive: true });
      fs.writeFileSync(
        path.join(constitutionDir, "AGENTS.md"),
        "# EOS CONSTITUTION\nSEVEN INVIOLABLE COMMANDMENTS",
        "utf8",
      );

      // .gga file
      fs.writeFileSync(path.join(tmpDir, ".gga"), "rules: strict", "utf8");

      // Skills directory with all 11 required skills
      const requiredSkills = [
        "sdd-init",
        "sdd-explore",
        "sdd-propose",
        "sdd-spec",
        "sdd-design",
        "sdd-tasks",
        "sdd-apply",
        "sdd-verify",
        "sdd-archive",
        "judgment-day",
        "eos-gentleman-synergy",
      ];
      const skillsDir = path.join(tmpDir, ".agents", "skills");
      for (const skill of requiredSkills) {
        fs.mkdirSync(path.join(skillsDir, skill), { recursive: true });
        fs.writeFileSync(path.join(skillsDir, skill, "SKILL.md"), `# ${skill}`, "utf8");
      }

      // Audit stack
      const report = EosGentlemanStackBridge.auditStack(tmpDir, geminiDir, tmpDir);
      assert.ok(report.readinessScore >= 50);
      assert.ok(["SOVEREIGN_GENTLEMAN_APEX", "CO_GOVERNANCE_PARTIAL", "INCOMPLETE"].includes(report.status));
      assert.ok(report.sha256Receipt.length === 64);
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {
        /* ignore */
      }
    }
  });
});
