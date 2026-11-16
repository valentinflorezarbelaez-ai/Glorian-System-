/**
 * EOS SYSTEM — AKASHIC MEMORY TESTS
 * Tests for suggestAkashicTopicKey, classifySamaelianFactorAndSephirah,
 * evaluateOddProportionalRouting, createRddFourRLensesReviewTemplate, MEMORY_CAPABILITY_REFERENCE_CATALOG
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  suggestAkashicTopicKey,
  classifySamaelianFactorAndSephirah,
  evaluateOddProportionalRouting,
  createRddFourRLensesReviewTemplate,
  MEMORY_CAPABILITY_REFERENCE_CATALOG,
} from "../src/core/eosAkashicMemory.ts";

// ============================================================================
// MEMORY_CAPABILITY_REFERENCE_CATALOG
// ============================================================================

test("MEMORY_CAPABILITY_REFERENCE_CATALOG has 6 entries", () => {
  assert.equal(MEMORY_CAPABILITY_REFERENCE_CATALOG.length, 6);
});

test("MEMORY_CAPABILITY_REFERENCE_CATALOG entries have required fields", () => {
  for (const entry of MEMORY_CAPABILITY_REFERENCE_CATALOG) {
    assert.ok(entry.capability.length > 0);
    assert.ok(entry.eosCurrentBehavior.length > 0);
  }
});

test("MEMORY_CAPABILITY_REFERENCE_CATALOG includes browser-local notes", () => {
  const notes = MEMORY_CAPABILITY_REFERENCE_CATALOG.find((e) => e.capability === "Browser-local notes");
  assert.ok(notes !== undefined);
  assert.ok(notes.eosCurrentBehavior.includes("localStorage"));
});

test("MEMORY_CAPABILITY_REFERENCE_CATALOG includes text search", () => {
  const search = MEMORY_CAPABILITY_REFERENCE_CATALOG.find((e) => e.capability === "Text search and filters");
  assert.ok(search !== undefined);
  assert.ok(search.eosCurrentBehavior.includes("case-insensitive"));
});

test("MEMORY_CAPABILITY_REFERENCE_CATALOG includes export", () => {
  const export_ = MEMORY_CAPABILITY_REFERENCE_CATALOG.find((e) => e.capability === "Export");
  assert.ok(export_ !== undefined);
  assert.ok(export_.eosCurrentBehavior.includes("Markdown"));
});

// ============================================================================
// suggestAkashicTopicKey
// ============================================================================

test("suggestAkashicTopicKey returns type/slug format", () => {
  const key = suggestAkashicTopicKey("architecture", "Core Decision");
  assert.equal(key, "architecture/core-decision");
});

test("suggestAkashicTopicKey lowercases type", () => {
  const key = suggestAkashicTopicKey("Architecture", "Test");
  assert.ok(key.startsWith("architecture/"));
});

test("suggestAkashicTopicKey replaces spaces with dashes", () => {
  const key = suggestAkashicTopicKey("architecture", "My New Feature");
  assert.ok(key.includes("my-new-feature"));
});

test("suggestAkashicTopicKey strips accents from title", () => {
  const key = suggestAkashicTopicKey("architecture", "Café Résumé");
  assert.ok(!key.includes("é"));
  assert.ok(!key.includes("é"));
});

test("suggestAkashicTopicKey truncates long slugs at 44 chars", () => {
  const longTitle = "a".repeat(100);
  const key = suggestAkashicTopicKey("architecture", longTitle);
  const slug = key.split("/")[1];
  assert.ok(slug.length <= 44);
});

test("suggestAkashicTopicKey removes leading/trailing dashes", () => {
  const key = suggestAkashicTopicKey("architecture", "---Test---");
  assert.ok(!key.includes("--"));
});

test("suggestAkashicTopicKey handles special characters in type", () => {
  const key = suggestAkashicTopicKey("bug-fix!!", "Test");
  assert.equal(key, "bug-fix/test");
});

test("suggestAkashicTopicKey defaults empty type to architecture", () => {
  const key = suggestAkashicTopicKey("", "Test");
  assert.ok(key.startsWith("architecture/"));
});

test("suggestAkashicTopicKey defaults empty title to core-decision", () => {
  const key = suggestAkashicTopicKey("architecture", "");
  assert.ok(key.endsWith("core-decision"));
});

test("suggestAkashicTopicKey is deterministic", () => {
  const k1 = suggestAkashicTopicKey("bugfix", "Fix login crash");
  const k2 = suggestAkashicTopicKey("bugfix", "Fix login crash");
  assert.equal(k1, k2);
});

// ============================================================================
// classifySamaelianFactorAndSephirah
// ============================================================================

test("classifySamaelianFactorAndSephirah returns MORIR for bugfix type", () => {
  const result = classifySamaelianFactorAndSephirah("bugfix", "Fixed null pointer");
  assert.equal(result.factor, "MORIR");
  assert.equal(result.sephirah, "Geburah (Rigor de la Ley · Tribunal de Anubis)");
});

test("classifySamaelianFactorAndSephirah returns MORIR when text contains 'bug'", () => {
  const result = classifySamaelianFactorAndSephirah("decision", "Found a bug in auth");
  assert.equal(result.factor, "MORIR");
});

test("classifySamaelianFactorAndSephirah returns MORIR when text contains 'fix'", () => {
  const result = classifySamaelianFactorAndSephirah("discovery", "Applied a hotfix");
  assert.equal(result.factor, "MORIR");
});

test("classifySamaelianFactorAndSephirah returns MORIR when text contains 'error'", () => {
  const result = classifySamaelianFactorAndSephirah("learning", "Handled error case");
  assert.equal(result.factor, "MORIR");
});

test("classifySamaelianFactorAndSephirah returns MORIR when text contains 'fdir'", () => {
  const result = classifySamaelianFactorAndSephirah("pattern", "FDIR healing pattern");
  assert.equal(result.factor, "MORIR");
});

test("classifySamaelianFactorAndSephirah returns SACRIFICIO for session_summary type", () => {
  const result = classifySamaelianFactorAndSephirah("session_summary", "Session notes");
  assert.equal(result.factor, "SACRIFICIO");
  assert.equal(result.sephirah, "Tiphereth (Alma Humana · Voluntad Thelema)");
});

test("classifySamaelianFactorAndSephirah returns SACRIFICIO when text contains 'handoff'", () => {
  const result = classifySamaelianFactorAndSephirah("decision", "Handoff to next team");
  assert.equal(result.factor, "SACRIFICIO");
});

test("classifySamaelianFactorAndSephirah returns SACRIFICIO when text contains 'resumen'", () => {
  const result = classifySamaelianFactorAndSephirah("learning", "Resumen del dia");
  assert.equal(result.factor, "SACRIFICIO");
});

test("classifySamaelianFactorAndSephirah returns SACRIFICIO when text contains 'flota'", () => {
  const result = classifySamaelianFactorAndSephirah("discovery", "Flota desplegada");
  assert.equal(result.factor, "SACRIFICIO");
});

test("classifySamaelianFactorAndSephirah defaults to NACER", () => {
  const result = classifySamaelianFactorAndSephirah("architecture", "New microservice design");
  assert.equal(result.factor, "NACER");
  assert.equal(result.sephirah, "Daath (Gnosis / Conocimiento Akáshico)");
});

test("classifySamaelianFactorAndSephirah returns NACER for pattern type", () => {
  const result = classifySamaelianFactorAndSephirah("pattern", "Observer pattern applied");
  assert.equal(result.factor, "NACER");
});

test("classifySamaelianFactorAndSephirah is case-insensitive", () => {
  const result = classifySamaelianFactorAndSephirah("DECISION", "BUG in module");
  assert.equal(result.factor, "MORIR");
});

// ============================================================================
// evaluateOddProportionalRouting
// ============================================================================

test("evaluateOddProportionalRouting returns SMALL_INLINE for simple task", () => {
  const result = evaluateOddProportionalRouting("Add a new button to the UI");
  assert.equal(result.sizeTier, "SMALL_INLINE");
  assert.equal(result.delegationReason, "NONE_INLINE");
  assert.equal(result.publicState, "Ready");
});

test("evaluateOddProportionalRouting returns LARGE_FEATURE_DOC for schema task", () => {
  const result = evaluateOddProportionalRouting("Migrate database schema");
  assert.equal(result.sizeTier, "LARGE_FEATURE_DOC");
  assert.equal(result.delegationReason, "INDEPENDENT_VERIFIER");
  assert.equal(result.publicState, "Checking");
});

test("evaluateOddProportionalRouting detects 'database' keyword", () => {
  const result = evaluateOddProportionalRouting("Optimize database queries");
  assert.equal(result.sizeTier, "LARGE_FEATURE_DOC");
});

test("evaluateOddProportionalRouting detects 'security' keyword", () => {
  const result = evaluateOddProportionalRouting("Implement security audit");
  assert.equal(result.sizeTier, "LARGE_FEATURE_DOC");
});

test("evaluateOddProportionalRouting detects 'auth' keyword", () => {
  const result = evaluateOddProportionalRouting("Fix auth token refresh");
  assert.equal(result.sizeTier, "LARGE_FEATURE_DOC");
});

test("evaluateOddProportionalRouting detects 'concurrency' keyword", () => {
  const result = evaluateOddProportionalRouting("Fix concurrency race condition");
  assert.equal(result.sizeTier, "LARGE_FEATURE_DOC");
});

test("evaluateOddProportionalRouting detects 'migracion' keyword", () => {
  const result = evaluateOddProportionalRouting("Planear migracion de datos");
  assert.equal(result.sizeTier, "LARGE_FEATURE_DOC");
});

test("evaluateOddProportionalRouting detects 'cripto' keyword", () => {
  const result = evaluateOddProportionalRouting("Implementar modulo de cripto");
  assert.equal(result.sizeTier, "LARGE_FEATURE_DOC");
});

test("evaluateOddProportionalRouting high-risk testFirstRule includes verifier", () => {
  const result = evaluateOddProportionalRouting("Change database schema");
  assert.ok(result.testFirstRule.includes("Verifier"));
});

test("evaluateOddProportionalRouting low-risk testFirstRule includes inline", () => {
  const result = evaluateOddProportionalRouting("Update CSS colors");
  assert.ok(result.testFirstRule.includes("Inline"));
});

test("evaluateOddProportionalRouting echoes taskDescription", () => {
  const result = evaluateOddProportionalRouting("Mi tarea unica");
  assert.equal(result.taskDescription, "Mi tarea unica");
});

test("evaluateOddProportionalRouting handles empty taskDescription", () => {
  const result = evaluateOddProportionalRouting("");
  assert.equal(result.sizeTier, "SMALL_INLINE");
});

// ============================================================================
// createRddFourRLensesReviewTemplate
// ============================================================================

test("createRddFourRLensesReviewTemplate returns template with all fields", () => {
  const review = createRddFourRLensesReviewTemplate("Test Title", "fp-123");
  assert.ok("suppliedCandidateFingerprint" in review);
  assert.ok("riskTier" in review);
  assert.ok("lenses" in review);
  assert.ok("epistemicVerdict" in review);
});

test("createRddFourRLensesReviewTemplate retains supplied fingerprint", () => {
  const review = createRddFourRLensesReviewTemplate("Test", "fp-abc-456");
  assert.equal(review.suppliedCandidateFingerprint, "fp-abc-456");
});

test("createRddFourRLensesReviewTemplate riskTier is NOT_ASSESSED", () => {
  const review = createRddFourRLensesReviewTemplate("Test", "fp-123");
  assert.equal(review.riskTier, "NOT_ASSESSED");
});

test("createRddFourRLensesReviewTemplate epistemicVerdict is NOT_EXECUTED_TEMPLATE", () => {
  const review = createRddFourRLensesReviewTemplate("Test", "fp-123");
  assert.equal(review.epistemicVerdict, "NOT_EXECUTED_TEMPLATE");
});

test("createRddFourRLensesReviewTemplate lenses have 4 fields", () => {
  const review = createRddFourRLensesReviewTemplate("Test", "fp-123");
  assert.ok("risk" in review.lenses);
  assert.ok("resilience" in review.lenses);
  assert.ok("readability" in review.lenses);
  assert.ok("reliability" in review.lenses);
});

test("createRddFourRLensesReviewTemplate lenses mark as NOT RUN", () => {
  const review = createRddFourRLensesReviewTemplate("Test", "fp-123");
  assert.ok(review.lenses.risk.includes("[NOT RUN]"));
  assert.ok(review.lenses.resilience.includes("[NOT RUN]"));
  assert.ok(review.lenses.readability.includes("[NOT RUN]"));
  assert.ok(review.lenses.reliability.includes("[NOT RUN]"));
});

test("createRddFourRLensesReviewTemplate reliability lens includes candidate title", () => {
  const review = createRddFourRLensesReviewTemplate("Mi Titulo Unico", "fp-123");
  assert.ok(review.lenses.reliability.includes("Mi Titulo Unico"));
});
