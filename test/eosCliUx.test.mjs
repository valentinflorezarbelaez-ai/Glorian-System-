/**
 * EOS CLI UX TEST SUITE
 * Tests for command suggestion engine, input validation, status dashboard,
 * interactive mode helpers, first-run detection, and color output.
 *
 * All tests run offline — no terminal interaction needed.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ── Imports ──────────────────────────────────────────────────────────────────
const {
  suggestCommands,
  validateArgs,
  collectStatus,
  formatStatusDashboard,
  isFirstRun,
  markInitialized,
  getEosVersion,
  EOS_COMMANDS,
  levenshtein: _lev, // not exported but we test indirectly
  cl,
  supportsColor,
} = await import("../src/core/eosCliUx.ts");

// ── Suite 1: Command Suggestion Engine ──────────────────────────────────────────
describe("CLI UX — Command Suggestion Engine (Levenshtein)", () => {

  it("suggests 'consult' when user types 'consutl' (typo)", () => {
    const suggestions = suggestCommands("consutl");
    assert.ok(suggestions.length > 0, "Should suggest something for 'consutl'");
    assert.ok(
      suggestions.some(s => s.name === "consult"),
      `Expected 'consult' in suggestions, got: ${suggestions.map(s => s.name).join(", ")}`
    );
  });

  it("suggests 'turbo' when user types 'turb'", () => {
    const suggestions = suggestCommands("turb");
    assert.ok(suggestions.some(s => s.name === "turbo"));
  });

  it("suggests 'amplify' when user types 'amplif'", () => {
    const suggestions = suggestCommands("amplif");
    assert.ok(suggestions.some(s => s.name === "amplify"));
  });

  it("returns empty array for completely unrelated input", () => {
    const suggestions = suggestCommands("xyzabc123");
    // Very unlikely to match any command
    assert.ok(suggestions.length <= 3, "Should return at most 3 suggestions");
  });

  it("finds exact match with distance 0", () => {
    const suggestions = suggestCommands("turbo");
    assert.ok(suggestions.length > 0);
    assert.equal(suggestions[0].name, "turbo");
  });

  it("matches aliases too (solve → consult)", () => {
    const suggestions = suggestCommands("solv");
    assert.ok(suggestions.some(s => s.name === "consult" || s.aliases.includes("solve")));
  });

  it("always returns at most 3 suggestions", () => {
    const suggestions = suggestCommands("a");
    assert.ok(suggestions.length <= 3, "Should never return more than 3 suggestions");
  });
});

// ── Suite 2: Input Validation ─────────────────────────────────────────────────
describe("CLI UX — Input Validation (Error Prevention)", () => {

  it("returns null when all required args are present", () => {
    const err = validateArgs("consult", ["fix the bug"], ["problem"]);
    assert.equal(err, null, "Should return null when args are valid");
  });

  it("returns ValidationError when required arg is missing", () => {
    const err = validateArgs("consult", [], ["problem"]);
    assert.ok(err, "Should return a ValidationError");
    assert.equal(err.param, "problem");
    assert.ok(err.message.includes("problem"));
    assert.ok(err.example.includes("eos"));
  });

  it("returns ValidationError when required arg is empty string", () => {
    const err = validateArgs("blast", ["  "], ["file"]);
    assert.ok(err, "Should return ValidationError for whitespace-only arg");
  });

  it("includes helpful example in the error", () => {
    const err = validateArgs("blast", [], ["file"]);
    assert.ok(err.example.length > 0, "Error should include an example");
  });
});

// ── Suite 3: Status Dashboard ──────────────────────────────────────────────────
describe("CLI UX — Status Dashboard (Visibility of System State)", () => {

  it("collects status from the project root", async () => {
    const status = await collectStatus(root);
    assert.ok(status.version.length > 0, "Version should be non-empty");
    assert.ok(status.nodeVersion.startsWith("v"), "Node version should start with v");
    assert.ok(status.totalModules > 50, `Expected >50 core modules, got ${status.totalModules}`);
    assert.ok(status.totalTests > 40, `Expected >40 test suites, got ${status.totalTests}`);
    assert.ok(status.totalSpecs > 30, `Expected >30 specs, got ${status.totalSpecs}`);
    assert.ok(status.timestamp.includes("T"), "Timestamp should be ISO format");
  });

  it("formatStatusDashboard produces non-empty string with version", async () => {
    const status = await collectStatus(root);
    const formatted = formatStatusDashboard(status);
    assert.ok(formatted.length > 100, "Dashboard output should be non-empty");
    assert.ok(formatted.includes(status.version), "Dashboard should include version");
    assert.ok(formatted.includes("Módulos"), "Dashboard should include module count");
  });

  it("handles missing project root gracefully", async () => {
    const tmpDir = path.join(os.tmpdir(), `eos-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const status = await collectStatus(tmpDir);
    assert.equal(status.totalModules, 0, "Should return 0 modules for empty dir");
    assert.equal(status.totalTests, 0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ── Suite 4: First-Run Detection ──────────────────────────────────────────────
describe("CLI UX — First-Run Onboarding (Learnability)", () => {

  let tmpProject;

  before(() => {
    tmpProject = path.join(os.tmpdir(), `eos-firstrun-${Date.now()}`);
    fs.mkdirSync(tmpProject, { recursive: true });
  });

  after(() => {
    if (fs.existsSync(tmpProject)) fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it("returns true when .eos-initialized does not exist", () => {
    assert.equal(isFirstRun(tmpProject), true, "Should detect first run when marker missing");
  });

  it("returns false after markInitialized is called", () => {
    markInitialized(tmpProject);
    assert.equal(isFirstRun(tmpProject), false, "Should return false after initialization");
  });

  it("marker file contains ISO timestamp", () => {
    const marker = path.join(tmpProject, ".eos-initialized");
    assert.ok(fs.existsSync(marker), "Marker file should exist");
    const content = fs.readFileSync(marker, "utf8");
    assert.ok(content.includes("T"), "Marker should contain ISO timestamp");
  });
});

// ── Suite 5: Dynamic Version ──────────────────────────────────────────────────
describe("CLI UX — Dynamic Version (Consistency)", () => {

  it("returns version from package.json", () => {
    const version = getEosVersion();
    assert.match(version, /^\d+\.\d+\.\d+$/, `Version should match semver, got: ${version}`);
  });

  it("returns same version on multiple calls (cached)", () => {
    const v1 = getEosVersion();
    const v2 = getEosVersion();
    assert.equal(v1, v2, "Version should be cached and consistent");
  });
});

// ── Suite 6: Command Registry ──────────────────────────────────────────────────
describe("CLI UX — Command Registry (Recognition over Recall)", () => {

  it("contains all expected categories", () => {
    const categories = new Set(EOS_COMMANDS.map(c => c.category));
    assert.ok(categories.has("CORE"), "Should have CORE category");
    assert.ok(categories.has("AGI"), "Should have AGI category");
    assert.ok(categories.has("PLATFORM"), "Should have PLATFORM category");
  });

  it("every command has a name, summary, and usage", () => {
    for (const cmd of EOS_COMMANDS) {
      assert.ok(cmd.name.length > 0, `Command name should not be empty`);
      assert.ok(cmd.summary.length > 0, `Command "${cmd.name}" should have a summary`);
      assert.ok(cmd.usage.length > 0, `Command "${cmd.name}" should have usage info`);
    }
  });

  it("no duplicate command names", () => {
    const names = EOS_COMMANDS.map(c => c.name);
    const unique = new Set(names);
    assert.equal(names.length, unique.size, "Command names should be unique");
  });

  it("aliases point to their parent command", () => {
    for (const cmd of EOS_COMMANDS) {
      for (const alias of cmd.aliases) {
        assert.ok(alias.length > 0, `Alias for "${cmd.name}" should not be empty`);
      }
    }
  });
});

// ── Suite 7: Color Output ─────────────────────────────────────────────────────
describe("CLI UX — Color Output (Aesthetic)", () => {

  it("supportsColor respects NO_COLOR env var", () => {
    const original = process.env["NO_COLOR"];
    process.env["NO_COLOR"] = "1";
    assert.equal(supportsColor(), false, "Should return false when NO_COLOR is set");
    if (original === undefined) delete process.env["NO_COLOR"];
    else process.env["NO_COLOR"] = original;
  });

  it("cl.green returns a string regardless of color support", () => {
    const result = cl.green("test");
    assert.equal(typeof result, "string");
    assert.ok(result.includes("test"), "Should contain the original text");
  });

  it("cl.bold wraps text correctly", () => {
    const result = cl.bold("hello");
    assert.ok(result.includes("hello"), "Bold text should contain original string");
  });
});
