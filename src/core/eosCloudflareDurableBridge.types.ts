/**
 * EOS SYSTEM — CLOUDFLARE DURABLE OBJECTS PERSISTENT STATE & ACTOR MESH (TYPES)
 * Governed by SPEC-297, CHANGE-159, IEEE 830 EARS, BDD-1557..1562
 *
 * Provides typed data contracts for stateful edge actor lifecycles, WebSocket hibernation,
 * embedded transactional edge storage, and sub-5ms semantic prompt vector caching.
 * Zero external runtime npm dependencies (Law V).
 */

export type DurableActorStatus = "INITIALIZED" | "ACTIVE" | "HIBERNATED" | "TERMINATED";

export interface DurableActorMessage {
  readonly id: string;
  readonly sender: string;
  readonly payload: unknown;
  readonly timestamp: number;
}

export interface DurableActorSnapshot {
  readonly actorId: string;
  readonly status: DurableActorStatus;
  readonly storageKeyCount: number;
  readonly activeWebSockets: number;
  readonly messageCount: number;
  readonly lastActiveTimestamp: number;
}

export interface EdgeStorageEntry {
  readonly key: string;
  readonly value: unknown;
  readonly version: number;
  readonly updatedAt: number;
}

export interface SemanticVectorEntry {
  readonly prompt: string;
  readonly vector: readonly number[];
  readonly response: unknown;
  readonly createdAt: number;
  readonly ttlMs: number;
  readonly hitCount: number;
}

export interface SemanticVectorMatch {
  readonly hit: boolean;
  readonly similarity: number;
  readonly response?: unknown;
  readonly cachedPrompt?: string;
  readonly latencyMs: number;
}

export interface EdgeBridgeSignedRequest {
  readonly payload: unknown;
  readonly signature: string;
  readonly timestamp: number;
  readonly keyId: string;
}

export interface DurableObjectsAuditReceipt {
  readonly specId: "SPEC-297";
  readonly changeId: "CHANGE-159";
  readonly timestamp: string;
  readonly actorsSpawned: number;
  readonly transactionsAudited: number;
  readonly cacheHitRate: number;
  readonly edgeBridgeVerified: boolean;
  readonly sha256Signature: string;
}
