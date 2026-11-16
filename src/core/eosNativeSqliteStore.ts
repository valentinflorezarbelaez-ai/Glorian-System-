/**
 * EOS Native SQLite Store & Semantic Vector Governor
 *
 * Provides embedded ACID document storage, Full-Text Search (FTS5),
 * scalar quantized vector BLOB storage, k-NN cosine similarity retrieval,
 * and hybrid Reciprocal Rank Fusion (RRF) using built-in node:sqlite.
 *
 * Conforms to SPEC-287 / CHANGE-149 and Law V (Zero npm runtime dependencies).
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface SqliteDocumentRecord {
  id: string;
  category: string;
  title: string;
  content: string;
  vector?: Float32Array | number[] | Uint8Array;
  metadata?: Record<string, unknown>;
  createdAt?: number;
}

export interface SqliteStoredDocument {
  id: string;
  category: string;
  title: string;
  content: string;
  vector: Uint8Array | null;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface SqliteFtsSearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  rank: number;
}

export interface SqliteVectorSearchResult {
  id: string;
  title: string;
  category: string;
  similarity: number;
}

export interface SqliteHybridSearchResult {
  id: string;
  title: string;
  category: string;
  content: string;
  rrfScore: number;
  ftsRank?: number;
  vectorRank?: number;
}

export interface SqliteStorageAuditReport {
  timestampIso: string;
  dbPath: string;
  journalMode: string;
  synchronous: string;
  totalDocuments: number;
  fts5Enabled: boolean;
  vectorIndexedCount: number;
  categories: Record<string, number>;
  sha256Signature: string;
}

export class EosNativeSqliteStore {
  private readonly db: DatabaseSync;
  private readonly dbPath: string;

  constructor(dbPath: string = ":memory:") {
    this.dbPath = dbPath;
    if (dbPath !== ":memory:") {
      const dir = path.dirname(path.resolve(dbPath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.configurePragmas();
    this.initSchema();
  }

  /**
   * Configures SQLite pragmas for high performance and durability.
   */
  private configurePragmas(): void {
    if (this.dbPath !== ":memory:") {
      this.db.exec("PRAGMA journal_mode = WAL;");
      this.db.exec("PRAGMA synchronous = NORMAL;");
    }
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

  /**
   * Initializes relational tables and FTS5 virtual tables.
   */
  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        vector BLOB,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
      CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);

      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        id UNINDEXED,
        title,
        content,
        category,
        content='documents',
        content_rowid='rowid'
      );
    `);
  }

  /**
   * Quantizes a float vector into an 8-bit unsigned integer array (SQ8).
   */
  public quantizeVector(vector: Float32Array | number[]): Uint8Array {
    const len = vector.length;
    if (len === 0) return new Uint8Array(0);

    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < len; i++) {
      const v = vector[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }

    const range = max - min || 1e-9;
    const quantized = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const normalized = Math.max(0, Math.min(255, Math.round(((vector[i] - min) / range) * 255)));
      quantized[i] = normalized;
    }
    return quantized;
  }

  /**
   * Calculates cosine similarity between two Uint8Array quantized vectors.
   */
  public cosineSimilarityQuantized(a: Uint8Array, b: Uint8Array): number {
    const len = Math.min(a.length, b.length);
    if (len === 0) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    // Loop unrolling step 4
    let i = 0;
    const limit = len - (len % 4);
    for (; i < limit; i += 4) {
      const a0 = a[i],
        b0 = b[i];
      const a1 = a[i + 1],
        b1 = b[i + 1];
      const a2 = a[i + 2],
        b2 = b[i + 2];
      const a3 = a[i + 3],
        b3 = b[i + 3];

      dot += a0 * b0 + a1 * b1 + a2 * b2 + a3 * b3;
      normA += a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3;
      normB += b0 * b0 + b1 * b1 + b2 * b2 + b3 * b3;
    }

    for (; i < len; i++) {
      const va = a[i];
      const vb = b[i];
      dot += va * vb;
      normA += va * va;
      normB += vb * vb;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  /**
   * Executes an atomic ACID transaction.
   */
  public transaction<T>(callback: () => T): T {
    this.db.exec("BEGIN TRANSACTION;");
    try {
      const result = callback();
      this.db.exec("COMMIT;");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  /**
   * Inserts or replaces a document in SQLite and synchronizes FTS5.
   */
  public insertDocument(doc: SqliteDocumentRecord): void {
    let vectorBuffer: Buffer | null = null;
    if (doc.vector) {
      const q = doc.vector instanceof Uint8Array ? doc.vector : this.quantizeVector(doc.vector);
      vectorBuffer = Buffer.from(q.buffer, q.byteOffset, q.byteLength);
    }

    const metadataJson = doc.metadata ? JSON.stringify(doc.metadata) : "{}";
    const createdAt = doc.createdAt ?? Date.now();

    this.transaction(() => {
      // 1. Insert into relational table
      const stmtDoc = this.db.prepare(`
        INSERT OR REPLACE INTO documents (id, category, title, content, vector, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `);
      stmtDoc.run(doc.id, doc.category, doc.title, doc.content, vectorBuffer, metadataJson, createdAt);

      // 2. Synchronize FTS5 virtual table
      const stmtFts = this.db.prepare(`
        INSERT INTO documents_fts (id, title, content, category)
        VALUES (?, ?, ?, ?);
      `);
      stmtFts.run(doc.id, doc.title, doc.content, doc.category);
    });
  }

  /**
   * Retrieves a document by its primary key ID.
   */
  public getDocument(id: string): SqliteStoredDocument | null {
    const stmt = this.db.prepare(`
      SELECT id, category, title, content, vector, metadata, created_at
      FROM documents WHERE id = ?;
    `);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    let vectorUint8: Uint8Array | null = null;
    if (row.vector) {
      const buf = row.vector as Buffer;
      vectorUint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }

    let parsedMeta: Record<string, unknown> = {};
    if (typeof row.metadata === "string") {
      try {
        parsedMeta = JSON.parse(row.metadata);
      } catch {
        parsedMeta = {};
      }
    }

    return {
      id: String(row.id),
      category: String(row.category),
      title: String(row.title),
      content: String(row.content),
      vector: vectorUint8,
      metadata: parsedMeta,
      createdAt: Number(row.created_at),
    };
  }

  /**
   * Executes Full-Text Search 5 (FTS5) lexical queries with BM25 ranking.
   */
  public searchFts(query: string, limit: number = 10): SqliteFtsSearchResult[] {
    const sanitized = query.replace(/[^\w\s-]/g, " ").trim();
    if (!sanitized) return [];

    const stmt = this.db.prepare(`
      SELECT id, title, content, category, rank
      FROM documents_fts
      WHERE documents_fts MATCH ?
      ORDER BY rank
      LIMIT ?;
    `);

    const rows = stmt.all(sanitized, limit) as Array<Record<string, unknown>>;
    return rows.map((r, index) => ({
      id: String(r.id),
      title: String(r.title),
      content: String(r.content),
      category: String(r.category),
      rank: index + 1,
    }));
  }

  /**
   * Executes k-NN vector search against all stored quantized vectors.
   */
  public searchVector(
    queryVector: Float32Array | number[] | Uint8Array,
    limit: number = 10,
  ): SqliteVectorSearchResult[] {
    const qVec = queryVector instanceof Uint8Array ? queryVector : this.quantizeVector(queryVector);

    const stmt = this.db.prepare(`
      SELECT id, title, category, vector FROM documents WHERE vector IS NOT NULL;
    `);
    const rows = stmt.all() as Array<Record<string, unknown>>;

    const scored: SqliteVectorSearchResult[] = [];
    for (const r of rows) {
      if (!r.vector) continue;
      const buf = r.vector as Buffer;
      const docVec = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      const similarity = this.cosineSimilarityQuantized(qVec, docVec);
      scored.push({
        id: String(r.id),
        title: String(r.title),
        category: String(r.category),
        similarity: Math.round(similarity * 10000) / 10000,
      });
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
  }

  /**
   * Executes hybrid Reciprocal Rank Fusion (RRF) search.
   */
  public searchHybrid(
    textQuery: string,
    queryVector: Float32Array | number[] | Uint8Array,
    limit: number = 10,
    kRrf: number = 60,
  ): SqliteHybridSearchResult[] {
    const ftsResults = this.searchFts(textQuery, limit * 2);
    const vectorResults = this.searchVector(queryVector, limit * 2);

    const scoresMap = new Map<string, { rrf: number; ftsRank?: number; vecRank?: number; doc: SqliteStoredDocument }>();

    // Process FTS rankings
    for (let i = 0; i < ftsResults.length; i++) {
      const item = ftsResults[i];
      const doc = this.getDocument(item.id);
      if (!doc) continue;
      const rank = i + 1;
      const contribution = 1 / (kRrf + rank);
      scoresMap.set(item.id, {
        rrf: contribution,
        ftsRank: rank,
        doc,
      });
    }

    // Process Vector rankings
    for (let i = 0; i < vectorResults.length; i++) {
      const item = vectorResults[i];
      const rank = i + 1;
      const contribution = 1 / (kRrf + rank);
      const existing = scoresMap.get(item.id);
      if (existing) {
        existing.rrf += contribution;
        existing.vecRank = rank;
      } else {
        const doc = this.getDocument(item.id);
        if (doc) {
          scoresMap.set(item.id, {
            rrf: contribution,
            vecRank: rank,
            doc,
          });
        }
      }
    }

    const merged = Array.from(scoresMap.values()).map((entry) => ({
      id: entry.doc.id,
      title: entry.doc.title,
      category: entry.doc.category,
      content: entry.doc.content,
      rrfScore: Math.round(entry.rrf * 100000) / 100000,
      ftsRank: entry.ftsRank,
      vectorRank: entry.vecRank,
    }));

    merged.sort((a, b) => b.rrfScore - a.rrfScore);
    return merged.slice(0, limit);
  }

  /**
   * Generates a cryptographic audit report and receipt of the database.
   */
  public auditStorage(): SqliteStorageAuditReport {
    const countRow = this.db.prepare("SELECT COUNT(*) as cnt FROM documents;").get() as {
      cnt: number;
    };
    const vecRow = this.db.prepare("SELECT COUNT(*) as cnt FROM documents WHERE vector IS NOT NULL;").get() as {
      cnt: number;
    };

    const catRows = this.db
      .prepare("SELECT category, COUNT(*) as cnt FROM documents GROUP BY category;")
      .all() as Array<{ category: string; cnt: number }>;

    const categories: Record<string, number> = {};
    for (const r of catRows) {
      categories[r.category] = r.cnt;
    }

    let journalMode = "memory";
    let synchronous = "0";
    try {
      const jRow = this.db.prepare("PRAGMA journal_mode;").get() as Record<string, unknown>;
      const sRow = this.db.prepare("PRAGMA synchronous;").get() as Record<string, unknown>;
      journalMode = String(jRow.journal_mode ?? "memory");
      synchronous = String(sRow.synchronous ?? "0");
    } catch {
      // Memory or restricted pragma environment
    }

    const payload = {
      timestampIso: new Date().toISOString(),
      dbPath: this.dbPath,
      journalMode,
      synchronous,
      totalDocuments: countRow ? Number(countRow.cnt) : 0,
      fts5Enabled: true,
      vectorIndexedCount: vecRow ? Number(vecRow.cnt) : 0,
      categories,
    };

    const hash = crypto.createHash("sha256");
    hash.update(JSON.stringify(payload));
    const sha256Signature = hash.digest("hex");

    const fullReport: SqliteStorageAuditReport = {
      ...payload,
      sha256Signature,
    };

    const receiptDir = path.resolve(process.cwd(), "docs", "evidence");
    if (!fs.existsSync(receiptDir)) {
      fs.mkdirSync(receiptDir, { recursive: true });
    }
    const receiptPath = path.join(receiptDir, "SQLITE_STORAGE_RECEIPT.json");
    fs.writeFileSync(receiptPath, JSON.stringify(fullReport, null, 2), "utf-8");

    return fullReport;
  }

  /**
   * Closes the database connection.
   */
  public close(): void {
    this.db.close();
  }
}
