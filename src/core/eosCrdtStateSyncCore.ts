/**
 * EOS Layer-0 Conflict-Free Replicated Data Types (CRDT) Core (SPEC-215)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 24 Strip-Only TypeScript.
 * Enforces IEEE 830 EARS FR-1094..FR-1098 and ISO/IEC/IEEE 29148 BDD-1094..BDD-1098.
 */

import crypto from "node:crypto";
import {
  type VectorOrdering,
  type LwwRegister,
  type OrSetElement,
  type OrSetSnapshot,
  type RgaNode,
  type CrdtStateSnapshot,
  type CrdtDelta,
  type CrdtReceipt,
  type CrdtMergeResult,
  type CrdtOperationType,
} from "./eosCrdtStateSyncCore.types.ts";

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

function pureSha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/* -------------------------------------------------------------------------- */
/* Causal Vector Clock Operations (FR-1094)                                   */
/* -------------------------------------------------------------------------- */

export function vectorClockIncrement(clock: Record<string, number>, nodeId: string): Record<string, number> {
  const current = clock[nodeId] ?? 0;
  return {
    ...clock,
    [nodeId]: current + 1,
  };
}

export function vectorClockJoin(c1: Record<string, number>, c2: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = { ...c1 };
  for (const [k, v] of Object.entries(c2)) {
    result[k] = Math.max(result[k] ?? 0, v);
  }
  return result;
}

export function vectorClockCompare(c1: Record<string, number>, c2: Record<string, number>): VectorOrdering {
  let hasLess = false;
  let hasGreater = false;

  const allKeys = new Set([...Object.keys(c1), ...Object.keys(c2)]);
  for (const k of allKeys) {
    const v1 = c1[k] ?? 0;
    const v2 = c2[k] ?? 0;
    if (v1 < v2) hasLess = true;
    if (v1 > v2) hasGreater = true;
  }

  if (hasLess && hasGreater) return "CONCURRENT";
  if (hasLess) return "LESS";
  if (hasGreater) return "GREATER";
  return "EQUAL";
}

/* -------------------------------------------------------------------------- */
/* LWW-Register Functions (FR-1095)                                           */
/* -------------------------------------------------------------------------- */

export function lwwRegisterMerge<T>(r1: LwwRegister<T>, r2: LwwRegister<T>): LwwRegister<T> {
  if (r1.timestamp > r2.timestamp) return r1;
  if (r2.timestamp > r1.timestamp) return r2;
  return r1.nodeId.localeCompare(r2.nodeId) >= 0 ? r1 : r2;
}

/* -------------------------------------------------------------------------- */
/* ORSet (Observed-Remove Set) Functions (FR-1096)                            */
/* -------------------------------------------------------------------------- */

export function orSetAdd<T>(
  set: OrSetSnapshot<T>,
  element: T,
  nodeId: string,
  timestamp: number,
  tagSeq: number = 0,
): OrSetSnapshot<T> {
  const tag = pureSha256(`${JSON.stringify(element)}:${nodeId}:${timestamp}:${tagSeq}`);
  const newAdd: OrSetElement<T> = { element, tag, timestamp, nodeId };
  return {
    adds: [...set.adds, newAdd],
    removes: set.removes,
  };
}

export function orSetRemove<T>(set: OrSetSnapshot<T>, element: T): OrSetSnapshot<T> {
  const serialized = JSON.stringify(element);
  const tagsToRemove: string[] = [];
  for (const item of set.adds) {
    if (JSON.stringify(item.element) === serialized) {
      tagsToRemove.push(item.tag);
    }
  }
  return {
    adds: set.adds,
    removes: Array.from(new Set([...set.removes, ...tagsToRemove])),
  };
}

export function orSetRead<T>(set: OrSetSnapshot<T>): T[] {
  const removeSet = new Set(set.removes);
  const activeMap = new Map<string, T>();
  for (const item of set.adds) {
    if (!removeSet.has(item.tag)) {
      activeMap.set(JSON.stringify(item.element), item.element);
    }
  }
  return Array.from(activeMap.values());
}

export function orSetMerge<T>(s1: OrSetSnapshot<T>, s2: OrSetSnapshot<T>): OrSetSnapshot<T> {
  const addMap = new Map<string, OrSetElement<T>>();
  for (const item of s1.adds) addMap.set(item.tag, item);
  for (const item of s2.adds) addMap.set(item.tag, item);

  const removes = Array.from(new Set([...s1.removes, ...s2.removes]));
  return {
    adds: Array.from(addMap.values()),
    removes,
  };
}

/* -------------------------------------------------------------------------- */
/* RGA (Replicated Growable Array) Functions (FR-1097)                         */
/* -------------------------------------------------------------------------- */

function compareRgaOrder(a: RgaNode, b: RgaNode): number {
  if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
  return b.nodeId.localeCompare(a.nodeId);
}

export function rgaReconstruct<T>(nodes: readonly RgaNode<T>[]): RgaNode<T>[] {
  const childrenOf = new Map<string, RgaNode<T>[]>();
  for (const n of nodes) {
    const p = n.parentId ?? "ROOT";
    if (!childrenOf.has(p)) childrenOf.set(p, []);
    childrenOf.get(p)!.push(n);
  }

  for (const siblings of childrenOf.values()) {
    siblings.sort(compareRgaOrder);
  }

  const result: RgaNode<T>[] = [];
  function traverse(parentId: string): void {
    const children = childrenOf.get(parentId) ?? [];
    for (const child of children) {
      result.push(child);
      traverse(child.id);
    }
  }
  traverse("ROOT");
  return result;
}

export function rgaRead<T>(nodes: readonly RgaNode<T>[]): T[] {
  const sorted = rgaReconstruct(nodes);
  return sorted.filter((n) => !n.deleted).map((n) => n.value);
}

export function rgaMerge<T>(r1: readonly RgaNode<T>[], r2: readonly RgaNode<T>[]): RgaNode<T>[] {
  const nodeMap = new Map<string, RgaNode<T>>();
  for (const n of r1) nodeMap.set(n.id, n);
  for (const n of r2) {
    const existing = nodeMap.get(n.id);
    if (!existing) {
      nodeMap.set(n.id, n);
    } else if (n.deleted && !existing.deleted) {
      nodeMap.set(n.id, { ...existing, deleted: true });
    }
  }
  return rgaReconstruct(Array.from(nodeMap.values()));
}

/* -------------------------------------------------------------------------- */
/* Layer-0 CRDT State Sync Core Class (FR-1098)                               */
/* -------------------------------------------------------------------------- */

export class EosCrdtStateSyncCore {
  public readonly nodeId: string;
  private _vectorClock: Record<string, number>;
  private _registers: Map<string, LwwRegister>;
  private _sets: Map<string, OrSetSnapshot>;
  private _sequences: Map<string, RgaNode[]>;
  private _seqCounter: number;

  public constructor(nodeId: string, initialClock?: Record<string, number>) {
    assertPrecondition(Boolean(nodeId && nodeId.trim()), "NodeId must not be empty");
    this.nodeId = nodeId.trim();
    this._vectorClock = { ...initialClock, [this.nodeId]: initialClock?.[this.nodeId] ?? 0 };
    this._registers = new Map();
    this._sets = new Map();
    this._sequences = new Map();
    this._seqCounter = 0;
  }

  public get vectorClock(): Readonly<Record<string, number>> {
    return { ...this._vectorClock };
  }

  public setRegister<T>(key: string, value: T): LwwRegister<T> {
    assertPrecondition(Boolean(key), "Register key must not be empty");
    this._vectorClock = vectorClockIncrement(this._vectorClock, this.nodeId);
    const timestamp = this._vectorClock[this.nodeId];
    const reg: LwwRegister<T> = { value, timestamp, nodeId: this.nodeId };
    this._registers.set(key, reg as LwwRegister);
    return deepFreeze(reg);
  }

  public getRegister<T>(key: string): T | undefined {
    return this._registers.get(key)?.value as T | undefined;
  }

  public addToSet<T>(setName: string, element: T): OrSetSnapshot<T> {
    assertPrecondition(Boolean(setName), "Set name must not be empty");
    this._vectorClock = vectorClockIncrement(this._vectorClock, this.nodeId);
    const timestamp = this._vectorClock[this.nodeId];
    const current = (this._sets.get(setName) as OrSetSnapshot<T>) ?? { adds: [], removes: [] };
    const updated = orSetAdd(current, element, this.nodeId, timestamp, ++this._seqCounter);
    this._sets.set(setName, updated as OrSetSnapshot);
    return deepFreeze(updated);
  }

  public removeFromSet<T>(setName: string, element: T): OrSetSnapshot<T> {
    assertPrecondition(Boolean(setName), "Set name must not be empty");
    this._vectorClock = vectorClockIncrement(this._vectorClock, this.nodeId);
    const current = (this._sets.get(setName) as OrSetSnapshot<T>) ?? { adds: [], removes: [] };
    const updated = orSetRemove(current, element);
    this._sets.set(setName, updated as OrSetSnapshot);
    return deepFreeze(updated);
  }

  public readSet<T>(setName: string): T[] {
    const current = (this._sets.get(setName) as OrSetSnapshot<T>) ?? { adds: [], removes: [] };
    return orSetRead(current);
  }

  public insertSequence<T>(seqName: string, value: T, afterIndex: number = -1): RgaNode<T> {
    assertPrecondition(Boolean(seqName), "Sequence name must not be empty");
    this._vectorClock = vectorClockIncrement(this._vectorClock, this.nodeId);
    const timestamp = this._vectorClock[this.nodeId];

    const currentNodes = (this._sequences.get(seqName) as RgaNode<T>[]) ?? [];
    const activeNodes = rgaReconstruct(currentNodes).filter((n) => !n.deleted);

    let parentId: string | null = null;
    if (afterIndex >= 0 && afterIndex < activeNodes.length) {
      parentId = activeNodes[afterIndex].id;
    } else if (afterIndex >= activeNodes.length && activeNodes.length > 0) {
      parentId = activeNodes[activeNodes.length - 1].id;
    }

    const id = `${timestamp}:${this.nodeId}:${++this._seqCounter}`;
    const newNode: RgaNode<T> = {
      id,
      parentId,
      value,
      deleted: false,
      timestamp,
      nodeId: this.nodeId,
    };

    const updatedList = rgaMerge(currentNodes, [newNode]);
    this._sequences.set(seqName, updatedList as RgaNode[]);
    return deepFreeze(newNode);
  }

  public deleteSequence(seqName: string, activeIndex: number): boolean {
    const currentNodes = this._sequences.get(seqName) ?? [];
    const activeNodes = rgaReconstruct(currentNodes).filter((n) => !n.deleted);
    if (activeIndex < 0 || activeIndex >= activeNodes.length) return false;

    const targetId = activeNodes[activeIndex].id;
    this._vectorClock = vectorClockIncrement(this._vectorClock, this.nodeId);
    const updatedList = currentNodes.map((n) => (n.id === targetId ? { ...n, deleted: true } : n));
    this._sequences.set(seqName, rgaReconstruct(updatedList));
    return true;
  }

  public readSequence<T>(seqName: string): T[] {
    const nodes = (this._sequences.get(seqName) as RgaNode<T>[]) ?? [];
    return rgaRead(nodes);
  }

  public computeStateHash(): string {
    const serialized = JSON.stringify({
      vectorClock: Object.fromEntries(Object.entries(this._vectorClock).sort(([a], [b]) => a.localeCompare(b))),
      registers: Object.fromEntries(Array.from(this._registers.entries()).sort(([a], [b]) => a.localeCompare(b))),
      sets: Object.fromEntries(
        Array.from(this._sets.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, s]) => [
            k,
            {
              adds: [...s.adds].sort((a, b) => a.tag.localeCompare(b.tag)),
              removes: [...s.removes].sort(),
            },
          ]),
      ),
      sequences: Object.fromEntries(
        Array.from(this._sequences.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, nodes]) => [k, rgaReconstruct(nodes)]),
      ),
    });
    return pureSha256(serialized);
  }

  public exportSnapshot(): CrdtStateSnapshot {
    const registers = Object.fromEntries(this._registers.entries());
    const sets = Object.fromEntries(this._sets.entries());
    const sequences = Object.fromEntries(Array.from(this._sequences.entries()).map(([k, v]) => [k, rgaReconstruct(v)]));
    const stateHashSha256 = this.computeStateHash();

    return deepFreeze({
      nodeId: this.nodeId,
      vectorClock: { ...this._vectorClock },
      registers,
      sets,
      sequences,
      stateHashSha256,
    });
  }

  public getDelta(peerClock: Record<string, number> = {}): CrdtDelta {
    const deltaRegisters: Record<string, LwwRegister> = {};
    for (const [k, reg] of this._registers.entries()) {
      const peerTimestamp = peerClock[reg.nodeId] ?? 0;
      if (reg.timestamp > peerTimestamp) {
        deltaRegisters[k] = reg;
      }
    }

    const deltaSets: Record<string, OrSetSnapshot> = {};
    for (const [k, set] of this._sets.entries()) {
      const deltaAdds = set.adds.filter((a) => a.timestamp > (peerClock[a.nodeId] ?? 0));
      if (deltaAdds.length > 0 || set.removes.length > 0) {
        deltaSets[k] = { adds: deltaAdds, removes: set.removes };
      }
    }

    const deltaSequences: Record<string, RgaNode[]> = {};
    for (const [k, nodes] of this._sequences.entries()) {
      const deltaNodes = nodes.filter((n) => n.timestamp > (peerClock[n.nodeId] ?? 0) || n.deleted);
      if (deltaNodes.length > 0) {
        deltaSequences[k] = deltaNodes;
      }
    }

    return deepFreeze({
      sourceNodeId: this.nodeId,
      vectorClock: { ...this._vectorClock },
      registers: deltaRegisters,
      sets: deltaSets,
      sequences: deltaSequences,
    });
  }

  public mergeSnapshot(remote: CrdtStateSnapshot): CrdtMergeResult {
    this._vectorClock = vectorClockJoin(this._vectorClock, remote.vectorClock);

    for (const [k, remoteReg] of Object.entries(remote.registers)) {
      const localReg = this._registers.get(k);
      this._registers.set(k, localReg ? lwwRegisterMerge(localReg, remoteReg) : remoteReg);
    }

    for (const [k, remoteSet] of Object.entries(remote.sets)) {
      const localSet = this._sets.get(k) ?? { adds: [], removes: [] };
      this._sets.set(k, orSetMerge(localSet, remoteSet));
    }

    for (const [k, remoteNodes] of Object.entries(remote.sequences)) {
      const localNodes = this._sequences.get(k) ?? [];
      this._sequences.set(k, rgaMerge(localNodes, remoteNodes));
    }

    const stateHashSha256 = this.computeStateHash();
    const receipt = this._createReceipt("merge", stateHashSha256);

    return deepFreeze({
      converged: true,
      stateHashSha256,
      vectorClock: { ...this._vectorClock },
      receipt,
    });
  }

  public mergeDelta(delta: CrdtDelta): CrdtMergeResult {
    this._vectorClock = vectorClockJoin(this._vectorClock, delta.vectorClock);

    for (const [k, remoteReg] of Object.entries(delta.registers)) {
      const localReg = this._registers.get(k);
      this._registers.set(k, localReg ? lwwRegisterMerge(localReg, remoteReg) : remoteReg);
    }

    for (const [k, remoteSet] of Object.entries(delta.sets)) {
      const localSet = this._sets.get(k) ?? { adds: [], removes: [] };
      this._sets.set(k, orSetMerge(localSet, remoteSet));
    }

    for (const [k, remoteNodes] of Object.entries(delta.sequences)) {
      const localNodes = this._sequences.get(k) ?? [];
      this._sequences.set(k, rgaMerge(localNodes, remoteNodes));
    }

    const stateHashSha256 = this.computeStateHash();
    const receipt = this._createReceipt("delta", stateHashSha256);

    return deepFreeze({
      converged: true,
      stateHashSha256,
      vectorClock: { ...this._vectorClock },
      receipt,
    });
  }

  private _createReceipt(operation: CrdtOperationType, stateHash: string): CrdtReceipt {
    const timestamp = new Date().toISOString();
    const receiptId = `eos-crdt-${operation}-${pureSha256(`${stateHash}:${timestamp}`).slice(0, 16)}`;
    const receiptSha256 = pureSha256(`${receiptId}:${stateHash}:${timestamp}`);
    return deepFreeze({
      receiptId,
      operation,
      timestamp,
      stateHashSha256: stateHash,
      receiptSha256,
    });
  }
}
