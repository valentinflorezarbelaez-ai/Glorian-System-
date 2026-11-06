/**
 * SPEC-146 Peak Assurance TCB — BDD-410..415
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateMcpAdmission,
  evaluateExternalWrite,
  hashToken,
  verifySessionTokenBinding,
  TCB_MUTATION_TARGET_SNIPPET,
  TCB_MUTATION_SCORE_FLOOR,
  MCP_MAX_PAYLOAD_BYTES
} from "../src/core/eosPeakAssuranceTcb.ts";
import { EosMutationTester } from "../src/core/eosMutationTester.ts";
import { verifyMcpStreamableSecurityModel } from "../scripts/verify-formal-tla.mjs";

describe("SPEC-146 Peak Assurance TCB", () => {
  it("BDD-410: Origin deny-by-default", () => {
    const denied = evaluateMcpAdmission({
      origin: "https://evil.example",
      allowlist: ["https://glorian-system.vercel.app"],
      payloadBytes: 10,
      presentedToken: "a".repeat(32)
    });
    assert.equal(denied.admitted, false);
    assert.equal(denied.reason, "ORIGIN_DENIED");
    assert.equal(denied.statusCode, 403);
  });

  it("BDD-411: Payload hard bound 1 MiB", () => {
    const denied = evaluateMcpAdmission({
      origin: "https://glorian-system.vercel.app",
      allowlist: ["https://glorian-system.vercel.app"],
      payloadBytes: MCP_MAX_PAYLOAD_BYTES + 1,
      presentedToken: "b".repeat(32)
    });
    assert.equal(denied.admitted, false);
    assert.equal(denied.reason, "PAYLOAD_TOO_LARGE");
    assert.equal(denied.statusCode, 413);
  });

  it("BDD-412: Session token binding timing-safe mismatch", () => {
    const tokenA = "c".repeat(32);
    const tokenB = "d".repeat(32);
    const hashA = hashToken(tokenA);
    assert.equal(verifySessionTokenBinding(hashA, tokenA), true);
    assert.equal(verifySessionTokenBinding(hashA, tokenB), false);
    const denied = evaluateMcpAdmission({
      origin: "https://glorian-system.vercel.app",
      allowlist: ["https://glorian-system.vercel.app"],
      payloadBytes: 100,
      sessionTokenHash: hashA,
      presentedToken: tokenB
    });
    assert.equal(denied.admitted, false);
    assert.equal(denied.reason, "TOKEN_BINDING_MISMATCH");
  });

  it("BDD-413: Law IV incomplete blocks external write", () => {
    const denied = evaluateExternalWrite({
      registered: true,
      intakeComplete: true,
      specificationApproved: true,
      auditComplete: true,
      ownerApproval: false,
      implementationAuthorized: true
    });
    assert.equal(denied.admitted, false);
    assert.equal(denied.reason, "LAW_IV_INCOMPLETE");
    const ok = evaluateExternalWrite({
      registered: true,
      intakeComplete: true,
      specificationApproved: true,
      auditComplete: true,
      ownerApproval: true,
      implementationAuthorized: true
    });
    assert.equal(ok.admitted, true);
  });

  it("BDD-414: TLA+ McpStreamableSecurity bounded simulation PASS", () => {
    const res = verifyMcpStreamableSecurityModel(200);
    assert.equal(res.simulationAssertionsPassed, true);
    assert.equal(res.moduleName, "McpStreamableSecurity");
    assert.ok(res.stepsExecuted >= 200);
  });

  it("BDD-415: TCB mutation score floor >= 80", () => {
    const tester = new EosMutationTester();
    const report = tester.evaluateTestSuite(TCB_MUTATION_TARGET_SNIPPET, (code) => {
      // eslint-disable-next-line no-new-func
      const fn = new Function(`${code}; return admit;`)();
      // Oracle: all-true must admit; any false must deny
      if (fn(true, true, true, true) !== true) return false;
      if (fn(false, true, true, true) !== false) return false;
      if (fn(true, false, true, true) !== false) return false;
      if (fn(true, true, false, true) !== false) return false;
      if (fn(true, true, true, false) !== false) return false;
      return true;
    });
    assert.ok(report.mutationScore >= TCB_MUTATION_SCORE_FLOOR, `score ${report.mutationScore}`);
    assert.equal(report.grade, "TIER_S_CERTIFIED");
  });
});
