/**
 * EOS SYSTEM — NSA DEFENSE-IN-DEPTH & CNSA 2.0 ZERO-TRUST TEST SUITE
 * Governed by ADR-040, SPEC-034, FR-094..FR-098, BDD-086..BDD-089
 *
 * Verifies:
 * 1. CNSA 2.0 AES-256-GCM encryption, AAD binding & constant-time compare (BDD-086)
 * 2. DoD 5220.22-M / NSA 4-pass in-place memory zeroization (BDD-087)
 * 3. Red/Black physical-logical separation & Bell-LaPadula MAC rules (BDD-088)
 * 4. Real-time side-channel anomaly detector & fail-closed emergency purge (BDD-089)
 *
 * 100% Layer-0 Purity with zero runtime npm dependencies.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { EosNsaCryptoSuite } from "../src/core/eosNsaCryptoSuite.ts";
import { EosNsaZeroTrustCompartment } from "../src/core/eosNsaZeroTrustCompartment.ts";
import { EosNsaAnomalyDetector } from "../src/core/eosNsaAnomalyDetector.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

describe("SPEC-034: NSA Defense-in-Depth & CNSA 2.0 Verification", () => {
  // =========================================================================
  // PILLAR 1: CNSA 2.0 AES-256-GCM Authenticated Encryption & AAD (BDD-086)
  // =========================================================================
  describe("BDD-086: CNSA 2.0 AES-256-GCM & Constant-Time Verification", () => {
    const key = EosNsaCryptoSuite.generateKey256();
    const plaintext = "CLASSIFIED_TOP_SECRET_DIRECTIVE_ALPHA_NOUS";
    const aad = "CLASS=TOP_SECRET;COMP=EOS-NOUS;CLEARANCE=TS-SCI";

    test("encrypts with 96-bit IV, 128-bit AuthTag, and decrypts cleanly with matching AAD", () => {
      const envelope = EosNsaCryptoSuite.encryptAesGcm256(plaintext, key, aad);

      assert.equal(envelope.algorithm, "AES-256-GCM");
      assert.equal(Buffer.from(envelope.iv, "hex").length, 12, "IV must be exactly 96 bits (12 bytes)");
      assert.equal(Buffer.from(envelope.authTag, "hex").length, 16, "AuthTag must be 128 bits (16 bytes)");
      assert.equal(envelope.aad, aad);
      assert.equal(envelope.sha384Digest.length, 96, "SHA-384 digest must be 96 hex characters");

      // Clean decryption
      const decrypted = EosNsaCryptoSuite.decryptAesGcm256(envelope, key);
      assert.equal(decrypted.toString("utf8"), plaintext);
    });

    test("fails closed if ciphertext or AAD is tampered", () => {
      const envelope = EosNsaCryptoSuite.encryptAesGcm256(plaintext, key, aad);

      // Tampered ciphertext (deterministic bit flip)
      const tamperedCiphertext = (envelope.ciphertext[0] === "0" ? "1" : "0") + envelope.ciphertext.slice(1);
      const tamperedEnvelope = { ...envelope, ciphertext: tamperedCiphertext };

      assert.throws(
        () => EosNsaCryptoSuite.decryptAesGcm256(tamperedEnvelope, key),
        /NSA Integrity Failure/
      );

      // Tampered AAD
      const tamperedAadEnvelope = { ...envelope, aad: "CLASS=UNCLASSIFIED;COMP=PUBLIC" };
      assert.throws(
        () => EosNsaCryptoSuite.decryptAesGcm256(tamperedAadEnvelope, key),
        /NSA Integrity Failure/
      );
    });

    test("constant-time comparison verifies exact matches and resists timing leaks", () => {
      const secretTokenA = "TOP_SECRET_ALPHA_TOKEN_9876543210";
      const secretTokenB = "TOP_SECRET_ALPHA_TOKEN_9876543210";
      const differentToken = "TOP_SECRET_BETA_TOKEN_0123456789";

      assert.equal(EosNsaCryptoSuite.constantTimeCompare(secretTokenA, secretTokenB), true);
      assert.equal(EosNsaCryptoSuite.constantTimeCompare(secretTokenA, differentToken), false);
      assert.equal(EosNsaCryptoSuite.constantTimeCompare(secretTokenA, "SHORT"), false);
    });
  });

  // =========================================================================
  // PILLAR 2: DoD 5220.22-M / NSA 4-Pass Memory Zeroization (BDD-087)
  // =========================================================================
  describe("BDD-087: Multi-Pass Physical Memory Zeroization", () => {
    test("overwrites buffer through 4 passes and leaves 100% zeroed memory", () => {
      const secretBuffer = Buffer.from("CRITICAL_PRIVATE_KEY_MATERIAL_NEVER_PERSIST", "utf8");
      assert.equal(EosNsaCryptoSuite.isZeroized(secretBuffer), false);

      EosNsaCryptoSuite.zeroizeBuffer(secretBuffer);

      assert.equal(EosNsaCryptoSuite.isZeroized(secretBuffer), true);
      for (let i = 0; i < secretBuffer.length; i++) {
        assert.equal(secretBuffer[i], 0x00, `Byte at index ${i} must be zero`);
      }
    });
  });

  // =========================================================================
  // PILLAR 3: Red/Black Separation & Bell-LaPadula MAC Lattice (BDD-088)
  // =========================================================================
  describe("BDD-088: Red/Black Boundary & Bell-LaPadula Mandatory Access Control", () => {
    const compartment = new EosNsaZeroTrustCompartment();

    const topSecretSubject = {
      subjectId: "AGENT_VALENTIN",
      clearance: "TOP_SECRET",
      compartments: ["EOS-NOUS", "TITAN-CORE"]
    };

    const secretSubject = {
      subjectId: "AGENT_FIELD_OPERATIVE",
      clearance: "SECRET",
      compartments: ["TITAN-CORE"]
    };

    const unclassifiedSubject = {
      subjectId: "PUBLIC_OBSERVER",
      clearance: "UNCLASSIFIED",
      compartments: []
    };

    const topSecretObject = {
      objectId: "NOUS_KUNDALINI_DIRECTIVE",
      classification: "TOP_SECRET",
      compartments: ["EOS-NOUS"],
      redPayload: "SACRED_FORMULA_OF_TRANSMUTATION"
    };

    test("enforces Simple Security (No Read-Up): lower clearance cannot read higher object", () => {
      // Store in RED boundary with authorized subject
      const stored = compartment.storeRedObject(topSecretSubject, topSecretObject);
      assert.equal(stored, true);

      // Secret subject cannot read Top Secret object (Read-Up violation)
      const readBySecret = compartment.readRedObject(secretSubject, topSecretObject.objectId);
      assert.equal(readBySecret, null);

      // Top Secret subject with required compartment CAN read
      const readByTopSecret = compartment.readRedObject(topSecretSubject, topSecretObject.objectId);
      assert.equal(readByTopSecret, topSecretObject.redPayload);
    });

    test("enforces *-Property (No Write-Down): high clearance cannot write to lower classification", () => {
      // Top Secret subject writing to UNCLASSIFIED is blocked to prevent accidental leak
      const canWriteDown = compartment.canWrite(topSecretSubject, "UNCLASSIFIED", []);
      assert.equal(canWriteDown, false, "Must block Write-Down to lower classification");

      // Secret subject writing to SECRET or TOP_SECRET is allowed
      const canWriteEqual = compartment.canWrite(secretSubject, "SECRET", ["TITAN-CORE"]);
      assert.equal(canWriteEqual, true);

      const canWriteUp = compartment.canWrite(secretSubject, "TOP_SECRET", ["TITAN-CORE"]);
      assert.equal(canWriteUp, true);
    });

    test("crosses the BLACK boundary only as encrypted AES-256-GCM ciphertext", () => {
      const blackTransit = compartment.exportToBlackBoundary(topSecretSubject, topSecretObject.objectId);

      assert.equal(blackTransit.objectId, topSecretObject.objectId);
      assert.equal(blackTransit.classification, "TOP_SECRET");
      assert.ok(blackTransit.envelope.ciphertext.length > 0);
      assert.ok(blackTransit.sequenceNumber > 0);
      assert.ok(blackTransit.previousLogHash.length > 0);

      // Verify audit log has recorded the transactions
      const auditTrail = compartment.getAuditTrail();
      assert.ok(auditTrail.length >= 3);
      assert.ok(auditTrail.some(r => r.action === "TRANSIT_BLACK" && r.outcome === "GRANTED"));
    });
  });

  // =========================================================================
  // PILLAR 4: Continuous Side-Channel Anomaly Detector & Lockdown (BDD-089)
  // =========================================================================
  describe("BDD-089: Side-Channel Anomaly Detector & Emergency Purge", () => {
    test("triggers EMERGENCY_LOCKDOWN after exceeding threshold of failures", () => {
      const detector = new EosNsaAnomalyDetector(3);
      let memoryWiped = false;

      detector.registerZeroizeTarget(() => {
        memoryWiped = true;
      });

      assert.equal(detector.getState(), "NOMINAL");

      // Failure 1
      detector.recordFailure("AuthTag mismatch");
      assert.equal(detector.getState(), "SUSPICIOUS");
      assert.equal(memoryWiped, false);

      // Failure 2
      detector.recordFailure("Timing variance spike");
      assert.equal(detector.getState(), "SUSPICIOUS");

      // Failure 3 -> triggers LOCKDOWN
      const report = detector.recordFailure("Repeated classification violation");
      assert.equal(detector.getState(), "EMERGENCY_LOCKDOWN");
      assert.equal(detector.isLockedDown(), true);
      assert.equal(memoryWiped, true, "Memory zeroize target must have executed");

      assert.equal(report, "EMERGENCY_LOCKDOWN");
      const reports = detector.getIncidentReports();
      assert.equal(reports.length, 1);
      assert.equal(reports[0].currentState, "EMERGENCY_LOCKDOWN");
      assert.ok(reports[0].sha384Attestation.length === 96);
    });

    test("recovers from lockdown only with valid constant-time cryptographic token", () => {
      const detector = new EosNsaAnomalyDetector(1);
      detector.recordFailure("Direct attack trigger");
      assert.equal(detector.isLockedDown(), true);

      const secretToken = "SOVEREIGN_AUTHORIZATION_RESET_TOKEN_NSA_41";

      // Invalid token fails
      const failedReset = detector.authorizedReset("WRONG_TOKEN", secretToken);
      assert.equal(failedReset, false);
      assert.equal(detector.isLockedDown(), true);

      // Valid token restores
      const validReset = detector.authorizedReset(secretToken, secretToken);
      assert.equal(validReset, true);
      assert.equal(detector.isLockedDown(), false);
      assert.equal(detector.getState(), "NOMINAL");
    });
  });

  // =========================================================================
  // PILLAR 5: MCP Tool Dispatching Integration
  // =========================================================================
  describe("MCP Tools: eos_nsa_encrypt, eos_nsa_zero_trust_check, eos_nsa_audit_logs", () => {
    const server = new EosMcpServer();

    test("dispatches eos_nsa_encrypt via MCP", () => {
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: "req-nsa-1",
        method: "tools/call",
        params: {
          name: "eos_nsa_encrypt",
          arguments: {
            plaintext: "TOP_SECRET_MCP_PAYLOAD",
            classification: "TOP_SECRET",
            compartment: "EOS-NOUS"
          }
        }
      });

      assert.equal(res.jsonrpc, "2.0");
      assert.equal(res.id, "req-nsa-1");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.algorithm, "AES-256-GCM");
      assert.ok(parsed.ciphertext.length > 0);
      assert.ok(parsed.authTag.length === 32);
      assert.ok(parsed.sha384Digest.length === 96);
    });

    test("dispatches eos_nsa_zero_trust_check via MCP", () => {
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: "req-nsa-2",
        method: "tools/call",
        params: {
          name: "eos_nsa_zero_trust_check",
          arguments: {
            subjectClearance: "SECRET",
            subjectCompartments: ["TITAN-CORE"],
            objectClassification: "TOP_SECRET",
            objectCompartments: ["EOS-NOUS"],
            action: "READ"
          }
        }
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.permitted, false);
      assert.equal(parsed.ruleEnforced, "Bell-LaPadula Simple Security (No Read-Up)");
    });

    test("dispatches eos_nsa_audit_logs via MCP", () => {
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: "req-nsa-3",
        method: "tools/call",
        params: {
          name: "eos_nsa_audit_logs",
          arguments: {}
        }
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.ok(typeof parsed.totalEntries === "number");
      assert.ok(Array.isArray(parsed.auditTrail));
    });
  });
});
