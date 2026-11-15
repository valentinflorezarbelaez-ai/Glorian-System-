# INTAKE-134 — Toolchain Control Plane, Local TLC Execution, and Cold-Start Shield Grace

## Metadata

- **Intake ID**: INTAKE-134
- **Project**: Glorian System (`eos-system-control-plane`)
- **Date**: 2026-11-14
- **Author**: Valentín Flórez Arbeláez (Principal Architect & System Owner)
- **Status**: INTAKE_COMPLETE
- **Priority**: P1 (Toolchain Integration, Local Formal Verification & SRE Cold-Start Reliability)

---

## 1. Context & Problem Statement

Following the installation and local deployment of Docker, Kubernetes (`glorian-cluster` via kind), kubectl, Helm, Trivy, OPA, k6, Java 21, and Rust, an architectural audit of Glorian System revealed three critical gaps:

1. **Toolchain Integration Gap**: While binaries for Docker, kubectl, Helm, kind, Trivy, OPA, Terraform, k6, Java, Rust, Go, and Python exist on the developer host, Glorian System lacked an integrated control plane mechanism to query, validate, and invoke them safely under zero-trust principles (`execFile` with argument arrays, sanitized environments, strict timeouts, and kind-only context boundaries).
2. **Local TLC Model Checking Deferred**: Despite having Java 21 LTS installed, `scripts/run-tlc.mjs` continued reporting `DEFERRED_TO_CI_SETUP_JAVA` because `tools/tla2tools.jar` was absent locally. The official Leslie Lamport TLC JAR must be deterministically fetched, cryptographically verified against its release SHA-256 (`7e53aa636dac8a3cb0533f343115c0548e03fc0ce5edc7739becf58d3d0fb84f`), and executed locally across all configured formal protocols.
3. **Cold-Start False Load-Shedding**: In `api/_shield.js`, `EosEventLoopSaturationGovernor` sampled event loop delay during module initialization. In serverless cold starts (Vercel functions), the initial require/compilation overhead caused event loop lag to spike (e.g. 24,628 ms) during the first request, prematurely flipping the state to `SHEDDING_ACTIVE` and rejecting legitimate initial traffic with HTTP 503. A deterministic warmup grace window / minimum sample threshold is required before load shedding can be engaged.
