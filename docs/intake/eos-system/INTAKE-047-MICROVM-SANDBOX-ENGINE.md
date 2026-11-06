# INTAKE-047: Hermetic MicroVM & Isolated Hypervisor Sandbox Engine

## 1. Context & Business Intent
To enable autonomous multi-agent engineering missions (e.g. 93 subagents compiling polyglot code, running fuzzers or stress testing unreviewed code overnight) with zero risk to the host developer workstation, EOS requires a physical isolation layer inspired by AWS Firecracker, Google gVisor, and Docker sandboxes. The engine must detect available virtualization runtimes (`FIRECRACKER`, `DOCKER_GVISOR`, `EPHEMERAL_NODE_VM`), enforce zero-network isolation (`--network none`), enforce strict memory/CPU bounds, provide ephemeral tmpfs write barriers, and emit cryptographic execution receipts into the SQLite WAL ledger.

## 2. Invariants & Constraints
- **Layer-0 Purity**: Zero external runtime npm dependencies (`node:child_process`, `node:fs`, `node:crypto`, `node:vm`).
- **Hard Boundaries**:
  - Memory: Max 512 MB per ephemeral agent sandbox.
  - Timeout: Hard timeout kill barrier (e.g. 15,000 ms).
  - Network: Strictly isolated from host network.
  - Disk: Host repository mounted read-only; writes restricted to temporary overlay/tmpfs.
- **Fail-Safe Fallback**: If neither Docker nor Firecracker is running on the host, falls back transparently to `node:vm` hermetic context with isolated process limits.
