# PLAN-157: MicroVM Hardware Sandboxing via Firecracker & gVisor (runsc)

- **Plan ID**: `PLAN-157`
- **Change ID**: `CHANGE-157`
- **Spec Reference**: `SPEC-295`
- **Status**: `APPROVED`
- **Target Module**: `src/core/eosFirecrackerMicroVmEngine.ts`
- **Tier**: Hardware Virtualization, MicroVM & Hypervisor Sandboxing
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Architectural Strategy

The MicroVM and Application-Kernel Sandboxing Engine provides military-grade isolation for untrusted agent code execution, replacing generic shared-kernel Docker containers with hardware virtualization (AWS Firecracker) and intercepted syscall sandboxing (Google gVisor `runsc`).

### Pure Layer-0 Architecture (Law V)

1. **Hardware Virtualization Prober (`HardwareVirtualizationProber`)**:
   - Detects presence of `/dev/kvm` on Linux hosts.
   - Probes CPU virtualization extensions (`vmx` for Intel VT-x, `svm` for AMD-V) in `/proc/cpuinfo` or WMI on Windows.
   - Probes availability of `firecracker` and `runsc` binaries in the system `$PATH`.
   - Selects optimal tier: `FIRECRACKER` > `GVISOR_RUNSC` > `ISOLATED_PROCESS_JAIL`.
2. **Firecracker MicroVM Configuration Engine (`FirecrackerConfigGenerator`)**:
   - Synthesizes canonical Firecracker configuration objects adhering to the v1.x REST API specification:
     - `boot-source`: uncompressed Linux kernel (`vmlinux`), cmdline (`console=ttyS0 reboot=k panic=1 pci=off nomodules`).
     - `drives`: ext4 rootfs disk image (`is_root_device: true`, `is_read_only: true`).
     - `machine-config`: `vcpu_count`, `mem_size_mib`, `smt: false`.
     - `vsock`: guest vsock `uds_path` and `guest_cid: 3` for hermetic agent communication.
3. **Google gVisor OCI Engine (`GvisorConfigGenerator`)**:
   - Generates OCI standard `config.json` configured for the `runsc` application kernel.
   - Isolates system calls in user space through the Sentry subsystem and file I/O through Gofer.
   - Disables ambient network namespaces (`network: none`) and mounts a read-only root with an ephemeral tmpfs.
4. **Hermetic Isolated Process Jail (`IsolatedProcessJail`)**:
   - Provides deterministic zero-dependency execution fallback when neither Firecracker nor gVisor is natively available on the host.
   - Enforces static AST analysis to block network egress (`http`, `fetch`, `net.Socket`).
   - Enforces hard execution timeouts via watchdog timers.
   - Enforces memory limit heuristics and sanitized global execution contexts.
5. **Cryptographic Proof Receipt**:
   - Emits execution metadata and security attestations at `docs/evidence/MICROVM_SANDBOX_RECEIPT.json`.

---

## 2. Component Design & Interfaces

```typescript
export type VirtualizationTier = "FIRECRACKER" | "GVISOR_RUNSC" | "ISOLATED_PROCESS_JAIL";

export interface HostVirtualizationDiagnostic {
  tier: VirtualizationTier;
  kvmPresent: boolean;
  firecrackerInstalled: boolean;
  gvisorInstalled: boolean;
  cpuExtensions: string[];
  recommendation: string;
}

export interface FirecrackerVmConfig {
  bootSource: {
    kernelImagePath: string;
    bootArgs: string;
  };
  drives: Array<{
    driveId: string;
    pathOnHost: string;
    isRootDevice: boolean;
    isReadOnly: boolean;
  }>;
  machineConfig: {
    vcpuCount: number;
    memSizeMib: number;
    smt: boolean;
  };
  vsock?: {
    guestCid: number;
    udsPath: string;
  };
}

export interface SandboxExecutionOptions {
  codeOrCommand: string;
  timeoutMs?: number;
  memoryLimitMb?: number;
  forceTier?: VirtualizationTier;
}

export interface SandboxExecutionResult {
  executionId: string;
  tierUsed: VirtualizationTier;
  status: "COMPLETED" | "TIMEOUT_KILLED" | "NETWORK_VIOLATION_BLOCKED" | "FAILED";
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  memoryPeakBytes: number;
}
```

---

## 3. Rejected Alternatives & Tradeoffs

- **Standard Docker Container with Default Runtime**: Rejected because containers share the host Linux kernel directly, leaving the host vulnerable to kernel exploits (dirty pipe, dirty COW) and privilege escalation.
- **QEMU Full System Emulation**: Rejected because QEMU cold-boot takes several seconds and emulates complex hardware buses, while Firecracker boots in $< 15$ ms with minimal virtio devices.
- **Third-Party Node.js Native Addons**: Rejected to strictly adhere to Law V (zero compiled npm dependencies in `package.json`).
