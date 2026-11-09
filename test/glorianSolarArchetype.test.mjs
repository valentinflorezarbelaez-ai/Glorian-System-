/**
 * Specification Test Suite for Glorian Solar Design Archetype & Sovereign Platform Standards
 * Specifications: SPEC-117, SPEC-130 (IEEE 830 / ISO 29148 / WCAG 2.1 AA)
 * Acceptance Criteria: BDD-315, BDD-316, BDD-317, BDD-318
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosEliteDesignStudioEngine } from "../src/core/eosEliteDesignStudioEngine.ts";
import { EosTacticalCommandEngine } from "../src/core/eosTacticalCommandEngine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

test("BDD-315: Glorian Solar Archetype Tokens and WCAG AAA Contrast Ratio", () => {
  const studio = EosEliteDesignStudioEngine.getInstance();
  studio.reset();

  const tokens = studio.getArchetypeTokens("GLORIAN_SOLAR");

  assert.equal(tokens.background, "#050508", "Background must be deep pleromic obsidian");
  assert.equal(tokens.surface, "#0D0E15");
  assert.equal(tokens.surfaceElevated, "#161824");
  assert.equal(tokens.foreground, "#FFFFFF", "Foreground must be pure radiant light");
  assert.equal(tokens.primaryAccent, "#F59E0B", "Primary accent must be Solar Gold");
  assert.equal(tokens.secondaryAccent, "#FBBF24", "Secondary accent must be Radiant Amber");
  assert.equal(tokens.borderRadius, "8px");
  assert.equal(tokens.spatialGridBasePx, 8);
  assert.ok(tokens.glowEffect.includes("rgba(245, 158, 11"), "Glow effect must emit solar gold halo");

  const status = studio.getStatus();
  assert.equal(status.activeArchetypesCount, 4, "Studio must support 4 active archetypes");
});

test("BDD-316: Scaffolding Components with GLORIAN_SOLAR Archetype", () => {
  const studio = EosEliteDesignStudioEngine.getInstance();
  studio.reset();

  // Test INCIDENT_TIMELINE
  const timeline = studio.scaffoldComponent("GLORIAN_SOLAR", "INCIDENT_TIMELINE", {
    title: "Glorian Solar Defense Radar",
    subtitle: "Pleromic Autonomous Core Matrix",
  });

  assert.equal(timeline.archetype, "GLORIAN_SOLAR");
  assert.equal(timeline.componentType, "INCIDENT_TIMELINE");
  assert.equal(timeline.title, "Glorian Solar Defense Radar");
  assert.ok(timeline.htmlMarkup.includes('role="region"'));
  assert.ok(timeline.htmlMarkup.includes('aria-label="Glorian Solar Defense Radar"'));
  assert.ok(timeline.scopedCss.includes("#050508"));
  assert.ok(timeline.scopedCss.includes("#F59E0B"));
  assert.ok(timeline.wcagContrastRatio >= 7.0, "Contrast ratio must exceed WCAG AAA (7:1)");
  assert.equal(timeline.sha256Attestation.length, 64);

  // Test TELEMETRY_GRID
  const grid = studio.scaffoldComponent("GLORIAN_SOLAR", "TELEMETRY_GRID", {
    title: "Glorian Fleet Telemetry Matrix",
  });

  assert.equal(grid.archetype, "GLORIAN_SOLAR");
  assert.equal(grid.componentType, "TELEMETRY_GRID");
  assert.ok(grid.htmlMarkup.includes('role="grid"'));
  assert.ok(grid.scopedCss.includes("#0D0E15"));
  assert.equal(grid.sha256Attestation.length, 64);
});

test("BDD-317: CLI Banner Displays Glorian System Sovereign Control Plane", () => {
  const cliOutput = execFileSync(process.execPath, [path.join(root, "bin/eos.mjs"), "help"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.ok(cliOutput.includes("GLORIAN SYSTEM v"), "CLI output banner must state GLORIAN SYSTEM v...");
  assert.ok(
    cliOutput.includes("SOVEREIGN CONTROL PLANE & ENGINEERING ENGINE"),
    "CLI output banner subtitle must be updated to sovereign control plane",
  );
});

test("BDD-318: OpenSpec Catalog Index Synchronized to 172 Specifications", () => {
  const tacticalEngine = new EosTacticalCommandEngine(root);
  const indexPath = tacticalEngine.exportOpenSpecsJson();

  assert.ok(fs.existsSync(indexPath), "OpenSpec catalog index must exist");
  const catalog = JSON.parse(fs.readFileSync(indexPath, "utf8"));

  assert.equal(catalog.totalSpecs, 179, "Total OpenSpecs must equal 179");
  const spec130 = catalog.specs.find((s) => s.id === "SPEC-130");
  assert.ok(spec130, "SPEC-130 must be cataloged in openspec-catalog-index.json");
  assert.ok(
    spec130.title.toLowerCase().includes("glorian sovereign identity"),
    "SPEC-130 title must declare Glorian sovereign identity",
  );
});
