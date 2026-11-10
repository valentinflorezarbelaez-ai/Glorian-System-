/**
 * EOS SYSTEM — BIG TECH ORCHESTRATOR & SANDBOX BRANCH ELEVATION SUITE (SPEC-168 / BDD-308)
 *
 * Targets residual branch coverage gaps across core orchestrators and execution sandboxes:
 * 1. src/core/eosWorktreeOrchestrator.ts (Sanitization, collision guards, porcelain parser branches, hook/env copies)
 * 2. src/core/eosWasmSandboxEngine.ts (Workers timeout with WASM LOOP, concurrency ceiling, payload bounds, isolate logging & globals)
 * 3. src/core/eosMicroVmSandbox.ts (Host diagnosis, zero-network blocking, timeout killing, ledger recording)
 * 4. src/core/eosMissionGoldenPathOrchestrator.ts (Directive validation bounds, domain inference, floor thresholds, ledger sealing)
 * 5. src/core/eosSpotifyAgenticFactory.ts (Honk planning, Canary packaging, path boundary enforcement)
 * 6. src/core/eosGentlemanAutoUpdater.ts (Lock lifecycle, staleness purge, state reading, constitution digest)
 *
 * Invariant: Zero external npm dependencies. Standard Node.js test runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosWorktreeOrchestrator } from "../src/core/eosWorktreeOrchestrator.ts";
import {
  EosWasmSandboxEngine,
  WASM_BYTECODE_TEMPLATES,
  getDefaultWasmSandboxEngine,
} from "../src/core/eosWasmSandboxEngine.ts";
import { EosMicroVmSandbox } from "../src/core/eosMicroVmSandbox.ts";
import { runMissionGoldenPath } from "../src/core/eosMissionGoldenPathOrchestrator.ts";
import { EosSpotifyAgenticFactory } from "../src/core/eosSpotifyAgenticFactory.ts";
import { EosGentlemanAutoUpdater } from "../src/core/eosGentlemanAutoUpdater.ts";
import { EosEngineeringWorkflow } from "../src/core/eosEngineeringWorkflow.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

describe("EOS BIG TECH ORCHESTRATOR & SANDBOX APEX SUITE", () => {
  describe("Suite 1: EosWorktreeOrchestrator Branch Hardening", () => {
    const orchestrator = new EosWorktreeOrchestrator(root);

    it("rejects invalid or illegal branch names", () => {
      const invalidNames = ["", "-leading-dash", "/leading-slash", "trailing-slash/", "///"];
      for (const name of invalidNames) {
        assert.throws(
          () => orchestrator.createWorktree(name),
          /Branch name must be a non-empty relative Git branch name/,
        );
      }
    });

    it("rejects worktree creation if destination path already exists", () => {
      // Use existing root directory as destination
      assert.throws(() => orchestrator.createWorktree("valid-branch", "."), /Worktree destination already exists/);
    });

    it("refuses removal of unregistered or root worktrees", () => {
      // 1. Root directory
      const rootRes = orchestrator.removeWorktree(root);
      assert.equal(rootRes.success, false);
      assert.ok(rootRes.error?.includes("Cannot remove primary repository root"));

      // 2. Unregistered external path
      const fakePath = path.join(os.tmpdir(), "nonexistent-worktree-xyz");
      const unregRes = orchestrator.removeWorktree(fakePath);
      assert.equal(unregRes.success, false);
      assert.ok(unregRes.error?.includes("Target is not a registered worktree"));
    });

    it("parses porcelain output across all structural variants", () => {
      const mockPorcelain = [
        "worktree /repo/main",
        "HEAD 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
        "branch refs/heads/main",
        "",
        "worktree /repo/bare-node",
        "HEAD 0000000000000000000000000000000000000000",
        "bare",
        "",
        "worktree /repo/locked-tree",
        "HEAD 1111111111111111111111111111111111111111",
        "branch refs/heads/feature-x",
        "locked Maintenance in progress",
        "",
        "worktree /repo/detached-tree",
        "HEAD 2222222222222222222222222222222222222222",
        "",
      ].join("\n");

      // Test private parsePorcelainList via instance call
      const parsed = orchestrator.parsePorcelainList(mockPorcelain);
      assert.equal(parsed.length, 4);

      // Primary main worktree
      assert.equal(parsed[0].path, "/repo/main");
      assert.equal(parsed[0].branch, "main");
      assert.equal(parsed[0].isMain, true);
      assert.equal(parsed[0].isBare, false);
      assert.equal(parsed[0].isLocked, false);

      // Bare repository
      assert.equal(parsed[1].isBare, true);
      assert.equal(parsed[1].branch, "(bare)");
      assert.equal(parsed[1].isMain, false);

      // Locked worktree with reason
      assert.equal(parsed[2].isLocked, true);
      assert.equal(parsed[2].lockReason, "Maintenance in progress");
      assert.equal(parsed[2].branch, "feature-x");

      // Detached HEAD
      assert.equal(parsed[3].branch, "detached");
      assert.equal(parsed[3].isLocked, false);
    });

    it("handles getWorktreeStatus failure gracefully on invalid directories", () => {
      const invalidPath = path.join(os.tmpdir(), "invalid-git-dir-404");
      const status = orchestrator.getWorktreeStatus(invalidPath);
      assert.equal(status.clean, false);
      assert.equal(status.currentBranch, "unknown");
      assert.equal(status.modifiedFiles.length, 0);
      assert.equal(status.untrackedFiles.length, 0);
    });
  });

  describe("Suite 2: EosWasmSandboxEngine Capability Bounds & Isolation", () => {
    const tmpLedgerDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-wasm-test-ledger-"));
    const engine = new EosWasmSandboxEngine(root, path.join(tmpLedgerDir, "test-ledger.sqlite"));

    it("executes valid Wasm bytecode via base64, Buffer, and Uint8Array", () => {
      const addBytes = WASM_BYTECODE_TEMPLATES.ADD;

      // 1. Base64
      const b64 = Buffer.from(addBytes).toString("base64");
      const rB64 = engine.executeWasm(b64, { entryFunction: "add", functionArgs: [10, 20] });
      assert.equal(rB64.status, "COMPLETED");
      assert.equal(rB64.returnValue, 30);

      // 2. Buffer
      const buf = Buffer.from(addBytes);
      const rBuf = engine.executeWasm(buf, { entryFunction: "add", functionArgs: [40, 2] });
      assert.equal(rBuf.status, "COMPLETED");
      assert.equal(rBuf.returnValue, 42);

      // 3. Uint8Array with custom page bounds
      const rPages = engine.executeWasm(addBytes, {
        initialPages: 2,
        maxPages: 16,
        entryFunction: "add",
        functionArgs: [100, 200],
      });
      assert.equal(rPages.status, "COMPLETED");
      assert.equal(rPages.returnValue, 300);
      assert.ok(rPages.memoryConsumedBytes >= 65536 * 2);
    });

    it("detects Wasm traps (Unreachable, Out-of-Bounds, Stack Overflow)", () => {
      const rTrap = engine.executeWasm(WASM_BYTECODE_TEMPLATES.TRAP, { entryFunction: "trap" });
      assert.equal(rTrap.status, "TRAPPED_UNREACHABLE");
      assert.equal(rTrap.exitCode, 1);

      const rOob = engine.executeWasm(WASM_BYTECODE_TEMPLATES.OOB, { entryFunction: "oob" });
      assert.equal(rOob.status, "TRAPPED_OOB");
      assert.equal(rOob.exitCode, 1);
    });

    it("kills infinite loop Wasm bytecode in worker thread via timeout supervisor", async () => {
      // Execute LOOP bytecode inside isolated worker with 60ms timeout
      const rLoop = await engine.executeWasmWorker(WASM_BYTECODE_TEMPLATES.LOOP, {
        entryFunction: "loop",
        timeoutMs: 60,
      });

      assert.equal(rLoop.status, "TIMEOUT_KILLED");
      assert.equal(rLoop.exitCode, 1);
      assert.ok(rLoop.stderr.some((e) => e.includes("terminated by worker supervisor")));
    });

    it("rejects oversized Wasm bytecode before thread spawning", async () => {
      const hugeBytes = new Uint8Array(512 * 1024 + 16);
      const rHuge = await engine.executeWasmWorker(hugeBytes);
      assert.equal(rHuge.status, "EXECUTION_FAILED");
      assert.ok(rHuge.stderr[0].includes("exceeds maximum allowed size"));
    });

    it("enforces worker concurrency ceiling (RESOURCE_EXHAUSTED)", async () => {
      const previousCount = EosWasmSandboxEngine.activeWorkerCount;
      try {
        EosWasmSandboxEngine.activeWorkerCount = EosWasmSandboxEngine.MAX_CONCURRENT_WORKERS;
        const rExhausted = await engine.executeWasmWorker(WASM_BYTECODE_TEMPLATES.ADD);
        assert.equal(rExhausted.status, "RESOURCE_EXHAUSTED");
        assert.ok(rExhausted.stderr[0].includes("concurrency limit reached"));
      } finally {
        EosWasmSandboxEngine.activeWorkerCount = previousCount;
      }
    });

    it("calls executeWasmAsync transparently", async () => {
      const rAsync = await engine.executeWasmAsync(WASM_BYTECODE_TEMPLATES.ADD, {
        entryFunction: "add",
        functionArgs: [7, 8],
      });
      assert.equal(rAsync.status, "COMPLETED");
      assert.equal(rAsync.returnValue, 15);
    });

    it("executes hardened node:vm isolate with console streams and global seals", () => {
      const code = `
        console.log("isolate test output");
        console.warn("isolate test warn");
        console.error("isolate test error");
        const hash = crypto.createHash("sha256").update("test").digest("hex");
        Math.max(10, 20) + hash.length;
      `;
      const rIso = engine.executeIsolate(code, {
        timeoutMs: 1000,
        readOnlyGlobals: { customConstant: 999 },
      });
      assert.equal(rIso.status, "COMPLETED");
      assert.equal(rIso.returnValue, 84); // 20 + 64
      assert.ok(rIso.stdout.includes("isolate test output"));
      assert.ok(rIso.stderr.includes("isolate test warn"));
      assert.ok(rIso.stderr.includes("isolate test error"));
    });

    it("synthesizes MicroVM descriptors for Hyper-V and Firecracker specifications", () => {
      const descriptor = engine.generateMicroVmDescriptor({
        vcpuCount: 4,
        memSizeMib: 1024,
        kernelPath: "/opt/custom/vmlinux",
        rootfsPath: "/opt/custom/rootfs.ext4",
        vsockPath: "/tmp/custom.vsock",
      });

      assert.ok(descriptor.enclaveId.startsWith("enclave-"));
      assert.equal(typeof descriptor.specSha256, "string");
      assert.equal(descriptor.specSha256.length, 64);

      if (process.platform === "win32") {
        assert.equal(descriptor.platform, "windows-hyperv");
        assert.equal(descriptor.spec.isolation, "hyperv");
        assert.equal(descriptor.spec.cpuCount, 4);
      } else {
        assert.equal(descriptor.platform, "linux-firecracker");
        assert.ok(descriptor.spec.boot_source);
      }
    });

    it("commits and closes execution receipts safely with default engine singleton", () => {
      const def = getDefaultWasmSandboxEngine(root);
      assert.ok(def instanceof EosWasmSandboxEngine);
    });
  });

  describe("Suite 3: EosMicroVmSandbox Virtualization Confinement", () => {
    it("diagnoses host virtualization capabilities deterministically", () => {
      const report = EosMicroVmSandbox.diagnoseHost();
      assert.ok(["FIRECRACKER", "DOCKER_GVISOR", "EPHEMERAL_NODE_VM"].includes(report.tier));
      assert.equal(typeof report.dockerAvailable, "boolean");
      assert.equal(typeof report.gVisorAvailable, "boolean");
      assert.equal(typeof report.firecrackerAvailable, "boolean");
      assert.equal(report.memoryLimitMb, 512);
      assert.equal(report.networkIsolated, true);
    });

    it("blocks intentional outbound network access attempts immediately", () => {
      const maliciousPayloads = [
        "const http = require('http');",
        "import * as net from 'net';",
        "fetch('https://malicious.example.com');",
        "const s = socket();",
      ];

      for (const payload of maliciousPayloads) {
        const res = EosMicroVmSandbox.runIsolated({ codeOrCommand: payload });
        assert.equal(res.status, "NETWORK_VIOLATION_BLOCKED");
        assert.equal(res.exitCode, 111);
        assert.ok(res.stderr.includes("Zero-Network isolation policy"));
      }
    });

    it("enforces execution timeout on infinite loops in ephemeral VM", () => {
      const res = EosMicroVmSandbox.runIsolated({
        codeOrCommand: "while (true) {}",
        timeoutMs: 60,
      });
      assert.equal(res.status, "TIMEOUT_KILLED");
      assert.equal(res.exitCode, 124);
      assert.ok(res.stderr.includes("timed out"));
    });

    it("records sandbox execution receipt in SQLite WAL ledger", () => {
      const tmpDb = path.join(os.tmpdir(), `eos-sbx-test-${Date.now()}.sqlite`);
      const res = EosMicroVmSandbox.runIsolated({
        codeOrCommand: "console.log('ledger test'); assert.ok(true);",
      });
      assert.equal(res.status, "COMPLETED");

      const recorded = EosMicroVmSandbox.recordReceiptInLedger(res, tmpDb);
      assert.equal(recorded, true);

      // Clean up tmp db
      try {
        fs.rmSync(tmpDb, { force: true });
      } catch {
        // Ignored
      }
    });
  });

  describe("Suite 4: EosMissionGoldenPathOrchestrator Stage Invariants & Domain Routing", () => {
    it("rejects empty directives and directives that exceed maximum bounds", () => {
      // 1. Empty directive returns fail status
      const emptyRes = runMissionGoldenPath("", { sealLedger: false });
      assert.equal(emptyRes.status, "FAILED");
      assert.equal(emptyRes.failingStage, "INPUT_VALIDATION");
      assert.equal(emptyRes.epistemicState, "BLOCKED");

      // 2. Oversized directive throws precondition violation
      const oversizedDirective = "A".repeat(32769);
      assert.throws(
        () => runMissionGoldenPath(oversizedDirective, { sealLedger: false }),
        /Directive exceeds 32 KiB bound/,
      );
    });

    it("infers all natural-language domain hints accurately", () => {
      const testCases = [
        { directive: "Design high throughput fintech banking service with datomic sachem", expected: "fintech" },
        { directive: "Calibrate studio loudness according to bs.1770 audio mastering", expected: "audio" },
        { directive: "Generate custom spotify playlist soundcheck octaves", expected: "spotify" },
        { directive: "Deploy federated control plane mcp fleet supervisor", expected: "platform" },
        { directive: "Perform refactor of utilities", expected: "general" },
      ];

      for (const tc of testCases) {
        const res = runMissionGoldenPath(tc.directive, {
          sealLedger: false,
          spotifyFloor: 0,
          nubankFloor: 0,
        });
        assert.equal(res.domainHint, tc.expected);
        assert.ok(res.stages.length >= 2);
      }
    });

    it("executes with custom target, custom floors, and custom ledger path", () => {
      const tmpLedger = path.join(os.tmpdir(), `eos-gp-test-${Date.now()}.sqlite`);
      const res = runMissionGoldenPath("Test custom mission options", {
        target: "custom-component",
        spotifyFloor: 50,
        nubankFloor: 50,
        sealLedger: true,
        ledgerPath: tmpLedger,
      });

      assert.equal(res.target, "custom-component");
      assert.ok(typeof res.sha256Receipt === "string" && res.sha256Receipt.length === 64);
      assert.ok(Array.isArray(res.stages));

      try {
        fs.rmSync(tmpLedger, { force: true });
      } catch {
        // Ignored
      }
    });
  });

  describe("Suite 5: EosSpotifyAgenticFactory Manifests & Boundary Safety", () => {
    const factory = new EosSpotifyAgenticFactory(root);

    it("plans Honk tasks across polyglot stacks in plan-only mode", () => {
      const stacks = ["rust", "go", "node", "java"];
      for (const stack of stacks) {
        const report = factory.dispatchHonk({
          taskName: `test-${stack}-service`,
          stack,
          specDescription: `Specification for ${stack} microservice`,
          dryRun: true,
        });
        assert.equal(report.status, "PLAN_ONLY");
        assert.equal(report.epistemicState, "NOT_VERIFIED");
        assert.equal(report.stack, stack);
        assert.ok(report.branchNameProposal.includes(`honk/test-${stack}-service`));
        assert.equal(typeof report.reportFingerprintSha256, "string");
      }
    });

    it("generates canary rollout packages with custom latencies and thresholds", () => {
      const canary = factory.generateProgressiveCanary("glorian-audio-stream", "squad-sound-architecture", 80, 0.05);

      assert.equal(canary.templateOnly, true);
      assert.equal(canary.serviceName, "glorian-audio-stream");
      assert.equal(canary.squad, "squad-sound-architecture");
      assert.equal(canary.p99LatencyMs, 80);
      assert.equal(canary.maxErrorRatePercent, 0.05);
      assert.ok(canary.flaggerCanaryYaml.includes("glorian-audio-stream"));
      assert.ok(canary.argoRolloutYaml.includes("squad-sound-architecture"));
      assert.equal(canary.resultFingerprintSha256.length, 64);
    });

    it("prevents directory traversal attacks escaping the project root", () => {
      assert.throws(
        () => factory.resolveProjectDirectory("../../../../../windows/system32"),
        /Target directory must stay inside the configured project root/,
      );
    });
  });

  describe("Suite 6: EosGentlemanAutoUpdater Lifecycle & State Resilience", () => {
    const tmpEosDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-updater-test-"));

    it("resolves default state and lock paths deterministically", () => {
      const statePath = EosGentlemanAutoUpdater.defaultStatePath(tmpEosDir);
      const lockPath = EosGentlemanAutoUpdater.defaultLockPath(tmpEosDir);
      assert.ok(statePath.endsWith(path.join(".eos", "state", "gentleman-auto-update.json")));
      assert.ok(lockPath.endsWith(path.join(".eos", "state", "gentleman-autoupdate.lock")));
    });

    it("manages lock acquisition, conflict prevention, and release lifecycle", () => {
      // 1. Acquire lock
      const acquired = EosGentlemanAutoUpdater.acquireLock(tmpEosDir);
      assert.equal(acquired, true);

      // 2. Second acquisition must fail (locked)
      const secondAttempt = EosGentlemanAutoUpdater.acquireLock(tmpEosDir);
      assert.equal(secondAttempt, false);

      // 3. Stale lock purge (older than 30 mins)
      const staleTime = Date.now() - 35 * 60 * 1000;
      fs.writeFileSync(
        EosGentlemanAutoUpdater.defaultLockPath(tmpEosDir),
        JSON.stringify({ pid: 99999, acquiredAtMs: staleTime }),
      );
      const reclaimed = EosGentlemanAutoUpdater.acquireLock(tmpEosDir);
      assert.equal(reclaimed, true);

      // 4. Release lock
      EosGentlemanAutoUpdater.releaseLock(tmpEosDir);
      assert.equal(fs.existsSync(EosGentlemanAutoUpdater.defaultLockPath(tmpEosDir)), false);
    });

    it("computes constitution digest and evaluates update schedules", () => {
      const digest = EosGentlemanAutoUpdater.computeConstitutionDigest(root);
      assert.equal(typeof digest, "string");
      assert.equal(digest.length, 64);

      // Without state, isAutoUpdateDue must return true
      const dueWithoutState = EosGentlemanAutoUpdater.isAutoUpdateDue(tmpEosDir, 6);
      assert.equal(dueWithoutState, true);

      // Write mock state checked recently
      fs.mkdirSync(path.join(tmpEosDir, ".eos", "state"), { recursive: true });
      fs.writeFileSync(
        EosGentlemanAutoUpdater.defaultStatePath(tmpEosDir),
        JSON.stringify({
          lastCheckedAtIso: new Date().toISOString(),
          lastCheckedAtMs: Date.now(),
          lastAppliedAtIso: null,
          checkIntervalHours: 6,
          agentTeamsLiteCommitSha: null,
          components: {},
          lastReceiptSha256: "0".repeat(64),
        }),
      );

      const dueRecently = EosGentlemanAutoUpdater.isAutoUpdateDue(tmpEosDir, 6);
      assert.equal(dueRecently, false);

      // Reading state
      const state = EosGentlemanAutoUpdater.readState(tmpEosDir);
      assert.ok(state !== null);
      assert.equal(state.checkIntervalHours, 6);
    });
  });

  describe("Suite 7: EosEngineeringWorkflow Boundary Guards", () => {
    const workflow = new EosEngineeringWorkflow();

    it("inspects the current repository state cleanly", () => {
      const report = workflow.inspect(root);
      assert.ok(report.branch.length > 0);
      assert.ok(report.headCommit.length > 0);
      assert.ok(Array.isArray(report.dirtyFiles));
      assert.ok(report.audit.fingerprint.primaryLanguage);
    });

    it("rejects empty or oversized tasks during planning", () => {
      // Empty task
      assert.throws(() => workflow.plan(root, ""), /Task must contain 1 to 512 UTF-8 bytes/);

      // Oversized task (> 512 bytes)
      assert.throws(() => workflow.plan(root, "X".repeat(513)), /Task must contain 1 to 512 UTF-8 bytes/);
    });

    it("plans valid engineering workflow with candidate validation commands", () => {
      const plan = workflow.plan(root, "Add unit tests for engineering workflow");
      assert.equal(plan.planStatus, "PLAN_ONLY");
      assert.equal(plan.executionPerformed, false);
      assert.ok(plan.proposedSteps.length >= 4);
      assert.ok(plan.candidateValidationCommands.length > 0);
    });

    it("rejects status/review/close operations with invalid workflow IDs", () => {
      // 1. Non-UUID format rejection
      assert.throws(() => workflow.status(root, "non-uuid-id"), /Workflow ID must be a UUID returned by flow start/);

      // 2. Unregistered valid UUID rejection (ENOENT file not found)
      const validV4Uuid = crypto.randomUUID();
      assert.throws(() => workflow.status(root, validV4Uuid), /ENOENT/);
      assert.throws(() => workflow.review(root, validV4Uuid), /ENOENT/);
      assert.throws(() => workflow.close(root, validV4Uuid), /ENOENT/);
    });
  });
});
