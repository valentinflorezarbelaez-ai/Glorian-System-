/**
 * EOS Firecracker MicroVM & Google gVisor Sandboxing Types
 *
 * SPEC-295 / CHANGE-157 / Step 7
 * Zero third-party runtime dependencies (Law V).
 */

export type MicroVmVirtualizationTier = "FIRECRACKER" | "GVISOR_RUNSC" | "ISOLATED_PROCESS_JAIL";

export interface MicroVmHostDiagnostic {
  tier: MicroVmVirtualizationTier;
  kvmPresent: boolean;
  firecrackerInstalled: boolean;
  gvisorInstalled: boolean;
  cpuExtensions: string[];
  recommendation: string;
}

export interface MicroVmBootSource {
  kernel_image_path: string;
  boot_args: string;
}

export interface MicroVmDrive {
  drive_id: string;
  path_on_host: string;
  is_root_device: boolean;
  is_read_only: boolean;
}

export interface MicroVmMachineConfig {
  vcpu_count: number;
  mem_size_mib: number;
  smt: boolean;
}

export interface MicroVmVsock {
  guest_cid: number;
  uds_path: string;
}

export interface MicroVmFirecrackerConfig {
  bootSource: MicroVmBootSource;
  drives: MicroVmDrive[];
  machineConfig: MicroVmMachineConfig;
  vsock?: MicroVmVsock;
}

export interface MicroVmGvisorOciConfig {
  ociVersion: string;
  process: {
    terminal: boolean;
    user: { uid: number; gid: number };
    args: string[];
    env: string[];
    cwd: string;
  };
  root: {
    path: string;
    readonly: boolean;
  };
  mounts: Array<{
    destination: string;
    type: string;
    source: string;
    options: string[];
  }>;
  linux: {
    namespaces: Array<{ type: string }>;
    resources: {
      memory: { limit: number };
    };
  };
}

export type MicroVmExecutionStatus = "COMPLETED" | "TIMEOUT_KILLED" | "NETWORK_VIOLATION_BLOCKED" | "FAILED";

export interface MicroVmExecutionOptions {
  codeOrCommand: string;
  timeoutMs?: number;
  memoryLimitMb?: number;
  forceTier?: MicroVmVirtualizationTier;
}

export interface MicroVmExecutionResult {
  executionId: string;
  tierUsed: MicroVmVirtualizationTier;
  status: MicroVmExecutionStatus;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  memoryPeakBytes: number;
}

export interface MicroVmAuditReceipt {
  timestampIso: string;
  specRef: string;
  hardwareVirtTier: MicroVmVirtualizationTier;
  isolationEnforced: boolean;
  networkEscapeBlocked: boolean;
  timeoutContained: boolean;
  sha256Signature: string;
}
