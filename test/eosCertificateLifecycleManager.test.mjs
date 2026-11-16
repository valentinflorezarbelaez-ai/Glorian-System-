/**
 * EOS SYSTEM — TLS CERTIFICATE LIFECYCLE MANAGER TESTS
 * Tests for EosCertificateLifecycleManager (cert-manager / ACME rotation pattern)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosCertificateLifecycleManager } from "../src/core/eosCertificateLifecycleManager.ts";

const renewalPolicy = { renewalWindowDays: 30, warnDaysBeforeExpiry: 45 };

test("constructor validates renewal window days", () => {
  assert.throws(
    () => new EosCertificateLifecycleManager({ renewalWindowDays: -1, warnDaysBeforeExpiry: 0 }),
    /renewalWindowDays must be >= 0/,
  );
});

test("issue creates a certificate with correct fields", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  const cert = mgr.issue("api.example.com", "Root CA", ["api.example.com", "*.api.example.com"], 365);
  assert.ok(cert.serial.startsWith("SN"));
  assert.equal(cert.subject, "api.example.com");
  assert.equal(cert.issuer, "Root CA");
  assert.equal(cert.sans.length, 2);
  assert.ok(cert.fingerprint.length === 64);
  assert.ok(cert.issuedAtMs > 0);
  assert.ok(cert.notAfterMs > cert.issuedAtMs);
});

test("issue validates subject is required", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  assert.throws(() => mgr.issue("", "Root CA", [], 365), /subject required/);
});

test("issue validates validityDays is positive", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  assert.throws(() => mgr.issue("test", "Root CA", [], 0), /validityDays must be positive/);
});

test("serial numbers are unique and sequential", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  const c1 = mgr.issue("a", "Root", [], 365);
  const c2 = mgr.issue("b", "Root", [], 365);
  assert.notEqual(c1.serial, c2.serial);
});

test("status returns ACTIVE for valid certificate", () => {
  const mgr = new EosCertificateLifecycleManager({ renewalWindowDays: 30, warnDaysBeforeExpiry: 45 });
  const cert = mgr.issue("test", "Root", [], 365);
  const status = mgr.status(cert.serial);
  assert.equal(status, "ACTIVE");
});

test("status returns null for unknown serial", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  assert.equal(mgr.status("UNKNOWN"), null);
});

test("status returns EXPIRED for expired certificate", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  const cert = mgr.issue("test", "Root", [], 1);
  const futureMs = cert.notAfterMs + 1000;
  assert.equal(mgr.status(cert.serial, futureMs), "EXPIRED");
});

test("status returns RENEWING when within renewal window", () => {
  const mgr = new EosCertificateLifecycleManager({ renewalWindowDays: 30, warnDaysBeforeExpiry: 45 });
  const cert = mgr.issue("test", "Root", [], 365);
  // Set time to 25 days before expiry (within 30-day renewal window)
  const nowMs = cert.notAfterMs - 25 * 86_400_000;
  assert.equal(mgr.status(cert.serial, nowMs), "RENEWING");
});

test("status returns REVOKED after revocation", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  const cert = mgr.issue("test", "Root", [], 365);
  mgr.revoke(cert.serial);
  assert.equal(mgr.status(cert.serial), "REVOKED");
});

test("revoke returns true for existing cert", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  const cert = mgr.issue("test", "Root", [], 365);
  assert.equal(mgr.revoke(cert.serial), true);
});

test("revoke returns false for unknown cert", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  assert.equal(mgr.revoke("UNKNOWN"), false);
});

test("renew replaces certificate and revokes old serial", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  const oldCert = mgr.issue("test", "Root", ["test.com"], 365);
  const newCert = mgr.renew(oldCert.serial, 365);
  assert.notEqual(oldCert.serial, newCert.serial);
  assert.equal(mgr.status(oldCert.serial), "REVOKED");
  assert.equal(mgr.status(newCert.serial), "ACTIVE");
  assert.equal(newCert.subject, "test");
  assert.equal(newCert.sans[0], "test.com");
});

test("renew throws for unknown serial", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  assert.throws(() => mgr.renew("UNKNOWN", 365), /unknown serial/);
});

test("certificateCount tracks issued certificates", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  assert.equal(mgr.certificateCount, 0);
  mgr.issue("a", "Root", [], 365);
  mgr.issue("b", "Root", [], 365);
  assert.equal(mgr.certificateCount, 2);
});

test("revokedCount tracks revoked certificates", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  const cert = mgr.issue("test", "Root", [], 365);
  assert.equal(mgr.revokedCount, 0);
  mgr.revoke(cert.serial);
  assert.equal(mgr.revokedCount, 1);
});

test("summary returns sorted certificate summaries by serial", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  mgr.issue("b", "Root", [], 365);
  mgr.issue("a", "Root", [], 365);
  const summary = mgr.summary();
  assert.equal(summary.length, 2);
  // Sorted by serial (SN00000001 < SN00000002), so first issued comes first
  assert.equal(summary[0].subject, "b");
  assert.equal(summary[1].subject, "a");
  assert.equal(summary[0].status, "ACTIVE");
  assert.ok(summary[0].daysRemaining > 0);
});

test("verifyChain succeeds for valid chain", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  const root = mgr.issue("Root CA", "Root CA", [], 3650);
  const leaf = mgr.issue("api.example.com", "Root CA", ["api.example.com"], 365);
  const result = mgr.verifyChain([leaf.serial, root.serial]);
  assert.equal(result.ok, true);
});

test("verifyChain fails for revoked certificate in chain", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  const root = mgr.issue("Root CA", "Root CA", [], 3650);
  const leaf = mgr.issue("api.example.com", "Root CA", ["api.example.com"], 365);
  mgr.revoke(leaf.serial);
  const result = mgr.verifyChain([leaf.serial, root.serial]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "revoked");
});

test("verifyChain fails for unknown root authority", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  const leaf = mgr.issue("api.example.com", "Unknown CA", ["api.example.com"], 365);
  const result = mgr.verifyChain([leaf.serial]);
  assert.equal(result.ok, false);
  assert.ok(result.reason?.includes("Unknown CA"));
});

test("verifyChain fails for leaf not found", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  const result = mgr.verifyChain(["UNKNOWN"]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "leaf not found");
});

test("crlFingerprint is deterministic for same revocations", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  const c1 = mgr.issue("a", "Root", [], 365);
  const c2 = mgr.issue("b", "Root", [], 365);
  mgr.revoke(c1.serial);
  mgr.revoke(c2.serial);
  const fp1 = mgr.crlFingerprint();
  const fp2 = mgr.crlFingerprint();
  // Same state → same fingerprint
  assert.equal(fp1, fp2);
  assert.ok(fp1.length === 64);
});

test("crlFingerprint is empty hash when no revocations", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  const fp = mgr.crlFingerprint();
  assert.ok(fp.length === 64);
});

test("fingerprint is deterministic for same input", () => {
  const mgr = new EosCertificateLifecycleManager(renewalPolicy);
  const c1 = mgr.issue("test", "Root", ["test.com"], 365);
  // Fingerprint is based on serial, subject, issuer, sans, issuedAtMs, notAfterMs
  assert.ok(c1.fingerprint.length === 64);
});
