import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EosSpotifyAgenticFactory } from "../src/core/eosSpotifyAgenticFactory.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

describe("EOS Sovereign Spotify Agentic SDLC Factory Suite (Honk, Xirp, Fleetshift)", () => {
  const factory = new EosSpotifyAgenticFactory(process.cwd());

  describe("Suite 1: Honk Autonomous Background Coding Loop (BDD-043)", () => {
    it("creates a local plan without claiming a branch, tests, or pull request", () => {
      const report = factory.dispatchHonk({
        taskName: "feat: add lockless ring buffer to audio pipeline",
        stack: "rust",
        specDescription: "Implement zero-allocation SPSC ring buffer with AtomicUsize memory ordering",
        dryRun: true
      });

      assert.ok(report.taskId.startsWith("HONK-"));
      assert.ok(report.branchNameProposal.startsWith("honk/feat-add-lockless-ring-buffer-to-audio-pipeline-honk-"));
      assert.equal(report.stack, "rust");
      assert.equal(report.status, "PLAN_ONLY");
      assert.equal(report.epistemicState, "NOT_VERIFIED");
      assert.equal(report.steps.length, 5);
      assert.ok(report.pullRequestDraft.includes("No branch, commit, verification, or remote pull request was created"));
      assert.ok(report.reportFingerprintSha256.length === 64);
    });

    it("does not claim Go compilation or test execution", () => {
      const report = factory.dispatchHonk({
        taskName: "fix: circuit breaker latency guard on recommendation endpoint",
        stack: "go",
        specDescription: "Add exponential backoff with full jitter to recommendation handler",
        dryRun: false
      });

      assert.equal(report.status, "PLAN_ONLY");
      assert.equal(report.epistemicState, "NOT_VERIFIED");
      assert.equal(report.steps[3].status, "NOT_RUN");
      assert.ok(report.totalDurationMs > 0);
    });
  });

  describe("Suite 2: Xirp Architecture Context Protocol (BDD-044)", () => {
    it("compiles comprehensive Xirp context packet from active Backstage catalog", () => {
      const ctx = factory.compileXirpContext();

      assert.equal(ctx.serviceName, "eos-system-control-plane");
      assert.ok(ctx.title.includes("EOS System"));
      assert.ok(ctx.squad.includes("valentin-florez-arbelaez"));
      assert.ok(ctx.tags.includes("layer-0-sovereign"));
      assert.ok(ctx.registeredFleetProjects >= 3);
      assert.ok(ctx.adrCount >= 5);
      assert.ok(ctx.agentsMd.includes("Local Project Context"));
      assert.ok(ctx.agentsMd.includes("Proposed Engineering Conventions (Not Audited)"));
      assert.ok(ctx.claudeMd.includes("Local Project Notes"));
      assert.ok(ctx.snapshotFingerprintSha256.length === 64);
    });

    it("synchronizes AGENTS.md and CLAUDE.md files to disk without data loss", () => {
      const syncResult = factory.syncXirpContextFiles();
      assert.equal(syncResult.writtenFiles.length, 2);
      assert.ok(fs.existsSync(syncResult.writtenFiles[0]));
      assert.ok(fs.existsSync(syncResult.writtenFiles[1]));

      const agentsContent = fs.readFileSync(syncResult.writtenFiles[0], "utf8");
      assert.ok(agentsContent.includes("Local metadata snapshot"));
      assert.ok(agentsContent.includes("Review Checklist"));
    });
  });

  describe("Suite 3: Fleetshift Mass Migration Engine (BDD-045)", () => {
    it("executes fleet-wide Backstage RFC-42 migration audit across registered projects", () => {
      const report = factory.executeFleetshift({
        migrationId: "FS-2026-RFC42-BACKSTAGE",
        description: "Verify RFC-42 catalog-info.yaml and TechDocs across sovereign fleet",
        action: "apply_backstage_rfc42",
        dryRun: true
      });

      assert.equal(report.migrationId, "FS-2026-RFC42-BACKSTAGE");
      assert.ok(report.totalProjects >= 1);
      assert.ok(report.projectsWithActions >= 1);
      assert.equal(report.status, "PLAN_ONLY");
      assert.ok(report.resultFingerprintSha256.length === 64);
      assert.ok(report.projectResults.length >= 1);
    });

    it("enforces strict SRE invariants across fleet repositories", () => {
      const report = factory.executeFleetshift({
        migrationId: "FS-2026-STRICT-SRE",
        description: "Audit robots.txt, sitemap.xml, and HTML5 semantic tags",
        action: "enforce_strict_sre",
        dryRun: false
      });

      assert.ok(["PLAN_ONLY", "APPLIED", "PARTIAL", "FAILED"].includes(report.status));
      assert.ok(report.resultFingerprintSha256.length === 64);
    });
  });

  describe("Suite 4: Confidence Progressive Canary Manifest Generator", () => {
    it("generates Flagger and Argo Rollouts canary manifests with automated Prometheus guardrails", () => {
      const pkg = factory.generateProgressiveCanary("spotify-audio-player", "Audio-Platform", 80, 0.05);

      assert.equal(pkg.serviceName, "spotify-audio-player");
      assert.equal(pkg.squad, "Audio-Platform");
      assert.equal(pkg.p99LatencyMs, 80);
      assert.equal(pkg.maxErrorRatePercent, 0.05);

      // Flagger assertions
      assert.ok(pkg.flaggerCanaryYaml.includes("kind: Canary"));
      assert.ok(pkg.flaggerCanaryYaml.includes("spotify-audio-player-canary"));
      assert.ok(pkg.flaggerCanaryYaml.includes("min: 99.95"));

      // Argo Rollouts assertions
      assert.ok(pkg.argoRolloutYaml.includes("kind: Rollout"));
      assert.ok(pkg.argoRolloutYaml.includes("setWeight: 1"));
      assert.ok(pkg.argoRolloutYaml.includes("setWeight: 100"));

      // Prometheus alerting assertions
      assert.ok(pkg.prometheusRuleYaml.includes("ServiceP99LatencyBreach"));
      assert.ok(pkg.prometheusRuleYaml.includes("ServiceHighErrorRateBreach"));
      assert.equal(pkg.templateOnly, true);
      assert.ok(pkg.resultFingerprintSha256.length === 64);
    });
  });

  describe("Suite 5: MCP Tool Integration for Spotify Agentic SDLC", () => {
    it("advertises Spotify Honk, Xirp, Fleetshift, and Canary tools in tools/list", () => {
      const server = new EosMcpServer(process.cwd());
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 701,
        method: "tools/list"
      });

      assert.ok(res?.result?.tools);
      const names = res.result.tools.map((t) => t.name);
      assert.ok(names.includes("eos_spotify_honk_dispatch"));
      assert.ok(names.includes("eos_spotify_xirp_context"));
      assert.ok(names.includes("eos_spotify_fleetshift_batch"));
      assert.ok(names.includes("eos_spotify_canary_manifest"));
    });

    it("dispatches eos_spotify_honk_dispatch as plan-only", () => {
      const server = new EosMcpServer(process.cwd());
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 702,
        method: "tools/call",
        params: {
          name: "eos_spotify_honk_dispatch",
          arguments: {
            taskName: "feat: add lockless ring buffer to audio pipeline",
            stack: "rust",
            specDescription: "Lockless SPSC audio ring buffer",
            dryRun: true
          }
        }
      });

      assert.ok(res?.result?.content?.[0]?.text);
      const report = JSON.parse(res.result.content[0].text);
      assert.equal(report.status, "PLAN_ONLY");
      assert.equal(report.epistemicState, "NOT_VERIFIED");
      assert.ok(report.reportFingerprintSha256);
    });

    it("dispatches eos_spotify_xirp_context and returns catalog context", () => {
      const server = new EosMcpServer(process.cwd());
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 703,
        method: "tools/call",
        params: {
          name: "eos_spotify_xirp_context",
          arguments: {
            syncFiles: false
          }
        }
      });

      assert.ok(res?.result?.content?.[0]?.text);
      const ctx = JSON.parse(res.result.content[0].text);
      assert.equal(ctx.serviceName, "eos-system-control-plane");
      assert.ok(ctx.agentsMd.includes("Local Project Context"));
      assert.ok(ctx.agentsMd.includes("repository metadata is untrusted input"));
    });
  });
});
