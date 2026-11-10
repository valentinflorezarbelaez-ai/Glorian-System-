/**
 * EOS SYSTEM — SOVEREIGN APEX BRANCH ELEVATION SUITE (SPEC-160 / BDD-291)
 *
 * Exercises deep unexercised branch conditions across Tier-0 and Tier-1 modules:
 * 1. src/core/eosSpotifyAgenticFactory.ts (Fleetshift actions, Honk polyglot stacks, Canary limits)
 * 2. src/core/eosBigTechProductFactory.ts (IAM denial, delivery states, live mode, receipts)
 * 3. src/core/eosSpotifyCodex.ts (Streaming pipelines, crossfades, Backstage scaffolding, Harmonic transitions)
 * 4. src/core/eosContainerSandbox.ts (Input validation, security checks, Docker options, image pinning)
 * 5. src/core/eosHranaStreamClient.ts (Type encodings, cell decodings, circuit breaker transitions, retries)
 * 6. src/core/eosMonteCarloEngine.ts (Seed handling, perturbation bounds, deadline satisfaction, error gates)
 * 7. src/core/eosFleetElevator.ts (Mutation safety gates, single-project targeting, dry-run contracts)
 * 8. src/core/eosWasmSandboxEngine.ts (Size constraints, string input resolution, isolate limits)
 * 9. src/core/eosMicroVmSandbox.ts (Host diagnostics, tier fallbacks, assert helpers)
 * 10. src/core/eosTlsPeerTransport.ts (SPIFFE prefixes, identity validation, peer verification)
 *
 * Invariant: Pure Layer-0 Node.js standard libraries (zero external npm dependencies).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosSpotifyAgenticFactory } from "../src/core/eosSpotifyAgenticFactory.ts";
import {
  runBigTechProductFactory,
  writeBigTechFactoryReceipt,
  buildDemoLedgerManifest,
} from "../src/core/eosBigTechProductFactory.ts";
import { EosSpotifyCodex } from "../src/core/eosSpotifyCodex.ts";
import { EosContainerSandbox } from "../src/core/eosContainerSandbox.ts";
import { EosHranaStreamClient } from "../src/core/eosHranaStreamClient.ts";
import { EosMonteCarloEngine } from "../src/core/eosMonteCarloEngine.ts";
import { EosFleetElevator } from "../src/core/eosFleetElevator.ts";
import { EosWasmSandboxEngine } from "../src/core/eosWasmSandboxEngine.ts";
import { EosMicroVmSandbox } from "../src/core/eosMicroVmSandbox.ts";
import { EosTlsPeerTransport } from "../src/core/eosTlsPeerTransport.ts";
import { EosConsistentHashRing } from "../src/core/eosConsistentHashRing.ts";
import { EosHashedTimingWheel } from "../src/core/eosHashedTimingWheel.ts";
import { EosPlanetaryConsensusEngine } from "../src/core/eosPlanetaryConsensusEngine.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

describe("SOVEREIGN APEX BRANCH ELEVATION — MISSION CRITICAL SUITE", () => {
  // -------------------------------------------------------------------------
  // 1. EosSpotifyAgenticFactory
  // -------------------------------------------------------------------------
  describe("1. EosSpotifyAgenticFactory — Comprehensive Branch Coverage", () => {
    it("dispatches Honk with polyglot stacks: rust, go, and generic", () => {
      const factory = new EosSpotifyAgenticFactory(root);

      const rustResult = factory.dispatchHonk({
        taskName: "Implement audio mixer",
        specDescription: "Audio mixer specification with bounded buffers",
        stack: "rust",
        dryRun: true,
      });
      assert.equal(rustResult.status, "PLAN_ONLY");
      assert.equal(rustResult.stack, "rust");

      const goResult = factory.dispatchHonk({
        taskName: "Implement telemetry publisher",
        specDescription: "Telemetry publisher specification with backpressure",
        stack: "go",
        dryRun: true,
      });
      assert.equal(goResult.status, "PLAN_ONLY");
      assert.equal(goResult.stack, "go");

      const genericResult = factory.dispatchHonk({
        taskName: "Implement custom worker",
        specDescription: "Generic Node.js worker implementation",
        stack: "node",
        dryRun: true,
      });
      assert.equal(genericResult.status, "PLAN_ONLY");
      assert.equal(genericResult.stack, "node");
    });

    it("enforces validation boundaries on generateProgressiveCanary and compileXirpContext", () => {
      const factory = new EosSpotifyAgenticFactory(root);

      assert.throws(() => factory.generateProgressiveCanary("Invalid_Service_Name!", "squad-1"), /serviceName/);
      assert.throws(() => factory.generateProgressiveCanary("valid-svc", ""), /squad/);

      const canary = factory.generateProgressiveCanary("valid-service", "sound-squad", 150, 0.05);
      assert.equal(canary.serviceName, "valid-service");
      assert.ok(canary.flaggerCanaryYaml.includes("valid-service"));
      assert.ok(canary.argoRolloutYaml.includes("valid-service"));

      const ctx = factory.compileXirpContext(root);
      assert.ok(ctx.serviceName);
    });

    it("executes Fleetshift across various actions: sre, deps, codemod, backstage", () => {
      const factory = new EosSpotifyAgenticFactory(root);

      // enforce_strict_sre
      const sreReport = factory.executeFleetshift({
        migrationId: "mig-sre-001",
        description: "Enforce strict SRE invariants",
        action: "enforce_strict_sre",
        dryRun: true,
        targetFleet: ["eos-system"],
      });
      assert.equal(sreReport.executionMode, "PLAN_ONLY");
      assert.ok(sreReport.projectResults.length > 0);

      // upgrade_dependencies
      const depsReport = factory.executeFleetshift({
        migrationId: "mig-deps-002",
        description: "Upgrade polyglot dependencies",
        action: "upgrade_dependencies",
        dryRun: true,
        targetFleet: ["eos-system"],
      });
      assert.equal(depsReport.executionMode, "PLAN_ONLY");

      // custom_codemod
      const codemodReport = factory.executeFleetshift({
        migrationId: "mig-code-003",
        description: "Custom codemod readiness check",
        action: "custom_codemod",
        dryRun: true,
        targetFleet: ["eos-system"],
      });
      assert.equal(codemodReport.executionMode, "PLAN_ONLY");

      // apply_backstage_rfc42
      const backstageReport = factory.executeFleetshift({
        migrationId: "mig-back-004",
        description: "Apply Backstage RFC-42 standard",
        action: "apply_backstage_rfc42",
        dryRun: true,
        targetFleet: ["eos-system"],
      });
      assert.equal(backstageReport.executionMode, "PLAN_ONLY");

      // Error handling: unregistered target project
      assert.throws(
        () =>
          factory.executeFleetshift({
            migrationId: "mig-err-005",
            description: "Invalid project migration",
            action: "enforce_strict_sre",
            dryRun: true,
            targetFleet: ["non-existent-project-xyz"],
          }),
        /unregistered project ID/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. EosBigTechProductFactory
  // -------------------------------------------------------------------------
  describe("2. EosBigTechProductFactory — Comprehensive Branch Coverage", () => {
    it("handles IAM denial, delivery status states, and receipt generation", () => {
      const manifest = buildDemoLedgerManifest();

      // 1. Dry run execution
      const dryResult = runBigTechProductFactory(manifest, {
        projectRoot: root,
        dryRun: true,
      });
      assert.ok(dryResult.sha256Receipt.length === 64);
      assert.equal(dryResult.dryRun, true);

      // 2. IAM denial simulation (policy that explicitly blocks)
      const blockingPolicy = [
        {
          id: "block-all",
          name: "Block all tools",
          effect: "DENY",
          tools: ["*"],
          description: "Deny all operations",
        },
      ];

      const deniedResult = runBigTechProductFactory(manifest, {
        projectRoot: root,
        dryRun: true,
        policies: blockingPolicy,
      });
      assert.equal(deniedResult.status, "BLOCKED");
      assert.equal(deniedResult.reason, "IAM_DENIED");
      assert.equal(deniedResult.epistemicState, "BLOCKED");

      // 3. Custom receipt writing
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-prod-receipt-"));
      const receiptPath = writeBigTechFactoryReceipt(tmpDir, dryResult, "custom-evidence/receipt.json");
      assert.ok(fs.existsSync(receiptPath));
      const parsedReceipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
      assert.equal(parsedReceipt.productId, manifest.id);
    });
  });

  // -------------------------------------------------------------------------
  // 3. EosSpotifyCodex
  // -------------------------------------------------------------------------
  describe("3. EosSpotifyCodex — Comprehensive Branch Coverage", () => {
    it("exercises streaming pipelines, crossfade arithmetic, and squad topologies", () => {
      const codex = new EosSpotifyCodex(root);

      // simulateAudioStreamingPipeline
      assert.throws(() => codex.simulateAudioStreamingPipeline(0), /chunkCount/);
      assert.throws(() => codex.simulateAudioStreamingPipeline(1025), /chunkCount/);
      const streamReport = codex.simulateAudioStreamingPipeline(4);
      assert.equal(streamReport.totalChunksProcessed, 4);
      assert.ok(streamReport.throughputMbSec > 0);

      // calculateGaplessEqualPowerCrossfade
      const crossfade = codex.calculateGaplessEqualPowerCrossfade(10);
      assert.equal(crossfade.length, 11);
      assert.ok(Math.abs(crossfade[5].totalPower - 1.0) < 0.01);

      // generateSquadManifest
      const defaultSquad = codex.generateSquadManifest();
      assert.equal(defaultSquad.scope, "TEMPLATE_ONLY");
      assert.equal(defaultSquad.squadName, "Example squad (not configured)");

      const customSquad = codex.generateSquadManifest({
        squadName: "Core Engine",
        tribe: "Platform Infrastructure",
      });
      assert.equal(customSquad.squadName, "Core Engine");
      assert.equal(customSquad.tribe, "Platform Infrastructure");
    });

    it("evaluates all Camelot wheel harmonic transition edge cases", () => {
      const codex = new EosSpotifyCodex(root);

      // key: 0..11, mode: 1 (major) / 0 (minor)
      // C Major (key 0, mode 1) -> Camelot 8B
      // C Major to C Major -> PERFECT_MATCH
      const same = codex.evaluateHarmonicTransition(0, 1, 0, 1);
      assert.equal(same.harmonicRelationship, "PERFECT_MATCH");
      assert.equal(same.compatible, true);

      // C Major (8B) to A Minor (key 9, mode 0 -> 8A) -> MODE_SHIFT
      const relative = codex.evaluateHarmonicTransition(0, 1, 9, 0);
      assert.equal(relative.harmonicRelationship, "MODE_SHIFT");
      assert.equal(relative.compatible, true);

      // C Major (8B) to G Major (key 7, mode 1 -> 9B) -> ENERGY_BOOST
      const boost = codex.evaluateHarmonicTransition(0, 1, 7, 1);
      assert.equal(boost.harmonicRelationship, "ENERGY_BOOST");
      assert.equal(boost.compatible, true);

      // C Major (8B) to F Major (key 5, mode 1 -> 7B) -> ENERGY_DROP
      const drop = codex.evaluateHarmonicTransition(0, 1, 5, 1);
      assert.equal(drop.harmonicRelationship, "ENERGY_DROP");
      assert.equal(drop.compatible, true);

      // Distant/Dissonant keys: C Major (8B) to F# Major (key 6, mode 1 -> 2B) -> DISSONANT
      const clash = codex.evaluateHarmonicTransition(0, 1, 6, 1);
      assert.equal(clash.harmonicRelationship, "DISSONANT");
      assert.equal(clash.compatible, false);
    });

    it("calculates exponential backoff with and without Retry-After headers", () => {
      const codex = new EosSpotifyCodex(root);

      // Explicit Retry-After header
      const withHeader = codex.calculateBackoffMs(2, 200, 8000, 45);
      assert.equal(withHeader, 45000);

      // Standard backoff without header
      const withoutHeader = codex.calculateBackoffMs(3, 200, 8000);
      assert.ok(withoutHeader >= 0 && withoutHeader <= 8000);
    });

    it("scaffolds Backstage catalog descriptors and handles existing catalog paths", () => {
      const codex = new EosSpotifyCodex(root);
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-scaffold-"));

      // Name regex validation
      assert.throws(() => codex.scaffoldBackstageCatalog(tmpDir, { name: "INVALID!NAME" }), /Component name/);

      // First run: write applied
      const result1 = codex.scaffoldBackstageCatalog(tmpDir, { name: "test-service", write: true });
      assert.equal(result1.created, true);
      assert.equal(result1.writeApplied, true);

      // Second run: file already exists
      const result2 = codex.scaffoldBackstageCatalog(tmpDir, { name: "test-service", write: true });
      assert.equal(result2.created, false);
      assert.ok(result2.message.includes("already exists"));
    });
  });

  // -------------------------------------------------------------------------
  // 4. EosContainerSandbox
  // -------------------------------------------------------------------------
  describe("4. EosContainerSandbox — Comprehensive Branch Coverage", () => {
    it("reports offline doctor diagnostic and validates run options fail-closed", async () => {
      const sandbox = new EosContainerSandbox(root);

      const doc = sandbox.doctor();
      assert.equal(typeof doc.ready, "boolean");
      assert.equal(typeof doc.message, "string");

      // Run option input validation boundaries:
      // 1. Invalid command (starts with "-")
      await assert.rejects(
        () => sandbox.run({ worktreePath: "test-wt", command: "-flag-only" }),
        /Provide an executable name/,
      );

      // 2. Command with NUL character
      await assert.rejects(
        () => sandbox.run({ worktreePath: "test-wt", command: "test\0cmd" }),
        /Provide an executable name/,
      );

      // 3. Non-string worktreePath
      await assert.rejects(
        () => sandbox.run({ worktreePath: 12345, command: "echo" }),
        /Sandbox worktree path must be a string/,
      );

      // 4. Invalid applyChanges (non-boolean)
      await assert.rejects(
        () => sandbox.run({ worktreePath: "test-wt", command: "echo", applyChanges: "yes" }),
        /applyChanges must be a boolean/,
      );

      // 5. Huge command arguments (> 128 KiB)
      const hugeArgs = [new Array(130 * 1024).join("x")];
      await assert.rejects(
        () => sandbox.run({ worktreePath: "test-wt", command: "echo", commandArgs: hugeArgs }),
        /exceed 128 KiB/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 5. EosHranaStreamClient
  // -------------------------------------------------------------------------
  describe("5. EosHranaStreamClient — Comprehensive Branch Coverage", () => {
    it("encodes all data types and decodes stream cells accurately", () => {
      const client = new EosHranaStreamClient({
        url: "http://127.0.0.1:9099",
        authToken: "secret-token-test",
      });

      // encodeArgs: null, float64, bigint, string, bytes
      const encoded = client.encodeArgs([null, 42.5, BigInt(9007199254740991), "hello", new Uint8Array([1, 2, 3])]);
      assert.equal(encoded[0].type, "null");
      assert.equal(encoded[1].type, "float64");
      assert.equal(encoded[1].value, 42.5);
      assert.equal(encoded[2].type, "int");
      assert.equal(encoded[2].value, "9007199254740991");
      assert.equal(encoded[3].type, "string");
      assert.equal(encoded[3].value, "hello");
      assert.equal(encoded[4].type, "bytes");

      // parseResult: float64, int, string, bytes, null
      const parsed = client.parseResult({
        cols: [{ name: "id" }, { name: "val" }, { name: "b" }],
        rows: [
          [
            { type: "int", value: "100" },
            { type: "float64", value: 3.14 },
            { type: "bytes", base64: Buffer.from("test").toString("base64") },
          ],
          [null, { type: "string", value: "hello" }, { type: "null" }],
        ],
      });
      assert.equal(parsed.cols[0], "id");
      assert.equal(parsed.rows[0][0], BigInt(100));
      assert.equal(parsed.rows[0][1], 3.14);
      assert.ok(parsed.rows[0][2] instanceof Uint8Array);
      assert.equal(parsed.rows[1][0], null);
      assert.equal(parsed.rows[1][1], "hello");
      assert.equal(parsed.rows[1][2], null);

      // Circuit breaker status
      assert.ok(["CLOSED", "HALF_OPEN", "OPEN"].includes(client.getReport().circuitStatus));
    });
  });

  // -------------------------------------------------------------------------
  // 6. EosMonteCarloEngine
  // -------------------------------------------------------------------------
  describe("6. EosMonteCarloEngine — Comprehensive Branch Coverage", () => {
    it("handles seed variations, PERT distributions, and deadline validations", () => {
      // 1. Validation bounds
      assert.throws(() => EosMonteCarloEngine.simulate([]), /Simulation requires at least one task/);
      assert.throws(
        () =>
          EosMonteCarloEngine.simulate([{ id: "t1", name: "Invalid", optimistic: -1, nominal: 5, pessimistic: 10 }]),
        /estimates cannot be negative/,
      );
      assert.throws(
        () =>
          EosMonteCarloEngine.simulate([
            { id: "t1", name: "Inconsistent", optimistic: 10, nominal: 5, pessimistic: 15 },
          ]),
        /invalid bounds/,
      );

      // 2. Valid simulation with deadline comparison
      const validTasks = [
        { id: "task-1", name: "Design", optimistic: 2, nominal: 4, pessimistic: 8 },
        { id: "task-2", name: "Build", optimistic: 5, nominal: 10, pessimistic: 20 },
      ];

      const reportWithDeadline = EosMonteCarloEngine.simulate(validTasks, {
        seed: 12345,
        iterations: 500,
        deadlineHours: 20,
      });
      assert.equal(reportWithDeadline.summary.iterations, 500);
      assert.ok(reportWithDeadline.summary.mean > 0);
      assert.equal(typeof reportWithDeadline.summary.deadlineProbability, "number");

      // PERT beta sample edge cases (o >= p)
      const rand = EosMonteCarloEngine.createPrng(42);
      const pointDistribution = EosMonteCarloEngine.samplePert(
        { id: "point", name: "Point", optimistic: 5, nominal: 5, pessimistic: 5 },
        rand,
      );
      assert.equal(pointDistribution, 5);
    });
  });

  // -------------------------------------------------------------------------
  // 7. EosFleetElevator
  // -------------------------------------------------------------------------
  describe("7. EosFleetElevator — Comprehensive Branch Coverage", () => {
    it("enforces fleet mutation safeguards and selective project elevation", () => {
      const elevator = new EosFleetElevator(root);

      // Mutating without explicit targetProject must fail-closed
      assert.throws(
        () => elevator.elevateFleet({ dryRun: false }),
        /Applying a fleet change requires one explicit targetProject/,
      );

      // Targeted elevation in dry-run mode
      const dryReport = elevator.elevateFleet({
        dryRun: true,
        targetProject: "eos-system",
      });
      assert.equal(typeof dryReport.totalProjects, "number");
      assert.ok(dryReport.projects.length <= 1);
    });
  });

  // -------------------------------------------------------------------------
  // 8. EosWasmSandboxEngine
  // -------------------------------------------------------------------------
  describe("8. EosWasmSandboxEngine — Comprehensive Branch Coverage", () => {
    it("handles bytecode bounds and invalid inputs fail-closed", () => {
      const engine = new EosWasmSandboxEngine();

      // Input exceeding bytecode ceiling (512 KiB)
      const oversizedBuffer = new Uint8Array(600 * 1024);
      const resultOversized = engine.executeWasm(oversizedBuffer);
      assert.equal(resultOversized.status, "EXECUTION_FAILED");
      assert.ok(resultOversized.stderr.length > 0);

      // Invalid base64 / non-wasm string input
      const resultInvalid = engine.executeWasm(Buffer.from("invalid wasm header").toString("base64"));
      assert.equal(resultInvalid.status, "EXECUTION_FAILED");
    });
  });

  // -------------------------------------------------------------------------
  // 9. EosMicroVmSandbox
  // -------------------------------------------------------------------------
  describe("9. EosMicroVmSandbox — Comprehensive Branch Coverage", () => {
    it("evaluates host diagnostics and microVM tier fallbacks", () => {
      const diag = EosMicroVmSandbox.diagnoseHost();
      assert.equal(typeof diag.dockerAvailable, "boolean");
      assert.equal(typeof diag.firecrackerAvailable, "boolean");
      assert.ok(["FIRECRACKER", "DOCKER_GVISOR", "EPHEMERAL_NODE_VM"].includes(diag.tier));

      // Execution of local function isolate
      const result = EosMicroVmSandbox.runIsolated({
        codeOrCommand: `
        const sum = 10 + 20;
        console.log("sum=" + sum);
        `,
        timeoutMs: 5000,
      });
      assert.equal(result.exitCode, 0);
      assert.ok(result.stdout.includes("sum=30"));
    });
  });

  // -------------------------------------------------------------------------
  // 10. EosTlsPeerTransport
  // -------------------------------------------------------------------------
  describe("10. EosTlsPeerTransport — Comprehensive Branch Coverage", () => {
    it("validates SPIFFE URIs, node identities, and security boundaries", () => {
      const transport = new EosTlsPeerTransport({
        allowedSpiffePrefix: "spiffe://glorian.internal/node/",
      });

      // Handshake verification: missing identity
      assert.equal(
        transport.verifyHandshake({
          identity: null,
          ecdhPublicKeyHex: "abcd",
          timestampIso: new Date().toISOString(),
          signatureHex: "1234",
        }),
        null,
      );

      // Handshake verification: invalid SPIFFE prefix
      assert.equal(
        transport.verifyHandshake({
          identity: {
            nodeId: "node-1",
            spiffeUri: "spiffe://evil.external/hacker",
            publicKeyPem: "-----BEGIN PUBLIC KEY-----\n...",
          },
          ecdhPublicKeyHex: "abcd",
          timestampIso: new Date().toISOString(),
          signatureHex: "1234",
        }),
        null,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 11. EosConsistentHashRing
  // -------------------------------------------------------------------------
  describe("11. EosConsistentHashRing — Comprehensive Branch Coverage", () => {
    it("handles empty ring errors, duplicate node additions, and preference routing", () => {
      const emptyRing = new EosConsistentHashRing([], 16);
      assert.throws(() => emptyRing.getNode("user-123"), /ConsistentHashRing is empty/);
      assert.throws(() => emptyRing.getPreferenceList("user-123", 2), /ConsistentHashRing is empty/);

      const ring = new EosConsistentHashRing(["node-a", "node-b", "node-c"], 32);
      assert.equal(ring.getPhysicalNodeCount(), 3);

      // Duplicate add is a safe no-op
      ring.addNode("node-a");
      assert.equal(ring.getPhysicalNodeCount(), 3);

      // Removal of non-existent node is a safe no-op
      ring.removeNode("node-phantom");
      assert.equal(ring.getPhysicalNodeCount(), 3);

      // Node lookup covers bisect boundary wraps
      const node1 = ring.getNode("alpha-key");
      assert.ok(["node-a", "node-b", "node-c"].includes(node1));

      // Preference list clamping when replicas requested exceed available physical nodes
      const prefs = ring.getPreferenceList("alpha-key", 10);
      assert.equal(prefs.length, 3);
      assert.equal(new Set(prefs).size, 3);

      // Normal removal
      ring.removeNode("node-c");
      assert.equal(ring.getPhysicalNodeCount(), 2);
    });
  });

  // -------------------------------------------------------------------------
  // 12. EosHashedTimingWheel
  // -------------------------------------------------------------------------
  describe("12. EosHashedTimingWheel — Comprehensive Branch Coverage", () => {
    it("enforces preconditions, handles multi-round timers, and supports cancellation", () => {
      // Precondition validations
      assert.throws(() => new EosHashedTimingWheel({ slots: 1, tickDurationMs: 10 }), /slots must be >= 2/);
      assert.throws(() => new EosHashedTimingWheel({ slots: 8, tickDurationMs: 0 }), /tickDurationMs must be positive/);

      const wheel = new EosHashedTimingWheel({ slots: 4, tickDurationMs: 10 });
      assert.throws(() => wheel.schedule(-5, () => {}), /delay must be >= 0/);
      assert.throws(() => wheel.scheduleRecurring(10, 5, () => {}), /interval must be >= tick/);

      let oneShotFired = 0;
      let multiRoundFired = 0;
      let repeatingFired = 0;

      // Schedule one-shot in slot 1 (10ms = 1 tick)
      wheel.schedule(10, () => {
        oneShotFired++;
      });
      // Schedule multi-round timer (100ms = 10 ticks = 2 full rounds + 2 slots)
      wheel.schedule(100, () => {
        multiRoundFired++;
      });
      // Schedule timer that throws: errors are safely swallowed
      wheel.schedule(10, () => {
        throw new Error("expected test explosion");
      });
      // Schedule timer to cancel
      const hToCancel = wheel.schedule(20, () => {
        assert.fail("cancelled timer must not fire");
      });

      assert.equal(wheel.cancel(hToCancel), true);
      assert.equal(wheel.cancel(hToCancel), false); // Cancelling again returns false
      assert.equal(wheel.cancel({ id: 9999, deadlineTick: 1, intervalTicks: 0 }), false);

      // Schedule recurring timer (10ms initial, 20ms interval = 2 ticks)
      wheel.scheduleRecurring(10, 20, () => {
        repeatingFired++;
      });

      assert.ok(wheel.pending >= 3);
      assert.ok(typeof wheel.fingerprint() === "string");

      // Advance by 1 tick: slot 1 fires
      wheel.advance(1);
      assert.equal(oneShotFired, 1);
      assert.equal(repeatingFired, 1);

      // Advance by 10 more ticks: multi-round timer completes and recurring fires again
      wheel.advance(10);
      assert.equal(multiRoundFired, 1);
      assert.ok(repeatingFired >= 4);

      const tel = wheel.telemetry();
      assert.ok(tel.scheduled >= 4);
      assert.ok(tel.fired >= 5);
      assert.equal(tel.cancelled, 1);
    });
  });

  // -------------------------------------------------------------------------
  // 13. EosPlanetaryConsensusEngine
  // -------------------------------------------------------------------------
  describe("13. EosPlanetaryConsensusEngine — Comprehensive Branch Coverage", () => {
    it("evaluates Raft election, log replication, network partitions, and healing", () => {
      assert.throws(() => new EosPlanetaryConsensusEngine(["n1", "n2"]), /requires at least 3 nodes/);

      const cluster = new EosPlanetaryConsensusEngine(["node-1", "node-2", "node-3"]);
      assert.equal(cluster.getClusterSize(), 3);
      assert.equal(cluster.getQuorumSize(), 2);
      assert.equal(cluster.getLeaderId(), null);

      // Propose without leader fails
      assert.throws(() => cluster.propose("SET", { x: 1 }), /No active leader elected/);
      assert.throws(() => cluster.electLeader("node-phantom"), /Unknown candidate node/);

      // Elect leader
      const election = cluster.electLeader("node-1");
      assert.equal(election.success, true);
      assert.equal(election.leaderId, "node-1");
      assert.equal(cluster.getLeaderId(), "node-1");

      // Propose mutation with quorum active
      const prop1 = cluster.propose("WRITE_RECORD", { key: "alpha", val: 42 });
      assert.equal(prop1.success, true);
      assert.equal(prop1.entryIndex, 1);
      assert.equal(prop1.acks, 3);
      assert.ok(prop1.stateHash.length === 64);

      // Partition leader and verify it cannot propose
      cluster.partitionNodes(["node-1"]);
      assert.equal(cluster.getLeaderId(), null);
      assert.throws(() => cluster.propose("WRITE_RECORD", { key: "beta" }), /No active leader elected/);

      // Elect new leader among surviving majority ("node-2", "node-3")
      const election2 = cluster.electLeader("node-2");
      assert.equal(election2.success, true);
      assert.equal(cluster.getLeaderId(), "node-2");

      // Isolated candidate cannot get elected
      const isolatedElect = cluster.electLeader("node-1");
      assert.equal(isolatedElect.success, false);
      assert.equal(isolatedElect.votesReceived, 0);

      // Heal partition
      cluster.healPartition();
      const nodeState = cluster.getNodeState("node-2");
      assert.equal(nodeState?.role, "LEADER");
    });
  });
});
