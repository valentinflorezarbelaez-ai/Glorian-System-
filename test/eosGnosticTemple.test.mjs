/**
 * EOS SYSTEM — GNOSTIC TEMPLE TESTS
 * Tests for EosGnosticTemple: auditThreeBrains, evaluateClaveDeSol, recordImpression,
 * checkCircadianVeto, prescribeOctaveShock
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosGnosticTemple } from "../src/core/eosGnosticTemple.ts";

// ============================================================================
// auditThreeBrains
// ============================================================================

test("auditThreeBrains calculates ratios correctly", () => {
  const temple = new EosGnosticTemple();
  const report = temple.auditThreeBrains(4, 4, 4);
  assert.equal(report.totalHours, 12);
  assert.equal(report.intellectualRatio, 0.33);
  assert.equal(report.emotionalRatio, 0.33);
  assert.equal(report.motorRatio, 0.33);
});

test("auditThreeBrains returns HARMONIC_EQUILIBRIUM for balanced brains", () => {
  const temple = new EosGnosticTemple();
  const report = temple.auditThreeBrains(3, 3, 3);
  assert.equal(report.status, "HARMONIC_EQUILIBRIUM");
  assert.ok(report.prescriptions[0].includes("armónico"));
});

test("auditThreeBrains detects INTELLECTUAL_HYPERTROPHY", () => {
  const temple = new EosGnosticTemple();
  const report = temple.auditThreeBrains(8, 1, 1);
  assert.equal(report.status, "INTELLECTUAL_HYPERTROPHY");
  assert.ok(report.prescriptions[0].includes("Hipertrofia"));
  assert.ok(report.prescriptions[1].includes("Calistenia"));
  assert.ok(report.prescriptions[2].includes("música"));
});

test("auditThreeBrains suggests motor compensation when motor is low", () => {
  const temple = new EosGnosticTemple();
  const report = temple.auditThreeBrains(3, 5, 0.5);
  assert.ok(report.prescriptions.some((p) => p.includes("motor")));
});

test("auditThreeBrains handles zero hours", () => {
  const temple = new EosGnosticTemple();
  const report = temple.auditThreeBrains(0, 0, 0);
  assert.equal(report.totalHours, 0.1);
  assert.equal(report.intellectualRatio, 0);
});

test("auditThreeBrains handles negative hours", () => {
  const temple = new EosGnosticTemple();
  const report = temple.auditThreeBrains(-1, -1, 10);
  assert.ok(report.totalHours > 0);
});

test("auditThreeBrains report contains all fields", () => {
  const temple = new EosGnosticTemple();
  const report = temple.auditThreeBrains(2, 2, 2);
  assert.ok("intellectualHours" in report);
  assert.ok("emotionalHours" in report);
  assert.ok("motorHours" in report);
  assert.ok("totalHours" in report);
  assert.ok("intellectualRatio" in report);
  assert.ok("emotionalRatio" in report);
  assert.ok("motorRatio" in report);
  assert.ok("status" in report);
  assert.ok("prescriptions" in report);
});

// ============================================================================
// evaluateClaveDeSol
// ============================================================================

test("evaluateClaveDeSol returns DESPIERTO when all true", () => {
  const temple = new EosGnosticTemple();
  const result = temple.evaluateClaveDeSol({
    subjectAware: true,
    objectFocused: true,
    placePresent: true,
  });
  assert.equal(result.state, "DESPIERTO");
  assert.equal(result.consciousnessAwakeScore, 100);
});

test("evaluateClaveDeSol returns AUTO_OBSERVADOR with 2 of 3", () => {
  const temple = new EosGnosticTemple();
  const result = temple.evaluateClaveDeSol({
    subjectAware: true,
    objectFocused: true,
    placePresent: false,
  });
  assert.equal(result.state, "AUTO_OBSERVADOR");
  assert.equal(result.consciousnessAwakeScore, 70);
});

test("evaluateClaveDeSol returns FASCINADO with 1 of 3", () => {
  const temple = new EosGnosticTemple();
  const result = temple.evaluateClaveDeSol({
    subjectAware: true,
    objectFocused: false,
    placePresent: false,
  });
  assert.equal(result.state, "FASCINADO_SUEÑO_CONCIENCIA");
  assert.equal(result.consciousnessAwakeScore, 35);
});

test("evaluateClaveDeSol returns FASCINADO with 0 of 3", () => {
  const temple = new EosGnosticTemple();
  const result = temple.evaluateClaveDeSol({
    subjectAware: false,
    objectFocused: false,
    placePresent: false,
  });
  assert.equal(result.state, "FASCINADO_SUEÑO_CONCIENCIA");
  assert.equal(result.consciousnessAwakeScore, 0);
});

test("evaluateClaveDeSol subjectAware scores 35 points", () => {
  const temple = new EosGnosticTemple();
  const result = temple.evaluateClaveDeSol({
    subjectAware: true,
    objectFocused: false,
    placePresent: false,
  });
  assert.equal(result.consciousnessAwakeScore, 35);
});

test("evaluateClaveDeSol objectFocused scores 35 points", () => {
  const temple = new EosGnosticTemple();
  const result = temple.evaluateClaveDeSol({
    subjectAware: false,
    objectFocused: true,
    placePresent: false,
  });
  assert.equal(result.consciousnessAwakeScore, 35);
});

test("evaluateClaveDeSol placePresent scores 30 points", () => {
  const temple = new EosGnosticTemple();
  const result = temple.evaluateClaveDeSol({
    subjectAware: false,
    objectFocused: false,
    placePresent: true,
  });
  assert.equal(result.consciousnessAwakeScore, 30);
});

test("evaluateClaveDeSol sets subject state correctly", () => {
  const temple = new EosGnosticTemple();
  const awake = temple.evaluateClaveDeSol({ subjectAware: true, objectFocused: true, placePresent: true });
  assert.ok(awake.subjectState.includes("Auto-recuerdo"));
  const asleep = temple.evaluateClaveDeSol({ subjectAware: false, objectFocused: false, placePresent: false });
  assert.ok(asleep.subjectState.includes("Sujeto olvidado"));
});

test("evaluateClaveDeSol sets object state correctly", () => {
  const temple = new EosGnosticTemple();
  const awake = temple.evaluateClaveDeSol({ subjectAware: true, objectFocused: true, placePresent: true });
  assert.ok(awake.objectState.includes("Acción sin dispersión"));
  const asleep = temple.evaluateClaveDeSol({ subjectAware: false, objectFocused: false, placePresent: false });
  assert.ok(asleep.objectState.includes("Mente mecánica"));
});

test("evaluateClaveDeSol sets place state correctly", () => {
  const temple = new EosGnosticTemple();
  const awake = temple.evaluateClaveDeSol({ subjectAware: true, objectFocused: true, placePresent: true });
  assert.ok(awake.placeState.includes("Enraizamiento"));
  const asleep = temple.evaluateClaveDeSol({ subjectAware: false, objectFocused: false, placePresent: false });
  assert.ok(asleep.placeState.includes("Cuerpo ausente"));
});

test("evaluateClaveDeSol provides theurgic advice", () => {
  const temple = new EosGnosticTemple();
  const result = temple.evaluateClaveDeSol({
    subjectAware: false,
    objectFocused: false,
    placePresent: false,
  });
  assert.ok(result.theurgicAdvice.length > 0);
  assert.ok(result.theurgicAdvice.includes("Alto"));
});

// ============================================================================
// recordImpression
// ============================================================================

test("recordImpression creates entry with id", () => {
  const temple = new EosGnosticTemple();
  const entry = temple.recordImpression("trigger", "ORGULLO", 5);
  assert.ok(entry.id.startsWith("IMP-"));
  assert.equal(entry.triggerEvent, "trigger");
  assert.equal(entry.identifiedEgo, "ORGULLO");
  assert.equal(entry.intensity, 5);
});

test("recordImpression clamps intensity to 1-10", () => {
  const temple = new EosGnosticTemple();
  const low = temple.recordImpression("t", "IRA", 0);
  assert.equal(low.intensity, 1);
  const high = temple.recordImpression("t", "IRA", 20);
  assert.equal(high.intensity, 10);
});

test("recordImpression sets dissolution formula for ORGULLO", () => {
  const temple = new EosGnosticTemple();
  const entry = temple.recordImpression("t", "ORGULLO", 5);
  assert.ok(entry.dissolutionFormula.includes("orgullo"));
});

test("recordImpression sets dissolution formula for IRA", () => {
  const temple = new EosGnosticTemple();
  const entry = temple.recordImpression("t", "IRA", 5);
  assert.ok(entry.dissolutionFormula.includes("ira"));
});

test("recordImpression sets dissolution formula for PEREZA", () => {
  const temple = new EosGnosticTemple();
  const entry = temple.recordImpression("t", "PEREZA", 5);
  assert.ok(entry.dissolutionFormula.includes("pereza"));
});

test("recordImpression sets dissolution formula for FASCINACION", () => {
  const temple = new EosGnosticTemple();
  const entry = temple.recordImpression("t", "FASCINACION", 5);
  assert.ok(entry.dissolutionFormula.includes("hipnosis"));
});

test("recordImpression sets dissolution formula for IMPACIENCIA", () => {
  const temple = new EosGnosticTemple();
  const entry = temple.recordImpression("t", "IMPACIENCIA", 5);
  assert.ok(entry.dissolutionFormula.includes("paciencia"));
});

test("recordImpression sets dissolution formula for LUJURIA", () => {
  const temple = new EosGnosticTemple();
  const entry = temple.recordImpression("t", "LUJURIA", 5);
  assert.ok(entry.dissolutionFormula.includes("transmuta"));
});

test("recordImpression sets dissolution formula for CODICIA", () => {
  const temple = new EosGnosticTemple();
  const entry = temple.recordImpression("t", "CODICIA", 5);
  assert.ok(entry.dissolutionFormula.includes("avaricia"));
});

test("recordImpression adds to log", () => {
  const temple = new EosGnosticTemple();
  temple.recordImpression("t1", "ORGULLO", 5);
  temple.recordImpression("t2", "IRA", 3);
  const log = temple.getImpressionLog();
  assert.equal(log.length, 2);
});

test("getImpressionLog returns a copy", () => {
  const temple = new EosGnosticTemple();
  temple.recordImpression("t", "ORGULLO", 5);
  const log1 = temple.getImpressionLog();
  const log2 = temple.getImpressionLog();
  assert.notEqual(log1, log2);
});

test("recordImpression entry has timestamp", () => {
  const temple = new EosGnosticTemple();
  const entry = temple.recordImpression("t", "ORGULLO", 5);
  assert.ok(entry.timestamp);
  assert.ok(entry.timestamp.includes("T"));
});

// ============================================================================
// checkCircadianVeto
// ============================================================================

test("checkCircadianVeto allows daytime (12:00)", () => {
  const temple = new EosGnosticTemple();
  const result = temple.checkCircadianVeto(new Date("2026-01-01T12:00:00"));
  assert.equal(result.vetoActive, false);
  assert.equal(result.status, "SOLAR_ACTIVITY_AUTHORIZED");
});

test("checkCircadianVeto allows morning (08:00)", () => {
  const temple = new EosGnosticTemple();
  const result = temple.checkCircadianVeto(new Date("2026-01-01T08:00:00"));
  assert.equal(result.vetoActive, false);
});

test("checkCircadianVeto allows early night (22:00)", () => {
  const temple = new EosGnosticTemple();
  const result = temple.checkCircadianVeto(new Date("2026-01-01T22:00:00"));
  assert.equal(result.vetoActive, false);
});

test("checkCircadianVeto activates at 22:30", () => {
  const temple = new EosGnosticTemple();
  const result = temple.checkCircadianVeto(new Date("2026-01-01T22:30:00"));
  assert.equal(result.vetoActive, true);
  assert.equal(result.status, "CIRCADIAN_REST_VETO_ACTIVE");
});

test("checkCircadianVeto activates at 23:00", () => {
  const temple = new EosGnosticTemple();
  const result = temple.checkCircadianVeto(new Date("2026-01-01T23:00:00"));
  assert.equal(result.vetoActive, true);
});

test("checkCircadianVeto activates at midnight", () => {
  const temple = new EosGnosticTemple();
  const result = temple.checkCircadianVeto(new Date("2026-01-01T00:00:00"));
  assert.equal(result.vetoActive, true);
});

test("checkCircadianVeto activates at 3 AM", () => {
  const temple = new EosGnosticTemple();
  const result = temple.checkCircadianVeto(new Date("2026-01-01T03:00:00"));
  assert.equal(result.vetoActive, true);
});

test("checkCircadianVeto allows at 5 AM", () => {
  const temple = new EosGnosticTemple();
  const result = temple.checkCircadianVeto(new Date("2026-01-01T05:00:00"));
  assert.equal(result.vetoActive, false);
});

test("checkCircadianVeto suggests action when veto active", () => {
  const temple = new EosGnosticTemple();
  const result = temple.checkCircadianVeto(new Date("2026-01-01T00:00:00"));
  assert.ok(result.suggestedAction.includes("pantallas"));
});

// ============================================================================
// prescribeOctaveShock
// ============================================================================

test("prescribeOctaveShock MI needs conscious shock", () => {
  const temple = new EosGnosticTemple();
  const result = temple.prescribeOctaveShock("MI");
  assert.equal(result.isSemiToneInterval, true);
  assert.equal(result.needsConsciousShock, true);
  assert.equal(result.shockType, "PHYSICAL_POWER");
});

test("prescribeOctaveShock SI needs conscious shock", () => {
  const temple = new EosGnosticTemple();
  const result = temple.prescribeOctaveShock("SI");
  assert.equal(result.isSemiToneInterval, true);
  assert.equal(result.needsConsciousShock, true);
  assert.equal(result.shockType, "THIRD_FACTOR_SERVICE");
});

test("prescribeOctaveShock DO does not need shock", () => {
  const temple = new EosGnosticTemple();
  const result = temple.prescribeOctaveShock("DO");
  assert.equal(result.isSemiToneInterval, false);
  assert.equal(result.needsConsciousShock, false);
});

test("prescribeOctaveShock RE does not need shock", () => {
  const temple = new EosGnosticTemple();
  const result = temple.prescribeOctaveShock("RE");
  assert.equal(result.needsConsciousShock, false);
});

test("prescribeOctaveShock FA does not need shock", () => {
  const temple = new EosGnosticTemple();
  const result = temple.prescribeOctaveShock("FA");
  assert.equal(result.needsConsciousShock, false);
});

test("prescribeOctaveShock SOL does not need shock", () => {
  const temple = new EosGnosticTemple();
  const result = temple.prescribeOctaveShock("SOL");
  assert.equal(result.needsConsciousShock, false);
});

test("prescribeOctaveShock LA does not need shock", () => {
  const temple = new EosGnosticTemple();
  const result = temple.prescribeOctaveShock("LA");
  assert.equal(result.needsConsciousShock, false);
});

test("prescribeOctaveShock prescription contains note", () => {
  const temple = new EosGnosticTemple();
  const result = temple.prescribeOctaveShock("DO");
  assert.ok(result.prescription.includes("DO"));
});

test("prescribeOctaveShock MI prescription mentions semitone", () => {
  const temple = new EosGnosticTemple();
  const result = temple.prescribeOctaveShock("MI");
  assert.ok(result.prescription.includes("Semitonal"));
});

test("prescribeOctaveShock SI prescription mentions Third Factor", () => {
  const temple = new EosGnosticTemple();
  const result = temple.prescribeOctaveShock("SI");
  assert.ok(result.prescription.includes("Tercer Factor"));
});
