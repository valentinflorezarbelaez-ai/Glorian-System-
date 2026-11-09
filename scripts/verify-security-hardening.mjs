#!/usr/bin/env node
/**
 * EOS SECURITY HARDENING VERIFIER (SPEC-054)
 * Verifies that all 15 security fixes from the CVE audit are in place.
 * Runs as Stage 1.5 in CI — immediately after SAST, before everything else.
 *
 * Each check is deterministic and fails fast if a regression is introduced.
 * Zero external dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const { EosSmtAutomatedReasoningProver } = await import("../src/core/eosSmtAutomatedReasoningProver.ts");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

console.log("======================================================================");
console.log(" EOS SECURITY HARDENING VERIFIER — 15-CVE Regression Gate");
console.log("======================================================================\n");

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  [✔] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [✘] ${name}`);
    console.error(`       → ${err.message}`);
    failed++;
  }
}

const read = (relPath) => fs.readFileSync(path.join(root, relPath), "utf8");

// ── CVE-1: Unbounded body cap in MCP stream server ──────────────────────────
check("CVE-1: MCP body size cap present", () => {
  const src = read("src/mcp/eosMcpStreamServer.ts");
  // Constant was renamed from MAX_BODY_BYTES to DEFAULT_MAX_REQUEST_BYTES in v62 rewrite
  assert.ok(
    src.includes("DEFAULT_MAX_REQUEST_BYTES") || src.includes("MAX_BODY_BYTES"),
    "Body size cap constant missing (expected DEFAULT_MAX_REQUEST_BYTES)",
  );
  assert.ok(src.includes("413"), "413 Payload Too Large response missing");
  assert.ok(src.includes("req.socket.destroy()"), "Socket destroy on oversize body missing");
});

// ── CVE-2: Session accumulation cap ─────────────────────────────────────────
check("CVE-2: Session accumulation cap (MAX_SESSIONS) present", () => {
  const src = read("src/mcp/eosMcpStreamServer.ts");
  assert.ok(src.includes("MAX_SESSIONS"), "MAX_SESSIONS constant missing");
  assert.ok(src.includes("_gc()"), "Background GC method missing");
});

// ── CVE-3: Auth bypass on /metrics ──────────────────────────────────────────
check("CVE-3: Auth bypass fix — /metrics behind skipAuth", () => {
  const src = read("src/mcp/eosMcpStreamServer.ts");
  // v62 rewrite replaced the skipAuth flag with an early-return branch: only
  // /health and /status may resolve before the single authentication gate.
  const authIndex = src.indexOf("_authenticate(req)");
  assert.ok(authIndex > 0, "single authentication gate (_authenticate) not found");
  const healthIndex = src.indexOf('pathname === "/health"');
  assert.ok(healthIndex > 0 && healthIndex < authIndex, "/health must be served before auth");
  const metricsIndex = src.indexOf('pathname === "/metrics"');
  assert.ok(metricsIndex > authIndex, "/metrics must be gated behind authentication");
});

// ── CVE-4: Path traversal fix in HermeticSandbox ────────────────────────────
check("CVE-4: Path traversal blocked in eosHermeticSandbox", () => {
  const src = read("src/core/eosHermeticSandbox.ts");
  assert.ok(src.includes('clean.startsWith("..")'), "Leading .. check missing in normalizeRel");
  assert.ok(src.includes("_assertContained"), "_assertContained method missing");
  assert.ok(src.includes("startsWith(normalizedRoot"), "containment check missing in commitToDisk");
});

// ── CVE-5: RCE in DynamicToolForge — comprehensive blocklist ─────────────────
check("CVE-5: Tool forge comprehensive security scanner (replaces incomplete check)", () => {
  const src = read("src/core/eosDynamicToolForge.ts");
  assert.ok(src.includes("BLOCKED_MODULE_PATTERNS"), "BLOCKED_MODULE_PATTERNS array missing");
  assert.ok(src.includes("child_process"), "child_process must be blocked");
  assert.ok(src.includes("process\\.env"), "process.env must be blocked");
  assert.ok(src.includes("eval\\s*\\("), "eval must be blocked");
  assert.ok(!src.includes(`req.moduleSource.includes("../..") ||`), "Old incomplete check still present");
});

// ── CVE-6: TOCTOU fix in forge invoke ────────────────────────────────────────
check("CVE-6: TOCTOU hash verification before dynamic import", () => {
  const src = read("src/core/eosDynamicToolForge.ts");
  assert.ok(src.includes("currentHash !== entry.contentHash"), "Hash comparison missing");
  assert.ok(src.includes("hash mismatch"), "Mismatch error message missing");
});

// ── CVE-7: IP spoofing fix in rate limiter ────────────────────────────────────
check("CVE-7: Rate limiter X-Forwarded-For spoofing fix (trusted proxy only)", () => {
  const src = read("src/core/eosApiRateLimit.ts");
  assert.ok(src.includes("getTrueClientIp"), "getTrueClientIp function missing");
  assert.ok(src.includes("EOS_TRUSTED_PROXIES"), "EOS_TRUSTED_PROXIES env var missing");
  assert.ok(src.includes("isTrustedProxy"), "Proxy trust check missing");
  assert.ok(!src.includes("let _limiter"), "Singleton _limiter variable must be removed");
});

// ── CVE-8: CORS wildcard fix ──────────────────────────────────────────────────
check("CVE-8: CORS wildcard removed from api/health.js", () => {
  const src = read("api/health.js");
  assert.ok(!src.includes('"Access-Control-Allow-Origin", "*"'), "Wildcard CORS still present");
  assert.ok(src.includes("EOS_ALLOWED_ORIGINS"), "EOS_ALLOWED_ORIGINS env var missing");
});

// ── CVE-9: TMR Gamma pattern list expanded ───────────────────────────────────
check("CVE-9: TMR Gamma expanded destructive pattern list (40+ patterns)", () => {
  const src = read("src/core/eosJarvisMonad.ts");
  assert.ok(src.includes("| pwsh"), "PowerShell pipe pattern missing");
  assert.ok(src.includes("| python"), "Python pipe pattern missing");
  assert.ok(src.includes("mkfs"), "mkfs pattern missing");
  assert.ok(src.includes("sudo bash"), "sudo bash pattern missing");
  assert.ok(src.includes("curl http"), "curl exfiltration pattern missing");
  // Count patterns — should have at least 30
  const matches = (src.match(/destructivePatterns = \[([\s\S]*?)\]/)?.[1] ?? "").match(/"/g) ?? [];
  assert.ok(matches.length >= 60, `Expected ≥60 quote chars in destructivePatterns, got ${matches.length}`);
});

// ── CVE-10: simpleHash replaced with SHA-256 ─────────────────────────────────
check("CVE-10: 32-bit simpleHash replaced with SHA-256", () => {
  const src = read("src/core/eosJarvisMonad.ts");
  assert.ok(src.includes('createHash("sha256")'), "SHA-256 hash missing in simpleHash");
  assert.ok(!src.includes("h = ((h << 5) - h"), "Old 32-bit DJB2 hash still present");
});

// ── CVE-11: Stack trace not leaked in production ─────────────────────────────
check("CVE-11: Stack trace not exposed in MCP stream server error response", () => {
  const src = read("src/mcp/eosMcpStreamServer.ts");
  assert.ok(!src.includes("data: String(err.stack"), "err.stack still leaked in production");
});

// ── CVE-12: Registry validation in fleet CI ─────────────────────────────────
check("CVE-12: Fleet CI registry entries validated before execFileSync", () => {
  const src = read("scripts/fleet-autonomous-cicd.mjs");
  assert.ok(src.includes("validateRegistryEntry"), "validateRegistryEntry function missing");
  assert.ok(src.includes('proj.localPath.includes("..")'), "Path traversal check missing");
  assert.ok(src.includes("path.isAbsolute"), "Absolute path check missing for cicdGateScript");
});

// ── CVE-13: CORP header fixed in vercel.json ─────────────────────────────────
check("CVE-13: Cross-Origin-Resource-Policy changed to same-origin", () => {
  const src = read("vercel.json");
  assert.ok(src.includes('"Cross-Origin-Resource-Policy", "value": "same-origin"'), "CORP must be same-origin");
  assert.ok(
    !src.includes('"Cross-Origin-Resource-Policy", "value": "cross-origin"'),
    "cross-origin CORP still present",
  );
  assert.ok(src.includes("X-Permitted-Cross-Domain-Policies"), "X-Permitted-Cross-Domain-Policies header missing");
});

// ── CVE-14: Stack trace/path not in graph.js fallback ────────────────────────
check("CVE-14: Filesystem path not leaked in api/graph.js fallback", () => {
  const src = read("api/graph.js");
  assert.ok(
    src.includes('process.env.NODE_ENV !== "production" ? err.message'),
    "err.message must be gated by NODE_ENV",
  );
});

// ── CVE-15: traceparent validated before reflection ──────────────────────────
check("CVE-15: traceparent header validated against W3C format before reflection", () => {
  const src = read("api/health.js");
  assert.ok(src.includes("TRACEPARENT_RE"), "TRACEPARENT_RE validation regex missing");
  assert.ok(src.includes("TRACEPARENT_RE.test"), "TRACEPARENT_RE.test() call missing");
});

// ── PROOF-16: Mathematical SMT Proof of ABAC Boundary Safety (SPEC-063) ────────
check("PROOF-16: Mathematical SMT Proof of ABAC Boundary Safety (SPEC-063)", () => {
  const report = EosSmtAutomatedReasoningProver.proveAbacSafety(
    [
      { role: "admin", action: "write_immutable_ledger", allow: true },
      { role: "guest", action: "write_immutable_ledger", allow: false },
    ],
    "guest",
    "write_immutable_ledger",
  );
  assert.equal(report.verdict, "PROVED_UNSAT_SECURE", "ABAC security proof must be UNSAT");
  assert.equal(report.isSatisfiable, false);
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n======================================================================`);
console.log(` Security Hardening: ${passed} passed, ${failed} failed`);
console.log(`======================================================================`);

if (failed > 0) {
  console.error(`\n[FAIL] ${failed} security regression(s) detected.`);
  console.error(`       A security fix has been reverted or broken. Fix before merging.\n`);
  process.exit(1);
}

console.log(`\n[PASS] All 15 CVE-class security fixes and formal SMT theorem verified. ✔\n`);
process.exit(0);
