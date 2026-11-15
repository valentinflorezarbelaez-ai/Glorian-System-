# Intake Record: INTAKE-146 — Multi-Region Quorum Lease & Distributed Lock Governor

- **Change Reference**: `CHANGE-146`
- **Spec Reference**: `SPEC-284`
- **Target Subsystem**: `src/core/eosDistributedLockGovernor.ts` / `bin/commands/cliDistributedLock.mjs`
- **Author**: Glorian Control Plane / Valentín Flórez Arbeláez
- **Date**: 2026-11-15
- **Status**: `INTAKE_COMPLETE`
- **Priority**: High (Phase E6 — Distributed Coordination & Split-Brain Immunity)

---

## 1. Problem Statement

In distributed cloud systems spanning multiple regions or agent pods (Google Cloud, AWS, Vercel edge functions), multiple autonomous workers often compete for shared critical resources (e.g. database migration execution, single-writer state machines, master coordinator election). Simple database flags or unlocked caching flags suffer from race conditions, network partition split-brain anomalies, and Martin Kleppmann's "zombie client" flaw (where a client experiences an execution pause such as garbage collection, its lease expires, another client acquires the lock, and the first client awakens and writes stale corrupted data).

To provide true enterprise-grade distributed mutual exclusion without single-point-of-failure locks, Glorian requires:

1. **Quorum Consensus Leases**: Lock acquisition requires approval from a strict majority quorum ($Q = \lfloor N/2 \rfloor + 1$) across configured cluster nodes.
2. **Monotonic Fencing Tokens**: Every acquired lock receives a strictly incrementing integer token ($f_{token} \in \mathbb{N}$). Downstream storage engines check $f_{token} \ge f_{last}$, unconditionally rejecting out-of-order writes from delayed zombie processes.
3. **Monotonic TTL Expiration & Heartbeat Renewal**: Automatic failover if a lock owner crashes or disconnects without releasing.
4. **Deterministic Safe Preemption & Release**: Lock holders verify their identity and fencing token before renewal or explicit release.

## 2. Requirements & Scope

- **Pure Layer-0 TypeScript**: Zero external dependencies (`dependencies: {}`).
- **Quorum Consensus Node Emulation**: Configurable node topology with quorum voting.
- **Fencing Token Generation**: Monotonic sequence invariant $f_{i+1} > f_i$.
- **Lease State Machine**: `ACQUIRED`, `RENEWED`, `EXPIRED`, `RELEASED`, `DENIED`.
- **Verification CLI**: Subcommands `toolchain:lock:acquire`, `toolchain:lock:renew`, `toolchain:lock:release`.
- **Receipt & Artifact Integrity**: Automated generation of `docs/evidence/DISTRIBUTED_LOCK_RECEIPT.json` sealed with SHA-256.
- **Testing**: BDD scenarios BDD-1479 through BDD-1484.
