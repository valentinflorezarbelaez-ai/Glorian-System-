# INTAKE-157: MicroVM Hardware Sandboxing via Firecracker & gVisor (runsc)

- **Intake ID**: `INTAKE-157`
- **Change ID**: `CHANGE-157`
- **Spec Reference**: `SPEC-295`
- **Target Module**: `src/core/eosFirecrackerMicroVmEngine.ts`
- **Tier**: Hardware Virtualization, MicroVM & Hypervisor Sandboxing
- **Owner**: `user:valentin-florez-arbelaez`
- **Timestamp**: 2026-11-15T21:20:00Z
- **Status**: `INTAKE_COMPLETE`

---

## 1. Business Need & Context

In sovereign multi-agent engineering, executing code synthesized by AI agents directly on host environments or standard Docker containers introduces container escape vulnerabilities (dirty COW, kernel exploits, ambient network access).
Glorian System requires true hardware-level microVM isolation and application-kernel sandboxing:

1. **AWS Firecracker MicroVMs**: Ephemeral KVM-accelerated virtual machines booting in $< 15$ ms with isolated Linux kernels, minimal device emulation (virtio-net, virtio-block, virtio-vsock), and unshared guest memory.
2. **Google gVisor (`runsc`)**: User-space application kernel intercepting and filtering system calls with Sentry and Gofer to prevent kernel exploitation.
3. **Hermetic Isolated Process Jail (Fallback)**: When hardware KVM is unavailable on Windows development hosts or constrained CI, executes code inside isolated process jails enforcing zero-network policy, memory ceilings, and watchdog timer kills.
4. **Cryptographic Proof Receipt**: Emits execution evidence at `docs/evidence/MICROVM_SANDBOX_RECEIPT.json`.

---

## 2. Scope & Technical Objectives

- **Pure Layer-0 TypeScript**: Zero external runtime dependencies (`dependencies: {}`).
- **Firecracker Config Generator**: Synthesizes canonical JSON configs (`boot-source`, `drives`, `machine-config`, `vsock`).
- **gVisor OCI Specification Generator**: Synthesizes OCI `config.json` tailored for `runsc` with network isolation.
- **Hardware Virtualization Prober**: Probes `/dev/kvm`, nested virtualization, hypervisor flags, and binary availability (`firecracker`, `runsc`, `docker`).
- **Hermetic Execution Orchestrator**: Executes scripts or commands with hard resource quotas, network egress blocking, and timeout guards.
- **CLI Subcommands**: `toolchain:microvm:launch`, `toolchain:microvm:config`, `toolchain:microvm:diag`, `toolchain:microvm:audit`.
- **Evidence Receipt**: `docs/evidence/MICROVM_SANDBOX_RECEIPT.json`.
