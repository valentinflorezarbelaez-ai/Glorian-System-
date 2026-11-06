import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

import {
  EosFleetProductionVerifier,
  REGISTERED_FLEET_TARGETS
} from "../src/core/eosFleetProductionVerifier.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-197: Target URL validation and SSRF blocking (private IPs, loopbacks, metadata)", () => {
  // Valid HTTPS production target
  const validUrl = EosFleetProductionVerifier.normalizeTargetUrl("https://portafolio-valentin.vercel.app/");
  assert.equal(validUrl.protocol, "https:");
  assert.equal(validUrl.hostname, "portafolio-valentin.vercel.app");

  // HTTP protocol disallowed
  assert.throws(
    () => EosFleetProductionVerifier.normalizeTargetUrl("http://portafolio-valentin.vercel.app/"),
    /SSRF_TARGET_PROHIBITED: Only HTTPS targets are allowed/
  );

  // Localhost blocked
  assert.throws(
    () => EosFleetProductionVerifier.normalizeTargetUrl("https://localhost:3000/"),
    /SSRF_TARGET_PROHIBITED: Target hostname 'localhost' references local loopback/
  );

  // Loopback 127.0.0.1 blocked
  assert.throws(
    () => EosFleetProductionVerifier.normalizeTargetUrl("https://127.0.0.1:8080/"),
    /SSRF_TARGET_PROHIBITED/
  );

  // Cloud metadata 169.254.169.254 blocked
  assert.throws(
    () => EosFleetProductionVerifier.normalizeTargetUrl("https://169.254.169.254/latest/meta-data"),
    /SSRF_TARGET_PROHIBITED: Target hostname '169.254.169.254' is a link-local cloud metadata service/
  );

  // Private IPv4 10.0.0.1 and 192.168.1.1 blocked
  assert.throws(
    () => EosFleetProductionVerifier.normalizeTargetUrl("https://10.0.0.5/api"),
    /SSRF_TARGET_PROHIBITED: Target hostname '10.0.0.5' is a private IPv4 address/
  );
  assert.throws(
    () => EosFleetProductionVerifier.normalizeTargetUrl("https://192.168.1.100/admin"),
    /SSRF_TARGET_PROHIBITED: Target hostname '192.168.1.100' is a private IPv4 address/
  );
});

test("BDD-198: Probe execution captures HTTP status, TTFB, and payload metrics", async () => {
  const mockHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Valentin Florez — Portfolio</title>
  <link rel="icon" href="/favicon.ico">
</head>
<body>
  <header role="banner"><h1>Valentin Florez</h1></header>
  <main role="main"><p>Ingeniero de Software</p></main>
  <footer role="contentinfo"><p>2026</p></footer>
</body>
</html>`;

  const probe = await EosFleetProductionVerifier.probeTarget("https://portafolio-valentin.vercel.app/", {
    mockTransport: async () => ({
      statusCode: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "referrer-policy": "strict-origin-when-cross-origin",
        "content-security-policy": "default-src 'self'"
      },
      body: mockHtml,
      durationMs: 120,
      ttfbMs: 65
    })
  });

  assert.equal(probe.httpStatus, 200);
  assert.equal(probe.ok, true);
  assert.equal(probe.durationMs, 120);
  assert.equal(probe.ttfbMs, 65);
  assert.ok(probe.payloadBytes > 0);
  assert.ok(probe.sha256Attestation.length === 64);
});

test("BDD-199: Security header audit verifies HSTS, nosniff, and framing guards", () => {
  const completeHeaders = {
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "content-security-policy": "frame-ancestors 'none'"
  };

  const audit = EosFleetProductionVerifier.auditSecurityHeaders(completeHeaders);
  assert.equal(audit.strictTransportSecurity, true);
  assert.equal(audit.xContentTypeOptions, true);
  assert.equal(audit.xFrameOptions, true);
  assert.equal(audit.referrerPolicy, true);
  assert.equal(audit.contentSecurityPolicy, true);
  assert.equal(audit.passedCount, 5);

  const missingHeaders = {
    "server": "Vercel"
  };
  const poorAudit = EosFleetProductionVerifier.auditSecurityHeaders(missingHeaders);
  assert.equal(poorAudit.strictTransportSecurity, false);
  assert.equal(poorAudit.xContentTypeOptions, false);
  assert.equal(poorAudit.passedCount, 0);
});

test("BDD-200: HTML semantic landmarks audit verifies WCAG 2.1 AA structural tokens", () => {
  const validHtml = `
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body>
        <header>Header</header>
        <nav>Nav</nav>
        <main><h1>Title</h1></main>
        <footer>Footer</footer>
      </body>
    </html>
  `;
  const report = EosFleetProductionVerifier.auditSemanticLandmarks(validHtml);
  assert.equal(report.hasMain, true);
  assert.equal(report.hasHeader, true);
  assert.equal(report.hasFooter, true);
  assert.equal(report.hasNav, true);
  assert.equal(report.hasH1, true);
  assert.equal(report.hasResponsiveViewport, true);
  assert.equal(report.passedCount, 6);

  const brokenHtml = "<div>Unsemantic text only</div>";
  const brokenReport = EosFleetProductionVerifier.auditSemanticLandmarks(brokenHtml);
  assert.equal(brokenReport.hasMain, false);
  assert.equal(brokenReport.hasHeader, false);
  assert.equal(brokenReport.passedCount, 0);
});

test("BDD-201: Synthetic Core Web Vitals and SEO metadata evaluation", () => {
  const htmlWithSeo = `
    <html>
      <head>
        <title>PTG — Performance Talent Group</title>
        <meta property="og:title" content="PTG" />
        <meta property="og:description" content="Talent Group" />
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body></body>
    </html>
  `;
  const seo = EosFleetProductionVerifier.auditSeoMetadata(htmlWithSeo);
  assert.equal(seo.title, "PTG — Performance Talent Group");
  assert.equal(seo.hasOgTitle, true);
  assert.equal(seo.hasOgDescription, true);
  assert.equal(seo.hasFavicon, true);

  const score = EosFleetProductionVerifier.calculateHealthScore(
    200,
    150,
    70,
    50000,
    { passedCount: 5, totalCount: 5, strictTransportSecurity: true, xContentTypeOptions: true, xFrameOptions: true, referrerPolicy: true, contentSecurityPolicy: true },
    { passedCount: 6, totalCount: 6, hasMain: true, hasHeader: true, hasFooter: true, hasNav: true, hasH1: true, hasResponsiveViewport: true }
  );
  assert.ok(score >= 95, `Expected score >= 95, got ${score}`);
});

test("BDD-202: MCP tool eos_fleet_verify dispatches audit and records receipt in SQLite WAL", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-fleet-verify-test-"));
  const dbPath = path.join(tmpDir, "fleet_test.sqlite");

  try {
    const server = new EosMcpServer(projectRoot, "core");
    const mcpRes = server.handleRequest({
      jsonrpc: "2.0",
      id: 101,
      method: "tools/call",
      params: {
        name: "eos_fleet_verify",
        arguments: {
          target: "https://portafolio-valentin.vercel.app/",
          recordToLedger: true
        }
      }
    });

    assert.ok(mcpRes.result);
    const text = mcpRes.result.content[0].text;
    const data = JSON.parse(text);
    assert.equal(data.status, "PRODUCTION_READY_WITHIN_TESTED_SCOPE");
    assert.equal(data.auditedTarget, "https://portafolio-valentin.vercel.app/");
    assert.ok(data.score >= 80);
    assert.equal(data.securityHeadersVerified, true);
    assert.equal(data.semanticLandmarksVerified, true);
    assert.ok(data.sha256Receipt.length === 64);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
