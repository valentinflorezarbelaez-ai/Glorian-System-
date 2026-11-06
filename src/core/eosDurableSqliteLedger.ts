/**
 * EOS SYSTEM — ZERO-DEPENDENCY DURABLE SQLITE WAL + FTS5 BITEMPORAL LEDGER (Layer 0)
 * Governed by SPEC-044, CHANGE-037, ADR-050, FR-134, BDD-130 (v50.0.0)
 *
 * Uses Node.js native `node:sqlite` (`DatabaseSync`) with Write-Ahead Logging (WAL),
 * FTS5 full-text indexing, and monotonic SHA-256 cryptographic hash-chaining.
 *
 * Zero external runtime npm dependencies (Law V).
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  assertPrecondition,
  assertPostcondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";

export type LedgerCategory =
  | "MISSION_DIRECTION"
  | "ARCHITECTURE_DECISION"
  | "SECURITY_AUDIT"
  | "VERIFICATION_RECEIPT"
  | "GENTLEMAN_ENGRAM_SYNC";

export interface LedgerAppendInput {
  readonly entryId?: string;
  readonly category: LedgerCategory;
  readonly projectId: string;
  readonly title: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly engramTopicKey?: string;
  readonly createdAtIso?: string;
}

export interface DurableLedgerRecord {
  readonly seq: number;
  readonly entryId: string;
  readonly category: LedgerCategory;
  readonly projectId: string;
  readonly title: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly engramTopicKey: string | null;
  readonly createdAtIso: string;
  readonly prevHash: string;
  readonly entryHash: string;
}

export interface LedgerIntegrityReport {
  readonly databasePath: string;
  readonly journalMode: string;
  readonly totalEntries: number;
  readonly intact: boolean;
  readonly headHash: string;
  readonly corruptedSequences: readonly number[];
  readonly sha256Receipt: string;
}

const GENESIS_PREV_HASH = "0".repeat(64);

/**
 * Sanitizes free-text user input into safe FTS5 quoted token terms so punctuation
 * characters (`-`, `:`, `*`, `"`, `'`) never trigger FTS5 query syntax errors.
 */
export function sanitizeFts5Query(rawQuery: string): string {
  if (typeof rawQuery !== "string") return "";
  const tokens = rawQuery
    .replace(/["'`]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}_-]/gu, "").trim())
    .filter((t) => t.length > 0)
    .slice(0, 16);

  if (tokens.length === 0) return "";
  return tokens.map((token) => `"${token}"`).join(" ");
}

export class EosDurableSqliteLedger {
  private readonly databasePath: string;
  private readonly db: DatabaseSync;
  private closed: boolean = false;

  constructor(databasePath: string = ":memory:") {
    assertPrecondition(
      typeof databasePath === "string" && databasePath.trim().length > 0,
      "databasePath must be a non-empty string or ':memory:'"
    );

    if (databasePath !== ":memory:") {
      this.databasePath = path.resolve(databasePath);
      fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
    } else {
      this.databasePath = ":memory:";
    }

    this.db = new DatabaseSync(this.databasePath);
    this.initializeSchema();
  }

  public static defaultLedgerPath(projectRoot: string = process.cwd()): string {
    return path.join(path.resolve(projectRoot), ".eos", "state", "eos_sovereign_ledger.sqlite");
  }

  private initializeSchema(): void {
    this.db.exec("PRAGMA busy_timeout = 5000;");
    if (this.databasePath !== ":memory:") {
      this.db.exec("PRAGMA journal_mode = WAL;");
    }
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS eos_ledger_entries (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        engram_topic_key TEXT,
        created_at_iso TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        entry_hash TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_eos_ledger_project
        ON eos_ledger_entries(project_id, seq DESC);

      CREATE VIRTUAL TABLE IF NOT EXISTS eos_ledger_fts USING fts5(
        entry_id UNINDEXED,
        category,
        project_id,
        title,
        payload_json
      );
    `);
  }

  private static computeEntryHash(
    prevHash: string,
    entryId: string,
    category: string,
    projectId: string,
    title: string,
    payloadJson: string,
    createdAtIso: string
  ): string {
    return pureSha256(
      `${prevHash}|${entryId}|${category}|${projectId}|${title}|${payloadJson}|${createdAtIso}`
    );
  }

  public appendEntry(input: LedgerAppendInput): DurableLedgerRecord {
    assertPrecondition(!this.closed, "Cannot append to a closed SQLite ledger");
    assertPrecondition(typeof input.title === "string" && input.title.trim().length > 0, "Ledger title is required");
    assertPrecondition(typeof input.projectId === "string" && input.projectId.trim().length > 0, "projectId is required");

    const title = input.title.trim();
    const projectId = input.projectId.trim();
    const category = input.category;
    const createdAtIso = input.createdAtIso || new Date().toISOString();
    const payloadJson = JSON.stringify(input.payload ?? {});
    const engramTopicKey = input.engramTopicKey ? input.engramTopicKey.trim() : null;

    this.db.exec("BEGIN IMMEDIATE TRANSACTION;");
    try {
      const lastRow = this.db
        .prepare("SELECT seq, entry_hash FROM eos_ledger_entries ORDER BY seq DESC LIMIT 1")
        .get() as { seq: number; entry_hash: string } | undefined;

      const prevHash = lastRow ? String(lastRow.entry_hash) : GENESIS_PREV_HASH;
      const nextHint = lastRow ? Number(lastRow.seq) + 1 : 1;
      const entryId =
        input.entryId && input.entryId.trim().length > 0
          ? input.entryId.trim()
          : `EOS-LEDGER-${String(nextHint).padStart(6, "0")}-${pureSha256(`${createdAtIso}:${title}:${nextHint}`).slice(0, 10)}`;

      const entryHash = EosDurableSqliteLedger.computeEntryHash(
        prevHash,
        entryId,
        category,
        projectId,
        title,
        payloadJson,
        createdAtIso
      );

      const insertResult = this.db
        .prepare(
          `INSERT INTO eos_ledger_entries (
            entry_id, category, project_id, title, payload_json,
            engram_topic_key, created_at_iso, prev_hash, entry_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          entryId,
          category,
          projectId,
          title,
          payloadJson,
          engramTopicKey,
          createdAtIso,
          prevHash,
          entryHash
        );

      this.db
        .prepare(
          `INSERT INTO eos_ledger_fts (entry_id, category, project_id, title, payload_json)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(entryId, category, projectId, title, payloadJson);

      this.db.exec("COMMIT;");

      const seq = Number(insertResult.lastInsertRowid);
      assertPostcondition(entryHash.length === 64, "Entry hash must be 64-char SHA-256 hex");

      return deepFreeze({
        seq,
        entryId,
        category,
        projectId,
        title,
        payload: JSON.parse(payloadJson),
        engramTopicKey,
        createdAtIso,
        prevHash,
        entryHash
      });
    } catch (err) {
      try {
        this.db.exec("ROLLBACK;");
      } catch {
        // Ignore rollback error if transaction already closed
      }
      throw err;
    }
  }

  public searchEntries(rawQuery: string, limit: number = 10): readonly DurableLedgerRecord[] {
    assertPrecondition(!this.closed, "Cannot query a closed SQLite ledger");
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const ftsQuery = sanitizeFts5Query(rawQuery);
    if (!ftsQuery) {
      return this.listRecent(safeLimit);
    }

    const rows = this.db
      .prepare(
        `SELECT e.seq, e.entry_id, e.category, e.project_id, e.title, e.payload_json,
                e.engram_topic_key, e.created_at_iso, e.prev_hash, e.entry_hash
         FROM eos_ledger_fts f
         JOIN eos_ledger_entries e ON e.entry_id = f.entry_id
         WHERE eos_ledger_fts MATCH ?
         ORDER BY f.rank, e.seq DESC
         LIMIT ?`
      )
      .all(ftsQuery, safeLimit) as Array<Record<string, unknown>>;

    return deepFreeze(rows.map((r) => this.mapRow(r)));
  }

  public listRecent(limit: number = 10, projectId?: string): readonly DurableLedgerRecord[] {
    assertPrecondition(!this.closed, "Cannot query a closed SQLite ledger");
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

    const rows = projectId && projectId.trim().length > 0
      ? (this.db
          .prepare(
            `SELECT seq, entry_id, category, project_id, title, payload_json,
                    engram_topic_key, created_at_iso, prev_hash, entry_hash
             FROM eos_ledger_entries
             WHERE project_id = ?
             ORDER BY seq DESC
             LIMIT ?`
          )
          .all(projectId.trim(), safeLimit) as Array<Record<string, unknown>>)
      : (this.db
          .prepare(
            `SELECT seq, entry_id, category, project_id, title, payload_json,
                    engram_topic_key, created_at_iso, prev_hash, entry_hash
             FROM eos_ledger_entries
             ORDER BY seq DESC
             LIMIT ?`
          )
          .all(safeLimit) as Array<Record<string, unknown>>);

    return deepFreeze(rows.map((r) => this.mapRow(r)));
  }

  public getEntriesUpTo(maxSeq: number): readonly DurableLedgerRecord[] {
    assertPrecondition(!this.closed, "Cannot query a closed SQLite ledger");
    assertPrecondition(maxSeq >= 1, "maxSeq must be >= 1");

    const rows = this.db
      .prepare(
        `SELECT seq, entry_id, category, project_id, title, payload_json,
                engram_topic_key, created_at_iso, prev_hash, entry_hash
         FROM eos_ledger_entries
         WHERE seq <= ?
         ORDER BY seq ASC`
      )
      .all(maxSeq) as Array<Record<string, unknown>>;

    return deepFreeze(rows.map((r) => this.mapRow(r)));
  }

  public verifyChainIntegrity(): LedgerIntegrityReport {
    assertPrecondition(!this.closed, "Cannot verify a closed SQLite ledger");

    const modeRow = this.db.prepare("PRAGMA journal_mode;").get() as { journal_mode?: string } | undefined;
    const journalMode = String(modeRow?.journal_mode || "memory").toLowerCase();

    const rows = this.db
      .prepare(
        `SELECT seq, entry_id, category, project_id, title, payload_json,
                created_at_iso, prev_hash, entry_hash
         FROM eos_ledger_entries
         ORDER BY seq ASC`
      )
      .all() as Array<Record<string, unknown>>;

    let expectedPrev = GENESIS_PREV_HASH;
    const corruptedSequences: number[] = [];

    for (const row of rows) {
      const seq = Number(row.seq);
      const prevHash = String(row.prev_hash);
      const entryHash = String(row.entry_hash);
      const recomputed = EosDurableSqliteLedger.computeEntryHash(
        expectedPrev,
        String(row.entry_id),
        String(row.category),
        String(row.project_id),
        String(row.title),
        String(row.payload_json),
        String(row.created_at_iso)
      );

      if (prevHash !== expectedPrev || entryHash !== recomputed) {
        corruptedSequences.push(seq);
      }
      expectedPrev = entryHash;
    }

    const intact = corruptedSequences.length === 0;
    const headHash = rows.length > 0 ? String(rows[rows.length - 1]!.entry_hash) : GENESIS_PREV_HASH;
    const sha256Receipt = pureSha256(
      JSON.stringify({
        databasePath: this.databasePath,
        journalMode,
        totalEntries: rows.length,
        intact,
        headHash,
        corruptedSequences
      })
    );

    return deepFreeze({
      databasePath: this.databasePath,
      journalMode,
      totalEntries: rows.length,
      intact,
      headHash,
      corruptedSequences,
      sha256Receipt
    });
  }

  public close(): void {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }

  private mapRow(row: Record<string, unknown>): DurableLedgerRecord {
    return {
      seq: Number(row.seq),
      entryId: String(row.entry_id),
      category: String(row.category) as LedgerCategory,
      projectId: String(row.project_id),
      title: String(row.title),
      payload: JSON.parse(String(row.payload_json || "{}")),
      engramTopicKey: row.engram_topic_key ? String(row.engram_topic_key) : null,
      createdAtIso: String(row.created_at_iso),
      prevHash: String(row.prev_hash),
      entryHash: String(row.entry_hash)
    };
  }
}
