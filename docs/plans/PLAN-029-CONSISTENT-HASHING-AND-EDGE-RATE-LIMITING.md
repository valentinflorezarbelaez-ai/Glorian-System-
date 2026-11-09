# PLAN-029: IMPLEMENTATION ARCHITECTURE FOR CONSISTENT HASHING & EDGE RATE LIMITING

## 1. Architectural Design & ADR-042

### ADR-042: Amazon Dynamo Consistent Hash Ring, Virtual Nodes & Hierarchical Anti-Entropy

- **Status**: ACCEPTED
- **Context**: Scaling storage and compute across planetary clusters requires deterministic node assignment with minimal movement during topology mutations. State drift between partitioned nodes must be synchronized efficiently.
- **Decision**:
  1. Implement `EosConsistentHashRing` mapping MD5/SHA-256 tokens into a $[0, 2^{32}-1]$ uint32 ring.
  2. Assign 64 virtual nodes per physical node to prevent hotspotting.
  3. Implement `EosAntiEntropyMerkleSync` building 4-level radix-16 Merkle trees over key partitions.
  4. Implement `EosTokenBucketRateLimiter` utilizing nanosecond monotonic deltas (`process.hrtime.bigint()`).
- **Rejected Alternatives**:
  - Modulo hashing (`hash(k) % N`): Rejected due to $O(K)$ key movement on node join/leave.
  - Gossip-only full table exchange: Rejected due to $O(K)$ network bandwidth saturation.
  - Sliding window memory arrays: Rejected due to GC pressure under high request volume.
- **Consequences**:
  - Zero allocation lookup in $O(\log(N \times V))$.
  - Fast delta synchronization without raw payload leakage.
  - Sub-microsecond rate-limiting overhead (< 50ns per token check).
