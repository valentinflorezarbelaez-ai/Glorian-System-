import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  discoverGitRepositories,
  extractGitMetadata,
  inferProjectMetadata,
  reconcileFleetRegistry,
  computeRegistrySignature,
  isExcludedFleetClone,
} from "../scripts/eos-fleet-registry-sync.mjs";

delete process.env.GIT_DIR;
delete process.env.GIT_INDEX_FILE;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_PREFIX;

function git(directory, args) {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_WORK_TREE;
  delete env.GIT_PREFIX;
  return execFileSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env,
  }).trim();
}

function makeWorkspace(t) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "eos-fleet-registry-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));
  return workspace;
}

function createFixtureRepository(workspace, name, { remoteUrl } = {}) {
  const repoRoot = path.join(workspace, name);
  fs.mkdirSync(repoRoot);
  git(repoRoot, ["init", "--initial-branch=main"]);
  git(repoRoot, ["config", "user.name", "EOS Fleet Registry Test"]);
  git(repoRoot, ["config", "user.email", "eos-fleet-registry-test@example.invalid"]);
  git(repoRoot, ["config", "commit.gpgsign", "false"]);
  fs.writeFileSync(path.join(repoRoot, "README.md"), `# ${name}\n`, "utf8");
  git(repoRoot, ["add", "README.md"]);
  git(repoRoot, ["commit", "-m", "Initialize fixture"]);
  if (remoteUrl) git(repoRoot, ["remote", "add", "origin", remoteUrl]);
  return repoRoot;
}

describe("SPEC-124: Autonomous Dynamic Fleet Registry & Law IV Sentinel", () => {
  describe("BDD-361: Autonomous Git Repository Discovery", () => {
    it("discovers git repositories in the workspace root and ignores non-git, hidden and excluded folders", (t) => {
      const workspace = makeWorkspace(t);
      for (const name of ["alpha-repo", "beta-repo"]) {
        fs.mkdirSync(path.join(workspace, name, ".git"), { recursive: true });
      }
      // A `.git` file (worktree/submodule checkout) is also a valid repository marker.
      fs.mkdirSync(path.join(workspace, "gamma-worktree"));
      fs.writeFileSync(
        path.join(workspace, "gamma-worktree", ".git"),
        "gitdir: ../alpha-repo/.git/worktrees/gamma\n",
        "utf8",
      );
      fs.mkdirSync(path.join(workspace, "plain-folder"));
      fs.mkdirSync(path.join(workspace, ".hidden-repo", ".git"), { recursive: true });
      fs.mkdirSync(path.join(workspace, "node_modules", ".git"), { recursive: true });
      fs.mkdirSync(path.join(workspace, ".cache", ".git"), { recursive: true });
      fs.writeFileSync(path.join(workspace, "not-a-directory.txt"), "file\n", "utf8");

      const repos = discoverGitRepositories(workspace);
      assert.deepEqual(repos.map((r) => r.name).sort(), ["alpha-repo", "beta-repo", "gamma-worktree"]);
      for (const repo of repos) {
        assert.equal(repo.fullPath, path.join(workspace, repo.name));
      }
    });

    it("returns an empty list for a non-existent workspace root", (t) => {
      const workspace = makeWorkspace(t);
      assert.deepEqual(discoverGitRepositories(path.join(workspace, "missing-root")), []);
    });
  });

  describe("BDD-362: Git Porcelain & Production Endpoint Inference", () => {
    it("extracts git remote, branch, and commit hash from a hermetic fixture repository", (t) => {
      const workspace = makeWorkspace(t);
      const remoteUrl = "https://github.com/eos-fixture/glorian-fixture.git";
      const repoRoot = createFixtureRepository(workspace, "glorian-fixture", { remoteUrl });

      const gitMeta = extractGitMetadata(repoRoot);
      assert.equal(gitMeta.remoteUrl, remoteUrl);
      assert.equal(gitMeta.currentBranch, "main");
      assert.match(gitMeta.headCommitSha, /^[0-9a-f]{40}$/);
      assert.equal(gitMeta.headCommitSha, git(repoRoot, ["rev-parse", "HEAD"]));
    });

    it("returns empty porcelain metadata for a directory that is not a git repository", (t) => {
      const workspace = makeWorkspace(t);
      const plainDir = path.join(workspace, "plain");
      fs.mkdirSync(plainDir);
      assert.deepEqual(extractGitMetadata(plainDir), {
        remoteUrl: "",
        currentBranch: "main",
        headCommitSha: "",
      });
    });

    it("infers canonical name, archetype, and production URL for Avo Pack", (t) => {
      const workspace = makeWorkspace(t);
      const repoRoot = path.join(workspace, "Control-De-Asistencia-Abopack");
      fs.mkdirSync(repoRoot);
      const meta = inferProjectMetadata(repoRoot);
      assert.equal(meta.name, "Avo Pack S.A.S. — Central de Asistencia y Liquidación Laboral");
      assert.equal(meta.productionUrl, "https://avo-pack.vercel.app");
      assert.equal(meta.type, "industrial-operations-suite");
      assert.equal(meta.cicdGateScript, "npm test");
    });

    it("infers generic metadata from package.json, vercel.json and index.html", (t) => {
      const workspace = makeWorkspace(t);
      const repoRoot = path.join(workspace, "my-service");
      fs.mkdirSync(repoRoot);
      fs.writeFileSync(
        path.join(repoRoot, "package.json"),
        JSON.stringify({ name: "my-service", description: "Fixture service", scripts: { test: "node --test" } }),
        "utf8",
      );
      fs.writeFileSync(
        path.join(repoRoot, "vercel.json"),
        JSON.stringify({ alias: ["my-service.vercel.app"] }),
        "utf8",
      );
      fs.writeFileSync(
        path.join(repoRoot, "index.html"),
        '<title>My Service Portal</title><a href="https://other.vercel.app">link</a>',
        "utf8",
      );
      const meta = inferProjectMetadata(repoRoot);
      assert.equal(meta.name, "My Service Portal");
      assert.equal(meta.productionUrl, "https://my-service.vercel.app");
      assert.equal(meta.type, "general-application");
      assert.equal(meta.cicdGateScript, "npm test");
    });

    it("prefers the verify:strict gate script when the package declares it", (t) => {
      const workspace = makeWorkspace(t);
      const repoRoot = path.join(workspace, "strict-app");
      fs.mkdirSync(repoRoot);
      fs.writeFileSync(
        path.join(repoRoot, "package.json"),
        JSON.stringify({
          name: "strict-app",
          scripts: { "verify:strict": "node scripts/verify-strict.mjs", test: "node --test" },
        }),
        "utf8",
      );
      const meta = inferProjectMetadata(repoRoot);
      assert.equal(meta.cicdGateScript, "scripts/verify-strict.mjs");
    });

    it("degrades gracefully to directory defaults when package.json is malformed", (t) => {
      const workspace = makeWorkspace(t);
      const repoRoot = path.join(workspace, "broken-pkg");
      fs.mkdirSync(repoRoot);
      fs.writeFileSync(path.join(repoRoot, "package.json"), "{ not valid json", "utf8");
      const meta = inferProjectMetadata(repoRoot);
      assert.equal(meta.name, "broken-pkg");
      assert.equal(meta.productionUrl, "");
      assert.equal(meta.type, "general-application");
      assert.equal(meta.cicdGateScript, "npm test");
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
            cicdGateScript: "scripts/verify-cicd-pipeline.mjs",
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
            cicdGateScript: "scripts/smoke-test.ps1",
          },
        ],
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
          cicdGateScript: "scripts/verify-cicd-pipeline.mjs",
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
          cicdGateScript: "scripts/smoke-test.ps1",
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
          cicdGateScript: "npm test",
        },
      ];

      const reconciled = reconcileFleetRegistry(existingRegistry, discovered, { allowNewProjects: true });

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

  describe("BDD-368: Ghost LEVEL_1 clone exclusion", () => {
    it("excludes Glorian-System- / Glorian-System--1 / Kegel clones from discovery inflation", () => {
      assert.equal(isExcludedFleetClone("Glorian-System-"), true);
      assert.equal(isExcludedFleetClone("Glorian-System--1"), true);
      assert.equal(isExcludedFleetClone("Kegel-Ham-Sah-trasnmutacion-y-fortalecimiento-pelvico"), true);
      assert.equal(isExcludedFleetClone("Eos-System-3"), true);
      assert.equal(isExcludedFleetClone("Eos-System"), false);
      assert.equal(isExcludedFleetClone("Performance-Talent-Group-1"), false);
    });

    it("does not auto-register unregistered disk clones without allowNewProjects", () => {
      const existingRegistry = {
        projects: [
          {
            id: "eos-system",
            name: "Glorian",
            resolvedLocalDir: "Eos-System",
            authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
          },
        ],
      };
      const discovered = [
        {
          id: undefined,
          dirName: "Glorian-System-",
          name: "Glorian-System-",
          remoteUrl: "https://github.com/example/Glorian-System-.git",
          currentBranch: "main",
          headCommitSha: "aaa",
        },
        {
          id: undefined,
          dirName: "fixture-ghost-app",
          name: "fixture-ghost-app",
          remoteUrl: "https://github.com/example/fixture-ghost-app.git",
          currentBranch: "main",
          headCommitSha: "bbb",
        },
      ];
      const sealed = reconcileFleetRegistry(existingRegistry, discovered);
      assert.equal(sealed.projects.length, 1);
      assert.equal(sealed.projects[0].id, "eos-system");
      assert.equal(sealed.projects[0].resolvedLocalDir, "Eos-System");
    });
  });

  describe("BDD-367: MCP Tool Execution (eos_fleet_registry_sync)", async () => {
    it("dispatches eos_fleet_registry_sync tool via EosMcpServer in dryRun mode", async (t) => {
      const workspace = makeWorkspace(t);
      createFixtureRepository(workspace, "fixture-fleet-repo", {
        remoteUrl: "https://github.com/eos-fixture/fixture-fleet-repo.git",
      });
      // Ghost clones must not inflate dry-run beyond the sealed registry.
      createFixtureRepository(workspace, "Glorian-System--1", {
        remoteUrl: "https://github.com/eos-fixture/Glorian-System-.git",
      });

      const previousWorkspaceRoot = process.env.EOS_WORKSPACE_ROOT;
      process.env.EOS_WORKSPACE_ROOT = workspace;
      t.after(() => {
        if (previousWorkspaceRoot === undefined) delete process.env.EOS_WORKSPACE_ROOT;
        else process.env.EOS_WORKSPACE_ROOT = previousWorkspaceRoot;
      });

      const { EosMcpServer } = await import("../src/mcp/eosMcpServer.ts");
      const server = new EosMcpServer(path.resolve("."), "full");
      const response = server.handleRequest({
        jsonrpc: "2.0",
        id: 124,
        method: "tools/call",
        params: {
          name: "eos_fleet_registry_sync",
          arguments: {
            dryRun: true,
          },
        },
      });

      assert.ok(response, "Must receive a JSON-RPC response");
      assert.equal(response.id, 124);
      assert.ok(response.result, "Must contain result");
      assert.ok(Array.isArray(response.result.content));
      const body = JSON.parse(response.result.content[0].text);
      assert.equal(body.dryRun, true);
      assert.ok(body.totalRegistered >= 5);
      assert.ok(/^[0-9a-f]{64}$/.test(body.registrySha256));
      // Law IV update-only: unregistered fixtures and Glorian ghosts stay out of dry-run.
      assert.equal(
        body.projects.some((p) => p.id === "fixture-fleet-repo"),
        false,
        "Unregistered fixture must not auto-inflate registry",
      );
      assert.equal(
        body.projects.some((p) => String(p.id).startsWith("glorian-system")),
        false,
        "Glorian-System ghost clones must be excluded",
      );
      assert.equal(body.totalRegistered, body.projects.length);
    });
  });
});
