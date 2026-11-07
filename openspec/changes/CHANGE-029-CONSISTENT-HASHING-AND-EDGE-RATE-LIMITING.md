# CHANGE-029: AMAZON DYNAMO CONSISTENT HASHING, ANTI-ENTROPY MERKLE SYNC & CLOUDFLARE TOKEN-BUCKET

## 1. Summary

Introduces Layer-0 distributed consistent hashing with virtual nodes (Amazon Dynamo / Apache Cassandra), hierarchical anti-entropy Merkle tree state synchronization, and Cloudflare-grade microsecond token-bucket edge rate limiting with zero npm dependencies.

## 2. Rationale

Eliminates rehash storms when cluster topologies scale, reduces cross-datacenter replica synchronization bandwidth from $O(K)$ to $O(\log K)$, and protects public endpoints against micro-burst DDoS attacks.

## 3. Specifications Involved

- `SPEC-036-CONSISTENT-HASHING-AND-EDGE-RATE-LIMITING.md`

## 4. Modules Added

- `src/core/eosConsistentHashRing.ts`
- `src/core/eosAntiEntropyMerkleSync.ts`
- `src/core/eosTokenBucketRateLimiter.ts`
- `test/eosConsistentHashingRateLimiter.test.mjs`
