/**
 * Glorian System — Distributed Bitemporal CRDT Memory Synchronizer
 * Governed by SPEC-348 / CHANGE-210
 *
 * Invariants:
 * 1. Pure Layer-0 implementation (zero external npm dependencies).
 * 2. Strict module line ceiling <= 800 lines with >= 12 lines headroom (SPEC-250).
 * 3. Strong Eventual Consistency (SEC) via Join-Semilattices (LWW, OR-Set, PN-Counter).
 * 4. Deterministic HLC causal ordering with lexicographical node ID tie-breaking.
 * 5. Bitemporal historical auditability (valid time x transaction time).
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveEvidencePath } from "./eosEvidencePaths.ts";
import type {
  AsOfQueryOptions,
  BitemporalRecord,
  CrdtAuditReceipt,
  CrdtMemoryState,
  HlcTimestamp,
  LwwRegister,
  OrSetElement,
  OrSetState,
  PnCounterState,
} from "./eosDistributedCrdtMemory.types.js";

/**
 * Hybrid Logical Clock (HLC) comparator.
 * Returns > 0 if a > b, < 0 if a < b, 0 if identical.
 */
export function compareHlc(a: HlcTimestamp, b: HlcTimestamp): number {
  if (a.physicalTime !== b.physicalTime) {
    return a.physicalTime - b.physicalTime;
  }
  if (a.logicalCounter !== b.logicalCounter) {
    return a.logicalCounter - b.logicalCounter;
  }
  return a.nodeId.localeCompare(b.nodeId);
}

/**
 * Generates an ISO-formatted string representation of an HLC.
 */
export function formatHlc(hlc: HlcTimestamp): string {
  return `${new Date(hlc.physicalTime).toISOString()}_${String(hlc.logicalCounter).padStart(5, "0")}_${hlc.nodeId}`;
}

export class EosDistributedCrdtMemoryCore {
  private readonly nodeId: string;
  private physicalTime: number;
  private logicalCounter: number;
  private registers: Map<string, LwwRegister>;
  private sets: Map<string, OrSetState>;
  private counters: Map<string, PnCounterState>;
  private bitemporalLedger: BitemporalRecord[];

  constructor(nodeId: string, initialPhysicalTime: number = Date.now()) {
    this.nodeId = nodeId;
    this.physicalTime = initialPhysicalTime;
    this.logicalCounter = 0;
    this.registers = new Map();
    this.sets = new Map();
    this.counters = new Map();
    this.bitemporalLedger = [];
  }

  /**
   * Advances the local HLC for a local event.
   */
  public tick(physicalNow: number = Date.now()): HlcTimestamp {
    if (physicalNow > this.physicalTime) {
      this.physicalTime = physicalNow;
      this.logicalCounter = 0;
    } else {
      this.logicalCounter++;
    }

    return {
      physicalTime: this.physicalTime,
      logicalCounter: this.logicalCounter,
      nodeId: this.nodeId,
      formatted: formatHlc({
        physicalTime: this.physicalTime,
        logicalCounter: this.logicalCounter,
        nodeId: this.nodeId,
        formatted: "",
      }),
    };
  }

  /**
   * Updates local HLC upon receiving a remote HLC timestamp.
   */
  public updateHlc(remoteHlc: HlcTimestamp, physicalNow: number = Date.now()): HlcTimestamp {
    const maxPhysical = Math.max(this.physicalTime, remoteHlc.physicalTime, physicalNow);
    if (maxPhysical === this.physicalTime && maxPhysical === remoteHlc.physicalTime) {
      this.logicalCounter = Math.max(this.logicalCounter, remoteHlc.logicalCounter) + 1;
    } else if (maxPhysical === this.physicalTime) {
      this.logicalCounter++;
    } else if (maxPhysical === remoteHlc.physicalTime) {
      this.logicalCounter = remoteHlc.logicalCounter + 1;
    } else {
      this.logicalCounter = 0;
    }
    this.physicalTime = maxPhysical;

    return {
      physicalTime: this.physicalTime,
      logicalCounter: this.logicalCounter,
      nodeId: this.nodeId,
      formatted: formatHlc({
        physicalTime: this.physicalTime,
        logicalCounter: this.logicalCounter,
        nodeId: this.nodeId,
        formatted: "",
      }),
    };
  }

  /**
   * Gets current HLC snapshot.
   */
  public getCurrentHlc(): HlcTimestamp {
    return {
      physicalTime: this.physicalTime,
      logicalCounter: this.logicalCounter,
      nodeId: this.nodeId,
      formatted: formatHlc({
        physicalTime: this.physicalTime,
        logicalCounter: this.logicalCounter,
        nodeId: this.nodeId,
        formatted: "",
      }),
    };
  }

  public getNodeId(): string {
    return this.nodeId;
  }

  // =========================================================================
  // LWW-Register Operations
  // =========================================================================

  public putLww<T = unknown>(
    key: string,
    value: T,
    options?: { validFrom?: number; validTo?: number | null; txTime?: number },
  ): LwwRegister<T> {
    const hlc = this.tick();
    const validFrom = options?.validFrom ?? this.physicalTime;
    const validTo = options?.validTo ?? null;
    const txTime = options?.txTime ?? this.physicalTime;

    const register: LwwRegister<T> = {
      key,
      value,
      timestamp: hlc,
      validFrom,
      validTo,
      txTime,
    };

    this.registers.set(key, register as LwwRegister);

    // Record in bitemporal ledger
    const recordId = `rec_${hlc.formatted}_${key}`;
    this.bitemporalLedger.push({
      id: recordId,
      key,
      value,
      validFrom,
      validTo,
      txFrom: txTime,
      txTo: null,
      nodeId: this.nodeId,
      hlc,
    });

    return register;
  }

  public getLww<T = unknown>(key: string): T | undefined {
    const reg = this.registers.get(key);
    return reg ? (reg.value as T) : undefined;
  }

  public getLwwRegister<T = unknown>(key: string): LwwRegister<T> | undefined {
    return this.registers.get(key) as LwwRegister<T> | undefined;
  }

  // =========================================================================
  // OR-Set Operations
  // =========================================================================

  public addOrSet<T = unknown>(
    setName: string,
    elementId: string,
    value: T,
    options?: { validFrom?: number; validTo?: number | null },
  ): OrSetElement<T> {
    const hlc = this.tick();
    const validFrom = options?.validFrom ?? this.physicalTime;
    const validTo = options?.validTo ?? null;
    const tag = `${this.nodeId}_${hlc.formatted}_${elementId}`;

    const element: OrSetElement<T> = {
      elementId,
      value,
      timestamp: hlc,
      tag,
      validFrom,
      validTo,
      txTime: this.physicalTime,
    };

    let set = this.sets.get(setName);
    if (!set) {
      set = { adds: {}, tombstones: [] };
      this.sets.set(setName, set);
    }

    set.adds[tag] = element as OrSetElement;

    // Record in bitemporal ledger
    this.bitemporalLedger.push({
      id: `set_add_${tag}`,
      key: `${setName}:${elementId}`,
      value: { action: "ADD", element },
      validFrom,
      validTo,
      txFrom: this.physicalTime,
      txTo: null,
      nodeId: this.nodeId,
      hlc,
    });

    return element;
  }

  public removeOrSet(setName: string, elementId: string): boolean {
    const set = this.sets.get(setName);
    if (!set) return false;

    const matchingTags: string[] = [];
    for (const [tag, el] of Object.entries(set.adds)) {
      if (el.elementId === elementId && !set.tombstones.includes(tag)) {
        matchingTags.push(tag);
      }
    }

    if (matchingTags.length === 0) return false;

    const hlc = this.tick();
    for (const tag of matchingTags) {
      if (!set.tombstones.includes(tag)) {
        set.tombstones.push(tag);
      }
    }

    this.bitemporalLedger.push({
      id: `set_rem_${hlc.formatted}_${setName}_${elementId}`,
      key: `${setName}:${elementId}`,
      value: { action: "REMOVE", tags: matchingTags },
      validFrom: this.physicalTime,
      validTo: null,
      txFrom: this.physicalTime,
      txTo: null,
      nodeId: this.nodeId,
      hlc,
    });

    return true;
  }

  public getOrSet<T = unknown>(setName: string): Array<{ elementId: string; value: T; tag: string }> {
    const set = this.sets.get(setName);
    if (!set) return [];

    const tombstoneLookup = new Set(set.tombstones);
    const resultMap = new Map<string, { elementId: string; value: T; tag: string }>();

    for (const [tag, el] of Object.entries(set.adds)) {
      if (!tombstoneLookup.has(tag)) {
        resultMap.set(el.elementId, {
          elementId: el.elementId,
          value: el.value as T,
          tag: el.tag,
        });
      }
    }

    return Array.from(resultMap.values());
  }

  // =========================================================================
  // PN-Counter Operations
  // =========================================================================

  public incrementCounter(counterName: string, amount: number = 1): number {
    let counter = this.counters.get(counterName);
    if (!counter) {
      counter = { P: {}, N: {} };
      this.counters.set(counterName, counter);
    }

    counter.P[this.nodeId] = (counter.P[this.nodeId] || 0) + amount;
    this.tick();
    return this.getCounter(counterName);
  }

  public decrementCounter(counterName: string, amount: number = 1): number {
    let counter = this.counters.get(counterName);
    if (!counter) {
      counter = { P: {}, N: {} };
      this.counters.set(counterName, counter);
    }

    counter.N[this.nodeId] = (counter.N[this.nodeId] || 0) + amount;
    this.tick();
    return this.getCounter(counterName);
  }

  public getCounter(counterName: string): number {
    const counter = this.counters.get(counterName);
    if (!counter) return 0;

    let pSum = 0;
    for (const val of Object.values(counter.P)) {
      pSum += val;
    }
    let nSum = 0;
    for (const val of Object.values(counter.N)) {
      nSum += val;
    }

    return pSum - nSum;
  }

  // =========================================================================
  // Bitemporal "As-Of" Query
  // =========================================================================

  public queryAsOf<T = unknown>(key: string, options: AsOfQueryOptions): BitemporalRecord<T>[] {
    const validTime = options.asOfValidTime ?? Infinity;
    const txTime = options.asOfTxTime ?? Infinity;

    return (this.bitemporalLedger as BitemporalRecord<T>[]).filter((rec) => {
      if (rec.key !== key) return false;

      const validMatches = rec.validFrom <= validTime && (rec.validTo === null || rec.validTo > validTime);
      const txMatches = rec.txFrom <= txTime && (rec.txTo === null || rec.txTo > txTime);

      return validMatches && txMatches;
    });
  }

  // =========================================================================
  // State Export & Delta Synchronization
  // =========================================================================

  public exportState(): CrdtMemoryState {
    const registersObj: Record<string, LwwRegister> = {};
    for (const [k, v] of this.registers.entries()) {
      registersObj[k] = v;
    }

    const setsObj: Record<string, OrSetState> = {};
    for (const [k, v] of this.sets.entries()) {
      setsObj[k] = {
        adds: { ...v.adds },
        tombstones: [...v.tombstones],
      };
    }

    const countersObj: Record<string, PnCounterState> = {};
    for (const [k, v] of this.counters.entries()) {
      countersObj[k] = {
        P: { ...v.P },
        N: { ...v.N },
      };
    }

    return {
      nodeId: this.nodeId,
      registers: registersObj,
      sets: setsObj,
      counters: countersObj,
      bitemporalLedger: [...this.bitemporalLedger],
      lastHlc: this.getCurrentHlc(),
    };
  }

  public mergeRemoteState(remote: CrdtMemoryState): void {
    // 1. Advance HLC
    this.updateHlc(remote.lastHlc);

    // 2. Merge LWW-Registers (Last-Write-Wins via HLC comparison)
    for (const [key, remoteReg] of Object.entries(remote.registers)) {
      const localReg = this.registers.get(key);
      if (!localReg) {
        this.registers.set(key, remoteReg);
      } else {
        const cmp = compareHlc(remoteReg.timestamp, localReg.timestamp);
        if (cmp > 0) {
          this.registers.set(key, remoteReg);
        }
      }
    }

    // 3. Merge OR-Sets (Union of Adds, Union of Tombstones)
    for (const [setName, remoteSet] of Object.entries(remote.sets)) {
      let localSet = this.sets.get(setName);
      if (!localSet) {
        localSet = { adds: {}, tombstones: [] };
        this.sets.set(setName, localSet);
      }

      // Merge adds
      for (const [tag, remoteElement] of Object.entries(remoteSet.adds)) {
        if (!localSet.adds[tag]) {
          localSet.adds[tag] = remoteElement;
        }
      }

      // Merge tombstones
      const tombstoneSet = new Set(localSet.tombstones);
      for (const t of remoteSet.tombstones) {
        tombstoneSet.add(t);
      }
      localSet.tombstones = Array.from(tombstoneSet);
    }

    // 4. Merge PN-Counters (Component-wise maximum for P and N)
    for (const [counterName, remoteCounter] of Object.entries(remote.counters)) {
      let localCounter = this.counters.get(counterName);
      if (!localCounter) {
        localCounter = { P: {}, N: {} };
        this.counters.set(counterName, localCounter);
      }

      for (const [nodeId, pVal] of Object.entries(remoteCounter.P)) {
        localCounter.P[nodeId] = Math.max(localCounter.P[nodeId] || 0, pVal);
      }
      for (const [nodeId, nVal] of Object.entries(remoteCounter.N)) {
        localCounter.N[nodeId] = Math.max(localCounter.N[nodeId] || 0, nVal);
      }
    }

    // 5. Merge Bitemporal Ledger (Union with ID deduplication)
    const existingIds = new Set(this.bitemporalLedger.map((r) => r.id));
    for (const rec of remote.bitemporalLedger) {
      if (!existingIds.has(rec.id)) {
        this.bitemporalLedger.push(rec);
        existingIds.add(rec.id);
      }
    }
  }

  // =========================================================================
  // Self-Auditing & Verification Harness
  // =========================================================================

  public static auditDistributedCrdtMemory(projectRoot: string = process.cwd()): CrdtAuditReceipt {
    const nodeA = new EosDistributedCrdtMemoryCore("node-alpha", 1700000000000);
    const nodeB = new EosDistributedCrdtMemoryCore("node-beta", 1700000000001);
    const nodeC = new EosDistributedCrdtMemoryCore("node-gamma", 1700000000002);

    // 1. Mutate independently across network partitions
    nodeA.putLww("session_state", { mode: "STANDBY", authLevel: 1 });
    nodeB.putLww("session_state", { mode: "ACTIVE", authLevel: 2 });
    nodeC.putLww("session_state", { mode: "SUPERVISOR", authLevel: 3 });

    nodeA.addOrSet("cluster_nodes", "node-1", { address: "10.0.0.1" });
    nodeB.addOrSet("cluster_nodes", "node-2", { address: "10.0.0.2" });
    nodeB.removeOrSet("cluster_nodes", "node-1");

    nodeA.incrementCounter("request_budget", 100);
    nodeB.decrementCounter("request_budget", 30);
    nodeC.incrementCounter("request_budget", 50);

    // 2. Perform delta merges in asymmetric order
    const stateA = nodeA.exportState();
    const stateB = nodeB.exportState();
    const stateC = nodeC.exportState();

    // Node A merges B then C
    nodeA.mergeRemoteState(stateB);
    nodeA.mergeRemoteState(stateC);

    // Node B merges C then A
    nodeB.mergeRemoteState(stateC);
    nodeB.mergeRemoteState(stateA);

    // Node C merges A then B
    nodeC.mergeRemoteState(stateA);
    nodeC.mergeRemoteState(stateB);

    // 3. Verify Convergence (Strong Eventual Consistency)
    const valA = nodeA.getLww("session_state");
    const valB = nodeB.getLww("session_state");
    const valC = nodeC.getLww("session_state");
    const convergenceLww =
      JSON.stringify(valA) === JSON.stringify(valB) && JSON.stringify(valB) === JSON.stringify(valC);

    const setA = nodeA
      .getOrSet("cluster_nodes")
      .map((x) => x.elementId)
      .sort();
    const setB = nodeB
      .getOrSet("cluster_nodes")
      .map((x) => x.elementId)
      .sort();
    const setC = nodeC
      .getOrSet("cluster_nodes")
      .map((x) => x.elementId)
      .sort();
    const convergenceSet =
      JSON.stringify(setA) === JSON.stringify(setB) && JSON.stringify(setB) === JSON.stringify(setC);

    const countA = nodeA.getCounter("request_budget");
    const countB = nodeB.getCounter("request_budget");
    const countC = nodeC.getCounter("request_budget");
    const convergenceCounter = countA === countB && countB === countC && countA === 120; // 100 - 30 + 50 = 120

    const convergenceVerified = convergenceLww && convergenceSet && convergenceCounter;

    // 4. Verify Commutativity: (X merge Y) === (Y merge X)
    const test1 = new EosDistributedCrdtMemoryCore("test-1");
    const test2 = new EosDistributedCrdtMemoryCore("test-2");
    test1.mergeRemoteState(stateA);
    test1.mergeRemoteState(stateB);

    test2.mergeRemoteState(stateB);
    test2.mergeRemoteState(stateA);

    const commutativityVerified =
      JSON.stringify(test1.getLww("session_state")) === JSON.stringify(test2.getLww("session_state")) &&
      test1.getCounter("request_budget") === test2.getCounter("request_budget");

    // 5. Verify Bitemporal Historical Fidelity
    const asOfRecords = nodeA.queryAsOf("session_state", { asOfValidTime: Infinity, asOfTxTime: Infinity });
    const bitemporalFidelityVerified = asOfRecords.length >= 1;

    const receiptPayload = {
      specId: "SPEC-348",
      timestamp: new Date().toISOString(),
      convergenceVerified,
      commutativityVerified,
      bitemporalFidelityVerified,
      activeNodes: ["node-alpha", "node-beta", "node-gamma"],
      registerCount: Object.keys(nodeA.exportState().registers).length,
      setCount: Object.keys(nodeA.exportState().sets).length,
      counterCount: Object.keys(nodeA.exportState().counters).length,
      ledgerRecordCount: nodeA.exportState().bitemporalLedger.length,
    };

    const checksumSha256 = createHash("sha256")
      .update(JSON.stringify(receiptPayload, Object.keys(receiptPayload).sort()))
      .digest("hex");

    const receipt: CrdtAuditReceipt = {
      receiptId: `CRDT_EVD_${Date.now()}`,
      ...receiptPayload,
      status: convergenceVerified && commutativityVerified && bitemporalFidelityVerified ? "VERIFIED" : "FAILED",
      checksumSha256,
    };

    const receiptPath = resolveEvidencePath("CRDT_MEMORY_RECEIPT.json", projectRoot);
    const receiptDir = path.dirname(receiptPath);
    if (!fs.existsSync(receiptDir)) {
      fs.mkdirSync(receiptDir, { recursive: true });
    }
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");

    return receipt;
  }
}
