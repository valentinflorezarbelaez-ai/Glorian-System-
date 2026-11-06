/**
 * EOS SYSTEM — BITEMPORAL TIME-TRAVEL STATE REPLAY & COUNTERFACTUAL ENGINE (Layer 0)
 * Governed by SPEC-068, CHANGE-059, ADR-073, FR-234..FR-237, BDD-211..BDD-212 (v67.0.0)
 *
 * Implements Datomic bitemporal point-in-time state reconstruction and FoundationDB-style
 * deterministic counterfactual sandbox branching over the SQLite WAL ledger.
 *
 * Zero external runtime npm dependencies (Law V). Node 24 strip-only compliant.
 */

import {
  assertPrecondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";
import {
  EosDurableSqliteLedger,
  type DurableLedgerRecord,
  type LedgerCategory
} from "./eosDurableSqliteLedger.ts";

export interface MaterializedStateProjection {
  readonly asOfSequence: number;
  readonly asOfIso: string;
  readonly totalEntriesReplayed: number;
  readonly activeProjects: readonly string[];
  readonly categoryCounts: Readonly<Record<string, number>>;
  readonly latestReceiptHash: string;
  readonly isChainIntact: boolean;
  readonly stateDigest: string;
}

export interface TimeTravelReplayResult {
  readonly targetSequence: number;
  readonly projection: MaterializedStateProjection;
  readonly replayedEntries: readonly DurableLedgerRecord[];
  readonly evaluatedAtIso: string;
  readonly sha256Receipt: string;
}

export class CounterfactualSandbox {
  private readonly branchedLedger: EosDurableSqliteLedger;
  private readonly baseSequence: number;

  constructor(baseSequence: number, initialEntries: readonly DurableLedgerRecord[]) {
    this.baseSequence = baseSequence;
    this.branchedLedger = new EosDurableSqliteLedger(":memory:");

    // Replay initial history into branch
    for (const entry of initialEntries) {
      this.branchedLedger.appendEntry({
        entryId: entry.entryId,
        category: entry.category,
        projectId: entry.projectId,
        title: entry.title,
        payload: entry.payload,
        engramTopicKey: entry.engramTopicKey || undefined,
        createdAtIso: entry.createdAtIso
      });
    }
  }

  public injectSpeculativeEvent(
    category: LedgerCategory,
    projectId: string,
    title: string,
    payload: Record<string, unknown>
  ): DurableLedgerRecord {
    return this.branchedLedger.appendEntry({
      category,
      projectId,
      title: `[COUNTERFACTUAL] ${title}`,
      payload
    });
  }

  public getHistory(): readonly DurableLedgerRecord[] {
    return this.branchedLedger.listRecent(100);
  }

  public getBranchedLedger(): EosDurableSqliteLedger {
    return this.branchedLedger;
  }

  public close(): void {
    this.branchedLedger.close();
  }
}

export class EosLedgerTimeTravelEngine {
  private readonly ledger: EosDurableSqliteLedger;
  private readonly ownsLedger: boolean;

  constructor(ledgerOrPath: EosDurableSqliteLedger | string) {
    if (typeof ledgerOrPath === "string") {
      this.ledger = new EosDurableSqliteLedger(ledgerOrPath);
      this.ownsLedger = true;
    } else {
      this.ledger = ledgerOrPath;
      this.ownsLedger = false;
    }
  }

  /**
   * Reconstructs deterministic state up to targetSequence (1..K).
   */
  public replayStateUpTo(targetSequence: number): TimeTravelReplayResult {
    assertPrecondition(targetSequence >= 1, "Target sequence must be >= 1");

    const replayed = this.ledger.getEntriesUpTo(targetSequence);
    assertPrecondition(replayed.length > 0, `No ledger entries found at or below sequence ${targetSequence}`);

    // Verify hash chain
    let isChainIntact = true;
    for (let i = 1; i < replayed.length; i++) {
      if (replayed[i].prevHash !== replayed[i - 1].entryHash) {
        isChainIntact = false;
        break;
      }
    }

    // Materialize state
    const projects = new Set<string>();
    const categoryCounts: Record<string, number> = {};

    for (const entry of replayed) {
      projects.add(entry.projectId);
      categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
    }

    const latestEntry = replayed[replayed.length - 1];
    const stateDigest = pureSha256(
      JSON.stringify({
        asOfSequence: targetSequence,
        projects: Array.from(projects).sort(),
        categoryCounts,
        latestReceiptHash: latestEntry.entryHash
      })
    );

    const projection: MaterializedStateProjection = {
      asOfSequence: targetSequence,
      asOfIso: latestEntry.createdAtIso,
      totalEntriesReplayed: replayed.length,
      activeProjects: Object.freeze(Array.from(projects).sort()),
      categoryCounts: Object.freeze(categoryCounts),
      latestReceiptHash: latestEntry.entryHash,
      isChainIntact,
      stateDigest
    };

    const evaluatedAtIso = new Date().toISOString();
    const sha256Receipt = pureSha256(
      JSON.stringify({
        targetSequence,
        projection,
        evaluatedAtIso
      })
    );

    return deepFreeze({
      targetSequence,
      projection,
      replayedEntries: replayed,
      evaluatedAtIso,
      sha256Receipt
    });
  }

  /**
   * Spawns an in-memory counterfactual branch for speculative simulation.
   */
  public createCounterfactualBranch(baseSequence: number): CounterfactualSandbox {
    const replay = this.replayStateUpTo(baseSequence);
    return new CounterfactualSandbox(baseSequence, replay.replayedEntries);
  }

  public close(): void {
    if (this.ownsLedger) {
      this.ledger.close();
    }
  }
}
