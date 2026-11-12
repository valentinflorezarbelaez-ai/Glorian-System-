# INTAKE-115 — Layer-0 Cryptographic Time-Lock Puzzle Engine (RSW96 & Sloth)

## Metadata

- **Intake ID**: INTAKE-115
- **Change ID**: CHANGE-115
- **SPEC ID**: SPEC-230
- **Author**: EOS Engineering System
- **Date**: 2026-11-12
- **Status**: INTAKE_COMPLETE
- **Priority**: HIGH
- **Layer**: Layer-0 (Zero external runtime dependencies)

## Business Context

The Glorian System coordinates distributed autonomous agents, sealed governance votes, delay-tolerant
key escrow, front-running mitigation, and automated dead-man switches. These capabilities require
**provable timed-release cryptography**: sending confidential data into the future such that nobody —
not even the sender or an adversary with vast parallel computing power — can decrypt the payload
before a calibrated wall-clock duration has elapsed.

## Problem Statement

1. **No non-parallelizable cryptographic delay primitive**: Standard symmetric or asymmetric encryption
   either can be decrypted immediately with the key or never without it; it cannot enforce an intrinsic
   sequential compute delay.
2. **Parallel hardware attacks**: Proof-of-Work (like SHA-256 mining) is parallelizable across millions
   of ASIC cores. A time-lock mechanism must enforce an inherently sequential computational dependency DAG.
3. **Slow puzzle generation without trapdoor**: Naive delayed release requires the creator to perform the
   computation upfront. An enterprise-grade system must allow the creator to generate puzzles in $O(\log T)$
   time using an algebraic trapdoor while forcing solvers to compute sequentially for $T$ steps.
4. **Lack of verifiable checkpoint receipts**: Observers cannot verify whether an ongoing puzzle solver is
   at step $k$ without re-running the entire computation from step 0.

## Proposed Solution

Implement `EosTimeLockPuzzleCore` — a pure Layer-0 TypeScript engine delivering:

- **RSW96 (Rivest-Shamir-Wagner) Time-Lock**:
  - Creator selects primes $p, q$, modulus $N = pq$, and totient $\phi(N) = (p-1)(q-1)$.
  - Creator computes key seed $y = a^{2^T \pmod{\phi(N)}} \pmod N$ in $O(\log T)$ time.
  - Symmetric key derived via SHA-256 KDF encrypts payload via AES-256-GCM.
  - Solver without $(p, q)$ must compute $y = a^{2^T} \pmod N$ via $T$ sequential squarings.
- **Sloth Invertible Permutation Time-Lock**:
  - Sequential modular square roots ($x_{i+1} = \sqrt{x_i} \pmod p$) for primes $p \equiv 3 \pmod 4$.
  - Fast $O(\log T)$ verification via repeated modular squarings ($x_0 \equiv x_T^{2^T} \pmod p$).
- **Checkpoint Sampling**:
  - Segmented intermediate proofs allowing intermediate progress attestation.

## Constraints

- Zero external runtime dependencies (`dependencies: {}` in `package.json`).
- Pure TypeScript / Node.js 24 built-ins only (`node:crypto` for AES-256-GCM and SHA-256, native `BigInt` for modular arithmetic).
- Deterministic serialization and constant-time execution where applicable.
