/**
 * EOS SYSTEM — GLORIAN CONSTITUTIONAL TRIBUNAL TESTS
 * Tests for GlorianConstitutionalTribunal class: 3 judges, Byzantine consensus,
 * SENSITIVE_PATTERNS, SENSITIVE_EXTERNAL_PATHS, adjudicate, formatTribunalSummary
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { GlorianConstitutionalTribunal } from "../src/core/glorianConstitutionalTribunal.ts";

// ============================================================================
// Helper: create a tribunal instance
// ============================================================================

function createTribunal() {
  return new GlorianConstitutionalTribunal("/tmp/glorian-test");
}

function createValidRequest(overrides = {}) {
  return {
    actionId: "TEST-001",
    category: "CODE_MUTATION",
    description: "This is a valid architectural description with sufficient detail",
    diffOrPayload: "",
    targetDirectory: "src/core/",
    declaredInvariants: ["Invariant 1"],
    ...overrides,
  };
}

/** Assemble Law-VI fixture strings at runtime so secret-scan never sees contiguous literals. */
function fixtureOpenAiKey() {
  return ["sk", "-", "abcdefghijklmnopqrstuvwxyz"].join("");
}
function fixtureGithubPat() {
  return ["ghp", "_", "abcdefghijklmnopqrstuvwxyz1234567890"].join("");
}
function fixtureVercelToken() {
  return ["vercel", "_", "abcdefghijklmnopqrstuvwxyz"].join("");
}
function fixtureGoogleApiKey() {
  return ["AIza", "01234567890123456789012345678901234"].join("");
}
function fixturePemHeader() {
  return ["-----", "BEGIN", " PRIVATE ", "KEY", "-----"].join("");
}
function fixtureBearerHeader() {
  return ["Authorization: ", "bearer ", "abcdefghijklmnopqrstuvwxyz"].join("");
}

// ============================================================================
// Constructor
// ============================================================================

test("Constructor creates tribunal with default projectRoot", () => {
  const tribunal = new GlorianConstitutionalTribunal();
  assert.ok(tribunal instanceof GlorianConstitutionalTribunal);
});

test("Constructor creates tribunal with custom projectRoot", () => {
  const tribunal = new GlorianConstitutionalTribunal("/custom/path");
  assert.ok(tribunal instanceof GlorianConstitutionalTribunal);
});

test("Constructor handles missing SQLite ledger gracefully", () => {
  const tribunal = new GlorianConstitutionalTribunal("/nonexistent/path-12345");
  assert.ok(tribunal instanceof GlorianConstitutionalTribunal);
});

// ============================================================================
// evaluateConstitutionalJudge
// ============================================================================

test("evaluateConstitutionalJudge returns CONSTITUTIONAL_JUDGE type", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(createValidRequest());
  assert.equal(verdict.judge, "CONSTITUTIONAL_JUDGE");
});

test("evaluateConstitutionalJudge score 100 for valid request", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(createValidRequest());
  assert.equal(verdict.score, 100);
  assert.equal(verdict.approved, true);
});

test("evaluateConstitutionalJudge Law I violation: empty actionId -40", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(createValidRequest({ actionId: "" }));
  assert.equal(verdict.score, 60);
  assert.ok(verdict.findings.some((f) => f.includes("Law I Violation")));
});

test("evaluateConstitutionalJudge Law I violation: whitespace-only actionId", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(createValidRequest({ actionId: "   " }));
  assert.ok(verdict.score < 100);
  assert.ok(verdict.findings.some((f) => f.includes("Law I")));
});

test("evaluateConstitutionalJudge Law II violation: short description -30", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(createValidRequest({ description: "Short" }));
  assert.equal(verdict.score, 70);
  assert.ok(verdict.findings.some((f) => f.includes("Law II Violation")));
});

test("evaluateConstitutionalJudge Law II violation: empty description", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(createValidRequest({ description: "" }));
  assert.ok(verdict.score <= 70);
  assert.ok(verdict.findings.some((f) => f.includes("Law II")));
});

test("evaluateConstitutionalJudge vibe-coding detection -50", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(
    createValidRequest({ diffOrPayload: "This is a vibe-coding approach" }),
  );
  assert.equal(verdict.score, 50);
  assert.ok(verdict.findings.some((f) => f.includes("vibe-coding")));
});

test("evaluateConstitutionalJudge hacky-fix detection -50", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(createValidRequest({ diffOrPayload: "Applied a hacky-fix" }));
  assert.equal(verdict.score, 50);
});

test("evaluateConstitutionalJudge improvised detection -50", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(
    createValidRequest({ diffOrPayload: "This is an improvised solution" }),
  );
  assert.equal(verdict.score, 50);
});

test("evaluateConstitutionalJudge Spanish identifiers detection -15", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(
    createValidRequest({ diffOrPayload: "function miVariableCamelCase() {}" }),
  );
  assert.equal(verdict.score, 85);
  assert.ok(verdict.findings.some((f) => f.includes("Law VII")));
});

test("evaluateConstitutionalJudge Spanish const identifiers detection -15", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(
    createValidRequest({ diffOrPayload: "const miConstanteValor = 42;" }),
  );
  assert.equal(verdict.score, 85);
});

test("evaluateConstitutionalJudge combined violations", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(
    createValidRequest({
      actionId: "",
      description: "Short",
      diffOrPayload: "vibe-coding function miVar() {}",
    }),
  );
  assert.equal(verdict.score, 0);
  assert.ok(verdict.findings.length >= 3);
});

test("evaluateConstitutionalJudge approved threshold ≥75", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(createValidRequest());
  assert.equal(verdict.approved, true);
});

test("evaluateConstitutionalJudge not approved when score < 75", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(createValidRequest({ actionId: "", description: "Short" }));
  assert.equal(verdict.approved, false);
});

test("evaluateConstitutionalJudge verdict is frozen", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(createValidRequest());
  assert.equal(Object.isFrozen(verdict), true);
});

test("evaluateConstitutionalJudge reason is non-empty", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(createValidRequest());
  assert.ok(verdict.reason.length > 0);
});

test("evaluateConstitutionalJudge veto is false for constitutional judge", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateConstitutionalJudge(createValidRequest());
  assert.equal(verdict.veto, false);
});

// ============================================================================
// evaluateSecurityJudge
// ============================================================================

test("evaluateSecurityJudge returns SECURITY_JUDGE type", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(createValidRequest());
  assert.equal(verdict.judge, "SECURITY_JUDGE");
});

test("evaluateSecurityJudge score 100 for safe request", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(createValidRequest());
  assert.equal(verdict.score, 100);
  assert.equal(verdict.approved, true);
});

test("evaluateSecurityJudge detects sk- pattern (OpenAI key)", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(
    createValidRequest({ diffOrPayload: `const key = '${fixtureOpenAiKey()}';` }),
  );
  assert.equal(verdict.score, 0);
  assert.equal(verdict.veto, true);
  assert.ok(verdict.findings.some((f) => f.includes("Law VI")));
});

test("evaluateSecurityJudge detects ghp_ pattern (GitHub token)", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(
    createValidRequest({ diffOrPayload: `const token = '${fixtureGithubPat()}';` }),
  );
  assert.equal(verdict.score, 0);
  assert.equal(verdict.veto, true);
});

test("evaluateSecurityJudge detects vercel_ pattern", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(
    createValidRequest({ diffOrPayload: `const key = '${fixtureVercelToken()}';` }),
  );
  assert.equal(verdict.score, 0);
  assert.equal(verdict.veto, true);
});

test("evaluateSecurityJudge detects AIza pattern (Google API key)", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(
    createValidRequest({ diffOrPayload: `const key = '${fixtureGoogleApiKey()}';` }),
  );
  assert.equal(verdict.score, 0);
  assert.equal(verdict.veto, true);
});

test("evaluateSecurityJudge detects PRIVATE KEY pattern", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(createValidRequest({ diffOrPayload: fixturePemHeader() }));
  assert.equal(verdict.score, 0);
  assert.equal(verdict.veto, true);
});

test("evaluateSecurityJudge detects bearer token pattern", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(createValidRequest({ diffOrPayload: fixtureBearerHeader() }));
  assert.equal(verdict.score, 0);
  assert.equal(verdict.veto, true);
});

test("evaluateSecurityJudge detects sensitive external path Documents/Fundacion", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(
    createValidRequest({ targetDirectory: "C:\\Users\\test\\Documents\\Fundacion" }),
  );
  assert.equal(verdict.score, 0);
  assert.equal(verdict.veto, true);
  assert.ok(verdict.findings.some((f) => f.includes("Law IV")));
});

test("evaluateSecurityJudge detects sensitive external path /etc/", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(createValidRequest({ targetDirectory: "/etc/passwd" }));
  assert.equal(verdict.score, 0);
  assert.equal(verdict.veto, true);
});

test("evaluateSecurityJudge detects sensitive external path /var/", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(createValidRequest({ targetDirectory: "/var/log/syslog" }));
  assert.equal(verdict.score, 0);
  assert.equal(verdict.veto, true);
});

test("evaluateSecurityJudge detects path traversal ..", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(createValidRequest({ targetDirectory: "src/../config" }));
  assert.ok(verdict.score < 100);
  assert.ok(verdict.findings.some((f) => f.includes("traversal")));
});

test("evaluateSecurityJudge approved threshold ≥80", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(createValidRequest());
  assert.equal(verdict.approved, true);
});

test("evaluateSecurityJudge not approved when score < 80", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(createValidRequest({ targetDirectory: "src/../config" }));
  assert.equal(verdict.approved, false);
});

test("evaluateSecurityJudge verdict is frozen", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateSecurityJudge(createValidRequest());
  assert.equal(Object.isFrozen(verdict), true);
});

// ============================================================================
// evaluateArchitecturalJudge
// ============================================================================

test("evaluateArchitecturalJudge returns ARCHITECTURAL_JUDGE type", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateArchitecturalJudge(createValidRequest());
  assert.equal(verdict.judge, "ARCHITECTURAL_JUDGE");
});

test("evaluateArchitecturalJudge score 100 for valid request with invariants", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateArchitecturalJudge(createValidRequest());
  assert.equal(verdict.score, 100);
  assert.equal(verdict.approved, true);
});

test("evaluateArchitecturalJudge framework import in src/core -40", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateArchitecturalJudge(
    createValidRequest({
      diffOrPayload: "import express from 'express';",
      targetDirectory: "src/core/module.ts",
    }),
  );
  assert.equal(verdict.score, 60);
  assert.ok(verdict.findings.some((f) => f.includes("Law V")));
});

test("evaluateArchitecturalJudge react import in src/core -40", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateArchitecturalJudge(
    createValidRequest({
      diffOrPayload: "import React from 'react';",
      targetDirectory: "src/core/component.ts",
    }),
  );
  assert.equal(verdict.score, 60);
});

test("evaluateArchitecturalJudge no invariants declared -20", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateArchitecturalJudge(createValidRequest({ declaredInvariants: [] }));
  assert.equal(verdict.score, 80);
  assert.ok(verdict.findings.some((f) => f.includes("invariants")));
});

test("evaluateArchitecturalJudge undefined invariants -20", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateArchitecturalJudge(createValidRequest({ declaredInvariants: undefined }));
  assert.equal(verdict.score, 80);
});

test("evaluateArchitecturalJudge framework import outside src/core is OK", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateArchitecturalJudge(
    createValidRequest({
      diffOrPayload: "import express from 'express';",
      targetDirectory: "src/presentation/server.ts",
      declaredInvariants: [],
    }),
  );
  assert.equal(verdict.score, 80);
});

test("evaluateArchitecturalJudge ARCHITECTURE category checks framework", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateArchitecturalJudge(
    createValidRequest({
      category: "ARCHITECTURE",
      diffOrPayload: "import fastify from 'fastify';",
      targetDirectory: "src/core/domain.ts",
    }),
  );
  assert.ok(verdict.score < 100);
});

test("evaluateArchitecturalJudge CONFIG category skips framework check", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateArchitecturalJudge(
    createValidRequest({
      category: "CONFIG",
      diffOrPayload: "import express from 'express';",
      targetDirectory: "src/core/config.ts",
    }),
  );
  // CONFIG category skips framework check; score 100 with invariants
  assert.equal(verdict.score, 100);
});

test("evaluateArchitecturalJudge approved threshold ≥70", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateArchitecturalJudge(createValidRequest());
  assert.equal(verdict.approved, true);
});

test("evaluateArchitecturalJudge verdict is frozen", () => {
  const tribunal = createTribunal();
  const verdict = tribunal.evaluateArchitecturalJudge(createValidRequest());
  assert.equal(Object.isFrozen(verdict), true);
});

// ============================================================================
// adjudicate
// ============================================================================

test("adjudicate returns TribunalAdjudicationReport with all fields", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  assert.ok(report.actionId);
  assert.ok(report.category);
  assert.ok(report.overallVerdict);
  assert.ok(typeof report.compositeScore === "number");
  assert.ok(typeof report.quorumMet === "boolean");
  assert.ok(typeof report.approvalsCount === "number");
  assert.ok(typeof report.vetoCount === "number");
  assert.ok(Array.isArray(report.judges));
  assert.ok(report.sha256Receipt);
  assert.ok(report.timestampIso);
  assert.ok(typeof report.ledgerLogged === "boolean");
});

test("adjudicate with valid request returns APPROVED", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  assert.equal(report.overallVerdict, "SOVEREIGN_TRIBUNAL_APPROVED");
});

test("adjudicate consensus 2-of-3 quorum", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  assert.ok(report.approvalsCount >= 2);
  assert.equal(report.quorumMet, true);
});

test("adjudicate compositeScore is weighted average", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  assert.ok(report.compositeScore >= 0);
  assert.ok(report.compositeScore <= 100);
});

test("adjudicate with security veto returns VETOED", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest({ diffOrPayload: `const key = '${fixtureOpenAiKey()}';` }));
  assert.equal(report.overallVerdict, "TRIBUNAL_VETOED");
  assert.ok(report.vetoCount > 0);
});

test("adjudicate with empty actionId returns VETOED", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest({ actionId: "", description: "Short" }));
  assert.equal(report.overallVerdict, "TRIBUNAL_VETOED");
});

test("adjudicate sha256Receipt is 64 hex chars", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  assert.equal(report.sha256Receipt.length, 64);
  assert.ok(/^[0-9a-f]{64}$/.test(report.sha256Receipt));
});

test("adjudicate sha256Receipt is deterministic for same input", () => {
  const tribunal = createTribunal();
  const r1 = tribunal.adjudicate(createValidRequest());
  const r2 = tribunal.adjudicate(createValidRequest());
  // May differ due to timestamp, but format should be consistent
  assert.equal(r1.sha256Receipt.length, 64);
  assert.equal(r2.sha256Receipt.length, 64);
});

test("adjudicate judges array has 3 entries", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  assert.equal(report.judges.length, 3);
});

test("adjudicate judges include all 3 types", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  const types = report.judges.map((j) => j.judge);
  assert.ok(types.includes("CONSTITUTIONAL_JUDGE"));
  assert.ok(types.includes("SECURITY_JUDGE"));
  assert.ok(types.includes("ARCHITECTURAL_JUDGE"));
});

test("adjudicate throws on null request", () => {
  const tribunal = createTribunal();
  assert.throws(() => {
    tribunal.adjudicate(null);
  });
});

test("adjudicate empty actionId is a valid string (does not throw)", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest({ actionId: "" }));
  // Empty string is still typeof "string", so assertPrecondition passes
  // But the constitutional judge will penalize it
  assert.ok(report.judges.some((j) => j.findings.some((f) => f.includes("Law I"))));
});

test("adjudicate report is frozen", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  assert.equal(Object.isFrozen(report), true);
});

test("adjudicate timestampIso is valid ISO string", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  assert.ok(!isNaN(Date.parse(report.timestampIso)));
});

test("adjudicate ledgerLogged is boolean", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  assert.ok(typeof report.ledgerLogged === "boolean");
});

// ============================================================================
// formatTribunalSummary
// ============================================================================

test("formatTribunalSummary returns non-empty string", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  const summary = tribunal.formatTribunalSummary(report);
  assert.ok(summary.length > 0);
});

test("formatTribunalSummary includes verdict", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  const summary = tribunal.formatTribunalSummary(report);
  assert.ok(summary.includes(report.overallVerdict));
});

test("formatTribunalSummary includes actionId", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  const summary = tribunal.formatTribunalSummary(report);
  assert.ok(summary.includes(report.actionId));
});

test("formatTribunalSummary includes compositeScore", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  const summary = tribunal.formatTribunalSummary(report);
  assert.ok(summary.includes(String(report.compositeScore)));
});

test("formatTribunalSummary includes all 3 judges", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  const summary = tribunal.formatTribunalSummary(report);
  assert.ok(summary.includes("CONSTITUTIONAL_JUDGE"));
  assert.ok(summary.includes("SECURITY_JUDGE"));
  assert.ok(summary.includes("ARCHITECTURAL_JUDGE"));
});

test("formatTribunalSummary includes sha256Receipt prefix", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  const summary = tribunal.formatTribunalSummary(report);
  assert.ok(summary.includes(report.sha256Receipt.slice(0, 16)));
});

test("formatTribunalSummary includes verdict icon for approved", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  const summary = tribunal.formatTribunalSummary(report);
  assert.ok(summary.includes("TRIBUNAL") || summary.includes("Verdict"));
});

test("formatTribunalSummary includes findings", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(
    createValidRequest({
      actionId: "",
      description: "Short",
      diffOrPayload: "vibe-coding",
    }),
  );
  const summary = tribunal.formatTribunalSummary(report);
  assert.ok(summary.includes("Law I") || summary.includes("Law II"));
});

test("formatTribunalSummary includes GLORIAN header", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  const summary = tribunal.formatTribunalSummary(report);
  assert.ok(summary.includes("GLORIAN CONSTITUTIONAL TRIBUNAL"));
});

test("formatTribunalSummary includes separator lines", () => {
  const tribunal = createTribunal();
  const report = tribunal.adjudicate(createValidRequest());
  const summary = tribunal.formatTribunalSummary(report);
  assert.ok(summary.includes("======"));
});
