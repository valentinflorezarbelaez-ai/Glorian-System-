/**
 * Test Suite: EosNeuroSymbolicVerifier (Layer 0 — Neuro-Symbolic Runtime Invariant Verification Engine)
 * SPEC-191: Neuro-Symbolic Runtime Invariant Verification Engine
 * CHANGE-076: Neuro-Symbolic Runtime Invariant Verification Engine
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosNeuroSymbolicVerifier } from "../src/core/eosNeuroSymbolicVerifier.ts";

describe("SPEC-191: EosNeuroSymbolicVerifier", () => {
  it("BDD-974: verifies safe autonomous agent action with valid proof and SHA-256 fingerprint", () => {
    const verifier = new EosNeuroSymbolicVerifier();

    const action = {
      actionId: "ACT-SAFE-001",
      actionType: "SHELL_COMMAND",
      target: "npm test",
      payload: "--silent",
      declaredPreconditions: { auth: true },
    };

    const verdict = verifier.verifyAction(action);
    assert.equal(verdict.status, "VERIFIED_SAFE");
    assert.equal(verdict.actionId, "ACT-SAFE-001");
    assert.equal(verdict.violations.length, 0);
    assert.ok(verdict.passedInvariants.includes("zero-runtime-dependency-purity"));
    assert.equal(verdict.sha256Fingerprint.length, 64);
  });

  it("BDD-975: rejects destructive shell command chaining and injection fail-closed", () => {
    const verifier = new EosNeuroSymbolicVerifier();

    const injectionAction = {
      actionId: "ACT-INJECT-001",
      actionType: "SHELL_COMMAND",
      target: "echo hello; rm -rf /",
    };

    const verdict = verifier.verifyAction(injectionAction);
    assert.equal(verdict.status, "REJECTED_VIOLATION");
    assert.ok(
      verdict.violations.some((v) => v.includes("COMMAND_INJECTION_DETECTED") || v.includes("COMMAND_CHAINING")),
    );
  });

  it("BDD-976: blocks directory traversal target paths", () => {
    const verifier = new EosNeuroSymbolicVerifier();

    const traversalAction = {
      actionId: "ACT-TRAVERSAL-001",
      actionType: "FILE_WRITE",
      target: "../../etc/shadow",
      payload: "root:evil",
    };

    const verdict = verifier.verifyAction(traversalAction);
    assert.equal(verdict.status, "REJECTED_VIOLATION");
    assert.ok(verdict.violations.includes("DIRECTORY_TRAVERSAL_DETECTED"));
  });

  it("BDD-977: blocks agent payloads containing secret credentials or private keys", () => {
    const verifier = new EosNeuroSymbolicVerifier();

    const secretAction = {
      actionId: "ACT-SECRET-001",
      actionType: "FILE_WRITE",
      target: "src/config.ts",
      payload: "const key = '" + "AK" + "IAIOSFODNN7EXAMPLE';",
    };

    const verdict = verifier.verifyAction(secretAction);
    assert.equal(verdict.status, "REJECTED_VIOLATION");
    assert.ok(verdict.violations.includes("SECRET_LEAKAGE_DETECTED"));
  });

  it("BDD-978: forward-chaining Horn clause solver deduces conclusions from facts", () => {
    const verifier = new EosNeuroSymbolicVerifier();

    const rules = [
      { antecedents: ["has_signature", "not_expired"], consequent: "TOKEN_VALID" },
      { antecedents: ["TOKEN_VALID", "role_admin"], consequent: "FULL_ACCESS_GRANTED" },
    ];

    const facts = new Set(["has_signature", "not_expired", "role_admin"]);
    const derived = verifier.evaluateHornClauses(facts, rules);

    assert.ok(derived.has("TOKEN_VALID"));
    assert.ok(derived.has("FULL_ACCESS_GRANTED"));
  });

  it("rejects action when declared preconditions indicate lack of authorization", () => {
    const verifier = new EosNeuroSymbolicVerifier();

    const unauthorizedAction = {
      actionId: "ACT-UNAUTH-001",
      actionType: "SHELL_COMMAND",
      target: "git push",
      declaredPreconditions: { auth: false },
    };

    const verdict = verifier.verifyAction(unauthorizedAction);
    assert.equal(verdict.status, "REJECTED_VIOLATION");
    assert.ok(verdict.violations.includes("UNSATISFIED_HOARE_PRECONDITION"));
  });
});
