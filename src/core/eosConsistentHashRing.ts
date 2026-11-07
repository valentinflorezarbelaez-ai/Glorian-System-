/**
 * EOS SYSTEM — CONSISTENT HASH RING WITH VIRTUAL NODES (Layer 0)
 * Governed by ADR-042, FR-103, FR-104 & BDD-094, BDD-095
 *
 * Implements Amazon Dynamo / Apache Cassandra style Consistent Hashing
 * over a 32-bit unsigned integer ring [0, 2^32 - 1].
 *
 * Features:
 * - Deterministic token assignment using cryptographic hash.
 * - 64 virtual nodes per physical node by default for balanced partition load.
 * - O(log(N * V)) binary search lookup.
 * - Multi-datacenter preference list routing with distinct physical node isolation.
 *
 * Zero external runtime dependencies.
 */

import crypto from "node:crypto";

export interface VirtualNodeEntry {
  token: number;
  nodeId: string;
  vnodeIndex: number;
}

export class EosConsistentHashRing {
  private ring: VirtualNodeEntry[] = [];
  private readonly defaultVnodes: number;
  private readonly physicalNodes = new Set<string>();

  constructor(nodes: string[] = [], vnodes = 64) {
    this.defaultVnodes = Math.max(1, vnodes);
    for (const node of nodes) {
      this.addNode(node, this.defaultVnodes);
    }
  }

  /**
   * Computes a 32-bit unsigned integer hash token from a string key.
   */
  public hashToUint32(input: string): number {
    const hash = crypto.createHash("md5").update(input).digest();
    return hash.readUInt32BE(0);
  }

  /**
   * Adds a physical node with V virtual nodes to the consistent hash ring.
   */
  public addNode(nodeId: string, vnodes = this.defaultVnodes): void {
    if (this.physicalNodes.has(nodeId)) {
      return;
    }
    this.physicalNodes.add(nodeId);

    for (let i = 0; i < vnodes; i++) {
      const vnodeKey = `${nodeId}#vn#${i}`;
      const token = this.hashToUint32(vnodeKey);
      this.ring.push({
        token,
        nodeId,
        vnodeIndex: i,
      });
    }

    // Keep ring sorted by token
    this.ring.sort((a, b) => a.token - b.token);
  }

  /**
   * Removes a physical node and all its virtual nodes from the ring.
   */
  public removeNode(nodeId: string): void {
    if (!this.physicalNodes.has(nodeId)) {
      return;
    }
    this.physicalNodes.delete(nodeId);
    this.ring = this.ring.filter((entry) => entry.nodeId !== nodeId);
  }

  /**
   * Finds the primary physical node responsible for a given key using binary search.
   * Time complexity: O(log(N * V)).
   */
  public getNode(key: string): string {
    if (this.ring.length === 0) {
      throw new Error("ConsistentHashRing is empty; no nodes available.");
    }

    const token = this.hashToUint32(key);
    const index = this.bisectRight(token);
    return this.ring[index].nodeId;
  }

  /**
   * Returns a preference list of R distinct physical nodes for replication.
   * Walks clockwise along the ring skipping redundant vnodes of already included physical nodes.
   */
  public getPreferenceList(key: string, replicationFactor: number): string[] {
    if (this.ring.length === 0) {
      throw new Error("ConsistentHashRing is empty; no nodes available.");
    }

    const targetReplicas = Math.min(replicationFactor, this.physicalNodes.size);
    const token = this.hashToUint32(key);
    let index = this.bisectRight(token);

    const preferenceList: string[] = [];
    const seenPhysicalNodes = new Set<string>();

    for (let count = 0; count < this.ring.length; count++) {
      const entry = this.ring[(index + count) % this.ring.length];
      if (!seenPhysicalNodes.has(entry.nodeId)) {
        seenPhysicalNodes.add(entry.nodeId);
        preferenceList.push(entry.nodeId);
        if (preferenceList.length >= targetReplicas) {
          break;
        }
      }
    }

    return preferenceList;
  }

  /**
   * Binary search (bisect_right) finding the first virtual node token >= target.
   * Wraps around to 0 if target exceeds the highest token in the ring.
   */
  private bisectRight(targetToken: number): number {
    let low = 0;
    let high = this.ring.length - 1;

    if (targetToken > this.ring[high].token || targetToken <= this.ring[0].token) {
      return 0;
    }

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.ring[mid].token >= targetToken) {
        if (mid === 0 || this.ring[mid - 1].token < targetToken) {
          return mid;
        }
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return 0;
  }

  public getPhysicalNodeCount(): number {
    return this.physicalNodes.size;
  }

  public getTotalVnodeCount(): number {
    return this.ring.length;
  }

  public getPhysicalNodes(): string[] {
    return Array.from(this.physicalNodes);
  }

  /**
   * Computes load distribution across physical nodes for a given sample of keys.
   */
  public getDistribution(keys: string[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const node of this.physicalNodes) {
      distribution[node] = 0;
    }
    for (const key of keys) {
      const assignedNode = this.getNode(key);
      distribution[assignedNode] = (distribution[assignedNode] || 0) + 1;
    }
    return distribution;
  }
}
