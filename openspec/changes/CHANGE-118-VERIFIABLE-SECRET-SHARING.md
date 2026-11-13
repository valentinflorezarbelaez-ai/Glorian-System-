# CHANGE-118 — Layer-0 Verifiable Secret Sharing Engine (Feldman & Pedersen VSS)

## Metadata

- **Change ID**: CHANGE-118
- **Target SPEC**: SPEC-233
- **Intake Ref**: INTAKE-118
- **Date**: 2026-11-12
- **Status**: APPROVED
- **Layer**: Layer-0 (Zero external runtime dependencies)

---

## 1. Description

Introduce `EosVerifiableSecretSharingCore`, an experimental Layer-0 implementation of non-interactive
Verifiable Secret Sharing (VSS). It implements Feldman and Pedersen schemes, allowing participants to check
whether a share is consistent with public commitments and allowing reconstruction to exclude invalid supplied
shares when at least $k$ valid shares remain. The result does not establish a participant's identity or prove
malfeasance. This implementation is not approved for production secrets pending independent cryptographic review.

---

## 2. Motivation

Threshold protocols need a way to check share consistency during distribution and recovery. Any future use with
BFT, FROST, or key escrow requires independent cryptographic review and a protected participant-specific transport
channel; this change does not itself integrate those production systems.

---

## 3. Impact Analysis

- **Runtime**: Zero external runtime dependencies; Node.js 22.18+ (`package.json` `dependencies: {}`).
- **Security**: Experimental RFC 3526 MODP Group 15 parameter set. JavaScript BigInt does not guarantee constant-time operations; the implementation has not received an independent cryptographic audit.
- **Privacy**: Pedersen is the default and relies on uniform blinding scalars and an unknown discrete-log relation between the fixed generators. Feldman commitments may expose low-entropy secrets to offline guessing.
- **Performance**: No latency target is claimed until reproducible benchmarks run on supported runtimes.
- **Compatibility**: No production integration with MPC, FROST (SPEC-219), or TimeLock (SPEC-230) is included.
