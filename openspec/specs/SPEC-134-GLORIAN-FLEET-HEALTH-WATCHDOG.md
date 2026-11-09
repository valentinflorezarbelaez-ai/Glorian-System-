# SPEC-134: Glorian Sovereign Fleet Health Watchdog & Synthetic Security Sentinel

## Status

- **Status**: APPROVED
- **Date**: 2026-11-08
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution
- **Implementation**: [`src/core/glorianFleetHealthWatchdog.ts`](file:///c:/Users/valen/Documents/Glorian-System/src/core/glorianFleetHealthWatchdog.ts)

---

## 1. Context and Rationale

Operating a multi-project distributed ecosystem requires automated synthetic monitoring and security header auditing across all fleet production endpoints without introducing vulnerabilities such as Server-Side Request Forgery (SSRF). The `GlorianFleetHealthWatchdog` Layer-0 module implements an active health watchdog and security probe.

It enforces strict SSRF perimeter defenses (blocking loopback, RFC 1918 private subnets, link-local addresses, and AWS/GCP cloud metadata services), calculates synthetic security header grades (HSTS, X-Content-Type-Options, CSP, X-Frame-Options), measures Time-To-First-Byte (TTFB) latency, and synthesizes a Composite Health Index sealed with a deterministic SHA-256 cryptographic receipt.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-540 (Ubiquitous - SSRF Shielding)**: `The system shall validate each target probe URL and block requests directed to loopback, link-local, private RFC 1918 addresses, and cloud metadata IP ranges.`
- **FR-541 (Event-Driven - Synthetic Probe Execution)**: `When a fleet health evaluation is triggered, the system shall probe authorized fleet endpoints to measure response status and TTFB latency.`
- **FR-542 (Ubiquitous - Security Header Grading)**: `The system shall inspect response headers for HSTS, X-Content-Type-Options: nosniff, Content-Security-Policy, and X-Frame-Options, calculating a normalized security score between 0 and 100.`
- **FR-543 (Error Condition - Target Blocked or Unreachable)**: `If a target URL fails safety validation or network connectivity, then the system shall record a degraded probe entry with safetyReason and prevent unhandled process termination.`
- **FR-544 (Ubiquitous - Composite Health Synthesis)**: `The system shall compute a Composite Health Index across all evaluated fleet projects and assign an audit status of FLEET_HEALTH_CERTIFIED or FLEET_HEALTH_DEGRADED.`
- **FR-545 (Ubiquitous - Cryptographic Proof)**: `The system shall compute a SHA-256 digest over the probe telemetry and seal the fleet health report.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-353 SSRF Attack Vector Elimination
  GIVEN an adversarial probe URL directed to loopback (127.0.0.1) or AWS metadata (169.254.169.254)
  WHEN the fleet health watchdog validates target safety
  THEN the result indicates allowed is false with a descriptive safety reason
  AND no network connection is initiated to the target
```

```gherkin
SCENARIO: BDD-354 Security Header Compliance Evaluation
  GIVEN an HTTP response with valid HSTS, nosniff, CSP, and Frame-Options headers
  WHEN the watchdog evaluates the headers
  THEN the security score evaluates to 100
  AND all compliance flags evaluate to true
```

```gherkin
SCENARIO: BDD-355 Composite Fleet Health Attestation
  GIVEN a fleet registry of production endpoints
  WHEN the fleet health watchdog completes an evaluation cycle
  THEN a FleetHealthReport is emitted with average TTFB and composite health index
  AND a 64-character SHA-256 receipt is attached
```
