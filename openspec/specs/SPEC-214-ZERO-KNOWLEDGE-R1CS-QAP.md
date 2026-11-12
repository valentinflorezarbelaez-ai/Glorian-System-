# SPEC-214: Layer-0 Zero-Knowledge Rank-1 Constraint System (R1CS) & QAP Arithmetic Circuit Core

## Status

- **Status**: APPROVED
- **Change**: `CHANGE-099`
- **Architecture Decision Record**: `ADR-099`
- **Applicable Standards**: IEEE 830 EARS, ISO/IEC/IEEE 29148 BDD, Gennaro et al. (GGPR 2013), Groth (2016), EOS Inviolable Laws I-VII

---

## Functional Requirements (EARS)

### FR-1089 (Ubiquitous - Finite Prime Field Arithmetic Core)

THE SYSTEM SHALL provide exact arbitrary-precision modular arithmetic over the prime field $\mathbb{Z}_p$ where $p = 21888242871839275222246405745257275088548364400416034343698204186575808495617$ (BN254 scalar field order), implementing addition, subtraction, multiplication, and modular inverse using the Extended Euclidean Algorithm without external libraries (EOS Law V).

### FR-1090 (State-Driven - Declarative R1CS Constraint Synthesis)

THE SYSTEM SHALL provide a declarative arithmetic circuit builder compiling high-level algebraic operations into sparse Rank-1 Constraint System (R1CS) matrices $A, B, C \in \mathbb{Z}_p^{m \times n}$ enforcing the quadratic relation:
$$(A \mathbf{s}) \odot (B \mathbf{s}) = C \mathbf{s} \pmod p$$
for witness vector $\mathbf{s} = [1, x_1, \dots, x_l, w_1, \dots, w_{n-l-1}]^T$ containing the constant 1, $l$ public inputs, and $n-l-1$ private intermediate/witness wires.

### FR-1091 (Event-Driven - Witness Generation & Satisfaction Verification)

WHEN supplied with public inputs and private witness values, THE SYSTEM SHALL synthesize the full witness vector $\mathbf{s}$, evaluate each constraint equation $k \in [0, m-1]$, and assert that $(A_k \cdot \mathbf{s}) \cdot (B_k \cdot \mathbf{s}) \equiv C_k \cdot \mathbf{s} \pmod p$, returning `SATISFIED` if and only if all $m$ constraints hold exactly.

### FR-1092 (State-Driven - Quadratic Arithmetic Program (QAP) Transformation)

THE SYSTEM SHALL transform the R1CS constraint matrices $A, B, C$ into polynomial vectors $A_i(x), B_i(x), C_i(x)$ using Lagrange polynomial interpolation over distinct evaluation roots $r_j = j$ for $j \in [1, m]$, compute the target divisor polynomial $T(x) = \prod_{j=1}^m (x - j)$, and compute the quotient polynomial:
$$H(x) = \frac{\left(\sum_{i=0}^{n-1} s_i A_i(x)\right) \cdot \left(\sum_{i=0}^{n-1} s_i B_i(x)\right) - \left(\sum_{i=0}^{n-1} s_i C_i(x)\right)}{T(x)}$$
guaranteeing a remainder of zero when the witness satisfies the circuit.

### FR-1093 (Ubiquitous - Fiat-Shamir Evaluation Argument, Receipts & Frontier Dispatch)

THE SYSTEM SHALL derive a challenge evaluation point $\tau$ using the Fiat-Shamir heuristic over the witness commitment and public inputs, compute evaluation proof values $\{A(\tau), B(\tau), C(\tau), H(\tau), T(\tau)\}$, and verify in $O(1)$ operations that $A(\tau) \cdot B(\tau) - C(\tau) \equiv H(\tau) \cdot T(\tau) \pmod p$ within $\le 2$ ms, emitting an immutable SHA-256 receipt and exposing CLI commands `r1cs:synthesize`, `r1cs:prove`, `r1cs:verify` and MCP actions `r1cs_synthesize`, `r1cs_prove`, `r1cs_verify`.

---

## BDD Scenarios

### BDD-1089: Finite Prime Field Arithmetic Core Verification

GIVEN the BN254 scalar field prime $p$
WHEN evaluating addition, subtraction, multiplication, and modular inversion
THEN $a \cdot a^{-1} \equiv 1 \pmod p$ for any non-zero element $a$
AND modular reduction MUST normalize negative BigInt values into $[0, p-1]$.

### BDD-1090: Declarative R1CS Circuit Synthesis

GIVEN an arithmetic relation $x^3 + x + 5 = 35$ with secret witness $x = 3$
WHEN the circuit is synthesized into R1CS constraint matrices $A, B, C$
THEN the constraint count $m$ MUST be minimal ($\le 3$ multiplication gates)
AND the witness vector length $n$ MUST include variable allocations for intermediate variables.

### BDD-1091: Witness Assignment & Satisfaction Evaluation

GIVEN a synthesized R1CS circuit and correct witness assignment ($x = 3$)
WHEN `isSatisfied(witness)` is evaluated
THEN it MUST return `true`
AND WHEN an invalid witness is evaluated ($x = 4$)
THEN `isSatisfied(witness)` MUST return `false` with failing constraint indices.

### BDD-1092: QAP Lagrange Interpolation & Quotient Divisibility

GIVEN a satisfied R1CS system with witness $\mathbf{s}$
WHEN transformed into QAP polynomials and evaluated against target polynomial $T(x)$
THEN the remainder polynomial $R(x)$ MUST be strictly zero
AND the quotient polynomial $H(x)$ degree MUST equal $m - 2$ (or $\le m$).

### BDD-1093: Fiat-Shamir Proof Generation, Sub-Millisecond Verification & CLI Dispatch

GIVEN a valid QAP instance and witness
WHEN a non-interactive argument of knowledge is generated
THEN proof verification at challenge point $\tau$ MUST complete in $\le 2$ milliseconds
AND forged polynomial evaluations MUST fail immediately
AND CLI command `glorian r1cs:prove --json` MUST output valid JSON with SHA-256 receipt.
