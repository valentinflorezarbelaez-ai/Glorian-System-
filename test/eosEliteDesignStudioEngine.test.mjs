/**
 * Unit Test Suite for EosEliteDesignStudioEngine
 * Specification: SPEC-117 (IEEE 830 / ISO 29148 / WCAG 2.1 AA)
 * Standard: World-Class Industrial Design Engineering (Spotify, Palantir, Anduril)
 * Acceptance Criteria: BDD-310 to BDD-314
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosEliteDesignStudioEngine } from "../src/core/eosEliteDesignStudioEngine.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

test("BDD-310: Spotify XIRP Incident Timeline Scaffolding with Acoustic Aesthetic Tokens", () => {
  const studio = EosEliteDesignStudioEngine.getInstance();
  studio.reset();

  const res = studio.scaffoldComponent("SPOTIFY_XIRP", "INCIDENT_TIMELINE", {
    title: "XIRP Live Incident Radar",
    subtitle: "Acoustic SRE Incident Response Console"
  });

  assert.equal(res.archetype, "SPOTIFY_XIRP");
  assert.equal(res.componentType, "INCIDENT_TIMELINE");
  assert.equal(res.title, "XIRP Live Incident Radar");
  assert.equal(res.tokens.background, "#121212");
  assert.equal(res.tokens.primaryAccent, "#1DB954");
  assert.ok(res.scopedCss.includes("#1DB954"));
  assert.ok(res.htmlMarkup.includes("role=\"region\""));
  assert.ok(res.htmlMarkup.includes("aria-label=\"XIRP Live Incident Radar\""));
  assert.ok(res.wcagContrastRatio >= 7.0, "Contrast ratio must exceed WCAG AAA (7:1)");
  assert.equal(res.sha256Attestation.length, 64);

  const status = studio.getStatus();
  assert.equal(status.totalGenerations, 1);
  assert.equal(status.lastArchetypeGenerated, "SPOTIFY_XIRP");
  assert.equal(status.state, "CONFORMANT");
});

test("BDD-311: Palantir Foundry Telemetry Grid Scaffolding with High-Density Tokens", () => {
  const studio = EosEliteDesignStudioEngine.getInstance();
  studio.reset();

  const res = studio.scaffoldComponent("PALANTIR_FOUNDRY", "TELEMETRY_GRID", {
    title: "Foundry Ontology Shard Matrix"
  });

  assert.equal(res.archetype, "PALANTIR_FOUNDRY");
  assert.equal(res.componentType, "TELEMETRY_GRID");
  assert.equal(res.tokens.background, "#0B0F19");
  assert.equal(res.tokens.primaryAccent, "#06B6D4");
  assert.equal(res.tokens.secondaryAccent, "#F59E0B");
  assert.ok(res.htmlMarkup.includes("role=\"grid\""));
  assert.ok(res.scopedCss.includes("grid-template-columns"));
  assert.ok(res.wcagContrastRatio >= 7.0);
  assert.equal(res.sha256Attestation.length, 64);
});

test("BDD-312: Anduril Lattice Tactical HUD Scaffolding with Radar Emerald Accents", () => {
  const studio = EosEliteDesignStudioEngine.getInstance();
  studio.reset();

  const res = studio.scaffoldComponent("ANDURIL_LATTICE", "TACTICAL_HUD", {
    title: "Lattice Edge Defense HUD"
  });

  assert.equal(res.archetype, "ANDURIL_LATTICE");
  assert.equal(res.componentType, "TACTICAL_HUD");
  assert.equal(res.tokens.background, "#08090A");
  assert.equal(res.tokens.primaryAccent, "#10B981");
  assert.equal(res.tokens.secondaryAccent, "#EF4444");
  assert.equal(res.tokens.spatialGridBasePx, 8);
  assert.equal(res.sha256Attestation.length, 64);
});

test("BDD-313: Automated Design Markup & Contrast Invariants Audit", () => {
  const studio = EosEliteDesignStudioEngine.getInstance();
  studio.reset();

  const sampleMarkup = `
<section class="eos-hud" role="region" aria-label="Telemetry HUD">
  <div style="padding: 16px; margin: 24px; gap: 8px;">
    <h3>Fleet Telemetry</h3>
  </div>
  <style>
    @media (prefers-reduced-motion: reduce) {
      .eos-hud * { animation: none !important; }
    }
  </style>
</section>`;

  const audit = studio.auditDesignMarkup(sampleMarkup);

  assert.equal(audit.conformant, true);
  assert.ok(audit.contrastRatio >= 4.5);
  assert.equal(audit.wcagLevel, "AAA");
  assert.equal(audit.spatialGridCompliant, true);
  assert.equal(audit.semanticAriaValid, true);
  assert.equal(audit.motionReducedCompliant, true);
  assert.ok(audit.findings.length >= 3);
  assert.equal(audit.sha256Attestation.length, 64);

  const status = studio.getStatus();
  assert.equal(status.totalAudits, 1);
});

test("BDD-314: EosMcpServer Integration for Scaffold and Audit Tools", async () => {
  const server = new EosMcpServer(process.cwd());

  // Test scaffold tool
  const scaffoldReq = {
    jsonrpc: "2.0",
    id: "test-design-1",
    method: "tools/call",
    params: {
      name: "eos_design_scaffold_component",
      arguments: {
        archetype: "SPOTIFY_XIRP",
        componentType: "INCIDENT_TIMELINE",
        title: "Live SRE Acoustic Stream"
      }
    }
  };

  const scaffoldRes = await server.handleRequest(scaffoldReq);
  assert.equal(scaffoldRes.error, undefined);
  assert.ok(scaffoldRes.result);
  const scaffoldData = JSON.parse(scaffoldRes.result.content[0].text);
  assert.equal(scaffoldData.archetype, "SPOTIFY_XIRP");
  assert.equal(scaffoldData.title, "Live SRE Acoustic Stream");
  assert.ok(scaffoldData.htmlMarkup.includes("Live SRE Acoustic Stream"));
  assert.ok(scaffoldData.scopedCss.includes("#1DB954"));
  assert.equal(scaffoldData.sha256Attestation.length, 64);

  // Test audit tool
  const auditReq = {
    jsonrpc: "2.0",
    id: "test-design-2",
    method: "tools/call",
    params: {
      name: "eos_design_audit_markup",
      arguments: {
        markup: scaffoldData.htmlMarkup + "<style>" + scaffoldData.scopedCss + "</style>"
      }
    }
  };

  const auditRes = await server.handleRequest(auditReq);
  assert.equal(auditRes.error, undefined);
  assert.ok(auditRes.result);
  const auditData = JSON.parse(auditRes.result.content[0].text);
  assert.equal(auditData.conformant, true);
  assert.equal(auditData.wcagLevel, "AAA");
  assert.equal(auditData.sha256Attestation.length, 64);
});
