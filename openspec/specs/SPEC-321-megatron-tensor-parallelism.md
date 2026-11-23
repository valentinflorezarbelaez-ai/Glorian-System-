# SPEC-321: Megatron-LM Style Tensor Parallelism (Column & Row Linear Sharding)

**Status**: `APPROVED`

---

## 1. Functional Requirements (EARS Syntax)

#### FR-1: Column-Parallel Linear Layer Decomposition

- **Pattern**: Event-Driven
- **Requirement**: WHEN a column-parallel linear projection with weight matrix $W_1 \in \mathbb{R}^{d_{\text{in}} \times d_{\text{hidden}}}$ is initialized across $P$ workers, THE SYSTEM shall partition $W_1$ column-wise such that worker $p$ stores strictly $W_1^{(p)} \in \mathbb{R}^{d_{\text{in}} \times (d_{\text{hidden}} / P)}$ and computes local projection $Y^{(p)} = X W_1^{(p)}$ with zero inter-worker communication.

#### FR-2: Local Fused Non-Linear Activation Functions

- **Pattern**: Ubiquitous
- **Requirement**: THE SYSTEM shall apply element-wise activation functions (Gaussian Error Linear Unit - GeLU or Sigmoid Linear Unit - SiLU) directly on the local sharded output $Y^{(p)}$ in-place without requiring any cross-worker synchronization or memory reallocation.

#### FR-3: Row-Parallel Linear Layer Decomposition

- **Pattern**: Event-Driven
- **Requirement**: WHEN a row-parallel linear projection with weight matrix $W_2 \in \mathbb{R}^{d_{\text{hidden}} \times d_{\text{out}}}$ is initialized across $P$ workers, THE SYSTEM shall partition $W_2$ row-wise such that worker $p$ stores strictly $W_2^{(p)} \in \mathbb{R}^{(d_{\text{hidden}} / P) \times d_{\text{out}}}$ and computes partial sum $O^{(p)} = Z^{(p)} W_2^{(p)}$ locally.

#### FR-4: Single-Barrier Collective Synchronization

- **Pattern**: Event-Driven
- **Requirement**: WHEN a forward pass through the column-parallel and row-parallel MLP block completes, THE SYSTEM shall invoke exactly one Ring All-Reduce collective communication barrier across the $P$ worker partial outputs $O^{(p)}$ to reconstruct the identical synchronized output tensor $O = \sum_{p=0}^{P-1} O^{(p)}$ across all workers.

#### FR-5: Sharded Vocabulary Parallel Cross-Entropy Loss

- **Pattern**: Event-Driven
- **Requirement**: WHEN computing cross-entropy loss over a vocabulary of size $V$ sharded across $P$ workers ($V / P$ per worker), THE SYSTEM shall compute local logits, determine global maximum using an All-Reduce scalar sync, normalize local partition exponentials, and produce the exact ground-truth loss without materializing full $B \times V$ logits on any individual node.

#### FR-6: Verification and Numerical Equivalence Invariant

- **Pattern**: Ubiquitous
- **Requirement**: THE SYSTEM shall verify that the distributed Megatron-LM MLP execution matches the monolithic centralized linear projection within a strict numerical absolute tolerance ($\max |O_{\text{distributed}} - O_{\text{central}}| \le 10^{-6}$), certify zero memory leaks, and generate a deterministic SHA-256 cryptographic audit receipt.

---

## 2. BDD Acceptance Criteria

```gherkin
SCENARIO: BDD-1701 Column-Parallel Linear Projection & Dimension Partitioning
  GIVEN an input batch X of shape [2, 4] and hidden dimension 8 distributed across P = 2 workers
  WHEN executing the column-parallel linear projection
  THEN worker 0 holds weight slice of shape [4, 4] and worker 1 holds weight slice of shape [4, 4]
  AND each worker computes local output [2, 4] without any network communication

SCENARIO: BDD-1702 Local Fused Non-Linear Activation Without Inter-Worker Synchronization
  GIVEN partitioned intermediate activations Y(0) and Y(1) on two workers
  WHEN applying fused GeLU or SiLU activations
  THEN activation is computed element-wise in-place on each worker
  AND zero bytes are transferred between workers during the non-linear stage

SCENARIO: BDD-1703 Row-Parallel Linear Projection & Local Matrix Multiplications
  GIVEN activated activations Z(0) and Z(1) of shape [2, 4] and output dimension 2
  WHEN executing row-parallel linear projection with W2 partitioned row-wise [4, 2]
  THEN worker 0 computes partial output O(0) of shape [2, 2]
  AND worker 1 computes partial output O(1) of shape [2, 2] locally

SCENARIO: BDD-1704 End-to-End Megatron MLP Block Execution & Single All-Reduce Barrier
  GIVEN a 2-layer MLP block (Column-Parallel -> Fused GeLU -> Row-Parallel) across P = 4 workers
  WHEN executing the complete forward pass
  THEN exactly 1 All-Reduce collective synchronization occurs across the entire block
  AND all 4 workers receive the exact identical synchronized output tensor matching centralized execution (< 1e-6)

SCENARIO: BDD-1705 Vocabulary Parallelism & Sharded Cross-Entropy Loss Computation
  GIVEN an output dimension representing vocabulary V = 16 partitioned across P = 4 workers
  WHEN calculating distributed cross-entropy loss against ground-truth target tokens
  THEN loss matches monolithic centralized cross-entropy within 1e-6
  AND full vocabulary logit matrices are never allocated on any single worker

SCENARIO: BDD-1706 Structural Invariant Audit & Cryptographic SHA-256 Receipt
  GIVEN a distributed Megatron-LM tensor parallel configuration
  WHEN running toolchain:megatron:audit
  THEN audit status is VERIFIED with exact numerical parity and memory reduction confirmed
  AND a deterministic SHA-256 cryptographic receipt is recorded in docs/evidence/
```
