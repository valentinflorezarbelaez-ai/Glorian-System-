# SPEC-217: Layer-0 Verifiable Random Functions (ECVRF RFC 9381) Core

## Status

- **Status**: APPROVED
- **Change**: `CHANGE-102`
- **Architecture Decision Record**: `ADR-102`
- **Applicable Standards**: IEEE 830 EARS, ISO/IEC/IEEE 29148 BDD, RFC 9381 (ECVRF), SECG SEC 2 (secp256k1), EOS Inviolable Laws I-VII

---

## Functional Requirements (EARS)

### FR-1104 (Ubiquitous - Secp256k1 Point Group Arithmetic & Hash-to-Curve)

THE SYSTEM SHALL implement short Weierstrass curve point arithmetic over the secp256k1 prime field $\mathbb{F}_p$ ($p = 2^{256} - 2^{32} - 977$), providing constant-time and leakage-resistant point addition, point doubling, scalar multiplication ($s \cdot P$), and deterministic hash-to-curve mapping $H = \text{HashToCurve}(\alpha)$ without third-party dependencies.

### FR-1105 (State-Driven - ECVRF Non-Interactive Evaluation & Proof Synthesis)

WHEN an evaluation input message $\alpha$ is submitted with secret key $sk$, THE SYSTEM SHALL compute the VRF point $\Gamma = sk \cdot H$, evaluate commitments $U = k \cdot G$ and $V = k \cdot H$ using deterministic nonce $k$, compute Fiat-Shamir challenge $c = \text{SHA256}(G \,\|\, H \,\|\, PK \,\|\, \Gamma \,\|\, U \,\|\, V) \pmod q$, and calculate the Schnorr-like scalar response $s = (k + c \cdot sk) \pmod q$, emitting proof $\pi = (\Gamma, c, s)$ and pseudorandom VRF output $\beta = \text{SHA256}(\text{"VRF_OUTPUT:"} \,\|\, \Gamma)$.

### FR-1106 (Event-Driven - Constant-Time O(1) Proof Verification)

WHEN a VRF proof $\pi = (\Gamma, c, s)$ is verified against public key $PK$ and input $\alpha$, THE SYSTEM SHALL recompute $H = \text{HashToCurve}(\alpha)$, evaluate $U' = s \cdot G - c \cdot PK$ and $V' = s \cdot H - c \cdot \Gamma$, recompute $c' = \text{SHA256}(G \,\|\, H \,\|\, PK \,\|\, \Gamma \,\|\, U' \,\|\, V') \pmod q$, and return `VALID` if and only if $c' == c$, in $\le 2$ milliseconds.

### FR-1107 (Ubiquitous - Randomness Unpredictability, Bias-Resistance & Leader Election)

THE SYSTEM SHALL guarantee that $\beta$ is pseudorandomly uniform, unpredictable prior to revelation of $sk$, and uniquely determined for any pair $(PK, \alpha)$, providing an election primitive `isElected(beta, thresholdFraction)` for decentralized consensus and verifiable lotteries.

### FR-1108 (Ubiquitous - Execution Receipts, Frontier Dispatch & CLI/MCP Interface)

THE SYSTEM SHALL emit an immutable SHA-256 execution receipt for each evaluation and verification, and expose CLI commands `vrf:eval`, `vrf:verify`, `vrf:elect` and MCP actions `vrf_eval`, `vrf_verify`, `vrf_elect`.

---

## BDD Scenarios

### BDD-1104: Secp256k1 Point Group Invariants and Hash-to-Curve

GIVEN the secp256k1 base generator point $G$
WHEN scalar multiplication is evaluated for $q$ (group order)
THEN $q \cdot G$ MUST yield the point at infinity $\mathcal{O}$
AND deterministic hash-to-curve on message $\alpha$ MUST return a valid curve point $H = (x, y)$ satisfying $y^2 \equiv x^3 + 7 \pmod p$.

### BDD-1105: Deterministic VRF Proof Generation and Pseudorandom Output

GIVEN a valid secret key $sk$ and public key $PK = sk \cdot G$
WHEN `evaluate(sk, alpha)` is executed twice on identical input $\alpha$
THEN the resulting output $\beta$ and proof $\pi = (\Gamma, c, s)$ MUST be byte-for-byte identical
AND $\beta$ MUST exhibit full entropy with 256 uniform bits.

### BDD-1106: Fast Verification and Forgery Rejection

GIVEN an authentic proof $\pi$ generated for $(PK, \alpha)$
WHEN `verify(PK, alpha, pi)` is executed
THEN verification MUST return `VALID` in under 2 milliseconds
AND WHEN $\alpha$ is altered, or $\pi.s$ is perturbed by 1
THEN verification MUST return `INVALID` immediately.

### BDD-1107: Unbiasable Consensus Leader Selection and Threshold Allocation

GIVEN a consensus slot with threshold probability 25% (0.25)
WHEN VRF output $\beta$ is evaluated across 1000 candidate nodes
THEN approximately 250 nodes ($\pm 5\%$) MUST be elected
AND an adversary lacking $sk$ CANNOT predict election status prior to proof publication.

### BDD-1108: Frontier CLI and MCP Dispatch

GIVEN the Glorian CLI and MCP control plane
WHEN `glorian vrf:eval --alpha="block-epoch-102" --json` is invoked
THEN the command MUST output valid JSON containing public key, $\Gamma$, $\beta$, and SHA-256 receipt.
