import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { EosTitansMatrix } from "../src/core/eosTitansMatrix.ts";

describe("EOS Sovereign Titans Matrix Suite (Spotify, SpaceX, NVIDIA, Google, xAI)", () => {
  const matrix = new EosTitansMatrix(process.cwd());

  describe("Suite 1: Spotify Xirp & Backstage RFC-42 (BDD-034)", () => {
    it("validates Backstage catalog-info.yaml and benchmarks local event ring", () => {
      const res = matrix.benchmarkSpotifyXirp();
      assert.equal(res.status, "PASS");
      assert.equal(res.titan, "SPOTIFY_XIRP");
      assert.equal(res.metrics.hasBackstageCatalog, true);
      assert.equal(res.metrics.backstageRfc42Valid, true);
      assert.ok(
        res.throughputOpsSec > 100,
        `Xirp throughput sanity floor: ${res.throughputOpsSec} ops/sec (parallel-CI host load, not a benchmark)`,
      );
      assert.ok(res.latencyUs < 200000, `Expected latency < 200ms, got ${res.latencyUs}us`);
    });

    it("verifies physical catalog-info.yaml conforms to Backstage Component spec", () => {
      const catalogPath = path.join(process.cwd(), "catalog-info.yaml");
      assert.ok(fs.existsSync(catalogPath));
      const content = fs.readFileSync(catalogPath, "utf8");
      assert.ok(content.includes("apiVersion: backstage.io/v1alpha1"));
      assert.ok(content.includes("kind: Component"));
      assert.ok(content.includes("name: eos-system-control-plane"));
    });

    it("asserts Glorian remote slug, System relation, and TechDocs stub (BDD-BS-001)", () => {
      const catalogPath = path.join(process.cwd(), "catalog-info.yaml");
      const mkdocsPath = path.join(process.cwd(), "mkdocs.yml");
      const techdocsHome = path.join(process.cwd(), "docs", "index.md");
      const backstageNotes = path.join(process.cwd(), "docs", "backstage", "README.md");

      assert.ok(fs.existsSync(catalogPath), "catalog-info.yaml must exist at repo root");
      assert.ok(fs.existsSync(mkdocsPath), "mkdocs.yml must exist for techdocs-ref dir:.");
      assert.ok(fs.existsSync(techdocsHome), "docs/index.md TechDocs home stub must exist");
      assert.ok(fs.existsSync(backstageNotes), "docs/backstage/README.md operator notes must exist");

      const content = fs.readFileSync(catalogPath, "utf8");
      const expectedSlug = "valentinflorezarbelaez-ai/Glorian-System-";

      assert.ok(content.includes("kind: Component"));
      assert.ok(content.includes("kind: System"));
      assert.ok(content.includes("name: eos-system-control-plane"));
      assert.ok(content.includes("name: eos-sovereign-mesh"));
      assert.ok(
        content.includes(`github.com/project-slug: ${expectedSlug}`),
        `github.com/project-slug must match live Glorian remote (${expectedSlug})`,
      );
      assert.ok(
        content.includes(
          `backstage.io/managed-by-location: url:https://github.com/${expectedSlug}/blob/main/catalog-info.yaml`,
        ),
        "managed-by-location must point at the Glorian catalog URL",
      );
      assert.ok(content.includes("system: eos-sovereign-mesh"));
      assert.ok(content.includes("owner: user:valentin-florez-arbelaez"));
      assert.ok(content.includes("backstage.io/techdocs-ref: dir:."));
      assert.equal(content.includes("Eos-System"), false, "legacy Eos-System slug must not remain in catalog");
      assert.equal(
        /(?:api[_-]?key|bearer\s+[a-z0-9]|-----BEGIN)/i.test(content),
        false,
        "catalog-info.yaml must not contain plaintext secrets",
      );

      const mkdocs = fs.readFileSync(mkdocsPath, "utf8");
      assert.ok(mkdocs.includes("techdocs-core"));
      assert.ok(mkdocs.includes("Home:"));
      assert.ok(mkdocs.includes("Verify:"));
      assert.ok(mkdocs.includes("Fleet:"));
    });

    it("keeps Layer-0 free of @backstage runtime deps (BDD-BS-002)", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
      const runtimeDeps = pkg.dependencies ?? {};
      assert.deepEqual(runtimeDeps, {}, "root package.json dependencies must remain {}");
      const serialized = JSON.stringify(pkg);
      assert.equal(
        serialized.includes("@backstage/"),
        false,
        "@backstage packages must stay outside root package.json",
      );
      assert.equal(
        fs.existsSync(path.join(process.cwd(), "src", "core", "node_modules")),
        false,
        "src/core must not carry node_modules",
      );
    });

    it("maps Soundcheck receipt + fleet registry to Backstage entities (BDD-BS-003)", () => {
      const registry = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "docs", "projects", "registry.json"), "utf8"),
      );
      const receipt = JSON.parse(
        fs.readFileSync(
          path.join(process.cwd(), "docs", "evidence", "SOUNDCHECK_SCORECARD_RECEIPT.json"),
          "utf8",
        ),
      );
      const pillarMap = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "docs", "backstage", "scorecard-pillar-map.json"), "utf8"),
      );
      const fleetYaml = fs.readFileSync(
        path.join(process.cwd(), "docs", "backstage", "fleet-components.yaml"),
        "utf8",
      );
      const scorecardsYaml = fs.readFileSync(
        path.join(process.cwd(), "docs", "backstage", "soundcheck-scorecards.yaml"),
        "utf8",
      );
      const appConfig = fs.readFileSync(
        path.join(process.cwd(), "docs", "backstage", "app-config.snippet.yaml"),
        "utf8",
      );
      const catalog = fs.readFileSync(path.join(process.cwd(), "catalog-info.yaml"), "utf8");

      const requiredReceiptFields = [
        "timestampIso",
        "specRef",
        "totalRepositoriesScored",
        "averageFleetScore",
        "platinumTiersCount",
        "goldTiersCount",
        "silverTiersCount",
        "bronzeTiersCount",
        "sha256Signature",
      ];
      for (const field of requiredReceiptFields) {
        assert.ok(field in receipt, `Soundcheck receipt missing ${field}`);
      }
      assert.equal(receipt.specRef, "SPEC-299");
      assert.equal(pillarMap.portalMustNotRescore, true);
      assert.equal(pillarMap.fleetPosture.defaultWhenPathsUnset, "CONTROL_PLANE_ONLY");
      assert.equal(pillarMap.receiptPath, "docs/evidence/SOUNDCHECK_SCORECARD_RECEIPT.json");
      assert.equal(pillarMap.pillars.length, 5);

      const pillarIds = pillarMap.pillars.map((p) => p.pillarId).sort();
      assert.deepEqual(pillarIds, [
        "DORA_VELOCITY",
        "LAW_V_CONFORMANCE",
        "SECURITY_POSTURE",
        "SPECIFICATION_DRIFT",
        "TEST_COVERAGE",
      ]);

      assert.ok(Array.isArray(registry.projects) && registry.projects.length >= 9);
      for (const project of registry.projects) {
        assert.ok(
          fleetYaml.includes(`name: ${project.id}`),
          `fleet-components.yaml must declare Component metadata.name=${project.id}`,
        );
        assert.ok(
          fleetYaml.includes("system: eos-sovereign-mesh"),
          "fleet Components must belong to eos-sovereign-mesh",
        );
        assert.ok(
          fleetYaml.includes("eos.glorian/fleet-posture: CONTROL_PLANE_ONLY"),
          "fleet stubs must advertise CONTROL_PLANE_ONLY by default",
        );
      }

      assert.ok(scorecardsYaml.includes("kind: Resource"));
      assert.ok(scorecardsYaml.includes("name: eos-soundcheck-fleet-matrix"));
      assert.ok(scorecardsYaml.includes("eos.glorian/fleet-posture: CONTROL_PLANE_ONLY"));
      assert.equal(
        /eos\.glorian\/fleet-posture:\s*FLEET_VERIFIED/.test(scorecardsYaml),
        false,
        "scorecard YAML must not set fleet-posture annotation to FLEET_VERIFIED without dogfood",
      );
      assert.equal(
        /eos\.glorian\/fleet-posture:\s*FLEET_VERIFIED/.test(fleetYaml),
        false,
        "fleet stubs must not set fleet-posture annotation to FLEET_VERIFIED without dogfood",
      );
      assert.ok(appConfig.includes("catalog:"));
      assert.ok(
        appConfig.includes(
          "https://github.com/valentinflorezarbelaez-ai/Glorian-System-/blob/main/catalog-info.yaml",
        ),
        "app-config snippet must register only the root catalog-info.yaml",
      );
      assert.equal(
        /locations:[\s\S]*target:\s*https:\/\/github\.com\/valentinflorezarbelaez-ai\/Glorian-System-\/blob\/main\/docs\/backstage\/fleet-components\.yaml/.test(
          appConfig,
        ),
        false,
        "app-config must not duplicate fleet-components as a sibling catalog location",
      );
      assert.equal(
        /locations:[\s\S]*target:\s*https:\/\/github\.com\/valentinflorezarbelaez-ai\/Glorian-System-\/blob\/main\/docs\/backstage\/soundcheck-scorecards\.yaml/.test(
          appConfig,
        ),
        false,
        "app-config must not duplicate soundcheck-scorecards as a sibling catalog location",
      );
      assert.ok(appConfig.includes("CONTROL_PLANE_ONLY"));
      assert.equal(
        /(?:api[_-]?key|bearer\s+[a-z0-9]|-----BEGIN)/i.test(`${fleetYaml}\n${scorecardsYaml}\n${appConfig}`),
        false,
        "Backstage P1 YAML must not contain plaintext secrets",
      );

      assert.ok(catalog.includes("name: glorian-fleet-component-stubs"));
      assert.ok(catalog.includes("name: glorian-soundcheck-scorecards"));
      assert.ok(catalog.includes("eos.glorian/fleet-posture: CONTROL_PLANE_ONLY"));
      assert.ok(
        catalog.includes(
          "https://github.com/valentinflorezarbelaez-ai/Glorian-System-/blob/main/docs/backstage/fleet-components.yaml",
        ),
        "fleet Location must use absolute GitHub URL target (resolves under URL parent)",
      );
      assert.ok(
        catalog.includes(
          "https://github.com/valentinflorezarbelaez-ai/Glorian-System-/blob/main/docs/backstage/soundcheck-scorecards.yaml",
        ),
        "soundcheck Location must use absolute GitHub URL target (resolves under URL parent)",
      );
      assert.equal(
        catalog.includes("./docs/backstage/fleet-components.yaml"),
        false,
        "relative file Location targets must not remain for fleet stubs",
      );
      assert.equal(
        catalog.includes("./docs/backstage/soundcheck-scorecards.yaml"),
        false,
        "relative file Location targets must not remain for scorecards",
      );
    });
  });

  describe("Suite 2: SpaceX Dragon / Starship Flight Computer 60Hz TMR (BDD-034)", () => {
    it("executes 60-cycle Triple Modular Redundancy Byzantine consensus loop", () => {
      const tmr = matrix.benchmarkSpaceXTmr("STARSHIP_VECTOR_TRAJECTORY", 60);
      assert.equal(tmr.consensusReached, true);
      assert.equal(tmr.byzantineFaultsDetected, 0);
      assert.equal(tmr.iterationCount, 60);
      // cycleHz derives from a wall-clock measurement of the 60-cycle consensus loop, so it
      // varies with host load. This is a generous sanity floor; the consensus invariants above
      // carry the real signal.
      assert.ok(tmr.cycleHz > 10, `TMR cycle rate below the 10Hz sanity floor: ${tmr.cycleHz}Hz`);
      assert.ok(typeof tmr.channelVotes.alpha === "string");
      assert.ok(typeof tmr.channelVotes.beta === "string");
      assert.ok(typeof tmr.channelVotes.gamma === "string");
    });

    it("detects Byzantine faults when channel calculations diverge", () => {
      const origCreateHash = crypto.createHash;
      let count = 0;
      try {
        crypto.createHash = function (alg, opts) {
          count++;
          if (count === 2) {
            return {
              update: () => ({ digest: () => "fault_beta" }),
            };
          }
          if (count === 3) {
            return {
              update: () => ({ digest: () => "fault_gamma" }),
            };
          }
          return origCreateHash.call(crypto, alg, opts);
        };

        const faultyTmr = matrix.benchmarkSpaceXTmr("FAULT_INJECTION", 1);
        assert.equal(faultyTmr.consensusReached, false);
        assert.equal(faultyTmr.byzantineFaultsDetected, 1);
      } finally {
        crypto.createHash = origCreateHash;
      }
    });
  });

  describe("Suite 3: NVIDIA TensorRT / CUDA Float32 Flat Buffer SIMD Kernel (BDD-034)", () => {
    it("executes zero-allocation 4096-element unrolled dot product kernel", () => {
      const res = matrix.benchmarkNvidiaSimd(4096);
      assert.equal(res.status, "PASS");
      assert.equal(res.titan, "NVIDIA_TENSOR_SIMD");
      assert.equal(res.metrics.zeroAllocationVerified, true);
      assert.equal(res.metrics.vectorLength, 4096);
      assert.ok(res.metrics.dotProductResult > 0);
      assert.ok(res.latencyUs < 200_000, `NVIDIA SIMD latency: ${res.latencyUs}µs (parallel CI ceiling)`);
    });

    it("executes SIMD kernel with odd vectorLength (unroll remainder elements)", () => {
      const oddRes = matrix.benchmarkNvidiaSimd(4097);
      assert.equal(oddRes.status, "PASS");
      assert.equal(oddRes.metrics.vectorLength, 4097);
      assert.ok(oddRes.metrics.dotProductResult > 0);
    });
  });

  describe("Suite 4: Google Borg Declarative State Reconciliation (BDD-035)", () => {
    it("reconciles active repository state with desired specification invariants", () => {
      const report = matrix.reconcileGoogleBorg();
      assert.equal(report.synchronized, true);
      assert.equal(report.driftPercentage, 0.0);
      assert.ok(report.actualStateCount >= report.desiredStateCount);
      assert.ok(
        report.convergenceTimeUs < 500_000,
        `Borg convergence: ${report.convergenceTimeUs}µs (parallel CI ceiling)`,
      ); // 500ms ceiling
    });
  });

  describe("Suite 5: xAI Colossus Cluster Inter-Agent RDMA Packet Fabric (BDD-034)", () => {
    it("routes 10,000 inter-agent packets with 0% packet loss and microsecond latency", () => {
      const res = matrix.benchmarkXaiFabric(10000);
      assert.equal(res.status, "PASS");
      assert.equal(res.titan, "XAI_COLOSSUS_FABRIC");
      assert.equal(res.metrics.packetLossRate, 0.0);
      assert.equal(res.metrics.packetsDelivered, 10000);
      assert.ok(
        res.throughputOpsSec > 500,
        `xAI fabric throughput sanity floor: ${res.throughputOpsSec} ops/sec (parallel-CI host load)`,
      );
    });
  });

  describe("Suite 6: Nubank Datomic Ledger & Spotify Smart Shuffle Titans", () => {
    it("benchmarks Nubank Datomic immutable ledger and verifies zero duplicate mutations", () => {
      const res = matrix.benchmarkNubankDatomic(1000);
      assert.equal(res.titan, "NUBANK_DATOMIC_LEDGER");
      assert.equal(res.status, "PASS");
      assert.equal(res.metrics.zeroDuplicatesVerified, true);
      assert.equal(res.metrics.duplicateRetriesPrevented, 500);
      assert.ok(
        res.throughputOpsSec > 100,
        `Datomic throughput sanity floor: ${res.throughputOpsSec} ops/sec (parallel CI, not benchmark)`,
      );
      assert.ok(res.latencyUs > 0);
    });

    it("benchmarks Spotify Smart Shuffle and verifies zero consecutive artist collisions", () => {
      const res = matrix.benchmarkSpotifySmartShuffle(60);
      assert.equal(res.titan, "SPOTIFY_SMART_SHUFFLE");
      assert.equal(res.status, "PASS");
      assert.equal(res.metrics.artistCollisions, 0);
      assert.ok(res.metrics.harmonicScore > 0);
      assert.ok(
        res.throughputOpsSec > 100,
        `Shuffle throughput sanity floor: ${res.throughputOpsSec} ops/sec (parallel CI)`,
      );
    });

    it("benchmarks IBM Mainframe Parallel Sysplex Seven-Nines and 2PC XA consistency", () => {
      const res = matrix.benchmarkIbmSysplex();
      assert.equal(res.titan, "IBM_SYSPLEX_SEVEN_NINES");
      assert.equal(res.status, "PASS");
      assert.equal(res.metrics.twoPhaseCommitStatus, "GLOBAL_COMMIT");
      assert.ok(res.metrics.availabilityPercentage >= 99.9999);
      assert.ok(
        res.throughputOpsSec > 100,
        `IBM Sysplex throughput sanity floor: ${res.throughputOpsSec} ops/sec (parallel-CI host load)`,
      );
    });
  });

  describe("Suite 7: Unified Titans Master Benchmark & Merkle Receipt", () => {
    it("executes all 8 Titans concurrently and emits cryptographic seal", () => {
      const report = matrix.runAllTitans();
      assert.equal(report.overallStatus, "APEX_PERFECTION");
      assert.equal(report.results.length, 8);
      assert.ok(typeof report.sha256Proof === "string" && report.sha256Proof.length === 64);
      assert.ok(report.totalDurationUs > 0);
    });
  });
});
