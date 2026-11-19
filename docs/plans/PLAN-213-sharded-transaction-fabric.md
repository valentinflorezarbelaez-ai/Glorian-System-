# PLAN-213: Architectural Plan for Sharded Transaction Fabric (`SPEC-351`)

- **Change ID**: `CHANGE-213`
- **Spec**: `SPEC-351`
- **Status**: `APPROVED`
- **Lead Architect**: Autonomous Engineering Director (Antigravity / EOS)

---

## 1. Architectural Strategy

The Sharded Transaction Fabric establishes a horizontally partitioned distributed storage and execution mesh:

1. **Consistent Hash Ring Engine**:
   - Computes 32-bit hashes for virtual node identifiers (`${shardId}#vnode-${i}`) using high-speed FNV-1a.
   - Maintains sorted ring array of hash tokens.
   - Locates target shards in $\mathcal{O}(\log K)$ time using binary search with clockwise wrapping.
2. **Multi-Version Concurrency Control (MVCC)**:
   - Each state record stores an array of historical versions with commit timestamps and transaction IDs.
   - Reads at timestamp $T$ return the latest version with $\text{commitTimestamp} \le T$.
   - Writes check if another uncommitted transaction holds a lock on the key.
3. **Two-Phase Commit (2PC) Coordinator**:
   - `prepare`: Broadcasts prepared writes to all involved participant shards.
   - Each shard verifies lock availability and MVCC version constraints, reserving resources.
   - If all shards respond `VOTE_COMMIT`, coordinator sends `COMMIT` with commit timestamp.
   - If any shard votes `VOTE_ABORT` or times out, coordinator sends `ROLLBACK`.
4. **Post-Quantum Attestation Vouchers**:
   - Every vote and commit acknowledgement is packaged in an attestation envelope signed with SHA-384/HMAC digest, validating provenance and integrity.

---

## 2. Architecture Decision Records (ADRs)

### ADR-213-001: Consistent Hash Ring with 64 Vnodes per Shard

- **Context**: Direct modulo sharding causes massive key movement whenever shards are added or removed.
- **Decision**: Use a consistent hash ring with 64 virtual nodes per physical shard, distributing keys with standard deviation $\le 15\%$.
- **Consequence**: Minimal key migration on topology change, O(log N) lookup overhead.

### ADR-213-002: Strict Two-Phase Commit with Fail-Closed Rollback

- **Context**: Partial multi-shard writes cause catastrophic inconsistency in distributed agent state.
- **Decision**: Enforce synchronous 2PC with fail-closed compensating rollbacks on any negative vote or timeout.
- **Consequence**: Guaranteed atomicity across heterogeneous shards without centralized database dependencies.
