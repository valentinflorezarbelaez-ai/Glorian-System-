/**
 * EOS SYSTEM — LAYER-0 MODIFIED MERKLE PATRICIA TRIE (SPEC-229)
 * Type Definitions & Node Interfaces
 *
 * Cryptographically verifiable key-value state storage with hex-prefix compact encoding,
 * RLP serialization, and standalone Merkle inclusion/exclusion proof verification.
 *
 * Zero external runtime dependencies.
 */

export type TrieNodeType = "null" | "leaf" | "extension" | "branch";

export type Nibbles = number[];

export interface NullNode {
  readonly type: "null";
}

export interface LeafNode {
  readonly type: "leaf";
  readonly path: Nibbles;
  readonly value: Buffer;
}

export interface ExtensionNode {
  readonly type: "extension";
  readonly path: Nibbles;
  readonly child: TrieNode | Buffer;
}

export interface BranchNode {
  readonly type: "branch";
  readonly branches: (TrieNode | Buffer | null)[];
  value: Buffer | null;
}

export type TrieNode = NullNode | LeafNode | ExtensionNode | BranchNode;

export type RlpItem = Buffer | RlpItem[];

export interface TrieProof {
  readonly keyHex: string;
  readonly rootHashHex: string;
  readonly proofNodesHex: string[];
  readonly inclusion: boolean;
  readonly valueHex: string | null;
}

export interface TrieStats {
  readonly keyCount: number;
  readonly rootHashHex: string;
  readonly rootType: TrieNodeType;
}
