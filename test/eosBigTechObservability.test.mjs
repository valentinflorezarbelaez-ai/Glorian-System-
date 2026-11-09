/**
 * BDD Test Suite — New Big Tech Modules (SPEC-147..152)
 * StructuredLogger, FeatureFlag, LoadTest, IncidentSeverity, SBOM, SecretsRotation
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosStructuredLogger, parseTraceparent, formatTraceparent } from "../src/core/eosStructuredLogger.ts";
import { EosFeatureFlagEngine } from "../src/core/eosFeatureFlagEngine.ts";
import { EosLoadTestEngine } from "../src/core/eosLoadTestEngine.ts";
import { EosIncidentSeverityClassifier } from "../src/core/eosIncidentSeverityClassifier.ts";
import { generateCycloneDxSbom } from "../src/core/eosCycloneDxSbomGenerator.ts";
import { EosSecretsRotationProtocol } from "../src/core/eosSecretsRotationProtocol.ts";

// ---------------------------------------------------------------------------
describe("SPEC-147: Structured Logger + W3C Trace-Context", () => {
  it("BDD-460: log entries contain traceId, spanId, correlationId", () => {
    const lines = [];
    const logger = new EosStructuredLogger({
      moduleName: "test",
      minLevel: "TRACE",
      sampleRate: 1,
      output: (l) => lines.push(l),
    });
    logger.info("hello", { key: "val" });
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.message, "hello");
    assert.equal(entry.traceId.length, 32);
    assert.equal(entry.spanId.length, 16);
    assert.equal(entry.correlationId.length, 36); // UUID
    assert.equal(entry.module, "test");
    assert.deepEqual(entry.metadata, { key: "val" });
  });

  it("BDD-461: child span inherits traceId, gets new spanId", () => {
    const logger = new EosStructuredLogger({
      moduleName: "parent",
      minLevel: "TRACE",
      sampleRate: 1,
      output: () => {},
    });
    const child = logger.createChildSpan();
    const pCtx = logger.getTraceContext();
    const cCtx = child.getTraceContext();
    assert.equal(cCtx.traceId, pCtx.traceId);
    assert.notEqual(cCtx.spanId, pCtx.spanId);
    assert.equal(cCtx.parentSpanId, pCtx.spanId);
  });

  it("BDD-462: parseTraceparent roundtrips via formatTraceparent", () => {
    const header = "00-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4-deadbeefdeadbeef-01";
    const ctx = parseTraceparent(header);
    assert.ok(ctx);
    assert.equal(ctx.traceId, "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4");
    assert.equal(formatTraceparent(ctx), header);
  });

  it("BDD-463: minLevel filters below-threshold logs", () => {
    const lines = [];
    const logger = new EosStructuredLogger({
      moduleName: "x",
      minLevel: "WARN",
      sampleRate: 1,
      output: (l) => lines.push(l),
    });
    logger.debug("nope");
    logger.info("nope");
    logger.warn("yes");
    assert.equal(lines.length, 1);
  });

  it("BDD-464: timed() logs duration", async () => {
    const lines = [];
    const logger = new EosStructuredLogger({
      moduleName: "t",
      minLevel: "TRACE",
      sampleRate: 1,
      output: (l) => lines.push(l),
    });
    const result = await logger.timed("op", () => 42);
    assert.equal(result, 42);
    const entry = JSON.parse(lines[0]);
    assert.ok(entry.metadata.durationMs >= 0);
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-148: Feature Flag Progressive Delivery", () => {
  it("BDD-470: deterministic bucket assignment", () => {
    const engine = new EosFeatureFlagEngine();
    engine.setFlag({
      key: "f1",
      state: "GRADUAL",
      rolloutPercent: 50,
      killSwitch: false,
      ownerSquad: "core",
      createdAt: "",
      guardrails: [],
    });
    const a = engine.evaluate("f1", "user-abc");
    const b = engine.evaluate("f1", "user-abc");
    assert.equal(a.bucket, b.bucket);
    assert.equal(a.variant, b.variant);
  });

  it("BDD-471: kill switch overrides percentage", () => {
    const engine = new EosFeatureFlagEngine();
    engine.setFlag({
      key: "k1",
      state: "FULL",
      rolloutPercent: 100,
      killSwitch: false,
      ownerSquad: "core",
      createdAt: "",
      guardrails: [],
    });
    assert.equal(engine.evaluate("k1", "u1").variant, "on");
    engine.killSwitch("k1");
    assert.equal(engine.evaluate("k1", "u1").variant, "off");
    assert.equal(engine.evaluate("k1", "u1").reason, "KILL_SWITCH");
  });

  it("BDD-472: 0% rollout → everyone off", () => {
    const engine = new EosFeatureFlagEngine();
    engine.setFlag({
      key: "z",
      state: "DISABLED",
      rolloutPercent: 0,
      killSwitch: false,
      ownerSquad: "x",
      createdAt: "",
      guardrails: [],
    });
    for (let i = 0; i < 20; i++) {
      assert.equal(engine.evaluate("z", `u${i}`).variant, "off");
    }
  });

  it("BDD-473: unknown flag returns NOT_FOUND", () => {
    const engine = new EosFeatureFlagEngine();
    const r = engine.evaluate("missing", "u");
    assert.equal(r.reason, "NOT_FOUND");
    assert.equal(r.variant, "off");
  });

  it("BDD-474: ~50% rollout hits roughly half of entities", () => {
    const engine = new EosFeatureFlagEngine();
    engine.setFlag({
      key: "half",
      state: "GRADUAL",
      rolloutPercent: 50,
      killSwitch: false,
      ownerSquad: "x",
      createdAt: "",
      guardrails: [],
    });
    let on = 0;
    for (let i = 0; i < 1000; i++) {
      if (engine.evaluate("half", `entity-${i}`).variant === "on") on++;
    }
    assert.ok(on >= 400 && on <= 600, `got ${on}/1000`);
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-149: Load Test Engine with SLA", () => {
  it("BDD-480: executes synthetic load and reports percentiles", async () => {
    const engine = new EosLoadTestEngine();
    const report = await engine.run(
      () => {
        /* instant */
      },
      { concurrency: 4, totalRequests: 50, rampUpMs: 0, timeoutMs: 5000 },
    );
    assert.equal(report.totalRequests, 50);
    assert.equal(report.successCount, 50);
    assert.equal(report.errorCount, 0);
    assert.ok(report.throughputRps > 0);
    assert.equal(report.latency.minMs, 0);
  });

  it("BDD-481: timeout errors are counted", async () => {
    const engine = new EosLoadTestEngine();
    const report = await engine.run(() => new Promise((r) => setTimeout(r, 200)), {
      concurrency: 2,
      totalRequests: 4,
      rampUpMs: 0,
      timeoutMs: 50,
    });
    assert.equal(report.errorCount, 4);
    assert.ok(report.errorRate >= 100);
  });

  it("BDD-482: SLA assertions pass for fast target", async () => {
    // Deterministic clock seam: wall-clock p99 assertions flake under parallel
    // suite load even for a no-op target, so latency advances by construction.
    let virtualNowMs = 0;
    const engine = new EosLoadTestEngine(() => (virtualNowMs += 1));
    const report = await engine.run(
      () => {},
      { concurrency: 2, totalRequests: 20, rampUpMs: 0, timeoutMs: 1000 },
      { p99: 50, errorRate: 1 },
    );
    assert.ok(report.allSLAPassed);
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-150: Incident Severity Classifier", () => {
  const classifier = new EosIncidentSeverityClassifier();

  it("BDD-490: data loss → P0", () => {
    const r = classifier.classify({
      burnRateMultiplier: 1,
      blastRadiusPercent: 10,
      durationMinutes: 5,
      dataLoss: true,
      customerFacing: false,
      errorBudgetRemaining: 50,
    });
    assert.equal(r.severity, "P0");
    assert.ok(r.autoRevert);
    assert.ok(r.actions.includes("PAGE_ONCALL"));
  });

  it("BDD-491: 60% customer blast at 20x → P0", () => {
    const r = classifier.classify({
      burnRateMultiplier: 20,
      blastRadiusPercent: 60,
      durationMinutes: 2,
      dataLoss: false,
      customerFacing: true,
      errorBudgetRemaining: 5,
    });
    assert.equal(r.severity, "P0");
  });

  it("BDD-492: customer 30% at 6x → P1", () => {
    const r = classifier.classify({
      burnRateMultiplier: 6,
      blastRadiusPercent: 30,
      durationMinutes: 10,
      dataLoss: false,
      customerFacing: true,
      errorBudgetRemaining: 20,
    });
    assert.equal(r.severity, "P1");
  });

  it("BDD-493: 10% blast at 1x → P2", () => {
    const r = classifier.classify({
      burnRateMultiplier: 1,
      blastRadiusPercent: 10,
      durationMinutes: 30,
      dataLoss: false,
      customerFacing: false,
      errorBudgetRemaining: 40,
    });
    assert.equal(r.severity, "P2");
  });

  it("BDD-494: low blast, healthy budget → P4", () => {
    const r = classifier.classify({
      burnRateMultiplier: 0.1,
      blastRadiusPercent: 0,
      durationMinutes: 1,
      dataLoss: false,
      customerFacing: false,
      errorBudgetRemaining: 95,
    });
    assert.equal(r.severity, "P4");
    assert.deepEqual(r.actions, ["LOG_ONLY"]);
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-151: CycloneDX SBOM Generator", () => {
  it("BDD-500: produces valid CycloneDX 1.5 structure", () => {
    const sbom = generateCycloneDxSbom(process.cwd());
    assert.equal(sbom.bomFormat, "CycloneDX");
    assert.equal(sbom.specVersion, "1.5");
    assert.ok(sbom.serialNumber.startsWith("urn:uuid:"));
    assert.equal(sbom.metadata.component.name, "glorian-system");
    assert.ok(sbom.components.length >= 150);
    assert.ok(sbom.components.every((c) => c.type === "library" && c.purl.startsWith("pkg:npm/glorian/")));
    assert.ok(sbom.components.every((c) => c.hashes[0].alg === "SHA-256" && c.hashes[0].content.length === 64));
  });

  it("BDD-501: dependency graph has entries", () => {
    const sbom = generateCycloneDxSbom(process.cwd());
    assert.ok(sbom.dependencies.length > 0);
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-152: Secrets Auto-Rotation Protocol", () => {
  it("BDD-510: fresh secret is GREEN", () => {
    const proto = new EosSecretsRotationProtocol();
    proto.register("api-key", 86_400_000); // 24h TTL
    const status = proto.getStatus("api-key");
    assert.equal(status.urgency, "GREEN");
    assert.equal(status.version, 1);
  });

  it("BDD-511: rotation increments version", () => {
    const proto = new EosSecretsRotationProtocol();
    proto.register("db-pass", 3_600_000);
    const r = proto.rotate("db-pass");
    assert.equal(r.previousVersion, 1);
    assert.equal(r.newVersion, 2);
    assert.ok(r.sha256Receipt.length === 64);
  });

  it("BDD-512: expired TTL → EXPIRED urgency", () => {
    const proto = new EosSecretsRotationProtocol();
    proto.register("old-token", 1); // 1ms TTL
    // Wait for expiry
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    return wait(5).then(() => {
      const status = proto.getStatus("old-token");
      assert.equal(status.urgency, "EXPIRED");
    });
  });

  it("BDD-513: needsRotation lists RED/EXPIRED secrets", () => {
    const proto = new EosSecretsRotationProtocol();
    proto.register("healthy", 86_400_000);
    proto.register("dying", 1); // expires instantly
    return new Promise((r) => setTimeout(r, 5)).then(() => {
      const needs = proto.needsRotation();
      assert.ok(needs.includes("dying"));
      assert.ok(!needs.includes("healthy"));
    });
  });
});
