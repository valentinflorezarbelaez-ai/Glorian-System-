/**
 * EOS SYSTEM — DYNAMO ANTI-ENTROPY MERKLE SYNC (Layer 0)
 * Governed by ADR-042, FR-105 & BDD-096
 *
 * Implements Amazon Dynamo style hierarchical Merkle Tree state synchronization.
 * Allows distributed replicas to detect out-of-sync key ranges in O(log K) without
 * transferring intact data over cross-datacenter links.
 *
 * Zero external runtime dependencies.
 */

import crypto from "node:crypto";

export interface MerkleNode {
  hash: string;
  rangeStart: number;
  rangeEnd: number;
  children?: MerkleNode[];
  keysCount: number;
}

export interface SyncDiffResult {
  inSync: boolean;
  divergentRanges: Array<{ rangeStart: number; rangeEnd: number; expectedHash: string; actualHash: string }>;
  comparisonsCount: number;
}

export class EosAntiEntropyMerkleSync {
  private readonly numBuckets: number;
  private readonly buckets: Map<number, Map<string, string>>; // bucketIndex -> (key -> valueHash)

  constructor(numBuckets = 16) {
    this.numBuckets = numBuckets;
    this.buckets = new Map();
    for (let i = 0; i < this.numBuckets; i++) {
      this.buckets.set(i, new Map());
    }
  }

  /**
   * Hashes a key into a specific bucket index in [0, numBuckets - 1].
   */
  private getBucketIndex(key: string): number {
    const hash = crypto.createHash("md5").update(key).digest();
    const val = hash.readUInt32BE(0);
    return val % this.numBuckets;
  }

  /**
   * Puts or updates a key-value entry into the replica's local state.
   */
  public put(key: string, value: string | Record<string, any>): void {
    const bucketIdx = this.getBucketIndex(key);
    const valueString = typeof value === "string" ? value : JSON.stringify(value);
    const valHash = crypto.createHash("sha256").update(valueString).digest("hex");
    this.buckets.get(bucketIdx)!.set(key, valHash);
  }

  /**
   * Removes a key from the local state.
   */
  public delete(key: string): void {
    const bucketIdx = this.getBucketIndex(key);
    this.buckets.get(bucketIdx)!.delete(key);
  }

  /**
   * Builds a hierarchical Merkle Tree over the bucketed state.
   */
  public buildMerkleTree(): MerkleNode {
    // 1. Build leaf nodes for each bucket
    const leaves: MerkleNode[] = [];
    for (let i = 0; i < this.numBuckets; i++) {
      const bucket = this.buckets.get(i)!;
      const sortedKeys = Array.from(bucket.keys()).sort();
      const hasher = crypto.createHash("sha256");

      for (const k of sortedKeys) {
        hasher.update(`${k}:${bucket.get(k)}|`);
      }

      const leafHash = hasher.digest("hex");
      leaves.push({
        hash: leafHash,
        rangeStart: i,
        rangeEnd: i,
        keysCount: bucket.size,
      });
    }

    // 2. Build binary/tree structure up to root
    return this.constructTree(leaves);
  }

  private constructTree(nodes: MerkleNode[]): MerkleNode {
    if (nodes.length === 1) {
      return nodes[0];
    }

    const parents: MerkleNode[] = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = i + 1 < nodes.length ? nodes[i + 1] : undefined;

      if (!right) {
        parents.push(left);
        continue;
      }

      const combinedHash = crypto.createHash("sha256").update(`${left.hash}:${right.hash}`).digest("hex");

      parents.push({
        hash: combinedHash,
        rangeStart: left.rangeStart,
        rangeEnd: right.rangeEnd,
        children: [left, right],
        keysCount: left.keysCount + right.keysCount,
      });
    }

    return this.constructTree(parents);
  }

  /**
   * Compares two Merkle Trees and returns only the divergent key ranges.
   * Runs in O(log B) where B is the number of buckets.
   */
  public static compareTrees(treeA: MerkleNode, treeB: MerkleNode): SyncDiffResult {
    let comparisons = 1;
    if (treeA.hash === treeB.hash) {
      return {
        inSync: true,
        divergentRanges: [],
        comparisonsCount: comparisons,
      };
    }

    const divergentRanges: Array<{ rangeStart: number; rangeEnd: number; expectedHash: string; actualHash: string }> =
      [];

    function traverse(nodeA: MerkleNode, nodeB: MerkleNode): void {
      comparisons++;
      if (nodeA.hash === nodeB.hash) {
        return; // Subtrees are identical
      }

      // If leaf reached
      if (!nodeA.children || !nodeB.children) {
        divergentRanges.push({
          rangeStart: nodeA.rangeStart,
          rangeEnd: nodeA.rangeEnd,
          expectedHash: nodeA.hash,
          actualHash: nodeB.hash,
        });
        return;
      }

      // Recursively compare children
      const minLen = Math.min(nodeA.children.length, nodeB.children.length);
      for (let i = 0; i < minLen; i++) {
        traverse(nodeA.children[i], nodeB.children[i]);
      }
    }

    traverse(treeA, treeB);

    return {
      inSync: false,
      divergentRanges,
      comparisonsCount: comparisons,
    };
  }
}
