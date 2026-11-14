export interface SandboxRunOptions {
  readonly worktreePath: string;
  readonly command: string;
  readonly commandArgs?: readonly string[];
  readonly applyChanges?: boolean;
  readonly timeoutMs?: number;
}

export interface SandboxRunReport {
  readonly success: boolean;
  readonly status: "COMPLETED" | "COMMAND_FAILED" | "TIMED_OUT" | "CONFLICT" | "FAILED";
  readonly exitCode: number | null;
  readonly timeoutMs: number;
  readonly appliedChanges: boolean;
  readonly changedFiles: readonly string[];
  readonly conflicts: readonly string[];
  readonly excludedPaths: readonly string[];
  readonly receiptPath: string | null;
  readonly error?: string;
}

export interface FileRecord {
  readonly sha256: string;
  readonly size: number;
  readonly mode: number;
  readonly sandboxMode: number;
}

export interface SnapshotManifest {
  readonly files: Map<string, FileRecord>;
  readonly bytes: number;
  readonly symlinks: readonly string[];
}

export interface DockerImageInfo {
  readonly ref: string;
  readonly digest: string;
}
