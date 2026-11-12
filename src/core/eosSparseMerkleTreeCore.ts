/**
 * EOS Layer-0 Sparse Merkle Tree (SMT) with Non-Membership Proofs (SPEC-218)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 24 Strip-Only TypeScript.
 * Enforces IEEE 830 EARS FR-1109..FR-1113 and ISO/IEC/IEEE 29148 BDD-1109..BDD-1113.
 */

import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  type SmtProof,
  type SmtSibling,
  type SmtReceipt,
  type SmtVerificationResult,
  type SmtSnapshot,
  type SmtOperationType,
} from "./eosSparseMerkleTreeCore.types.ts";

/* -------------------------------------------------------------------------- */
/* Design by Contract (DbC) Helpers                                          */
/* -------------------------------------------------------------------------- */

function assertPrecondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[PRECONDITION_FAILED] ${message}`);
  }
}

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function pureSha256(data: string | Uint8Array): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/* -------------------------------------------------------------------------- */
/* Trie Math & Precomputed Empty Hash Tables (FR-1109)                        */
/* -------------------------------------------------------------------------- */

export const SMT_DEPTH = 256;

// Precompute empty hashes for depths 0..256
export const EMPTY_HASHES: readonly string[] = (() => {
  const hashes: string[] = new Array(SMT_DEPTH + 1);
  hashes[0] = pureSha256("eos-smt-empty:0");
  for (let i = 1; i <= SMT_DEPTH; i++) {
    hashes[i] = pureSha256(`eos-smt-branch:${hashes[i - 1]}:${hashes[i - 1]}`);
  }
  return Object.freeze(hashes);
})();

export function getBit(pathHex: string, depth: number): number {
  const byteIdx = depth >> 3;
  const bitIdx = 7 - (depth & 7);
  const byte = parseInt(pathHex.slice(byteIdx * 2, byteIdx * 2 + 2), 16);
  return (byte >> bitIdx) & 1;
}

export function hashLeaf(pathHex: string, valueHash: string): string {
  return pureSha256(`eos-smt-leaf:${pathHex}:${valueHash}`);
}

export function hashBranch(leftHash: string, rightHash: string): string {
  return pureSha256(`eos-smt-branch:${leftHash}:${rightHash}`);
}

/* -------------------------------------------------------------------------- */
/* Internal SMT Node Hierarchies                                              */
/* -------------------------------------------------------------------------- */

interface SmtLeafNode {
  readonly type: "leaf";
  readonly key: string;
  readonly pathHex: string;
  readonly value: string;
  readonly valueHash: string;
  readonly hash: string;
}

interface SmtBranchNode {
  readonly type: "branch";
  left: SmtNode | null;
  right: SmtNode | null;
  hash: string;
}

type SmtNode = SmtLeafNode | SmtBranchNode;

/* -------------------------------------------------------------------------- */
/* Layer-0 Sparse Merkle Tree Engine Class                                    */
/* -------------------------------------------------------------------------- */

export class EosSparseMerkleTreeCore {
  private _rootNode: SmtNode | null;
  private _leafCount: number;

  public constructor() {
    this._rootNode = null;
    this._leafCount = 0;
  }

  public getLeafCount(): number {
    return this._leafCount;
  }

  public getRoot(): string {
    return this._rootNode ? this._rootNode.hash : EMPTY_HASHES[SMT_DEPTH];
  }

  public get(key: string): string | null {
    assertPrecondition(typeof key === "string" && key.length > 0, "Key must be non-empty string");
    const pathHex = pureSha256(`eos-smt-key:${key}`);
    const leaf = this._findLeaf(this._rootNode, pathHex, 0);
    return leaf && leaf.key === key ? leaf.value : null;
  }

  public set(key: string, value: string): { root: string; leafCount: number; receipt: SmtReceipt } {
    assertPrecondition(typeof key === "string" && key.length > 0, "Key must be non-empty string");
    assertPrecondition(typeof value === "string", "Value must be a string");

    const pathHex = pureSha256(`eos-smt-key:${key}`);
    const valueHash = pureSha256(`eos-smt-val:${value}`);

    const leafNode: SmtLeafNode = {
      type: "leaf",
      key,
      pathHex,
      value,
      valueHash,
      hash: hashLeaf(pathHex, valueHash),
    };

    const countBefore = this._leafCount;
    this._rootNode = this._insert(this._rootNode, leafNode, 0);
    const root = this.getRoot();

    const receipt = this._createReceipt("set", root, `key:${key}`);

    return deepFreeze({
      root,
      leafCount: this._leafCount,
      receipt,
    });
  }

  public delete(key: string): { root: string; leafCount: number; receipt: SmtReceipt } {
    assertPrecondition(typeof key === "string" && key.length > 0, "Key must be non-empty string");
    const pathHex = pureSha256(`eos-smt-key:${key}`);

    this._rootNode = this._deleteNode(this._rootNode, pathHex, 0);
    const root = this.getRoot();
    const receipt = this._createReceipt("delete", root, `key:${key}`);

    return deepFreeze({
      root,
      leafCount: this._leafCount,
      receipt,
    });
  }

  public getProof(key: string): SmtProof {
    assertPrecondition(typeof key === "string" && key.length > 0, "Key must be non-empty string");
    const pathHex = pureSha256(`eos-smt-key:${key}`);
    const siblings: SmtSibling[] = [];

    const result = this._collectProof(this._rootNode, pathHex, 0, siblings);
    const root = this.getRoot();

    if (result && result.key === key) {
      return deepFreeze({
        proofType: "membership",
        key,
        keyPath: pathHex,
        value: result.value,
        valueHash: result.valueHash,
        siblings,
        root,
      });
    }

    if (!result) {
      return deepFreeze({
        proofType: "non_membership",
        key,
        keyPath: pathHex,
        value: null,
        valueHash: "",
        nonMembershipReason: "EMPTY_SUBTREE",
        siblings,
        root,
      });
    }

    // result is another leaf occupying the path
    return deepFreeze({
      proofType: "non_membership",
      key,
      keyPath: pathHex,
      value: null,
      valueHash: "",
      nonMembershipReason: "KEY_COLLISION",
      conflictingKey: result.key,
      conflictingValueHash: result.valueHash,
      siblings,
      root,
    });
  }

  public verifyProof(proof: SmtProof): SmtVerificationResult {
    const startTime = performance.now();
    let currentHash: string;

    if (proof.proofType === "membership") {
      assertPrecondition(proof.value !== null, "Membership proof must contain non-null value");
      const computedValueHash = pureSha256(`eos-smt-val:${proof.value}`);
      if (computedValueHash !== proof.valueHash) {
        return this._makeVerifyResult(false, proof.proofType, startTime, proof.root, "VALUE_HASH_MISMATCH");
      }
      currentHash = hashLeaf(proof.keyPath, proof.valueHash);
    } else {
      if (proof.nonMembershipReason === "EMPTY_SUBTREE") {
        const remainingHeight = SMT_DEPTH - proof.siblings.length;
        currentHash = EMPTY_HASHES[remainingHeight];
      } else if (proof.nonMembershipReason === "KEY_COLLISION") {
        assertPrecondition(Boolean(proof.conflictingKey), "Conflicting key must be present in collision proof");
        assertPrecondition(Boolean(proof.conflictingValueHash), "Conflicting value hash must be present");
        const conflictingPathHex = pureSha256(`eos-smt-key:${proof.conflictingKey}`);
        if (conflictingPathHex === proof.keyPath) {
          return this._makeVerifyResult(false, proof.proofType, startTime, proof.root, "IDENTICAL_KEY_COLLISION");
        }
        currentHash = hashLeaf(conflictingPathHex, proof.conflictingValueHash!);
      } else {
        return this._makeVerifyResult(false, proof.proofType, startTime, proof.root, "UNKNOWN_NON_MEMBERSHIP_REASON");
      }
    }

    // Fold siblings upwards
    for (let i = proof.siblings.length - 1; i >= 0; i--) {
      const sib = proof.siblings[i];
      if (sib.isRight) {
        currentHash = hashBranch(currentHash, sib.hash);
      } else {
        currentHash = hashBranch(sib.hash, currentHash);
      }
    }

    const valid = currentHash === proof.root;
    return this._makeVerifyResult(
      valid,
      proof.proofType,
      startTime,
      proof.root,
      valid ? "VERIFIED_AUTHENTIC" : "REJECTED_ROOT_MISMATCH",
    );
  }

  public exportSnapshot(): SmtSnapshot {
    return deepFreeze({
      leafCount: this.getLeafCount(),
      root: this.getRoot(),
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Internal Recursive Tree Operations                                        */
  /* -------------------------------------------------------------------------- */

  private _insert(node: SmtNode | null, newLeaf: SmtLeafNode, depth: number): SmtNode {
    if (depth >= SMT_DEPTH) {
      return newLeaf;
    }

    if (node === null) {
      this._leafCount++;
      return newLeaf;
    }

    if (node.type === "leaf") {
      if (node.pathHex === newLeaf.pathHex) {
        // In-place value update
        return newLeaf;
      }

      // Branch collision: create a branch node and push both leaves down
      const branch: SmtBranchNode = {
        type: "branch",
        left: null,
        right: null,
        hash: "",
      };

      const bitExisting = getBit(node.pathHex, depth);
      const bitNew = getBit(newLeaf.pathHex, depth);

      if (bitExisting === 0) {
        branch.left = node;
      } else {
        branch.right = node;
      }

      // Recurse to place newLeaf
      if (bitNew === 0) {
        branch.left = this._insert(branch.left, newLeaf, depth + 1);
      } else {
        branch.right = this._insert(branch.right, newLeaf, depth + 1);
      }

      this._recomputeBranchHash(branch, depth);
      return branch;
    }

    // Node is branch
    const bit = getBit(newLeaf.pathHex, depth);
    if (bit === 0) {
      node.left = this._insert(node.left, newLeaf, depth + 1);
    } else {
      node.right = this._insert(node.right, newLeaf, depth + 1);
    }

    this._recomputeBranchHash(node, depth);
    return node;
  }

  private _deleteNode(node: SmtNode | null, pathHex: string, depth: number): SmtNode | null {
    if (node === null || depth >= SMT_DEPTH) {
      return null;
    }

    if (node.type === "leaf") {
      if (node.pathHex === pathHex) {
        this._leafCount--;
        return null;
      }
      return node;
    }

    const bit = getBit(pathHex, depth);
    if (bit === 0) {
      node.left = this._deleteNode(node.left, pathHex, depth + 1);
    } else {
      node.right = this._deleteNode(node.right, pathHex, depth + 1);
    }

    // Collapse empty branches
    if (node.left === null && node.right === null) {
      return null;
    }

    this._recomputeBranchHash(node, depth);
    return node;
  }

  private _findLeaf(node: SmtNode | null, pathHex: string, depth: number): SmtLeafNode | null {
    if (node === null) return null;
    if (node.type === "leaf") return node;

    const bit = getBit(pathHex, depth);
    return bit === 0 ? this._findLeaf(node.left, pathHex, depth + 1) : this._findLeaf(node.right, pathHex, depth + 1);
  }

  private _collectProof(
    node: SmtNode | null,
    pathHex: string,
    depth: number,
    siblings: SmtSibling[],
  ): SmtLeafNode | null {
    if (node === null) {
      return null;
    }

    if (node.type === "leaf") {
      return node;
    }

    const bit = getBit(pathHex, depth);
    const childHeight = SMT_DEPTH - 1 - depth;

    if (bit === 0) {
      const rightHash = node.right ? node.right.hash : EMPTY_HASHES[childHeight];
      siblings.push({ depth, isRight: true, hash: rightHash });
      return this._collectProof(node.left, pathHex, depth + 1, siblings);
    } else {
      const leftHash = node.left ? node.left.hash : EMPTY_HASHES[childHeight];
      siblings.push({ depth, isRight: false, hash: leftHash });
      return this._collectProof(node.right, pathHex, depth + 1, siblings);
    }
  }

  private _recomputeBranchHash(branch: SmtBranchNode, depth: number): void {
    const childHeight = SMT_DEPTH - 1 - depth;
    const leftHash = branch.left ? branch.left.hash : EMPTY_HASHES[childHeight];
    const rightHash = branch.right ? branch.right.hash : EMPTY_HASHES[childHeight];
    branch.hash = hashBranch(leftHash, rightHash);
  }

  private _makeVerifyResult(
    valid: boolean,
    proofType: "membership" | "non_membership",
    startTime: number,
    root: string,
    tag: string,
  ): SmtVerificationResult {
    const elapsedMs = performance.now() - startTime;
    const receipt = this._createReceipt("verify", root, tag);
    return deepFreeze({
      valid,
      proofType,
      verificationTimeMs: elapsedMs,
      receipt,
    });
  }

  private _createReceipt(operation: SmtOperationType, root: string, outputDigest?: string): SmtReceipt {
    const timestamp = new Date().toISOString();
    const receiptId = `eos-smt-${operation}-${pureSha256(`${root}:${timestamp}`).slice(0, 16)}`;
    const digest = outputDigest ?? root;
    const receiptSha256 = pureSha256(`${receiptId}:${root}:${digest}:${timestamp}`);
    return deepFreeze({
      receiptId,
      operation,
      timestamp,
      root,
      receiptSha256,
    });
  }
}
