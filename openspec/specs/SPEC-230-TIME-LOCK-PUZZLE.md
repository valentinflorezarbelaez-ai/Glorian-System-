# SPEC-230 — Layer-0 Cryptographic Time-Lock Puzzle Engine (RSW96 & Sloth)

## Metadata

- **SPEC ID**: SPEC-230
- **Change ID**: CHANGE-115
- **Intake ID**: INTAKE-115
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-12
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosTimeLockPuzzleCore`

---

## 1. Overview

`EosTimeLockPuzzleCore` provides provable timed-release encryption ensuring that confidential data
cannot be decrypted before $T$ inherently sequential computational operations have occurred.
It implements:

1. **RSW96 (Rivest-Shamir-Wagner)**: Composite modulus $N = pq$, trapdoor exponentiation $e = 2^T \pmod{\phi(N)}$,
   AES-256-GCM authenticated payload encapsulation, and non-parallelizable sequential modular squarings.
2. **Sloth Invertible Permutation**: Non-parallelizable modular square roots for primes $p \equiv 3 \pmod 4$
   with fast $O(\log T)$ verification via modular squaring.
3. **Verifiable Checkpoint Sampling**: Segmented progress proofs without full recalculation.

---

## 2. Functional Requirements (EARS Syntax)

**FR-230-001** (Event-Driven)
WHEN a secret message and difficulty parameter $T$ are provided with a composite trapdoor $(p, q)$,
THE SYSTEM SHALL compute $e = 2^T \pmod{(p-1)(q-1)}$ and $y = a^e \pmod N$ in $O(\log T)$ time,
derive a symmetric key via SHA-256 KDF, and encrypt the secret message with AES-256-GCM.

**FR-230-002** (Event-Driven)
WHEN a solver receives an RSW96 time-lock puzzle without the trapdoor $(p, q)$, THE SYSTEM SHALL
execute $T$ sequential modular squarings $y_{i+1} = y_i^2 \pmod N$ starting from $y_0 = a \pmod N$,
derive the identical symmetric key, and decrypt the authenticated payload.

**FR-230-003** (Error / Unwanted Condition)
IF any puzzle parameter (ciphertext, auth tag, IV, modulus, difficulty $T$) is corrupted or modified,
THEN THE SYSTEM SHALL abort decryption and return an explicit integrity failure.

**FR-230-004** (Event-Driven)
WHEN intermediate checkpoint sampling is enabled with step size $k$, THE SYSTEM SHALL record
state snapshots every $k$ squarings, enabling observers to verify segment transitions $y_{j} = y_{j-1}^{2^k} \pmod N$
in $O(\log k)$ time.

**FR-230-005** (Ubiquitous)
THE SYSTEM SHALL provide Sloth time-lock permutation functions where puzzle solving evaluates $T$
sequential modular square roots $x_{i+1} = x_i^{(p+1)/4} \pmod p$, and verification checks
$x_T^{2^T} \equiv x_0 \pmod p$ in $O(\log T)$ modular squarings.

---

## 3. Non-Functional Requirements

- **NFR-230-A** Zero external runtime dependencies; `dependencies` in `package.json` must remain `{}`.
- **NFR-230-B** All large integer calculations must use native JavaScript `BigInt` for exact precision.
- **NFR-230-C** Trapdoor generation for $T \le 10^7$ must complete in under 5 milliseconds.
- **NFR-230-D** Decryption payloads must use authenticated AES-256-GCM preventing bit-flipping attacks.
- **NFR-230-E** Sloth verification must execute in under 5 milliseconds.

---

## 4. BDD Acceptance Scenarios

### BDD-1169 — Fast Trapdoor Puzzle Generation (RSW96)

```gherkin
SCENARIO: Puzzle generation with trapdoor executes in sub-millisecond time
  GIVEN a composite modulus N = p * q and totient phi(N) = (p-1)*(q-1)
  WHEN a time-lock puzzle is created for difficulty T = 10,000 squarings
  THEN generation MUST complete in under 5 milliseconds via trapdoor exponentiation
  AND the puzzle package MUST contain N, a, T, iv, authTag, and encrypted payload
```

### BDD-1170 — Sequential Solver Execution and Secret Recovery

```gherkin
SCENARIO: Solver without trapdoor executes sequential squarings and recovers secret
  GIVEN a valid RSW96 time-lock puzzle locking a secret string
  WHEN solve(puzzle) executes the T sequential squarings
  THEN the recovered plaintext MUST exactly match the original secret string
  AND the derived key MUST match the creator's key
```

### BDD-1171 — Tamper Detection and Decryption Integrity

```gherkin
SCENARIO: Modifying puzzle ciphertext or auth tag causes integrity rejection
  GIVEN a valid RSW96 time-lock puzzle
  WHEN the ciphertext or auth tag is modified by 1 bit
  THEN solve(puzzle) MUST throw an authenticated decryption error
  AND no corrupted plaintext MUST be returned
```

### BDD-1172 — Checkpoint Sampling and Verification

```gherkin
SCENARIO: Intermediate checkpoints prove sequential execution progress
  GIVEN a puzzle with difficulty T = 1,000 and checkpoint interval k = 200
  WHEN the puzzle is solved with checkpoint recording enabled
  THEN exactly 5 intermediate checkpoints MUST be emitted
  AND each transition y_j = y_{j-1}^{2^k} mod N MUST be verified in O(log k) time
```

### BDD-1173 — Sloth Modular Square Root Time-Lock Permutation

```gherkin
SCENARIO: Sloth time-lock permits sequential square-root solving and fast verification
  GIVEN a prime p = 3 mod 4 and an input value x0
  WHEN Sloth permutation executes T sequential square roots
  THEN fast verification via x_T^{2^T} mod p MUST return x0
  AND verification MUST execute in under 5 milliseconds
```
