/**
 * EOS SYSTEM — LAYER-0 MODIFIED MERKLE PATRICIA TRIE (SPEC-229)
 *
 * Modified Merkle Patricia Trie (MPT) providing cryptographically verifiable key-value
 * state commitments with:
 * 1. Compact Hex-Prefix Path Encoding (even/odd nibbles with leaf/extension flags)
 * 2. Pure Layer-0 Recursive Length Prefix (RLP) serialization
 * 3. 4-Node Architecture: Null, Leaf, Extension, Branch (16-ary)
 * 4. Automatic branch compaction and collapsing on deletion
 * 5. Standalone Merkle Inclusion and Exclusion proof generation and verification
 *
 * FIPS 180-4 SHA-256 node hashing via Node.js 24 crypto built-in.
 * Zero external runtime dependencies.
 */

import { createHash } from "node:crypto";
import type {
  BranchNode,
  ExtensionNode,
  LeafNode,
  Nibbles,
  NullNode,
  RlpItem,
  TrieNode,
  TrieProof,
  TrieStats,
} from "./eosMerklePatriciaTrieCore.types.ts";

/**
 * Pure Layer-0 Recursive Length Prefix (RLP) Encoder and Decoder.
 */
export class EosRlp {
  static encode(item: RlpItem): Buffer {
    if (Buffer.isBuffer(item)) {
      if (item.length === 1 && item[0] < 0x80) {
        return item;
      }
      if (item.length <= 55) {
        return Buffer.concat([Buffer.from([0x80 + item.length]), item]);
      }
      const lenBuf = EosRlp.encodeLength(item.length);
      return Buffer.concat([Buffer.from([0xb7 + lenBuf.length]), lenBuf, item]);
    }

    if (Array.isArray(item)) {
      const encodedChildren = Buffer.concat(item.map((child) => EosRlp.encode(child)));
      if (encodedChildren.length <= 55) {
        return Buffer.concat([Buffer.from([0xc0 + encodedChildren.length]), encodedChildren]);
      }
      const lenBuf = EosRlp.encodeLength(encodedChildren.length);
      return Buffer.concat([Buffer.from([0xf7 + lenBuf.length]), lenBuf, encodedChildren]);
    }

    throw new TypeError("EosRlp.encode: item must be Buffer or Array of RlpItems");
  }

  static decode(buf: Buffer): RlpItem {
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      return Buffer.alloc(0);
    }
    const { item } = EosRlp.decodeSlice(buf, 0);
    return item;
  }

  private static decodeSlice(buf: Buffer, offset: number): { item: RlpItem; nextOffset: number } {
    if (offset >= buf.length) {
      return { item: Buffer.alloc(0), nextOffset: offset };
    }
    const prefix = buf[offset];

    // Single byte < 0x80
    if (prefix < 0x80) {
      return { item: buf.subarray(offset, offset + 1), nextOffset: offset + 1 };
    }

    // Short string (0-55 bytes)
    if (prefix <= 0xb7) {
      const len = prefix - 0x80;
      const end = offset + 1 + len;
      return { item: buf.subarray(offset + 1, end), nextOffset: end };
    }

    // Long string (> 55 bytes)
    if (prefix <= 0xbf) {
      const lenOfLen = prefix - 0xb7;
      const len = EosRlp.readInt(buf, offset + 1, lenOfLen);
      const start = offset + 1 + lenOfLen;
      const end = start + len;
      return { item: buf.subarray(start, end), nextOffset: end };
    }

    // Short list (0-55 bytes payload)
    if (prefix <= 0xf7) {
      const len = prefix - 0xc0;
      const end = offset + 1 + len;
      const items = EosRlp.decodeListPayload(buf, offset + 1, end);
      return { item: items, nextOffset: end };
    }

    // Long list (> 55 bytes payload)
    const lenOfLen = prefix - 0xf7;
    const len = EosRlp.readInt(buf, offset + 1, lenOfLen);
    const start = offset + 1 + lenOfLen;
    const end = start + len;
    const items = EosRlp.decodeListPayload(buf, start, end);
    return { item: items, nextOffset: end };
  }

  private static decodeListPayload(buf: Buffer, start: number, end: number): RlpItem[] {
    const list: RlpItem[] = [];
    let cur = start;
    while (cur < end) {
      const { item, nextOffset } = EosRlp.decodeSlice(buf, cur);
      list.push(item);
      cur = nextOffset;
    }
    return list;
  }

  private static encodeLength(length: number): Buffer {
    const hex = length.toString(16);
    const padded = hex.length % 2 === 0 ? hex : "0" + hex;
    return Buffer.from(padded, "hex");
  }

  private static readInt(buf: Buffer, offset: number, byteCount: number): number {
    let val = 0;
    for (let i = 0; i < byteCount; i++) {
      val = val * 256 + buf[offset + i];
    }
    return val;
  }
}

/**
 * Pure Hex-Prefix (Compact) Encoding and Decoding.
 */
export class EosHexPrefix {
  static bytesToNibbles(buf: Buffer): Nibbles {
    const nibbles: Nibbles = [];
    for (let i = 0; i < buf.length; i++) {
      nibbles.push(buf[i] >> 4);
      nibbles.push(buf[i] & 0x0f);
    }
    return nibbles;
  }

  static stringToNibbles(str: string): Nibbles {
    return EosHexPrefix.bytesToNibbles(Buffer.from(str, "utf8"));
  }

  static encodePath(nibbles: Nibbles, isLeaf: boolean): Buffer {
    const isOdd = nibbles.length % 2 === 1;
    const flag = (isLeaf ? 2 : 0) | (isOdd ? 1 : 0);

    if (isOdd) {
      // First byte combines flag and first nibble
      const firstByte = (flag << 4) | nibbles[0];
      const restBytes: number[] = [firstByte];
      for (let i = 1; i < nibbles.length; i += 2) {
        restBytes.push((nibbles[i] << 4) | nibbles[i + 1]);
      }
      return Buffer.from(restBytes);
    }

    // Even length: first byte has flag in high nibble, 0 in low nibble
    const firstByte = flag << 4;
    const restBytes: number[] = [firstByte];
    for (let i = 0; i < nibbles.length; i += 2) {
      restBytes.push((nibbles[i] << 4) | nibbles[i + 1]);
    }
    return Buffer.from(restBytes);
  }

  static decodePath(buf: Buffer): { nibbles: Nibbles; isLeaf: boolean } {
    if (buf.length === 0) {
      return { nibbles: [], isLeaf: false };
    }
    const b0 = buf[0];
    const flagNibble = b0 >> 4;
    const isLeaf = (flagNibble & 0x02) !== 0;
    const isOdd = (flagNibble & 0x01) !== 0;

    const nibbles: Nibbles = [];
    if (isOdd) {
      nibbles.push(b0 & 0x0f);
    }
    for (let i = 1; i < buf.length; i++) {
      nibbles.push(buf[i] >> 4);
      nibbles.push(buf[i] & 0x0f);
    }
    return { nibbles, isLeaf };
  }

  static matchingNibbleCount(a: Nibbles, b: Nibbles): number {
    const max = Math.min(a.length, b.length);
    let i = 0;
    while (i < max && a[i] === b[i]) {
      i++;
    }
    return i;
  }
}

/**
 * EosMerklePatriciaTrieCore
 *
 * Modified Merkle Patricia Trie implementation with deterministic SHA-256 root hashing
 * and inclusion/exclusion proof generation and verification.
 */
export class EosMerklePatriciaTrieCore {
  private root: TrieNode = { type: "null" };
  private keyCountInternal = 0;

  constructor() {}

  /**
   * Helper to hash an arbitrary buffer with SHA-256.
   */
  static sha256(buf: Buffer): Buffer {
    return createHash("sha256").update(buf).digest();
  }

  /**
   * Serializes a TrieNode into its canonical RlpItem representation.
   */
  static serializeNode(node: TrieNode): RlpItem {
    if (node.type === "null") {
      return Buffer.alloc(0);
    }

    if (node.type === "leaf") {
      const encodedPath = EosHexPrefix.encodePath(node.path, true);
      return [encodedPath, node.value];
    }

    if (node.type === "extension") {
      const encodedPath = EosHexPrefix.encodePath(node.path, false);
      const childRef = EosMerklePatriciaTrieCore.nodeReference(node.child);
      return [encodedPath, childRef];
    }

    // Branch node
    const items: RlpItem[] = [];
    for (let i = 0; i < 16; i++) {
      const child = node.branches[i];
      if (!child) {
        items.push(Buffer.alloc(0));
      } else {
        items.push(EosMerklePatriciaTrieCore.nodeReference(child));
      }
    }
    items.push(node.value ? node.value : Buffer.alloc(0));
    return items;
  }

  /**
   * Computes the node reference: embedded node if RLP < 32 bytes, otherwise SHA-256 hash.
   */
  static nodeReference(nodeOrHash: TrieNode | Buffer): RlpItem {
    if (Buffer.isBuffer(nodeOrHash)) {
      return nodeOrHash;
    }
    const rlp = EosRlp.encode(EosMerklePatriciaTrieCore.serializeNode(nodeOrHash));
    if (rlp.length < 32) {
      return EosMerklePatriciaTrieCore.serializeNode(nodeOrHash);
    }
    return EosMerklePatriciaTrieCore.sha256(rlp);
  }

  /**
   * Computes the 32-byte SHA-256 root hash of the trie.
   */
  getRootHash(): string {
    if (this.root.type === "null") {
      return EosMerklePatriciaTrieCore.sha256(Buffer.alloc(0)).toString("hex");
    }
    const rlp = EosRlp.encode(EosMerklePatriciaTrieCore.serializeNode(this.root));
    if (rlp.length < 32) {
      return EosMerklePatriciaTrieCore.sha256(rlp).toString("hex");
    }
    return EosMerklePatriciaTrieCore.sha256(rlp).toString("hex");
  }

  /**
   * Inserts or updates a key-value pair in the trie.
   */
  put(key: string | Buffer, value: string | Buffer): void {
    const keyBuf = typeof key === "string" ? Buffer.from(key, "utf8") : key;
    const valBuf = typeof value === "string" ? Buffer.from(value, "utf8") : value;
    const nibbles = EosHexPrefix.bytesToNibbles(keyBuf);

    const hadKey = this.get(key) !== null;
    this.root = this.insertRecursive(this.root, nibbles, valBuf);
    if (!hadKey) {
      this.keyCountInternal++;
    }
  }

  private insertRecursive(node: TrieNode, nibbles: Nibbles, value: Buffer): TrieNode {
    if (node.type === "null") {
      return { type: "leaf", path: nibbles, value };
    }

    if (node.type === "leaf") {
      const match = EosHexPrefix.matchingNibbleCount(node.path, nibbles);
      if (match === node.path.length && match === nibbles.length) {
        // Exact overwrite
        return { type: "leaf", path: node.path, value };
      }

      const branch: BranchNode = {
        type: "branch",
        branches: new Array(16).fill(null),
        value: null,
      };

      // Place existing leaf
      if (match === node.path.length) {
        branch.value = node.value;
      } else {
        const oldNibble = node.path[match];
        branch.branches[oldNibble] = {
          type: "leaf",
          path: node.path.slice(match + 1),
          value: node.value,
        };
      }

      // Place new leaf
      if (match === nibbles.length) {
        branch.value = value;
      } else {
        const newNibble = nibbles[match];
        branch.branches[newNibble] = {
          type: "leaf",
          path: nibbles.slice(match + 1),
          value,
        };
      }

      if (match === 0) {
        return branch;
      }
      return {
        type: "extension",
        path: node.path.slice(0, match),
        child: branch,
      };
    }

    if (node.type === "extension") {
      const match = EosHexPrefix.matchingNibbleCount(node.path, nibbles);
      if (match === node.path.length) {
        // Full extension matched, recurse into child
        const childNode = this.resolveChild(node.child);
        const updatedChild = this.insertRecursive(childNode, nibbles.slice(match), value);
        return { type: "extension", path: node.path, child: updatedChild };
      }

      // Split extension
      const branch: BranchNode = {
        type: "branch",
        branches: new Array(16).fill(null),
        value: null,
      };

      const oldNibble = node.path[match];
      const remainingOldPath = node.path.slice(match + 1);
      if (remainingOldPath.length === 0) {
        branch.branches[oldNibble] = node.child;
      } else {
        branch.branches[oldNibble] = {
          type: "extension",
          path: remainingOldPath,
          child: node.child,
        };
      }

      if (match === nibbles.length) {
        branch.value = value;
      } else {
        const newNibble = nibbles[match];
        branch.branches[newNibble] = {
          type: "leaf",
          path: nibbles.slice(match + 1),
          value,
        };
      }

      if (match === 0) {
        return branch;
      }
      return {
        type: "extension",
        path: node.path.slice(0, match),
        child: branch,
      };
    }

    // Branch node
    if (nibbles.length === 0) {
      return { ...node, value };
    }

    const branchIdx = nibbles[0];
    const existingChild = node.branches[branchIdx]
      ? this.resolveChild(node.branches[branchIdx]!)
      : { type: "null" as const };
    const updatedChild = this.insertRecursive(existingChild, nibbles.slice(1), value);

    const newBranches = [...node.branches];
    newBranches[branchIdx] = updatedChild;
    return { type: "branch", branches: newBranches, value: node.value };
  }

  /**
   * Retrieves the value Buffer for a given key, or null if absent.
   */
  get(key: string | Buffer): Buffer | null {
    const keyBuf = typeof key === "string" ? Buffer.from(key, "utf8") : key;
    const nibbles = EosHexPrefix.bytesToNibbles(keyBuf);
    return this.getRecursive(this.root, nibbles);
  }

  private getRecursive(node: TrieNode, nibbles: Nibbles): Buffer | null {
    if (node.type === "null") {
      return null;
    }

    if (node.type === "leaf") {
      if (node.path.length !== nibbles.length) return null;
      for (let i = 0; i < nibbles.length; i++) {
        if (node.path[i] !== nibbles[i]) return null;
      }
      return node.value;
    }

    if (node.type === "extension") {
      const match = EosHexPrefix.matchingNibbleCount(node.path, nibbles);
      if (match !== node.path.length) return null;
      const child = this.resolveChild(node.child);
      return this.getRecursive(child, nibbles.slice(match));
    }

    // Branch node
    if (nibbles.length === 0) {
      return node.value;
    }
    const child = node.branches[nibbles[0]];
    if (!child) return null;
    return this.getRecursive(this.resolveChild(child), nibbles.slice(1));
  }

  /**
   * Removes a key from the trie and compacts branches.
   */
  delete(key: string | Buffer): boolean {
    const keyBuf = typeof key === "string" ? Buffer.from(key, "utf8") : key;
    const nibbles = EosHexPrefix.bytesToNibbles(keyBuf);

    if (this.get(key) === null) {
      return false;
    }

    this.root = this.deleteRecursive(this.root, nibbles);
    this.keyCountInternal = Math.max(0, this.keyCountInternal - 1);
    return true;
  }

  private deleteRecursive(node: TrieNode, nibbles: Nibbles): TrieNode {
    if (node.type === "null") {
      return { type: "null" };
    }

    if (node.type === "leaf") {
      if (
        node.path.length === nibbles.length &&
        EosHexPrefix.matchingNibbleCount(node.path, nibbles) === nibbles.length
      ) {
        return { type: "null" };
      }
      return node;
    }

    if (node.type === "extension") {
      const match = EosHexPrefix.matchingNibbleCount(node.path, nibbles);
      if (match !== node.path.length) return node;

      const child = this.resolveChild(node.child);
      const updatedChild = this.deleteRecursive(child, nibbles.slice(match));

      if (updatedChild.type === "null") {
        return { type: "null" };
      }
      if (updatedChild.type === "extension") {
        return {
          type: "extension",
          path: [...node.path, ...updatedChild.path],
          child: updatedChild.child,
        };
      }
      if (updatedChild.type === "leaf") {
        return {
          type: "leaf",
          path: [...node.path, ...updatedChild.path],
          value: updatedChild.value,
        };
      }
      return { type: "extension", path: node.path, child: updatedChild };
    }

    // Branch node
    if (nibbles.length === 0) {
      const updated: BranchNode = { ...node, value: null };
      return this.compactBranch(updated);
    }

    const branchIdx = nibbles[0];
    const child = node.branches[branchIdx];
    if (!child) return node;

    const updatedChild = this.deleteRecursive(this.resolveChild(child), nibbles.slice(1));
    const newBranches = [...node.branches];
    newBranches[branchIdx] = updatedChild.type === "null" ? null : updatedChild;

    const updatedBranch: BranchNode = { type: "branch", branches: newBranches, value: node.value };
    return this.compactBranch(updatedBranch);
  }

  private compactBranch(branch: BranchNode): TrieNode {
    let nonNullCount = 0;
    let singleIdx = -1;

    for (let i = 0; i < 16; i++) {
      if (branch.branches[i]) {
        nonNullCount++;
        singleIdx = i;
      }
    }

    // Case 1: No children and no value -> null node
    if (nonNullCount === 0 && !branch.value) {
      return { type: "null" };
    }

    // Case 2: No children, but has value -> leaf with empty path
    if (nonNullCount === 0 && branch.value) {
      return { type: "leaf", path: [], value: branch.value };
    }

    // Case 3: Exactly 1 child, and no value -> compact branch into child path
    if (nonNullCount === 1 && !branch.value) {
      const child = this.resolveChild(branch.branches[singleIdx]!);
      if (child.type === "leaf") {
        return {
          type: "leaf",
          path: [singleIdx, ...child.path],
          value: child.value,
        };
      }
      if (child.type === "extension") {
        return {
          type: "extension",
          path: [singleIdx, ...child.path],
          child: child.child,
        };
      }
      // If child is a branch, wrap in extension of length 1
      return {
        type: "extension",
        path: [singleIdx],
        child,
      };
    }

    return branch;
  }

  private resolveChild(child: TrieNode | Buffer): TrieNode {
    if (Buffer.isBuffer(child)) {
      throw new Error("Embedded/hashed node resolution requires external DB storage");
    }
    return child;
  }

  /**
   * Generates a cryptographic Merkle proof for a given key.
   * Returns an array of RLP-encoded node buffers along the path.
   */
  prove(key: string | Buffer): TrieProof {
    const keyBuf = typeof key === "string" ? Buffer.from(key, "utf8") : key;
    const nibbles = EosHexPrefix.bytesToNibbles(keyBuf);
    const proofBuffers: Buffer[] = [];

    const value = this.proveRecursive(this.root, nibbles, proofBuffers);
    const rootHashHex = this.getRootHash();

    return {
      keyHex: keyBuf.toString("hex"),
      rootHashHex,
      proofNodesHex: proofBuffers.map((b) => b.toString("hex")),
      inclusion: value !== null,
      valueHex: value ? value.toString("hex") : null,
    };
  }

  private proveRecursive(node: TrieNode, nibbles: Nibbles, proof: Buffer[]): Buffer | null {
    if (node.type === "null") {
      return null;
    }

    // Record current node in proof
    const rlp = EosRlp.encode(EosMerklePatriciaTrieCore.serializeNode(node));
    proof.push(rlp);

    if (node.type === "leaf") {
      if (
        node.path.length === nibbles.length &&
        EosHexPrefix.matchingNibbleCount(node.path, nibbles) === nibbles.length
      ) {
        return node.value;
      }
      return null;
    }

    if (node.type === "extension") {
      const match = EosHexPrefix.matchingNibbleCount(node.path, nibbles);
      if (match !== node.path.length) {
        return null;
      }
      const child = this.resolveChild(node.child);
      return this.proveRecursive(child, nibbles.slice(match), proof);
    }

    // Branch node
    if (nibbles.length === 0) {
      return node.value;
    }
    const child = node.branches[nibbles[0]];
    if (!child) return null;
    return this.proveRecursive(this.resolveChild(child), nibbles.slice(1), proof);
  }

  /**
   * Standalone verification of a Merkle inclusion/exclusion proof against a 32-byte root hash.
   * Does NOT require an active trie instance.
   */
  static verifyProof(rootHashHex: string, key: string | Buffer, proofNodesHex: (string | Buffer)[]): Buffer | null {
    const keyBuf = typeof key === "string" ? Buffer.from(key, "utf8") : key;
    const nibbles = EosHexPrefix.bytesToNibbles(keyBuf);

    if (proofNodesHex.length === 0) {
      const emptyHash = EosMerklePatriciaTrieCore.sha256(Buffer.alloc(0)).toString("hex");
      if (rootHashHex.toLowerCase() === emptyHash.toLowerCase()) {
        return null;
      }
      throw new Error("verifyProof: Empty proof provided for non-empty root");
    }

    // Build hash dictionary
    const proofDict = new Map<string, Buffer>();
    for (const item of proofNodesHex) {
      const buf = Buffer.isBuffer(item) ? item : Buffer.from(item, "hex");
      const hash = EosMerklePatriciaTrieCore.sha256(buf).toString("hex").toLowerCase();
      proofDict.set(hash, buf);
    }

    // Verify first proof node matches root hash
    const rootBuf = Buffer.isBuffer(proofNodesHex[0]) ? proofNodesHex[0] : Buffer.from(proofNodesHex[0], "hex");
    const computedRoot = EosMerklePatriciaTrieCore.sha256(rootBuf).toString("hex").toLowerCase();
    if (computedRoot !== rootHashHex.toLowerCase()) {
      throw new Error(`verifyProof: Root proof node does not match target root hash`);
    }

    // Traverse proof nodes
    let curNode: RlpItem = EosRlp.decode(rootBuf);
    let curNibbles: Nibbles = nibbles;

    while (curNode) {
      if (!Array.isArray(curNode)) {
        return null;
      }

      // Branch node (17 elements)
      if (curNode.length === 17) {
        if (curNibbles.length === 0) {
          const val = curNode[16];
          return Buffer.isBuffer(val) && val.length > 0 ? val : null;
        }
        const nextNibble = curNibbles[0];
        const childRef = curNode[nextNibble];
        if (!childRef || (Buffer.isBuffer(childRef) && childRef.length === 0)) return null;
        curNibbles = curNibbles.slice(1);
        curNode = EosMerklePatriciaTrieCore.resolveProofChild(childRef, proofDict, "hash") as RlpItem;
        if (!curNode) return null;
        continue;
      }

      if (curNode.length === 2) {
        const { nibbles: nodeNibbles, isLeaf } = EosHexPrefix.decodePath(curNode[0] as Buffer);
        if (isLeaf) {
          return nodeNibbles.length === curNibbles.length &&
            EosHexPrefix.matchingNibbleCount(nodeNibbles, curNibbles) === curNibbles.length
            ? (curNode[1] as Buffer)
            : null;
        }
        const match = EosHexPrefix.matchingNibbleCount(nodeNibbles, curNibbles);
        if (match !== nodeNibbles.length) return null;
        curNibbles = curNibbles.slice(match);
        curNode = EosMerklePatriciaTrieCore.resolveProofChild(curNode[1], proofDict, "extension hash") as RlpItem;
        if (!curNode) return null;
        continue;
      }

      throw new Error(`verifyProof: Invalid MPT node length: ${curNode.length}`);
    }

    return null;
  }

  private static resolveProofChild(childRef: RlpItem, proofDict: Map<string, Buffer>, label: string): RlpItem | null {
    if (Buffer.isBuffer(childRef) && childRef.length === 32) {
      const nextHash = childRef.toString("hex").toLowerCase();
      const nextNodeBuf = proofDict.get(nextHash);
      if (!nextNodeBuf) throw new Error(`verifyProof: Missing proof node for ${label} ${nextHash}`);
      return EosRlp.decode(nextNodeBuf);
    }
    if (Array.isArray(childRef)) return childRef;
    return Buffer.isBuffer(childRef) ? EosRlp.decode(childRef) : null;
  }

  /**
   * Returns metadata and stats on the current trie state.
   */
  stats(): TrieStats {
    return {
      keyCount: this.keyCountInternal,
      rootHashHex: this.getRootHash(),
      rootType: this.root.type,
    };
  }

  /**
   * Resets the trie to empty state.
   */
  clear(): void {
    this.root = { type: "null" };
    this.keyCountInternal = 0;
  }
}
