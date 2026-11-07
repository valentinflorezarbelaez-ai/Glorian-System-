/**
 * ============================================================================
 * EOS SYSTEM — NUBANK INSTITUTIONAL ENGINEERING CODEX TEST SUITE (Layer 0)
 * ============================================================================
 * Governed by SPEC-023 & BDD-053 (building.nu.com standard).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createEmptyDatomicDb,
  transactDatomic,
  queryDatomicAsOf,
  queryDatomicHistory,
  verifySachemContract,
  synthesizeNubankBlamelessPostmortem,
  evaluateNubankArchitectureHealth,
  synthesizeNubankSquadCharter,
} from "../src/core/eosNubankCodex.ts";

describe("EOS Nubank Institutional Engineering Codex Suite (SPEC-023, BDD-053)", () => {
  describe("Suite 1: Nubank Architecture Health Evaluator (Building Nu 6 Pillars)", () => {
    it("evaluates a compliant architecture achieving BUILDING_NU_APEX score (100/100)", () => {
      const evaluation = evaluateNubankArchitectureHealth({
        hasMutableStateInDomain: false,
        usesHexagonalLayerIsolation: true,
        usesContractTestingInsteadOfE2E: true,
        enforcesKafkaIdempotencyTokens: true,
        usesImmutableBitemporalLedgers: true,
        hasBlamelessPostmortemProcess: true,
        unitTestCoveragePercent: 95,
      });

      assert.equal(evaluation.institutionalScore, 100);
      assert.equal(evaluation.tier, "BUILDING_NU_APEX");
      assert.equal(evaluation.findings.length, 0);
      assert.equal(evaluation.pillarScores.fightingComplexity, 20);
      assert.equal(evaluation.pillarScores.hexagonalIsolation, 20);
      assert.equal(evaluation.pillarScores.datomicBitemporality, 15);
      assert.equal(evaluation.pillarScores.sachemContracts, 15);
      assert.equal(evaluation.pillarScores.kafkaIdempotency, 15);
      assert.equal(evaluation.pillarScores.blamelessSre, 15);
    });

    it("penalizes mutable state, broken hexagonal isolation and missing idempotency", () => {
      const evaluation = evaluateNubankArchitectureHealth({
        hasMutableStateInDomain: true,
        usesHexagonalLayerIsolation: false,
        usesContractTestingInsteadOfE2E: false,
        enforcesKafkaIdempotencyTokens: false,
        usesImmutableBitemporalLedgers: false,
        hasBlamelessPostmortemProcess: false,
        unitTestCoveragePercent: 60,
      });

      assert.ok(evaluation.institutionalScore < 40);
      assert.equal(evaluation.tier, "HIGH_COMPLEXITY_RISK");
      assert.ok(evaluation.findings.some((f) => f.includes("MUTABLE_STATE_DETECTED")));
      assert.ok(evaluation.findings.some((f) => f.includes("BROKEN_HEXAGONAL_ISOLATION")));
      assert.ok(evaluation.findings.some((f) => f.includes("MISSING_IDEMPOTENCY_TOKENS")));
      assert.ok(evaluation.recommendations.length > 0);
    });
  });

  describe("Suite 2: Sachem Consumer-Driven Contract Verifier", () => {
    const v1Schema = {
      namespace: "nu.financial.transfer",
      version: "1.0.0",
      fields: [
        { name: "transferId", type: "uuid", required: true },
        { name: "amountCents", type: "number", required: true },
        { name: "sourceAccountId", type: "uuid", required: true },
        { name: "destinationAccountId", type: "uuid", required: true },
        { name: "memo", type: "string", required: false },
      ],
    };

    it("approves additive backward-compatible schema changes (adding optional fields)", () => {
      const v2CompatibleSchema = {
        namespace: "nu.financial.transfer",
        version: "1.1.0",
        fields: [
          ...v1Schema.fields,
          { name: "idempotencyToken", type: "string", required: false, doc: "Deduplication token" },
          { name: "clientDeviceFingerprint", type: "string", required: false },
        ],
      };

      const result = verifySachemContract(v1Schema, v2CompatibleSchema);
      assert.equal(result.isCompatible, true);
      assert.equal(result.violations.length, 0);
      assert.equal(result.additiveChanges.length, 2);
    });

    it("rejects breaking changes: removing a field", () => {
      const brokenSchema = {
        namespace: "nu.financial.transfer",
        version: "2.0.0-broken",
        fields: v1Schema.fields.filter((f) => f.name !== "amountCents"),
      };

      const result = verifySachemContract(v1Schema, brokenSchema);
      assert.equal(result.isCompatible, false);
      assert.ok(result.violations.some((v) => v.includes("BREAKING_CHANGE") && v.includes("amountCents")));
    });

    it("rejects breaking changes: mutating data types or making optional fields required", () => {
      const mutatedSchema = {
        namespace: "nu.financial.transfer",
        version: "2.0.0-mutated",
        fields: v1Schema.fields.map((f) => {
          if (f.name === "amountCents") return { ...f, type: "string" };
          if (f.name === "memo") return { ...f, required: true };
          return f;
        }),
      };

      const result = verifySachemContract(v1Schema, mutatedSchema);
      assert.equal(result.isCompatible, false);
      assert.ok(result.violations.some((v) => v.includes("TYPE_MISMATCH")));
      assert.ok(result.violations.some((v) => v.includes("CONSTRAINT_TIGHTENED")));
    });
  });

  describe("Suite 3: Datomic Immutable Bitemporal Simulator", () => {
    it("records datoms immutably and supports point-in-time as-of queries", () => {
      const db0 = createEmptyDatomicDb();
      assert.equal(db0.facts.length, 0);

      // Tx 1: Assert customer creation
      const tx1 = transactDatomic(db0, [
        { entityId: "cust-001", attribute: "customer/name", value: "Valentín Flórez" },
        { entityId: "cust-001", attribute: "account/credit-limit-cents", value: 500000 },
        { entityId: "cust-001", attribute: "account/status", value: "active" },
      ]);

      assert.equal(tx1.committedDatoms.length, 3);
      assert.ok(tx1.txTime > 0);
      assert.equal(tx1.dbAfter.facts.length, 3);

      // Tx 2: Later, update credit limit (retract old value, assert new value)
      const tx2 = transactDatomic(tx1.dbAfter, [
        { entityId: "cust-001", attribute: "account/credit-limit-cents", value: 500000, op: "retract" },
        { entityId: "cust-001", attribute: "account/credit-limit-cents", value: 1200000, op: "assert" },
      ]);

      assert.equal(tx2.dbAfter.facts.length, 5);

      // Query current state
      const currentState = queryDatomicAsOf(tx2.dbAfter, "cust-001", tx2.txTime);
      assert.equal(currentState["customer/name"], "Valentín Flórez");
      assert.equal(currentState["account/credit-limit-cents"], 1200000);

      // Query historical state as-of Tx1 (time travel)
      const historicalState = queryDatomicAsOf(tx2.dbAfter, "cust-001", tx1.txTime);
      assert.equal(historicalState["customer/name"], "Valentín Flórez");
      assert.equal(historicalState["account/credit-limit-cents"], 500000);

      // Query complete audit history
      const history = queryDatomicHistory(tx2.dbAfter, "cust-001");
      assert.equal(history.length, 5);
    });
  });

  describe("Suite 4: Institutional Blameless Postmortem Synthesizer", () => {
    it("synthesizes certified Nu blameless postmortem with 5 Whys and zero personal blame", () => {
      const report = synthesizeNubankBlamelessPostmortem({
        incidentId: "INC-2026-NU-042",
        title: "Kafka consumer group lag spike during PIX transaction peak",
        severity: "SEV1",
        owningSquad: "squad-transfers-bogota",
        affectedServices: ["transfer-gateway", "ledger-core", "pix-adapter"],
        customerImpact: "0.12% of outbound transfers experienced delayed confirmation (> 4s)",
        startTime: "2026-10-25T14:00:00Z",
        resolutionTime: "2026-10-25T14:32:00Z",
        durationMinutes: 32,
        timeline: [
          {
            timestamp: "14:00:00Z",
            description: "Prometheus alert triggered on consumer lag > 5000",
            detectedBy: "alert",
          },
          {
            timestamp: "14:08:00Z",
            description: "On-call engineer acknowledged and scaled consumer pods from 6 to 18",
            detectedBy: "engineer",
          },
          {
            timestamp: "14:32:00Z",
            description: "Lag dropped to 0; all messages processed idempotently",
            detectedBy: "sentinel",
          },
        ],
        fiveWhys: [
          "Consumer lag spiked because partition distribution was imbalanced.",
          "Partition distribution was imbalanced because keying was on bank routing number instead of account ID.",
          "Routing number was used due to an outdated API payload contract.",
          "Contract testing did not validate partition distribution entropy.",
          "The squad lacked an automated partition entropy lint in CI.",
        ],
        cognitiveFactors: [
          "Alert runbook had an ambiguous partition rebalance procedure.",
          "Dashboard showed global throughput but hid per-partition skew.",
        ],
        systemicRemediations: [
          {
            action: "Migrate Kafka keying strictly to account_id for uniform hashing",
            owner: "valentin",
            deadline: "2026-10-28",
          },
          {
            action: "Add automated partition entropy verification to Sachem schema checks",
            owner: "squad-platform",
            deadline: "2026-11-02",
          },
        ],
      });

      assert.ok(report.markdown.includes("NUBANK BLAMELESS POSTMORTEM — INC-2026-NU-042"));
      assert.ok(report.markdown.includes("squad-transfers-bogota"));
      assert.ok(report.markdown.includes("The 5 Whys"));
      assert.ok(report.markdown.includes("Human & Cognitive Ergonomics (Zero Blame Assessment)"));
      assert.ok(report.sha256Receipt.length === 64);
    });
  });

  describe("Suite 5: Autonomous Squad Charter Synthesizer", () => {
    it("generates an institutional squad charter with RFC governance", () => {
      const charter = synthesizeNubankSquadCharter({
        squadName: "squad-credit-cards-bogota",
        tribe: "Core-Credit-LatAm",
        mission: "Deliver seamless, sub-50ms credit card authorizations across Colombia and Mexico.",
        servicesOwned: ["card-authorizer", "credit-limit-ledger", "fraud-sentinel"],
        slos: [
          { metric: "Authorization Latency p99", target: "< 45ms" },
          { metric: "Service Availability", target: "99.99%" },
        ],
      });

      assert.equal(charter.squadName, "squad-credit-cards-bogota");
      assert.equal(charter.servicesOwned.length, 3);
      assert.ok(charter.rfcStandard.includes("RFC-NU-ARCHITECTURE"));
    });
  });
});
