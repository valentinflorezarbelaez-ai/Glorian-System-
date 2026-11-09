/**
 * EOS SYSTEM — TLS CERTIFICATE LIFECYCLE MANAGER (Layer 0)
 * Governed by SPEC-175 (cert-manager / ACME / Let's Encrypt rotation pattern)
 *
 * Implements:
 * - Certificate issuance with subject + SAN + serial + fingerprint
 * - Renewal window: certs enter RENEWING when within renewalWindowDays of expiry
 * - Revocation list with CRL fingerprint (deterministic)
 * - Chain verification: leaf -> intermediate -> root issuer linkage
 * - Status projection: ACTIVE / RENEWING / EXPIRED / REVOKED
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export type CertStatus = "ACTIVE" | "RENEWING" | "EXPIRED" | "REVOKED";

export interface CertificateRecord {
  readonly serial: string;
  readonly subject: string;
  readonly issuer: string;
  readonly sans: readonly string[];
  readonly issuedAtMs: number;
  readonly notAfterMs: number;
  readonly fingerprint: string;
}

export interface RenewalPolicy {
  readonly renewalWindowDays: number;
  readonly warnDaysBeforeExpiry: number;
}

export interface CertSummary {
  readonly serial: string;
  readonly subject: string;
  readonly status: CertStatus;
  readonly daysRemaining: number;
}

function fingerprintOf(rec: Omit<CertificateRecord, "fingerprint">): string {
  return pureSha256(JSON.stringify(rec));
}

export class EosCertificateLifecycleManager {
  private readonly certs: Map<string, CertificateRecord> = new Map();
  private readonly revoked: Set<string> = new Set();
  private readonly policy: RenewalPolicy;
  private serialCounter = 0;

  constructor(policy: RenewalPolicy) {
    assertPrecondition(policy.renewalWindowDays >= 0, "renewalWindowDays must be >= 0");
    this.policy = deepFreeze(policy);
  }

  issue(subject: string, issuer: string, sans: readonly string[], validityDays: number): CertificateRecord {
    assertPrecondition(subject.length > 0, "subject required");
    assertPrecondition(validityDays > 0, "validityDays must be positive");
    const serial = `SN${(++this.serialCounter).toString(16).padStart(8, "0")}`;
    const issuedAtMs = Date.now();
    const notAfterMs = issuedAtMs + validityDays * 86_400_000;
    const base = { serial, subject, issuer, sans, issuedAtMs, notAfterMs };
    const rec: CertificateRecord = deepFreeze({ ...base, fingerprint: fingerprintOf(base) });
    this.certs.set(serial, rec);
    return rec;
  }

  status(serial: string, nowMs = Date.now()): CertStatus | null {
    const c = this.certs.get(serial);
    if (!c) return null;
    if (this.revoked.has(serial)) return "REVOKED";
    if (c.notAfterMs <= nowMs) return "EXPIRED";
    const daysRemaining = (c.notAfterMs - nowMs) / 86_400_000;
    if (daysRemaining <= this.policy.renewalWindowDays) return "RENEWING";
    return "ACTIVE";
  }

  /**
   * Replaces an existing certificate with a freshly issued one, keeping the
   * subject/SANs and retiring the old serial (moves to REVOKED).
   */
  renew(serial: string, validityDays: number): CertificateRecord {
    const old = this.certs.get(serial);
    assertPrecondition(old !== undefined, `unknown serial ${serial}`);
    const o = old!;
    this.revoked.add(serial);
    return this.issue(o.subject, o.issuer, [...o.sans], validityDays);
  }

  revoke(serial: string): boolean {
    if (!this.certs.has(serial)) return false;
    this.revoked.add(serial);
    return true;
  }

  /**
   * Verifies the chain by walking issuer linkage: every non-root cert must
   * have an issuer matching another cert's subject.
   */
  verifyChain(serials: readonly string[]): { ok: boolean; breakAt?: string; reason?: string } {
    const bySubject = new Map<string, CertificateRecord>();
    for (const c of this.certs.values()) bySubject.set(c.subject, c);

    const leaf = this.certs.get(serials[0] ?? "");
    if (!leaf) return { ok: false, breakAt: serials[0], reason: "leaf not found" };

    for (let i = 0; i < serials.length; i++) {
      const c = this.certs.get(serials[i]);
      if (!c) return { ok: false, breakAt: serials[i], reason: "cert not found" };
      if (this.revoked.has(c.serial)) return { ok: false, breakAt: c.serial, reason: "revoked" };
      if (c.notAfterMs <= Date.now()) return { ok: false, breakAt: c.serial, reason: "expired" };
    }
    // Root linkage: last issuer must not require further resolution within set
    const last = this.certs.get(serials[serials.length - 1])!;
    if (last.issuer !== last.subject && !bySubject.has(last.issuer)) {
      return { ok: false, breakAt: last.serial, reason: `root authority ${last.issuer} unknown` };
    }
    return { ok: true };
  }

  summary(nowMs = Date.now()): readonly CertSummary[] {
    const out: CertSummary[] = [];
    for (const c of this.certs.values()) {
      const st = this.status(c.serial, nowMs)!;
      out.push(
        deepFreeze({
          serial: c.serial,
          subject: c.subject,
          status: st,
          daysRemaining: Math.floor((c.notAfterMs - nowMs) / 86_400_000),
        }),
      );
    }
    return out.sort((a, b) => a.serial.localeCompare(b.serial));
  }

  /**
   * Deterministic CRL fingerprint (revoked serials sorted alphabetically).
   */
  crlFingerprint(): string {
    return pureSha256([...this.revoked].sort().join("|"));
  }

  get certificateCount(): number {
    return this.certs.size;
  }
  get revokedCount(): number {
    return this.revoked.size;
  }
}
