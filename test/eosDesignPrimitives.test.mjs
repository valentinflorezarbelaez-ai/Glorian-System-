/**
 * EOS SYSTEM — DESIGN PRIMITIVES TESTS
 * Tests for architecturalGrid, gridCell, telemetryHeader, spotlightPanel, codeBlock, consoleTrace, generatePrimitivesCSS, generateSpotlightScript
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  architecturalGrid,
  gridCell,
  telemetryHeader,
  spotlightPanel,
  codeBlock,
  consoleTrace,
  generatePrimitivesCSS,
  generateSpotlightScript,
} from "../src/core/eosDesignPrimitives.ts";

// ============================================================================
// architecturalGrid
// ============================================================================

test("architecturalGrid defaults to 3 columns and 1200px max", () => {
  const html = architecturalGrid({ children: "<p>content</p>" });
  assert.ok(html.includes("--grid-cols:3"));
  assert.ok(html.includes("--grid-max:1200px"));
  assert.ok(html.includes("arch-grid"));
  assert.ok(html.includes("<p>content</p>"));
});

test("architecturalGrid accepts custom columns", () => {
  const html = architecturalGrid({ columns: 12, children: "" });
  assert.ok(html.includes("--grid-cols:12"));
});

test("architecturalGrid accepts custom max-width", () => {
  const html = architecturalGrid({ children: "", max: "800px" });
  assert.ok(html.includes("--grid-max:800px"));
});

test("architecturalGrid includes id when provided", () => {
  const html = architecturalGrid({ children: "", id: "main-grid" });
  assert.ok(html.includes('id="main-grid"'));
});

test("architecturalGrid omits id when not provided", () => {
  const html = architecturalGrid({ children: "" });
  assert.ok(!html.includes("id="));
});

// ============================================================================
// gridCell
// ============================================================================

test("gridCell defaults to span 1", () => {
  const html = gridCell("<p>cell</p>");
  assert.ok(html.includes("arch-grid__cell"));
  assert.ok(html.includes("grid-column:span 1"));
  assert.ok(html.includes("<p>cell</p>"));
});

test("gridCell accepts custom span", () => {
  const html = gridCell("<p>wide</p>", 3);
  assert.ok(html.includes("grid-column:span 3"));
});

// ============================================================================
// telemetryHeader
// ============================================================================

test("telemetryHeader generates index and title", () => {
  const html = telemetryHeader({ index: "01", title: "AGI Pipeline" });
  assert.ok(html.includes("telemetry-header"));
  assert.ok(html.includes("01"));
  assert.ok(html.includes("AGI Pipeline"));
  assert.ok(html.includes("//"));
});

test("telemetryHeader defaults status to ONLINE", () => {
  const html = telemetryHeader({ index: "01", title: "Test" });
  assert.ok(html.includes("ONLINE"));
});

test("telemetryHeader accepts custom status", () => {
  const html = telemetryHeader({ index: "02", title: "Test", status: "ALERT" });
  assert.ok(html.includes("ALERT"));
});

test("telemetryHeader uses statusColor override", () => {
  const html = telemetryHeader({ index: "01", title: "Test", statusColor: "#FF0000" });
  assert.ok(html.includes("background:#FF0000"));
});

test("telemetryHeader maps ONLINE status to green color", () => {
  const html = telemetryHeader({ index: "01", title: "Test", status: "ONLINE" });
  assert.ok(html.includes("#10B981"));
});

test("telemetryHeader maps ALERT status to red color", () => {
  const html = telemetryHeader({ index: "01", title: "Test", status: "ALERT" });
  assert.ok(html.includes("#EF4444"));
});

test("telemetryHeader maps ACTIVE status to blue glow", () => {
  const html = telemetryHeader({ index: "01", title: "Test", status: "ACTIVE" });
  assert.ok(html.includes("#3B82F6"));
});

test("telemetryHeader maps IDLE status to dim color", () => {
  const html = telemetryHeader({ index: "01", title: "Test", status: "IDLE" });
  assert.ok(html.includes("#71717A"));
});

// ============================================================================
// spotlightPanel
// ============================================================================

test("spotlightPanel generates card with content", () => {
  const html = spotlightPanel({ content: "<p>Hello</p>" });
  assert.ok(html.includes("spotlight-card"));
  assert.ok(html.includes("<p>Hello</p>"));
  assert.ok(html.includes("spotlight-card__content"));
});

test("spotlightPanel includes optional index", () => {
  const html = spotlightPanel({ content: "", index: "01" });
  assert.ok(html.includes("spotlight-card__index"));
  assert.ok(html.includes("01"));
});

test("spotlightPanel includes optional title", () => {
  const html = spotlightPanel({ content: "", title: "Card Title" });
  assert.ok(html.includes("spotlight-card__title"));
  assert.ok(html.includes("Card Title"));
});

test("spotlightPanel includes optional status", () => {
  const html = spotlightPanel({ content: "", status: "ACTIVE" });
  assert.ok(html.includes("spotlight-card__status"));
  assert.ok(html.includes("ACTIVE"));
});

test("spotlightPanel wide spans 2 columns", () => {
  const html = spotlightPanel({ content: "", wide: true });
  assert.ok(html.includes("grid-column:span 2"));
});

test("spotlightPanel non-wide has no span style", () => {
  const html = spotlightPanel({ content: "", wide: false });
  assert.ok(!html.includes("grid-column:span"));
});

// ============================================================================
// codeBlock
// ============================================================================

test("codeBlock generates language label and code", () => {
  const html = codeBlock({ language: "typescript", code: "const x = 1;" });
  assert.ok(html.includes("codeblock"));
  assert.ok(html.includes("typescript"));
  assert.ok(html.includes("const x = 1;"));
  assert.ok(html.includes("<pre"));
  assert.ok(html.includes("<code>"));
});

test("codeBlock includes copy button", () => {
  const html = codeBlock({ language: "js", code: "console.log(1)" });
  assert.ok(html.includes("codeblock__copy"));
  assert.ok(html.includes("Copy"));
});

test("codeBlock escapes quotes in copy command", () => {
  const html = codeBlock({ language: "sh", code: 'echo "hello"' });
  assert.ok(html.includes("&quot;"));
});

test("codeBlock uses copyCommand override", () => {
  const html = codeBlock({ language: "sh", code: "long code", copyCommand: "short" });
  assert.ok(html.includes("writeText('short')"));
});

// ============================================================================
// consoleTrace
// ============================================================================

test("consoleTrace generates table with header", () => {
  const html = consoleTrace([]);
  assert.ok(html.includes("trace__window"));
  assert.ok(html.includes("trace__table"));
  assert.ok(html.includes("Turn"));
  assert.ok(html.includes("Role"));
  assert.ok(html.includes("Content"));
  assert.ok(html.includes("Duration"));
});

test("consoleTrace renders rows correctly", () => {
  const html = consoleTrace([
    { turn: 1, role: "SYSTEM", content: "init", duration: "10 ms" },
    { turn: 2, role: "USER", content: "prompt", duration: "20 ms" },
  ]);
  assert.ok(html.includes("trace__turn-system"));
  assert.ok(html.includes("trace__turn-user"));
  assert.ok(html.includes("SYSTEM"));
  assert.ok(html.includes("USER"));
  assert.ok(html.includes("init"));
  assert.ok(html.includes("prompt"));
  assert.ok(html.includes("10 ms"));
  assert.ok(html.includes("20 ms"));
});

test("consoleTrace header shows count", () => {
  const html = consoleTrace([
    { turn: 1, role: "ASSISTANT", content: "a", duration: "1 ms" },
    { turn: 2, role: "TOOL", content: "b", duration: "2 ms" },
    { turn: 3, role: "ASSISTANT", content: "c", duration: "3 ms" },
  ]);
  assert.ok(html.includes("Turn 3"));
  assert.ok(html.includes("3 steps"));
});

test("consoleTrace maps all role colors", () => {
  const html = consoleTrace([
    { turn: 1, role: "SYSTEM", content: "", duration: "" },
    { turn: 2, role: "USER", content: "", duration: "" },
    { turn: 3, role: "TOOL", content: "", duration: "" },
    { turn: 4, role: "ASSISTANT", content: "", duration: "" },
  ]);
  assert.ok(html.includes("trace__turn-system"));
  assert.ok(html.includes("trace__turn-user"));
  assert.ok(html.includes("trace__turn-tool"));
  assert.ok(html.includes("trace__turn-assistant"));
});

// ============================================================================
// generatePrimitivesCSS
// ============================================================================

test("generatePrimitivesCSS returns non-empty string", () => {
  const css = generatePrimitivesCSS();
  assert.ok(css.length > 100);
});

test("generatePrimitivesCSS includes arch-grid styles", () => {
  const css = generatePrimitivesCSS();
  assert.ok(css.includes(".arch-grid"));
  assert.ok(css.includes(".arch-grid__cell"));
});

test("generatePrimitivesCSS includes telemetry-header styles", () => {
  const css = generatePrimitivesCSS();
  assert.ok(css.includes(".telemetry-header"));
  assert.ok(css.includes(".telemetry-header__status-dot"));
});

test("generatePrimitivesCSS includes spotlight-card styles", () => {
  const css = generatePrimitivesCSS();
  assert.ok(css.includes(".spotlight-card"));
  assert.ok(css.includes(".spotlight-card::before"));
});

test("generatePrimitivesCSS includes pulse animation", () => {
  const css = generatePrimitivesCSS();
  assert.ok(css.includes("@keyframes pulse"));
});

test("generatePrimitivesCSS includes codeblock styles", () => {
  const css = generatePrimitivesCSS();
  assert.ok(css.includes(".codeblock"));
  assert.ok(css.includes(".codeblock__copy"));
});

test("generatePrimitivesCSS includes trace styles", () => {
  const css = generatePrimitivesCSS();
  assert.ok(css.includes(".trace__window"));
  assert.ok(css.includes(".trace__table"));
});

test("generatePrimitivesCSS includes role color classes", () => {
  const css = generatePrimitivesCSS();
  assert.ok(css.includes(".trace__turn-system"));
  assert.ok(css.includes("#06B6D4"));
  assert.ok(css.includes(".trace__turn-assistant"));
  assert.ok(css.includes("#10B981"));
});

test("generatePrimitivesCSS includes responsive media query", () => {
  const css = generatePrimitivesCSS();
  assert.ok(css.includes("@media"));
  assert.ok(css.includes("768px"));
});

// ============================================================================
// generateSpotlightScript
// ============================================================================

test("generateSpotlightScript returns script tag", () => {
  const js = generateSpotlightScript();
  assert.ok(js.includes("<script>"));
  assert.ok(js.includes("</script>"));
});

test("generateSpotlightScript queries arch-grid and spotlight-card", () => {
  const js = generateSpotlightScript();
  assert.ok(js.includes(".arch-grid"));
  assert.ok(js.includes(".spotlight-card"));
});

test("generateSpotlightScript sets --mouse-x and --mouse-y", () => {
  const js = generateSpotlightScript();
  assert.ok(js.includes("--mouse-x"));
  assert.ok(js.includes("--mouse-y"));
});

test("generateSpotlightScript uses mousemove event", () => {
  const js = generateSpotlightScript();
  assert.ok(js.includes("mousemove"));
});
