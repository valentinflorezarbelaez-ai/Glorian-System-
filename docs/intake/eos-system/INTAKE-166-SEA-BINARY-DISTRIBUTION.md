# INTAKE-166: Single Executable Applications (SEA) Automated Binary Distribution

- **Project**: `eos-system-control-plane` (Glorian System)
- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Date**: 2026-11-16T10:02:00Z
- **Category**: Binary Distribution, Standalone Runtime & Post-Quantum Code Signing
- **Target Spec**: `SPEC-304`
- **Target Change**: `CHANGE-166`
- **Pillar**: Phase 4.5 of Master Engineering Roadmap (`ROADMAP.md`)

---

## 1. Context & Business Need

To operate as a truly sovereign software engineering control plane in air-gapped environments, edge IoT clusters, bare-metal infrastructure, and zero-trust Kubernetes worker nodes, Glorian System must be distributable as a single, self-contained binary (`eos.exe` on Windows, `eos` on Linux/macOS) that requires zero host dependencies and no pre-installed Node.js runtime.

Node.js 22.18+ provides native Single Executable Application (SEA) capabilities via `node --experimental-sea-config`. To turn this into a production-grade, planetary distribution engine without third-party dependencies (Law V), Glorian System requires:

1. Multi-platform target cross-matrix generation (`linux-x64`, `linux-arm64`, `darwin-arm64`, `darwin-x64`, `win32-x64`).
2. Deterministic SEA configuration synthesis (`sea-config.json`) and injection payload validation.
3. Dual cryptographic code signing combining Ed25519 (classical RoT) and ML-DSA post-quantum signature metadata.
4. Tamper-evident distribution bundles with in-toto attestation and cryptographic SHA-256 receipts.

---

## 2. Invariants & Guardrails

1. **Law V Compliance**: Zero third-party runtime dependencies. Uses native `node:crypto`, `node:fs`, `node:path`, `node:child_process`.
2. **Deterministic Manifests**: Generated distribution manifests and checksums must be reproducible bit-for-bit.
3. **Fail-Closed Verification**: Corrupted signatures, tampered blobs, or unauthorized platforms must be rejected before execution or delivery.
4. **Epistemic Evidence**: Every distribution audit must emit `docs/evidence/SEA_BINARY_RECEIPT.json`.
