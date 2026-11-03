/**
 * Specification Test Suite for SPEC-136: Glorian Sovereign Fleet Radar & Constitutional Cockpit
 * Acceptance Criteria: BDD-359, BDD-360, BDD-361
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

test("BDD-359: Live Fleet Radar Renders All 9 Registered Projects", () => {
  const htmlPath = path.join(root, "src/ui/eosStudioConsole.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  assert.match(html, /<title>Glorian System — Sovereign Studio Console<\/title>/i);
  assert.match(html, /<h1>GLORIAN SYSTEM \/\/ MATRIX/i);

  // Read registered projects from docs/projects/registry.json
  const registry = JSON.parse(fs.readFileSync(path.join(root, "docs/projects/registry.json"), "utf8"));
  const expectedProjects = registry.projects.map((p) => p.id);

  assert.equal(expectedProjects.length, 9);
  for (const projId of expectedProjects) {
    assert.ok(html.includes(projId), `eosStudioConsole.html must include project '${projId}'`);
  }
});

test("BDD-360: Constitutional Tribunal Interactive Simulator", () => {
  const htmlPath = path.join(root, "src/ui/eosStudioConsole.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  assert.ok(html.includes("CONSTITUTIONAL TRIBUNAL"), "Must contain Constitutional Tribunal section");
  assert.ok(html.includes("CONSTITUTIONAL_JUDGE"), "Must contain Constitutional Judge definition");
  assert.ok(html.includes("SECURITY_JUDGE"), "Must contain Security Judge definition");
  assert.ok(html.includes("ARCHITECTURAL_JUDGE"), "Must contain Architectural Judge definition");
  assert.ok(html.includes("SOVEREIGN_TRIBUNAL_APPROVED"), "Must support approved verdict state");
  assert.ok(html.includes("TRIBUNAL_VETOED"), "Must support vetoed verdict state");
});

test("BDD-361: Layer-0 Purity and Glorian Solar Tokens Conformance", () => {
  const htmlPath = path.join(root, "src/ui/eosStudioConsole.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  // Zero external CDNs or trackers
  assert.ok(!html.includes("https://cdn."), "Must have 0 external CDN links");
  assert.ok(!html.includes("https://cdnjs."), "Must have 0 external CDN links");
  assert.ok(!html.includes("https://unpkg.com"), "Must have 0 external CDN links");

  // Glorian Solar Tokens
  assert.ok(html.includes("#050508") || html.includes("--bg-pure"), "Must use Glorian dark background");
  assert.ok(html.includes("#f59e0b") || html.includes("--accent-majestic"), "Must use Glorian Solar majestic amber");
  assert.ok(html.includes("#fbbf24") || html.includes("--accent-gold-bright"), "Must use Glorian Solar bright gold");
});
