import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  EosProductDeliveryOrchestrator,
  resolveDeliveryTrack,
  evaluateLawIvComplete,
  deliveryAdmitOracle,
  createHermeticVerificationGatePort,
  createRealVerificationGatePort,
  computeProductQualityScorecard,
  PRODUCT_SCORECARD_FLOOR,
  DELIVERY_MUTATION_TARGET_SNIPPET,
} from "../src/core/eosProductDeliveryOrchestrator.ts";
import { EosUniversalProductFoundry } from "../src/core/eosUniversalProductFoundry.ts";

describe("SPEC-147 / SPEC-152: Product Delivery Orchestrator Test Suite", () => {
  it("verifies static status and metadata", () => {
    const status = EosProductDeliveryOrchestrator.getStatus();
    assert.equal(status.ladder, "LADDER-15");
    assert.equal(status.specId, "SPEC-147");
    assert.equal(status.epistemicTarget, "PRODUCT_DELIVERY_ORCHESTRATOR_VERIFIED_WITHIN_SCOPE");
    assert.ok(status.tools.includes("eos_product_deliver_run"));
  });

  it("resolves delivery track based on manifest tier", () => {
    assert.equal(resolveDeliveryTrack("MVP"), "FastTrack");
    assert.equal(resolveDeliveryTrack("PRODUCTION"), "HeavySddTrack");
    assert.equal(resolveDeliveryTrack("ENTERPRISE"), "HeavySddTrack");
    assert.equal(resolveDeliveryTrack("PROTOTYPE"), "HeavySddTrack");
  });

  it("evaluates Law IV completeness across all 6 invariant dimensions", () => {
    const full = {
      registered: true,
      intakeComplete: true,
      specificationApproved: true,
      auditComplete: true,
      ownerApproval: true,
      implementationAuthorized: true,
    };
    assert.equal(evaluateLawIvComplete(full), true);

    for (const key of Object.keys(full)) {
      const incomplete = { ...full, [key]: false };
      assert.equal(evaluateLawIvComplete(incomplete), false, `Should fail when ${key} is false`);
    }
  });

  it("evaluates deliveryAdmitOracle against snippet and mutant codes", () => {
    // Valid snippet
    assert.equal(deliveryAdmitOracle(DELIVERY_MUTATION_TARGET_SNIPPET), true);

    // Code throwing syntax error
    assert.equal(deliveryAdmitOracle("invalid syntax {{{"), false);

    // Mutant that returns true when dryRunOk is false
    const badMutant1 = `function admit(dryRunOk, lawIvOk, turboOk, secretOk, mutationOk) { return true; }`;
    assert.equal(deliveryAdmitOracle(badMutant1), false);

    // Mutant that returns false on valid inputs
    const badMutant2 = `function admit() { return false; }`;
    assert.equal(deliveryAdmitOracle(badMutant2), false);

    // Mutants that ignore one parameter
    const badMutant3 = `function admit(dryRunOk, lawIvOk, turboOk, secretOk, mutationOk) {
      if (dryRunOk === false) return false;
      if (turboOk === false) return false;
      if (secretOk === false) return false;
      if (mutationOk === false) return false;
      return true;
    }`;
    assert.equal(deliveryAdmitOracle(badMutant3), false);

    const badMutant4 = `function admit(dryRunOk, lawIvOk, turboOk, secretOk, mutationOk) {
      if (dryRunOk === false) return false;
      if (lawIvOk === false) return false;
      if (secretOk === false) return false;
      if (mutationOk === false) return false;
      return true;
    }`;
    assert.equal(deliveryAdmitOracle(badMutant4), false);

    const badMutant5 = `function admit(dryRunOk, lawIvOk, turboOk, secretOk, mutationOk) {
      if (dryRunOk === false) return false;
      if (lawIvOk === false) return false;
      if (turboOk === false) return false;
      if (mutationOk === false) return false;
      return true;
    }`;
    assert.equal(deliveryAdmitOracle(badMutant5), false);

    const badMutant6 = `function admit(dryRunOk, lawIvOk, turboOk, secretOk, mutationOk) {
      if (dryRunOk === false) return false;
      if (lawIvOk === false) return false;
      if (turboOk === false) return false;
      if (secretOk === false) return false;
      return true;
    }`;
    assert.equal(deliveryAdmitOracle(badMutant6), false);
  });

  it("exercises createHermeticVerificationGatePort nominal and override paths", () => {
    // Nominal port
    const nominal = createHermeticVerificationGatePort();
    const tNominal = nominal.runTurboPurity();
    assert.equal(tNominal.exitCode, 0);
    assert.equal(tNominal.evidence, "LAYER0_DEPENDENCIES_EMPTY");

    const sNominal = nominal.runSecretScan("clean code with no tokens");
    assert.equal(sNominal.exitCode, 0);
    assert.equal(sNominal.evidence, "NO_PLAIN_SECRET_PATTERNS");

    const mNominal = nominal.runMutationFloor();
    assert.equal(mNominal.exitCode, 0);
    assert.ok(mNominal.evidence.includes("mutationScore="));

    // Secret pattern detected
    const mockToken = ["sk", "1234567890abcdef1234567890"].join("-");
    const sFail = nominal.runSecretScan(`const token = '${mockToken}';`);
    assert.equal(sFail.exitCode, 1);
    assert.equal(sFail.evidence, "SECRET_PATTERN_DETECTED");

    // Overrides port
    const overridden = createHermeticVerificationGatePort({ turboExit: 1, secretExit: 2, mutationExit: 3 });
    assert.equal(overridden.runTurboPurity().exitCode, 1);
    assert.equal(overridden.runSecretScan("payload").exitCode, 2);
    assert.equal(overridden.runMutationFloor().exitCode, 3);
  });

  it("exercises createRealVerificationGatePort against disk fixtures", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-real-gates-"));
    try {
      // 1. Clean package.json (0 dependencies)
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "clean-pkg", dependencies: {} }));
      const realPort = createRealVerificationGatePort(tmpDir);

      const tClean = realPort.runTurboPurity();
      assert.equal(tClean.exitCode, 0);
      assert.equal(tClean.evidence, "RUNTIME_DEPENDENCIES_EMPTY");

      const sClean = realPort.runSecretScan("pure code");
      assert.equal(sClean.exitCode, 0);

      const mClean = realPort.runMutationFloor();
      assert.equal(mClean.exitCode, 0);

      // 2. Polluted package.json (runtime dependencies present)
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ name: "dirty-pkg", dependencies: { lodash: "^4.0.0" } }),
      );
      const tDirty = realPort.runTurboPurity();
      assert.equal(tDirty.exitCode, 1);
      assert.equal(tDirty.evidence, "RUNTIME_DEPENDENCIES_COUNT=1");

      // 3. Secret scan trigger
      const mockSecret = ["api", "key", "secretValue1234567890"].join("_");
      const sDirty = realPort.runSecretScan(`const k = "${mockSecret}";`);
      assert.equal(sDirty.exitCode, 1);

      // 4. Missing package.json read failure
      const missingPort = createRealVerificationGatePort(path.join(tmpDir, "nonexistent"));
      const tMissing = missingPort.runTurboPurity();
      assert.equal(tMissing.exitCode, 1);
      assert.ok(tMissing.evidence.includes("RUNTIME_DEPENDENCIES_READ_FAILED"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("exercises computeProductQualityScorecard scoring boundaries and grades", () => {
    const validTopology = {
      valid: true,
      earsBddCoveragePercent: 100,
      hermeticIsolationPassed: true,
      acyclic: true,
      reasons: [],
      sha256Proof: "a".repeat(64),
    };

    // Perfect scorecard (Grade A+)
    const scA = computeProductQualityScorecard({
      topology: validTopology,
      gateResults: [
        { name: "g1", exitCode: 0, evidence: "ok", durationMs: 1 },
        { name: "g2", exitCode: 0, evidence: "ok", durationMs: 1 },
      ],
      mutationScore: 100,
      timeToGreenMs: 2000,
      blastRadiusKnown: true,
    });
    assert.ok(scA.score >= 90);
    assert.equal(scA.grade, "A+");
    assert.equal(scA.sha256Receipt.length, 64);

    // Time to green between 5s and 30s (score tier 80)
    const scMidTime = computeProductQualityScorecard({
      topology: validTopology,
      gateResults: [{ name: "g1", exitCode: 0, evidence: "ok", durationMs: 1 }],
      mutationScore: 85,
      timeToGreenMs: 12000,
      blastRadiusKnown: true,
    });
    assert.ok(scMidTime.score >= 80);

    // Time to green > 30s and unknown blast radius, impure layer 0
    const impureTopology = {
      ...validTopology,
      hermeticIsolationPassed: false,
      acyclic: false,
    };
    const scSlow = computeProductQualityScorecard({
      topology: impureTopology,
      gateResults: [{ name: "g1", exitCode: 1, evidence: "fail", durationMs: 1 }],
      mutationScore: 60,
      timeToGreenMs: 45000,
      blastRadiusKnown: false,
    });
    assert.ok(scSlow.score < 80);
    assert.equal(scSlow.grade, "C");

    // Empty gateResults
    const scEmptyGates = computeProductQualityScorecard({
      topology: validTopology,
      gateResults: [],
      mutationScore: 80,
      timeToGreenMs: 1000,
      blastRadiusKnown: true,
    });
    assert.equal(scEmptyGates.gatePassRate, 0);
  });

  it("orchestrates deliverProduct with FastTrack MVP tier nominal execution", () => {
    const manifest = {
      id: "mvp-test-product",
      name: "MVP Test Product",
      description: "Quick lightweight MVP for rapid verification",
      tier: "MVP",
      domain: "CORE",
      platforms: ["web"],
      entities: ["Item"],
      commands: ["CreateItem"],
    };

    const res = EosProductDeliveryOrchestrator.deliverProduct(manifest, { dryRun: true });
    assert.equal(res.status, "SUCCESS");
    assert.equal(res.track, "FastTrack");
    assert.equal(res.dryRun, true);
    assert.ok(res.blueprint);
    assert.ok(res.topology?.valid);
    assert.ok(res.loopSummary);
    assert.ok(res.intelGovernanceStagesCompleted >= 8);
    assert.equal(res.gateResults.length, 3);
    assert.ok(res.scorecard);
    assert.ok(res.scorecard.score >= PRODUCT_SCORECARD_FLOOR);
    assert.equal(res.deploymentAttempted, false);
    assert.equal(res.sha256Receipt.length, 64);
  });

  it("orchestrates deliverProduct with HeavySddTrack PRODUCTION tier nominal execution", () => {
    const manifest = {
      id: "prod-enterprise-product",
      name: "Production Enterprise Product",
      description: "Mission-critical production service with full SDD rigor",
      tier: "PRODUCTION",
      domain: "ENTERPRISE",
      platforms: ["web", "distributed-backend"],
      entities: ["Order"],
      commands: ["SubmitOrder"],
    };

    const res = EosProductDeliveryOrchestrator.deliverProduct(manifest, { dryRun: true });
    assert.equal(res.status, "SUCCESS");
    assert.equal(res.track, "HeavySddTrack");
    assert.equal(res.dryRun, true);
    assert.ok(res.scorecard);
    assert.equal(res.deploymentAttempted, false);
  });

  it("blocks delivery when externalSatellite is true and Law IV is incomplete", () => {
    const manifest = {
      id: "external-satellite",
      name: "External Satellite Service",
      description: "Satellite service targeting external target repo",
      tier: "PRODUCTION",
      domain: "CORE",
      platforms: ["web"],
      entities: ["Proxy"],
      commands: ["Forward"],
    };

    const res = EosProductDeliveryOrchestrator.deliverProduct(manifest, {
      dryRun: false,
      externalSatellite: true,
      lawIv: {
        registered: true,
        intakeComplete: true,
        specificationApproved: false, // Incomplete!
        auditComplete: false,
        ownerApproval: false,
        implementationAuthorized: false,
      },
    });

    assert.equal(res.status, "BLOCKED");
    assert.equal(res.reason, "LAW_IV_INCOMPLETE");
    assert.equal(res.epistemicState, "BLOCKED");
    assert.equal(res.blueprint, null);
    assert.equal(res.sha256Receipt.length, 64);
  });

  it("fails delivery when verification gates fail", () => {
    const manifest = {
      id: "failing-gate-product",
      name: "Failing Gate Product",
      description: "Product destined to trigger gate failure",
      tier: "MVP",
      domain: "CORE",
      platforms: ["web"],
      entities: ["Check"],
      commands: ["TestCommand"],
    };

    const failingGates = createHermeticVerificationGatePort({ turboExit: 1 });
    const res = EosProductDeliveryOrchestrator.deliverProduct(manifest, {
      dryRun: true,
      gates: failingGates,
    });

    assert.equal(res.status, "FAILED");
    assert.equal(res.reason, "VERIFICATION_GATE_FAILED");
    assert.equal(res.epistemicState, "REMEDIATION_REQUIRED");
    assert.equal(res.scorecard, null);
    assert.ok(res.gateResults.some((g) => g.exitCode !== 0));
  });

  it("fails delivery when topology is invalid", () => {
    const manifest = {
      id: "invalid-topology-product",
      name: "Invalid Topology Product",
      description: "Product with invalid topology",
      tier: "MVP",
      domain: "CORE",
      platforms: ["web"],
      entities: ["Stub"],
      commands: ["StubCmd"],
    };

    const origValidate = EosUniversalProductFoundry.validateProductTopology;
    try {
      EosUniversalProductFoundry.validateProductTopology = () => ({
        valid: false,
        totalModules: 1,
        acyclic: false,
        hermeticIsolationPassed: false,
        earsBddCoveragePercent: 50,
        findings: ["Mocked topological circular dependency."],
        sha256Proof: "0".repeat(64),
      });

      const res = EosProductDeliveryOrchestrator.deliverProduct(manifest, { dryRun: true });
      assert.equal(res.status, "FAILED");
      assert.equal(res.reason, "TOPOLOGY_INVALID");
      assert.equal(res.epistemicState, "REMEDIATION_REQUIRED");
    } finally {
      EosUniversalProductFoundry.validateProductTopology = origValidate;
    }
  });

  it("materializes SDD package to disk when dryRun is false in temporary project", () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "eos-product-delivery-real-"));
    try {
      fs.writeFileSync(path.join(tmpProject, "package.json"), JSON.stringify({ name: "tmp-real", dependencies: {} }));

      const manifest = {
        id: "real-delivery-product",
        name: "Real Delivery Product",
        description: "Testing real SDD filesystem materialization",
        tier: "MVP",
        domain: "CORE",
        platforms: ["web"],
        entities: ["Ticket"],
        commands: ["IssueTicket"],
      };

      const res = EosProductDeliveryOrchestrator.deliverProduct(manifest, {
        dryRun: false,
        projectRoot: tmpProject,
        gates: createHermeticVerificationGatePort(), // Hermetic gates for fast test
      });

      assert.equal(res.status, "SUCCESS");
      assert.equal(res.dryRun, false);

      // Verify files materialized
      const productDir = path.join(tmpProject, "docs", "products", manifest.id);
      assert.ok(fs.existsSync(path.join(productDir, "INTAKE.md")));
      assert.ok(fs.existsSync(path.join(productDir, "SPEC.md")));
      assert.ok(fs.existsSync(path.join(productDir, "PLAN.md")));
      assert.ok(fs.existsSync(path.join(productDir, "TASKS.md")));
      assert.ok(fs.existsSync(path.join(productDir, "blueprint.json")));
      assert.ok(fs.existsSync(path.join(productDir, "scorecard.json")));
    } finally {
      fs.rmSync(tmpProject, { recursive: true, force: true });
    }
  });

  it("blocks delivery when scorecard score drops below PRODUCT_SCORECARD_FLOOR", () => {
    const manifest = {
      id: "low-scorecard-product",
      name: "Low Scorecard Product",
      description: "Forces scorecard below 80",
      tier: "MVP",
      domain: "CORE",
      platforms: ["web"],
      entities: ["Work"],
      commands: ["DoWork"],
    };

    // Gate port with mutation floor returning low score
    const lowMutationGate = {
      runTurboPurity: () => ({ name: "turbo_purity", exitCode: 0, evidence: "ok", durationMs: 1 }),
      runSecretScan: () => ({ name: "secret_scan", exitCode: 0, evidence: "ok", durationMs: 1 }),
      runMutationFloor: () => ({
        name: "mutation_floor",
        exitCode: 0,
        evidence: "mutationScore=20;grade=F",
        durationMs: 1,
      }),
    };

    const res = EosProductDeliveryOrchestrator.deliverProduct(manifest, {
      dryRun: true,
      gates: lowMutationGate,
      blastRadiusKnown: false, // further penalizes score
    });

    assert.equal(res.status, "BLOCKED");
    assert.equal(res.reason, "SCORECARD_FLOOR");
    assert.equal(res.epistemicState, "BLOCKED");
    assert.ok(res.scorecard);
    assert.ok(res.scorecard.score < PRODUCT_SCORECARD_FLOOR);
  });
});
