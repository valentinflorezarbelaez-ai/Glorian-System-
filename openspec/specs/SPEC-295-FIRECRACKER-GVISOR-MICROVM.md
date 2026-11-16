# SPEC-295: MicroVM Hardware Sandboxing via Firecracker & gVisor (runsc)

- **Specification ID**: `SPEC-295`
- **Change ID**: `CHANGE-157`
- **Status**: `APPROVED`
- **Module**: `src/core/eosFirecrackerMicroVmEngine.ts`
- **Tier**: Hardware Virtualization, MicroVM & Hypervisor Sandboxing
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-295-01 (Event-Driven Hardware Virtualization Probing)**: WHEN host hardware sandboxing diagnostics are requested, THE SYSTEM SHALL probe KVM device availability, hypervisor CPU extensions, and binary availability for `firecracker` and `runsc`.
- **FR-295-02 (State-Driven Firecracker MicroVM Configuration Synthesis)**: MIENTRAS a microVM execution profile is configured, THE SYSTEM SHALL synthesize a valid Firecracker JSON specification specifying kernel boot arguments, minimal rootfs drive parameters, and guest vsock communications.
- **FR-295-03 (State-Driven Google gVisor OCI Sandbox Configuration)**: MIENTRAS an application kernel sandbox is chosen, THE SYSTEM SHALL synthesize an OCI `config.json` configured for the `runsc` runtime with seccomp filtering, empty network namespaces, and cgroup resource quotas.
- **FR-295-04 (Error / Unwanted Condition: Outbound Network Escape Blocking)**: SI untrusted agent code attempts to establish network connections (HTTP, raw sockets, DNS), ENTONCES EL SISTEMA SHALL abort the execution immediately and record a `NETWORK_VIOLATION_BLOCKED` security fault.
- **FR-295-05 (Ubiquitous Memory & Timeout Containment)**: EL SISTEMA SHALL enforce strict watchdog timers and memory ceilings across all microVM and sandbox runs, killing processes that exceed allocated resource bounds.
- **FR-295-06 (Cryptographic Proof Receipt)**: WHEN a microVM sandbox audit completes, THE SYSTEM SHALL emit a verification receipt at `docs/evidence/MICROVM_SANDBOX_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1545 Hardware Virtualization Probing and Tier Selection
  GIVEN a host operating system environment
  WHEN HardwareVirtualizationProber inspects virtualization primitives
  THEN it returns a diagnostic report declaring kvmPresent, firecrackerInstalled, gvisorInstalled
  AND selects the highest tier available (FIRECRACKER > GVISOR_RUNSC > ISOLATED_PROCESS_JAIL).

SCENARIO: BDD-1546 Firecracker Declarative MicroVM Configuration Generation
  GIVEN microVM parameters with 2 vCPUs, 256 MiB RAM, and kernel path
  WHEN FirecrackerConfigGenerator synthesizes VM configuration
  THEN it emits valid JSON with boot-source, drives (is_root_device=true), machine-config, and vsock
  AND enables minimal kernel boot arguments "console=ttyS0 reboot=k panic=1 pci=off".

SCENARIO: BDD-1547 Google gVisor OCI Application Kernel Specification Synthesis
  GIVEN application execution constraints and rootfs path
  WHEN GvisorConfigGenerator synthesizes OCI config.json
  THEN it specifies runtime "runsc", network namespace "none", and read-only root filesystem
  AND isolates system call handling through Sentry/Gofer architecture.

SCENARIO: BDD-1548 Outbound Network Escape Detection and Hard Block
  GIVEN untrusted agent code containing network egress calls (fetch, http, net.Socket)
  WHEN HermeticMicroVmOrchestrator evaluates the code
  THEN execution is aborted fail-closed with status NETWORK_VIOLATION_BLOCKED
  AND exit code is 111 with zero outbound bytes transmitted.

SCENARIO: BDD-1549 Hermetic Sandbox Resource Quota & Timeout Enforcement
  GIVEN code containing an infinite execution loop (while(true))
  WHEN HermeticMicroVmOrchestrator executes the workload with a 300ms timeout
  THEN the watchdog timer terminates the execution with status TIMEOUT_KILLED
  AND execution duration does not exceed the allotted grace boundary.

SCENARIO: BDD-1550 Cryptographic MicroVM Sandbox Audit Receipt Generation
  GIVEN an audit executed via toolchain:microvm:audit or auditMicroVmPipeline
  WHEN the audit completes
  THEN docs/evidence/MICROVM_SANDBOX_RECEIPT.json is written
  AND contains hardwareVirtTier, isolationEnforced, networkEscapeBlocked, timeoutContained, and a valid sha256Signature.
```
