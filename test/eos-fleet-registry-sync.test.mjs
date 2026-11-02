import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  discoverGitRepositories,
  extractGitMetadata,
  inferProjectMetadata,
  reconcileFleetRegistry,
  computeRegistrySignature
} from "../scripts/eos-fleet-registry-sync.mjs";

describe("SPEC-124: Autonomous Dynamic Fleet Registry & Law IV Sentinel", () => {
  describe("BDD-361: Autonomous Git Repository Discovery", () => {
    it("discovers all git repositories in workspace root and ignores non-git folders", (t) => {
      const rootDir = "c:\\Users\\valen";
      if (!fs.existsSync(rootDir) || process.env.VERCEL) {
        t.skip("Skipping workspace discovery in sandboxed CI/Vercel environment");
        return;
      }
      const repos = discoverGitRepositories(rootDir);
      assert.ok(Array.isArray(repos));
      assert.ok(repos.length >= 5, "Expected at least 5 git repositories in workspace");
      
      const repoNames = repos.map((r) => r.name);
      assert.ok(repoNames.includes("Eos-System"), "Must discover Eos-System");
      assert.ok(repoNames.includes("Control-De-Asistencia-Abopack"), "Must discover Control-De-Asistencia-Abopack");
      assert.ok(repoNames.includes("portafolio"), "Must discover portafolio");
      
      // Must not include non-git or hidden tooling directories
      assert.ok(!repoNames.includes(".gemini"));
      assert.ok(!repoNames.includes(".cache"));
    });
  });

  describe("BDD-362: Git Porcelain & Production Endpoint Inference", () => {
    it("extracts git remote, branch, and commit hash for Eos-System", (t) => {
      const eosPath = path.resolve(".");
      const gitMeta = extractGitMetadata(eosPath);
      if (!gitMeta.remoteUrl || process.env.VERCEL) {
        t.skip("Skipping Git metadata extraction in isolated build container");
        return;
      }
      assert.ok(gitMeta.remoteUrl.includes("Eos-System"));
      assert.ok(gitMeta.currentBranch.length > 0);
      assert.ok(/^[0-9a-f]{40}$/i.test(gitMeta.headCommitSha));
    });

    it("infers project name, archetype, and production URL for Avo Pack", () => {
      const avopakPath = "c:\\Users\\valen\\Control-De-Asistencia-Abopack";
      if (fs.existsSync(avopakPath)) {
        const meta = inferProjectMetadata(avopakPath);
        assert.ok(meta.name.includes("Avo Pack") || meta.name.includes("Control de Asistencia"));
        assert.ok(meta.productionUrl.includes("avo-pack.vercel.app") || meta.productionUrl.includes("vercel.app"));
        assert.ok(meta.cicdGateScript.includes("test") || meta.cicdGateScript.includes("verify"));
      }
    });
  });

  describe("BDD-363 / BDD-364: Non-Destructive Governance Reconciliation (Preserving Authorizations)", () => {
    it("preserves LEVEL_3 authorizations while updating live git commit and fixing path mismatches", () => {
      const existingRegistry = {
        version: "10.1.0-portable-fleet-registry",
        updatedAt: "2026-10-25T09:46:00-05:00",
        complianceStandard: "EOS_CONSTITUTION_LAW_IV_EXTERNAL_WRITE_BARRIER",
        projects: [
          {
            id: "eos-system",
            name: "Glorian (Control Plane Core)",
            localPathEnv: "EOS_FLEET_EOS_SYSTEM_PATH",
            remoteUrl: "https://github.com/valentinflorezarbelaez-ai/Eos-System.git",
            productionUrl: "https://glorian-system.vercel.app",
            type: "control-plane-monolith",
            status: "REGISTERED",
            intake: "INTAKE_COMPLETE",
            specification: "SPECIFICATION_APPROVED",
            audit: "AUDIT_COMPLETE",
            authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
            cicdGateScript: "scripts/verify-cicd-pipeline.mjs"
          },
          {
            id: "performance-talent-group",
            name: "PTG — Performance Talent Group",
            localPathEnv: "EOS_FLEET_PTG_PATH",
            remoteUrl: "https://github.com/valentinflorezarbelaez-ai/Performance-Talent-Group.git",
            productionUrl: "https://ptg-performance-talent-group.vercel.app",
            type: "enterprise-operations",
            status: "REGISTERED",
            intake: "INTAKE_COMPLETE",
            specification: "SPECIFICATION_APPROVED",
            audit: "AUDIT_COMPLETE",
            authorization: "LEVEL_2_AUTHORIZED",
            cicdGateScript: "scripts/smoke-test.ps1"
          }
        ]
      };

      const discovered = [
        {
          id: "eos-system",
          name: "EOS System",
          dirName: "Eos-System",
          fullPath: "C:\\Users\\valen\\Eos-System",
          remoteUrl: "https://github.com/valentinflorezarbelaez-ai/Eos-System.git",
          currentBranch: "main",
          headCommitSha: "ab5000201234567890abcdef1234567890abcdef",
          productionUrl: "https://glorian-system.vercel.app",
          type: "control-plane-monolith",
          cicdGateScript: "scripts/verify-cicd-pipeline.mjs"
        },
        {
          id: "performance-talent-group",
          name: "Performance Talent Group",
          dirName: "Performance-Talent-Group-1",
          fullPath: "C:\\Users\\valen\\Performance-Talent-Group-1",
          remoteUrl: "https://github.com/valentinflorezarbelaez-ai/Performance-Talent-Group.git",
          currentBranch: "main",
          headCommitSha: "11223344556677889900aabbccddeeff00112233",
          productionUrl: "https://ptg-performance-talent-group.vercel.app",
          type: "enterprise-operations",
          cicdGateScript: "scripts/smoke-test.ps1"
        },
        {
          id: "control-de-asistencia-abopack",
          name: "Avo Pack S.A.S. — Control de Asistencia",
          dirName: "Control-De-Asistencia-Abopack",
          fullPath: "C:\\Users\\valen\\Control-De-Asistencia-Abopack",
          remoteUrl: "https://github.com/valentinflorezarbelaez-ai/Control-De-Asistencia-Abopack.git",
          currentBranch: "main",
          headCommitSha: "5ba39af01234567890abcdef1234567890abcdef",
          productionUrl: "https://avo-pack.vercel.app",
          type: "industrial-operations-suite",
          cicdGateScript: "npm test"
        }
      ];

      const reconciled = reconcileFleetRegistry(existingRegistry, discovered);

      assert.equal(reconciled.projects.length, 3);
      
      const eos = reconciled.projects.find((p) => p.id === "eos-system");
      assert.equal(eos.authorization, "LEVEL_3_PRODUCTION_AUTHORIZED");
      assert.equal(eos.headCommitSha, "ab5000201234567890abcdef1234567890abcdef");

      const ptg = reconciled.projects.find((p) => p.id === "performance-talent-group");
      assert.equal(ptg.authorization, "LEVEL_2_AUTHORIZED");
      assert.equal(ptg.resolvedLocalDir, "Performance-Talent-Group-1");

      const avopak = reconciled.projects.find((p) => p.id === "control-de-asistencia-abopack");
      assert.equal(avopak.status, "REGISTERED");
      assert.equal(avopak.productionUrl, "https://avo-pack.vercel.app");
    });
  });

  describe("BDD-365: Deterministic Registry Signature", () => {
    it("computes reproducible SHA-256 seal for registry", () => {
      const reg = { version: "1.0", projects: [{ id: "a" }] };
      const sig1 = computeRegistrySignature(reg);
      const sig2 = computeRegistrySignature(reg);
      assert.equal(sig1, sig2);
      assert.ok(/^[0-9a-f]{64}$/.test(sig1));
    });
  });

  describe("BDD-367: MCP Tool Execution (eos_fleet_registry_sync)", async () => {
    it("dispatches eos_fleet_registry_sync tool via EosMcpServer in dryRun mode", async () => {
      const { EosMcpServer } = await import("../src/mcp/eosMcpServer.ts");
      const server = new EosMcpServer(path.resolve("."), "full");
      const response = server.handleRequest({
        jsonrpc: "2.0",
        id: 124,
        method: "tools/call",
        params: {
          name: "eos_fleet_registry_sync",
          arguments: {
            dryRun: true
          }
        }
      });

      assert.ok(response, "Must receive a JSON-RPC response");
      assert.equal(response.id, 124);
      assert.ok(response.result, "Must contain result");
      assert.ok(Array.isArray(response.result.content));
      const body = JSON.parse(response.result.content[0].text);
      assert.equal(body.dryRun, true);
      assert.ok(body.totalRegistered >= 5);
      assert.ok(/^[0-9a-f]{64}$/.test(body.registrySha256));
    });
  });
});
