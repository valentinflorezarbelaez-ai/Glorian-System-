/**
 * EOS SYSTEM — DESIGN TOKENS TESTS
 * Tests for ALLOWED_COLORS, FORBIDDEN_*, validateCssAgainstTokens, validateHtmlAgainstTokens, getTokenSystemSummary
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_COLORS,
  FORBIDDEN_COLOR_PATTERNS,
  FORBIDDEN_BORDER_RADIUS,
  FORBIDDEN_SHADOWS,
  ALLOWED_BORDER_RADIUS,
  ALLOWED_SHADOWS,
  ALLOWED_FONTS,
  ALLOWED_TIMING_FUNCTIONS,
  ALLOWED_SPACING,
  validateCssAgainstTokens,
  validateHtmlAgainstTokens,
  getTokenSystemSummary,
} from "../src/core/eosDesignTokens.ts";

// ============================================================================
// ALLOWED_COLORS
// ============================================================================

test("ALLOWED_COLORS contains background colors", () => {
  assert.equal(ALLOWED_COLORS["void"], "#050505");
  assert.equal(ALLOWED_COLORS["surface"], "#0A0C12");
  assert.equal(ALLOWED_COLORS["panel"], "#11141D");
  assert.equal(ALLOWED_COLORS["glass"], "rgba(255,255,255,0.03)");
});

test("ALLOWED_COLORS contains border colors", () => {
  assert.equal(ALLOWED_COLORS["border-hairline"], "rgba(255,255,255,0.09)");
  assert.equal(ALLOWED_COLORS["border-focus"], "rgba(59,130,246,0.50)");
});

test("ALLOWED_COLORS contains ink colors", () => {
  assert.equal(ALLOWED_COLORS["ink-primary"], "#F4F4F5");
  assert.equal(ALLOWED_COLORS["ink-secondary"], "#94A3B8");
  assert.equal(ALLOWED_COLORS["ink-muted"], "#475569");
  assert.equal(ALLOWED_COLORS["ink-inverted"], "#050505");
});

test("ALLOWED_COLORS contains accent colors", () => {
  assert.equal(ALLOWED_COLORS["accent-blue"], "#2563EB");
  assert.equal(ALLOWED_COLORS["accent-glow"], "#3B82F6");
  assert.equal(ALLOWED_COLORS["accent-status"], "#10B981");
  assert.equal(ALLOWED_COLORS["accent-warn"], "#F59E0B");
  assert.equal(ALLOWED_COLORS["accent-error"], "#EF4444");
  assert.equal(ALLOWED_COLORS["accent-cyan"], "#06B6D4");
});

test("ALLOWED_COLORS contains CSS variable names", () => {
  assert.equal(ALLOWED_COLORS["--bg-base"], "#090A0F");
  assert.equal(ALLOWED_COLORS["--text-white"], "#F8FAFC");
  assert.equal(ALLOWED_COLORS["--text-muted"], "#A1A1AA");
});

test("ALLOWED_COLORS is frozen", () => {
  assert.throws(() => {
    ALLOWED_COLORS["test"] = "#000";
  }, TypeError);
});

// ============================================================================
// FORBIDDEN patterns
// ============================================================================

test("FORBIDDEN_COLOR_PATTERNS rejects pure white", () => {
  assert.ok(FORBIDDEN_COLOR_PATTERNS[0].test("color: #fff"));
  assert.ok(FORBIDDEN_COLOR_PATTERNS[1].test("color: #ffffff"));
});

test("FORBIDDEN_BORDER_RADIUS contains large radius rules", () => {
  assert.ok(FORBIDDEN_BORDER_RADIUS["rounded-2xl"]);
  assert.ok(FORBIDDEN_BORDER_RADIUS["rounded-3xl"]);
  assert.ok(FORBIDDEN_BORDER_RADIUS["rounded-xl"]);
  assert.ok(FORBIDDEN_BORDER_RADIUS["rounded-full"]);
});

test("FORBIDDEN_SHADOWS contains generic shadow rules", () => {
  assert.ok(FORBIDDEN_SHADOWS["shadow-lg"]);
  assert.ok(FORBIDDEN_SHADOWS["shadow-xl"]);
  assert.ok(FORBIDDEN_SHADOWS["shadow-2xl"]);
});

// ============================================================================
// ALLOWED constants
// ============================================================================

test("ALLOWED_BORDER_RADIUS contains allowed values", () => {
  assert.equal(ALLOWED_BORDER_RADIUS["0px"], "none");
  assert.equal(ALLOWED_BORDER_RADIUS["4px"], "sm (máximo para paneles)");
  assert.equal(ALLOWED_BORDER_RADIUS["9999px"], "full (solo status dots)");
});

test("ALLOWED_SHADOWS contains allowed values", () => {
  assert.equal(ALLOWED_SHADOWS["none"], "none");
  assert.ok(ALLOWED_SHADOWS["glow"].includes("rgba(59,130,246,0.25)"));
  assert.ok(ALLOWED_SHADOWS["inner"].includes("inset"));
});

test("ALLOWED_FONTS contains font families", () => {
  assert.ok(ALLOWED_FONTS["sans"].includes("Inter"));
  assert.ok(ALLOWED_FONTS["mono"].includes("JetBrains Mono"));
});

test("ALLOWED_TIMING_FUNCTIONS contains spring curve", () => {
  assert.ok(ALLOWED_TIMING_FUNCTIONS["spring"].includes("cubic-bezier"));
  assert.equal(ALLOWED_TIMING_FUNCTIONS["ease"], "ease-out");
});

test("ALLOWED_SPACING contains spacing values", () => {
  assert.equal(ALLOWED_SPACING["1px"], "hairline border gap");
  assert.equal(ALLOWED_SPACING["4px"], "xs");
  assert.equal(ALLOWED_SPACING["96px"], "4xl");
});

// ============================================================================
// validateCssAgainstTokens
// ============================================================================

test("validateCssAgainstTokens returns no violations for clean CSS", () => {
  const violations = validateCssAgainstTokens(".card { color: #F4F4F5; border-radius: 4px; }", "test.css");
  assert.equal(violations.length, 0);
});

test("validateCssAgainstTokens detects forbidden border-radius", () => {
  const violations = validateCssAgainstTokens(".card { border-radius: 1rem; }", "test.css");
  assert.ok(violations.length > 0);
  assert.equal(violations[0].rule, "NO_LARGE_RADIUS");
  assert.equal(violations[0].file, "test.css");
  assert.equal(violations[0].line, 1);
});

test("validateCssAgainstTokens detects forbidden shadow", () => {
  const violations = validateCssAgainstTokens(".card { box-shadow: 0 4px 6px rgba(0,0,0,0.1); }", "test.css");
  assert.ok(violations.length > 0);
  assert.equal(violations[0].rule, "NO_GENERIC_SHADOW");
});

test("validateCssAgainstTokens detects raw colors not in allowed set", () => {
  const violations = validateCssAgainstTokens(".card { color: #ABCDEF; }", "test.css");
  const rawColorViolation = violations.find((v) => v.rule === "NO_RAW_COLORS");
  assert.ok(rawColorViolation);
  assert.equal(rawColorViolation.value, "#abcdef");
});

test("validateCssAgainstTokens allows CSS variable definitions", () => {
  const violations = validateCssAgainstTokens(":root { --custom: #ABCDEF; }", "test.css");
  const rawColorViolation = violations.find((v) => v.rule === "NO_RAW_COLORS");
  assert.equal(rawColorViolation, undefined);
});

test("validateCssAgainstTokens detects inline styles", () => {
  const violations = validateCssAgainstTokens('<div style="color: red">content</div>', "test.html");
  const inlineViolation = violations.find((v) => v.rule === "NO_INLINE_STYLES");
  assert.ok(inlineViolation);
});

test("validateCssAgainstTokens allows var() in inline styles", () => {
  const violations = validateCssAgainstTokens('<div style="color: var(--text-white)">content</div>', "test.html");
  const inlineViolation = violations.find((v) => v.rule === "NO_INLINE_STYLES");
  assert.equal(inlineViolation, undefined);
});

test("validateCssAgainstTokens reports correct line numbers", () => {
  const violations = validateCssAgainstTokens(
    ".a { color: #F4F4F5; }\n.b { border-radius: 1rem; }\n.c { color: #F4F4F5; }",
    "test.css",
  );
  assert.equal(violations[0].line, 2);
});

test("validateCssAgainstTokens violation has remediation", () => {
  const violations = validateCssAgainstTokens(".card { border-radius: 1rem; }", "test.css");
  assert.ok(violations[0].remediation);
  assert.ok(violations[0].message);
});

test("validateCssAgainstTokens detects Tailwind rounded-2xl", () => {
  const violations = validateCssAgainstTokens(".card { rounded-2xl: true; }", "test.css");
  assert.ok(violations.length > 0);
  assert.equal(violations[0].value, "rounded-2xl");
});

// ============================================================================
// validateHtmlAgainstTokens
// ============================================================================

test("validateHtmlAgainstTokens returns no violations for clean HTML", () => {
  const violations = validateHtmlAgainstTokens('<div class="card">content</div>', "test.html");
  assert.equal(violations.length, 0);
});

test("validateHtmlAgainstTokens detects inline styles", () => {
  const violations = validateHtmlAgainstTokens('<div style="color: red">content</div>', "test.html");
  assert.ok(violations.length > 0);
  assert.equal(violations[0].rule, "NO_INLINE_STYLES");
});

test("validateHtmlAgainstTokens allows var() inline styles", () => {
  const violations = validateHtmlAgainstTokens('<div style="color: var(--text-white)">content</div>', "test.html");
  const inlineViolation = violations.find((v) => v.rule === "NO_INLINE_STYLES");
  assert.equal(inlineViolation, undefined);
});

test("validateHtmlAgainstTokens detects forbidden border-radius", () => {
  const violations = validateHtmlAgainstTokens('<div class="rounded-2xl">content</div>', "test.html");
  assert.ok(violations.length > 0);
  assert.equal(violations[0].rule, "NO_LARGE_RADIUS");
});

test("validateHtmlAgainstTokens detects forbidden shadows", () => {
  const violations = validateHtmlAgainstTokens('<div class="shadow-lg">content</div>', "test.html");
  assert.ok(violations.length > 0);
  assert.equal(violations[0].rule, "NO_GENERIC_SHADOW");
});

test("validateHtmlAgainstTokens reports file and line", () => {
  const violations = validateHtmlAgainstTokens('<div>ok</div>\n<div style="color:red">bad</div>', "page.html");
  assert.equal(violations[0].file, "page.html");
  assert.equal(violations[0].line, 2);
});

// ============================================================================
// getTokenSystemSummary
// ============================================================================

test("getTokenSystemSummary returns correct counts", () => {
  const summary = getTokenSystemSummary();
  assert.ok(summary.totalColors > 0);
  assert.ok(summary.totalAllowedRadii > 0);
  assert.ok(summary.totalAllowedShadows > 0);
  assert.ok(summary.totalFonts > 0);
  assert.ok(summary.totalTimingFunctions > 0);
});

test("getTokenSystemSummary totalColors matches ALLOWED_COLORS", () => {
  const summary = getTokenSystemSummary();
  assert.equal(summary.totalColors, Object.keys(ALLOWED_COLORS).length);
});

test("getTokenSystemSummary totalAllowedRadii matches ALLOWED_BORDER_RADIUS", () => {
  const summary = getTokenSystemSummary();
  assert.equal(summary.totalAllowedRadii, Object.keys(ALLOWED_BORDER_RADIUS).length);
});

test("getTokenSystemSummary totalFonts matches ALLOWED_FONTS", () => {
  const summary = getTokenSystemSummary();
  assert.equal(summary.totalFonts, Object.keys(ALLOWED_FONTS).length);
});
