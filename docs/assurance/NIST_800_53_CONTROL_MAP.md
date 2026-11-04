# NIST SP 800-53 Rev.5 Control Map — Glorian Peak Assurance (Wave B)

**Scope**: Control-plane TCB (MCP Streamable, Law IV, secrets, supply chain)  
**Date**: 2026-11-04  
**Epistemic**: self-attested mapping with local receipts — not a federal ATO

| Control | Title | Status | Evidence Anchor |
|---|---|---|---|
| AC-2 | Account Management | COVERED | MCP bearer session binding (`eosPeakAssuranceTcb`, SPEC-140/146) |
| AC-3 | Access Enforcement | COVERED | Origin allowlist + token bind fail-closed |
| AC-6 | Least Privilege | COVERED | Law IV six-precondition external write barrier |
| AU-2 | Event Logging | COVERED | SQLite WAL ledger SECURITY_AUDIT / VERIFICATION_RECEIPT |
| AU-12 | Audit Generation | COVERED | `eos_sqlite_ledger`, EVD JSON under `docs/evidence/` |
| CM-2 | Baseline Configuration | COVERED | Freeze gate + OpenSpec catalog + SBOM |
| CM-3 | Configuration Change Control | COVERED | SDD Intake→Spec→EVD; GGA hooks |
| IA-2 | Identification & Authentication | COVERED | 256-bit CSPRNG bearer + timingSafeEqual |
| IA-5 | Authenticator Management | PARTIAL | Tokens ephemeral; rotation runbook in IVV playbook |
| SC-7 | Boundary Protection | COVERED | Host/Origin validation, 1 MiB cutoff, no wildcard CORS on sensitive routes |
| SC-8 | Transmission Confidentiality | PARTIAL | TLS at edge (Vercel/GitHub); local stdio MCP is loopback |
| SC-12 | Cryptographic Key Establishment | PARTIAL | Hash/HMAC local; OIDC keyless CI attestation present |
| SC-13 | Cryptographic Protection | COVERED | SHA-256/384, timingSafeEqual, CycloneDX digests |
| SI-2 | Flaw Remediation | COVERED | Autonomous healer + verify:strict gate |
| SI-3 | Malicious Code Protection | COVERED | Wasm worker isolation SPEC-142/144; guest path removed SPEC-143 |
| SI-4 | System Monitoring | COVERED | Fleet pulse/soundcheck/sentinel SPEC-134 |
| SI-10 | Information Input Validation | COVERED | Patch validator Gamma barrier; payload bounds |
| SA-11 | Developer Testing | COVERED | 154+ suites, mutation floor on TCB |
| SA-15 | Development Process | COVERED | EOS 7-Law constitution + OpenSpec EARS/BDD |

## Summary
- COVERED: 15
- PARTIAL: 3
- GAP (TCB AC/IA/SC): 0
- Coverage ratio (COVERED / total listed): 15/18 ≈ **83.3%** (>= 80% Wave B DONE)
