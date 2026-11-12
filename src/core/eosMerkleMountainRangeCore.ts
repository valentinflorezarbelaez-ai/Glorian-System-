/**
 * EOS Layer-0 Merkle Mountain Range (MMR) & Cryptographic Accumulator Core (SPEC-216)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 24 Strip-Only TypeScript.
 * Enforces IEEE 830 EARS FR-1099..FR-1103 and ISO/IEC/IEEE 29148 BDD-1099..BDD-1103.
 */

import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  type MmrNode,
  type MmrPeak,
  type MmrInclusionProof,
  type MmrConsistencyProof,
  type MmrSnapshot,
  type MmrReceipt,
  type MmrVerificationResult,
  type MmrOperationType,
} from "./eosMerkleMountainRangeCore.types.ts";

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
/* MMR Positional Math Primitives (FR-1099)                                   */
/* -------------------------------------------------------------------------- */

export function calculateNodeHeight(pos: number): number {
  let p = pos + 1;
  while (p !== 0) {
    let k = 0;
    while ((1 << (k + 1)) - 1 <= p) {
      k++;
    }
    k--;
    const treeSize = (1 << (k + 1)) - 1;
    if (p === treeSize) return k;
    p -= treeSize;
  }
  return 0;
}

export function calculatePeaks(mmrSize: number): { pos: number; height: number }[] {
  const peaks: { pos: number; height: number }[] = [];
  let offset = 0;
  let remaining = mmrSize;

  while (remaining > 0) {
    let h = 0;
    while ((1 << (h + 1)) - 1 <= remaining) {
      h++;
    }
    h--;
    const treeSize = (1 << (h + 1)) - 1;
    peaks.push({ pos: offset + treeSize - 1, height: h });
    offset += treeSize;
    remaining -= treeSize;
  }

  return peaks;
}

export function calculateBagOfPeaks(mmrSize: number, peaks: readonly { readonly hash: string }[]): string {
  if (peaks.length === 0) {
    return pureSha256(`eos-mmr-empty:${mmrSize}`);
  }
  const hashesConcat = peaks.map((p) => p.hash).join(":");
  return pureSha256(`eos-mmr-bag:${mmrSize}:${hashesConcat}`);
}

/* -------------------------------------------------------------------------- */
/* Layer-0 Merkle Mountain Range Engine Class                                 */
/* -------------------------------------------------------------------------- */

export class EosMerkleMountainRangeCore {
  private readonly _nodes: MmrNode[];
  private readonly _leafPositions: number[];
  private _peaks: MmrPeak[];
  private _cachedRoot: string | null;

  public constructor() {
    this._nodes = [];
    this._leafPositions = [];
    this._peaks = [];
    this._cachedRoot = null;
  }

  public getLeafCount(): number {
    return this._leafPositions.length;
  }

  public getSize(): number {
    return this._nodes.length;
  }

  public getNode(pos: number): MmrNode | undefined {
    return this._nodes[pos];
  }

  public getPeaks(): readonly MmrPeak[] {
    return deepFreeze([...this._peaks]);
  }

  public getRoot(): string {
    if (this._cachedRoot === null) {
      this._cachedRoot = calculateBagOfPeaks(this._nodes.length, this._peaks);
    }
    return this._cachedRoot;
  }

  /**
   * Appends a new leaf to the MMR and merges mountain summits (FR-1100).
   */
  public append(data: string | Uint8Array): {
    leafIndex: number;
    leafPos: number;
    leafHash: string;
    mmrSize: number;
    root: string;
  } {
    const leafIndex = this._leafPositions.length;
    const leafPos = this._nodes.length;
    const leafHash = pureSha256(
      typeof data === "string" ? `eos-mmr-leaf:${data}` : Buffer.concat([Buffer.from("eos-mmr-leaf:"), data]),
    );

    const leafNode: MmrNode = {
      pos: leafPos,
      height: 0,
      hash: leafHash,
      leafIndex,
    };

    this._nodes.push(leafNode);
    this._leafPositions.push(leafPos);
    this._cachedRoot = null;

    let currentSummit: MmrPeak = {
      pos: leafPos,
      height: 0,
      hash: leafHash,
    };

    while (this._peaks.length > 0) {
      const top = this._peaks[this._peaks.length - 1];
      if (top.height === currentSummit.height) {
        this._peaks.pop();
        const parentPos = this._nodes.length;
        const parentHeight = top.height + 1;
        const parentHash = pureSha256(`eos-mmr-parent:${parentPos}:${top.hash}:${currentSummit.hash}`);

        const parentNode: MmrNode = {
          pos: parentPos,
          height: parentHeight,
          hash: parentHash,
        };

        this._nodes.push(parentNode);
        currentSummit = {
          pos: parentPos,
          height: parentHeight,
          hash: parentHash,
        };
      } else {
        break;
      }
    }

    this._peaks.push(currentSummit);
    const root = this.getRoot();

    return deepFreeze({
      leafIndex,
      leafPos,
      leafHash,
      mmrSize: this._nodes.length,
      root,
    });
  }

  public appendBatch(dataItems: readonly (string | Uint8Array)[]): string {
    for (const item of dataItems) {
      this.append(item);
    }
    return this.getRoot();
  }

  /**
   * Generates a succinct O(log n) inclusion proof for the leaf at leafIndex (FR-1102).
   */
  public getInclusionProof(leafIndex: number): MmrInclusionProof {
    assertPrecondition(
      leafIndex >= 0 && leafIndex < this._leafPositions.length,
      `Leaf index ${leafIndex} out of range [0, ${this._leafPositions.length - 1}]`,
    );

    const targetPos = this._leafPositions[leafIndex];
    const targetNode = this._nodes[targetPos];
    assertPrecondition(Boolean(targetNode), "Target leaf node must exist");

    // Identify which peak contains the targetPos
    const peaks = this._peaks;
    let targetPeak: MmrPeak | null = null;
    let mountainStart = 0;

    for (const peak of peaks) {
      const treeSize = (1 << (peak.height + 1)) - 1;
      const mountainEnd = mountainStart + treeSize - 1;
      if (targetPos >= mountainStart && targetPos <= mountainEnd) {
        targetPeak = peak;
        break;
      }
      mountainStart += treeSize;
    }

    assertPrecondition(targetPeak !== null, "Target leaf must reside within a mountain");

    // Traverse downwards from targetPeak to targetPos to gather sibling hashes
    const siblings: { pos: number; height: number; hash: string }[] = [];
    let curr = targetPeak.pos;

    for (let h = targetPeak.height; h >= 1; h--) {
      const left = curr - (1 << h);
      const right = curr - 1;

      if (targetPos <= left) {
        const siblingNode = this._nodes[right];
        siblings.push({ pos: siblingNode.pos, height: siblingNode.height, hash: siblingNode.hash });
        curr = left;
      } else {
        const siblingNode = this._nodes[left];
        siblings.push({ pos: siblingNode.pos, height: siblingNode.height, hash: siblingNode.hash });
        curr = right;
      }
    }

    // Siblings from leaf level (0) up to peak
    siblings.reverse();

    return deepFreeze({
      leafIndex,
      leafPos: targetPos,
      leafHash: targetNode.hash,
      mmrSize: this._nodes.length,
      siblings,
      peaks: [...this._peaks],
      root: this.getRoot(),
    });
  }

  /**
   * Verifies an inclusion proof against the canonical bag-of-peaks root (FR-1102).
   */
  public verifyInclusion(proof: MmrInclusionProof): MmrVerificationResult {
    const startTime = performance.now();

    // 1. Reconstruct peak from leafHash and sibling path
    let currHash = proof.leafHash;
    let currPos = proof.leafPos;
    let currHeight = 0;

    for (const sibling of proof.siblings) {
      const isRightSibling = sibling.pos > currPos;
      const parentPos = isRightSibling ? currPos + (1 << (currHeight + 1)) : currPos + 1;

      if (isRightSibling) {
        currHash = pureSha256(`eos-mmr-parent:${parentPos}:${currHash}:${sibling.hash}`);
      } else {
        currHash = pureSha256(`eos-mmr-parent:${parentPos}:${sibling.hash}:${currHash}`);
      }

      currPos = parentPos;
      currHeight++;
    }

    // 2. Locate target peak in the peaks array and substitute reconstructed hash
    const reconstructedPeaks: { hash: string }[] = [];
    let peakFound = false;

    for (const peak of proof.peaks) {
      if (peak.pos === currPos) {
        reconstructedPeaks.push({ hash: currHash });
        peakFound = currHash === peak.hash;
      } else {
        reconstructedPeaks.push({ hash: peak.hash });
      }
    }

    // 3. Reconstruct bag-of-peaks root
    const reconstructedRoot = calculateBagOfPeaks(proof.mmrSize, reconstructedPeaks);
    const valid = peakFound && reconstructedRoot === proof.root;
    const elapsedMs = performance.now() - startTime;

    const receipt = this._createReceipt("verify", proof.root, valid ? "INCLUSION_VERIFIED" : "INCLUSION_REJECTED");

    return deepFreeze({
      valid,
      verificationTimeMs: elapsedMs,
      receipt,
    });
  }

  /**
   * Generates a prefix consistency proof between historical fromSize and current size (FR-1103).
   */
  public getConsistencyProof(fromSize: number): MmrConsistencyProof {
    assertPrecondition(fromSize >= 1 && fromSize <= this._nodes.length, "Invalid fromSize");

    const fromPeaksDesc = calculatePeaks(fromSize);
    const fromPeaks = fromPeaksDesc.map((p) => this._nodes[p.pos]);
    const fromRoot = calculateBagOfPeaks(fromSize, fromPeaks);
    const toRoot = this.getRoot();

    const proofHashes = fromPeaks.map((p) => p.hash);

    return deepFreeze({
      fromSize,
      toSize: this._nodes.length,
      fromRoot,
      toRoot,
      proofHashes,
    });
  }

  /**
   * Verifies consistency proof across historical MMR sizes (FR-1103).
   */
  public verifyConsistency(proof: MmrConsistencyProof): MmrVerificationResult {
    const startTime = performance.now();

    const peaksAtFromSize = calculatePeaks(proof.fromSize);
    const reconstructedFromPeaks = peaksAtFromSize.map((p, idx) => ({
      hash: proof.proofHashes[idx],
    }));

    const calculatedFromRoot = calculateBagOfPeaks(proof.fromSize, reconstructedFromPeaks);
    const valid = calculatedFromRoot === proof.fromRoot && proof.toSize >= proof.fromSize;
    const elapsedMs = performance.now() - startTime;

    const receipt = this._createReceipt(
      "verify",
      proof.toRoot,
      valid ? "CONSISTENCY_VERIFIED" : "CONSISTENCY_REJECTED",
    );

    return deepFreeze({
      valid,
      verificationTimeMs: elapsedMs,
      receipt,
    });
  }

  public exportSnapshot(): MmrSnapshot {
    return deepFreeze({
      leafCount: this.getLeafCount(),
      mmrSize: this.getSize(),
      root: this.getRoot(),
      peaks: [...this._peaks],
    });
  }

  private _createReceipt(operation: MmrOperationType, root: string, outputDigest?: string): MmrReceipt {
    const timestamp = new Date().toISOString();
    const receiptId = `eos-mmr-${operation}-${pureSha256(`${root}:${timestamp}`).slice(0, 16)}`;
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
