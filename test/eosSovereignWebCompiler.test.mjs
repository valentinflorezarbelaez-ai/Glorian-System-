/**
 * @file eosSovereignWebCompiler.test.mjs
 * @description Automated test suite for SPEC-343 / CHANGE-205 (BDD-1836..BDD-1842).
 * Verifies mathematical WCAG 2.1 AAA contrast calculation, SRI SHA-384 asset attestation,
 * Schema.org JSON-LD microdata generation, full web application compilation, fail-closed
 * breach handling, interactive accessible modules, and CLI command execution.
 *
 * Invariant: Pure Layer-0 testing, zero external runtime dependencies, hermetic receipts.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ARCHETYPE_PALETTES,
  computeContrastRatio,
  computeRelativeLuminance,
  computeSriDigest,
  EosSovereignWebCompilerCore,
  generateSeoGraph,
  parseHexColor,
  verifySriDigest,
  verifyWcagAaaCompliance,
  WebCompilerError,
} from "../src/core/eosSovereignWebCompiler.ts";
import { handleWebCompilerCommand } from "../bin/commands/cliWebCompiler.mjs";
import { createPhase8AgiHandlers } from "../src/mcp/tools/eosMcpPhase8AgiHandlers.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

test("SPEC-343 / BDD-1836: Mathematical WCAG 2.1 AAA Contrast Prover", () => {
  // Test hex parsing
  assert.deepEqual(parseHexColor("#ffffff"), [255, 255, 255]);
  assert.deepEqual(parseHexColor("#000"), [0, 0, 0]);
  assert.throws(() => parseHexColor("invalid"), /INVALID_HEX_COLOR/);

  // Test sRGB relative luminance
  const lumWhite = computeRelativeLuminance("#ffffff");
  const lumBlack = computeRelativeLuminance("#000000");
  assert.equal(Math.round(lumWhite), 1);
  assert.equal(Math.round(lumBlack), 0);

  // Contrast ratio of pure black on pure white is 21:1
  const crMax = computeContrastRatio("#000000", "#ffffff");
  assert.equal(crMax, 21);

  // Verify all 4 archetype palettes pass WCAG 2.1 AAA
  const archetypes = ["GLORIAN_SOLAR", "SPOTIFY_XIRP", "PALANTIR_FOUNDRY", "ANDURIL_LATTICE"];
  for (const arch of archetypes) {
    const palette = ARCHETYPE_PALETTES[arch];
    const report = verifyWcagAaaCompliance(palette);
    assert.equal(report.valid, true, `Archetype ${arch} must pass WCAG AAA proof`);
    assert.equal(report.breachCount, 0);
    assert.ok(report.minimumObservedRatio >= 3.0);
  }
});

test("SPEC-343 / BDD-1837: Subresource Integrity (SRI) SHA-384 Compilation", () => {
  const cssSample = "body { margin: 0; background: #000; }";
  const jsSample = "console.log('sovereign-execution');";

  const sriCss = computeSriDigest(cssSample);
  assert.equal(sriCss.algorithm, "sha384");
  assert.ok(sriCss.digest.startsWith("sha384-"));
  assert.equal(verifySriDigest(cssSample, sriCss.digest), true);

  const sriJs = computeSriDigest(jsSample);
  assert.equal(sriJs.algorithm, "sha384");
  assert.ok(sriJs.digest.startsWith("sha384-"));
  assert.equal(verifySriDigest(jsSample, sriJs.digest), true);

  // Verification fails on tampered content
  const tamperedJs = "console.log('tampered');";
  assert.equal(verifySriDigest(tamperedJs, sriJs.digest), false);
});

test("SPEC-343 / BDD-1838: Schema.org JSON-LD and SEO Meta Synthesis", () => {
  const config = {
    appName: "Sovereign Apex",
    tagline: "Ultra-High Frequency Autonomous Node",
    description: "Military-grade decentralized trading network.",
    domain: "apex.glorian.io",
    archetype: "GLORIAN_SOLAR",
    features: [{ title: "L0 Kernel", description: "Zero dependencies." }],
    pricingTiers: [
      {
        id: "pro",
        name: "Pro Trader",
        priceMonthly: 199,
        priceAnnual: 1990,
        currency: "$",
        description: "Direct node access.",
        features: ["Low latency", "Private cluster"],
        ctaText: "Subscribe",
        ctaHref: "#sub",
      },
    ],
    faqs: [
      {
        question: "What is the SLA?",
        answer: "99.999% availability guaranteed.",
      },
    ],
  };

  const seo = generateSeoGraph(config);
  assert.equal(seo.title, "Sovereign Apex — Ultra-High Frequency Autonomous Node");
  assert.equal(seo.canonicalUrl, "https://apex.glorian.io");

  // Validate JSON-LD @graph structure
  const graph = seo.jsonLd["@graph"];
  assert.ok(Array.isArray(graph));
  assert.ok(graph.some((e) => e["@type"] === "WebSite" && e.name === "Sovereign Apex"));
  assert.ok(graph.some((e) => e["@type"] === "Organization"));
  assert.ok(graph.some((e) => e["@type"] === "SoftwareApplication" && e.offers?.length === 1));
  assert.ok(graph.some((e) => e["@type"] === "FAQPage" && e.mainEntity?.length === 1));

  // Validate Meta Tags
  assert.ok(seo.metaTags.some((m) => m.name === "description" && m.content === config.description));
  assert.ok(seo.metaTags.some((m) => m.property === "og:title" && m.content === seo.title));
  assert.ok(seo.metaTags.some((m) => m.name === "twitter:card" && m.content === "summary_large_image"));
});

test("SPEC-343 / BDD-1839: Full Web Application Compilation and Archetype Scaffolding", () => {
  const config = {
    appName: "Nexus Sovereign",
    tagline: "Elite Quantitative Financial Community",
    description: "Mathematically proven institutional SaaS platform.",
    domain: "nexus.glorian.internal",
    archetype: "SPOTIFY_XIRP",
    features: [
      { title: "Pure Layer-0", description: "Deterministic binary execution." },
      { title: "BS.1770 Audio", description: "Accurate loudness monitoring." },
    ],
    metrics: [
      { label: "Throughput", value: "10M ops/s" },
      { label: "P99.99 Latency", value: "< 15µs" },
    ],
    pricingTiers: [
      {
        id: "free",
        name: "Explorer",
        priceMonthly: 0,
        priceAnnual: 0,
        currency: "$",
        description: "Community membership.",
        features: ["Forum access", "Weekly digest"],
        ctaText: "Join",
        ctaHref: "#free",
      },
    ],
    faqs: [
      {
        question: "Is there lock-in?",
        answer: "None. You own all keys and source code.",
      },
    ],
  };

  const compiled = EosSovereignWebCompilerCore.compileWebApp(config);

  assert.equal(compiled.wcagAaaCertified, true);
  assert.equal(compiled.archetype, "SPOTIFY_XIRP");
  assert.ok(compiled.html.includes("<!DOCTYPE html>"));
  assert.ok(compiled.html.includes("<title>Nexus Sovereign — Elite Quantitative Financial Community</title>"));
  assert.ok(compiled.html.includes('style integrity="sha384-'));
  assert.ok(compiled.html.includes('script integrity="sha384-'));
  assert.ok(compiled.html.includes("10M ops/s"));
  assert.ok(compiled.html.includes("Pure Layer-0"));

  // Check SRI hashes
  assert.ok(compiled.sriDigests["app.css"].startsWith("sha384-"));
  assert.ok(compiled.sriDigests["app.js"].startsWith("sha384-"));

  // Check PWA Web Manifest
  const manifest = JSON.parse(compiled.manifestJson);
  assert.equal(manifest.name, "Nexus Sovereign");
  assert.equal(manifest.display, "standalone");
});

test("SPEC-343 / BDD-1840: Fail-Closed Rejection on Contrast Breach", () => {
  const invalidConfig = {
    appName: "Breached App",
    tagline: "Low Contrast Violation",
    description: "Testing fail-closed rejection.",
    domain: "breach.example.com",
    archetype: "GLORIAN_SOLAR",
    theme: {
      dark: {
        background: "#000000",
        surface: "#111111",
        textPrimary: "#444444", // Very low contrast on black (~2.2:1 < 7.0:1)
        textSecondary: "#333333",
        accent: "#0000ff",
        accentText: "#111111",
        border: "#222222",
      },
    },
    features: [{ title: "Failing Feature", description: "Will not compile." }],
  };

  assert.throws(
    () => EosSovereignWebCompilerCore.compileWebApp(invalidConfig),
    (err) => {
      assert.ok(err instanceof WebCompilerError);
      assert.equal(err.code, "WCAG_CONTRAST_BREACH");
      assert.ok(err.message.includes("failed WCAG 2.1 AAA contrast proof"));
      return true;
    },
  );
});

test("SPEC-343 / BDD-1841: High-Converting Interactive Modules (Pricing & FAQs)", () => {
  const css = EosSovereignWebCompilerCore.generateStyles(ARCHETYPE_PALETTES.GLORIAN_SOLAR);
  assert.ok(css.includes("--bg:"));
  assert.ok(css.includes("--surface:"));
  assert.ok(css.includes(":focus-visible"));
  assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"));

  const script = EosSovereignWebCompilerCore.generateScript();
  assert.ok(script.includes("aria-expanded"));
  assert.ok(script.includes("aria-controls"));
  assert.ok(script.includes("theme-toggle"));
  assert.ok(script.includes("localStorage.setItem('eos-theme'"));
});

test("SPEC-343 / BDD-1842: Deterministic Invariant Audit Receipt Emission & CLI Execution", async () => {
  const tmpEvidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-web-compiler-"));
  const prevEvidence = process.env.EOS_EVIDENCE_DIR;
  process.env.EOS_EVIDENCE_DIR = tmpEvidenceDir;

  try {
    // 1. Audit receipt emission
    const receipt = EosSovereignWebCompilerCore.auditCompiler(ROOT);
    assert.equal(receipt.spec, "SPEC-343");
    assert.equal(receipt.totalArchetypesValidated, 4);
    assert.equal(receipt.wcagAaaComplianceScore, 1.0);
    assert.equal(receipt.sriVerificationPassed, true);
    assert.equal(receipt.seoCompletenessScore, 1.0);
    assert.equal(receipt.allPassed, true);
    assert.ok(receipt.sha256.length === 64);

    const receiptOnDisk = path.join(tmpEvidenceDir, "SOVEREIGN_WEB_COMPILER_RECEIPT.json");
    assert.equal(fs.existsSync(receiptOnDisk), true);

    // 2. CLI commands execution
    let capturedLog = "";
    const originalLog = console.log;
    console.log = (...msgs) => {
      capturedLog += msgs.join(" ") + "\n";
    };

    try {
      // CLI: toolchain:web:contrast
      capturedLog = "";
      await handleWebCompilerCommand({
        command: "toolchain:web:contrast",
        args: ["--fg=#ffffff", "--bg=#000000", "--json"],
      });
      const parsedContrast = JSON.parse(capturedLog);
      assert.equal(parsedContrast.contrastRatio, 21);
      assert.equal(parsedContrast.wcagAaaNormalText, true);

      // CLI: toolchain:web:sri
      capturedLog = "";
      await handleWebCompilerCommand({
        command: "toolchain:web:sri",
        args: ["--content=test-sri", "--json"],
      });
      const parsedSri = JSON.parse(capturedLog);
      assert.equal(parsedSri.algorithm, "sha384");
      assert.ok(parsedSri.digest.startsWith("sha384-"));

      // CLI: toolchain:web:seo
      capturedLog = "";
      await handleWebCompilerCommand({
        command: "toolchain:web:seo",
        args: ["--name=CliApp", "--domain=cli.internal", "--json"],
      });
      const parsedSeo = JSON.parse(capturedLog);
      assert.equal(parsedSeo.title, "CliApp — Autonomous Trading Ecosystem");

      // CLI: toolchain:web:audit
      capturedLog = "";
      await handleWebCompilerCommand({
        command: "toolchain:web:audit",
        args: ["--json"],
      });
      const parsedAudit = JSON.parse(capturedLog);
      assert.equal(parsedAudit.allPassed, true);

      // CLI: toolchain:web:compile
      capturedLog = "";
      await handleWebCompilerCommand({
        command: "toolchain:web:compile",
        args: ["--name=CliCompile", "--domain=clicompile.internal", "--archetype=PALANTIR_FOUNDRY", "--json"],
      });
      const parsedCompile = JSON.parse(capturedLog);
      assert.equal(parsedCompile.wcagAaaCertified, true);
      assert.equal(parsedCompile.archetype, "PALANTIR_FOUNDRY");

      // 3. MCP tool invocation
      const mcpHandlers = createPhase8AgiHandlers({ projectRoot: ROOT });
      assert.equal(typeof mcpHandlers.eos_web_compiler_audit, "function");
      const mcpAuditResult = await mcpHandlers.eos_web_compiler_audit({});
      assert.equal(mcpAuditResult.allPassed, true);
      assert.equal(mcpAuditResult.spec, "SPEC-343");
    } finally {
      console.log = originalLog;
    }
  } finally {
    if (prevEvidence) {
      process.env.EOS_EVIDENCE_DIR = prevEvidence;
    } else {
      delete process.env.EOS_EVIDENCE_DIR;
    }
    fs.rmSync(tmpEvidenceDir, { recursive: true, force: true });
  }
});
