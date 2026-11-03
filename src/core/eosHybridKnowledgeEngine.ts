/**
 * src/core/eosHybridKnowledgeEngine.ts
 *
 * SPEC-141: Distributed Vector Memory & Hybrid Search Engine (Big Tech Standard)
 * Implements persistent hybrid retrieval combining SQLite FTS5 (BM25 lexical search)
 * and dense 64-dimensional Float32Array vector embedding indexing in WAL mode.
 *
 * Fuses results with Reciprocal Rank Fusion (RRF k=60).
 * ZERO runtime NPM dependencies — 100% pure Layer-0 TypeScript.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export type DocCategory = "SPEC" | "CHANGE" | "ADR" | "CODE" | "PLAN" | "DOC";
export type SearchMode = "hybrid" | "vector" | "lexical";

export interface KnowledgeDocMeta {
  readonly docId: string;
  readonly filePath: string;
  readonly category: DocCategory;
  readonly title: string;
  readonly contentHash: string;
  readonly indexedAtIso: string;
}

export interface HybridSearchResult {
  readonly id: string;
  readonly score: number;
  readonly title: string;
  readonly snippet: string;
  readonly filePath: string;
  readonly category: DocCategory;
  readonly lexicalRank?: number;
  readonly vectorRank?: number;
}

export interface CorpusIndexReport {
  readonly indexedCount: number;
  readonly skippedCount: number;
  readonly totalDocuments: number;
  readonly durationMs: number;
}

export interface SearchOptions {
  readonly topK?: number;
  readonly mode?: SearchMode;
  readonly category?: DocCategory | "ALL";
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "with", "of",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "but", "by", "from", "into", "through", "during",
  "before", "after", "above", "below", "up", "down", "in", "out", "off",
  "over", "under", "again", "further", "then", "once", "here", "there",
  "when", "where", "why", "how", "all", "any", "both", "each", "few", "more",
  "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same",
  "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should",
  "now", "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "en",
  "para", "por", "con", "sin", "sobre", "y", "o", "u", "e", "que", "es", "son",
  "fue", "era", "se", "su", "sus", "al", "del", "lo", "como"
]);

export class EosHybridKnowledgeEngine {
  public static readonly VECTOR_DIMENSIONS = 64;
  public static readonly RRF_K = 60;

  private readonly projectRoot: string;
  private readonly dbPath: string;
  private readonly isMemory: boolean;
  private db!: DatabaseSync;

  // In-memory cache of normalized dense vectors for sub-microsecond k-NN scans
  private vectorCache: Map<string, { vector: Float32Array; category: DocCategory }> = new Map();

  constructor(projectRoot: string = process.cwd(), dbPath?: string) {
    this.projectRoot = path.resolve(projectRoot);

    if (dbPath === ":memory:") {
      this.dbPath = ":memory:";
      this.isMemory = true;
    } else if (dbPath) {
      this.dbPath = path.resolve(dbPath);
      this.isMemory = false;
    } else {
      this.dbPath = path.join(this.projectRoot, ".eos", "state", "eos_hybrid_knowledge.sqlite");
      this.isMemory = false;
    }

    this.initializeDatabase();
    this.loadVectorCache();
  }

  private initializeDatabase(): void {
    if (!this.isMemory) {
      try {
        fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
        this.db = new DatabaseSync(this.dbPath);
        this.db.exec("PRAGMA journal_mode = WAL;");
      } catch {
        // Fallback to volatile memory if directory creation fails or filesystem is read-only
        this.db = new DatabaseSync(":memory:");
      }
    } else {
      this.db = new DatabaseSync(":memory:");
    }

    this.db.exec("PRAGMA synchronous = NORMAL;");

    // 1. Metadata catalog
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS eos_docs_metadata (
        doc_id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        indexed_at_iso TEXT NOT NULL
      );
    `);

    // 2. FTS5 Virtual Table for BM25 lexical ranking
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS eos_docs_fts USING fts5(
        doc_id UNINDEXED,
        title,
        content,
        category,
        tokenize = 'unicode61'
      );
    `);

    // 3. Dense vector embeddings stored as raw binary BLOBs
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS eos_vector_nodes (
        doc_id TEXT PRIMARY KEY,
        dimensions INTEGER NOT NULL,
        vector_blob BLOB NOT NULL,
        FOREIGN KEY (doc_id) REFERENCES eos_docs_metadata(doc_id) ON DELETE CASCADE
      );
    `);
  }

  private loadVectorCache(): void {
    try {
      const rows = this.db.prepare(`
        SELECT m.doc_id, m.category, v.dimensions, v.vector_blob
        FROM eos_docs_metadata m
        JOIN eos_vector_nodes v ON m.doc_id = v.doc_id
      `).all() as Array<{
        doc_id: string;
        category: string;
        dimensions: number;
        vector_blob: Buffer | Uint8Array;
      }>;

      for (const row of rows) {
        if (row.dimensions === EosHybridKnowledgeEngine.VECTOR_DIMENSIONS) {
          const buf = row.vector_blob;
          const floatArr = new Float32Array(
            buf.buffer,
            buf.byteOffset,
            buf.byteLength / Float32Array.BYTES_PER_ELEMENT
          );
          this.vectorCache.set(row.doc_id, {
            vector: floatArr,
            category: row.category as DocCategory
          });
        }
      }
    } catch {
      // Clean slate on fresh or empty database
    }
  }

  /**
   * Deterministic 64-dimensional dense semantic embedding generator.
   * Uses subword character n-grams and positional term weighting.
   * L2 normalized to unit sphere: ||v|| = 1.0.
   */
  public generateDenseEmbedding(text: string): Float32Array {
    const dim = EosHybridKnowledgeEngine.VECTOR_DIMENSIONS;
    const vector = new Float32Array(dim);

    if (!text || typeof text !== "string") {
      return vector;
    }

    const clean = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_\-\s]/g, " ");

    const tokens = clean
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t));

    if (tokens.length === 0) {
      return vector;
    }

    for (let pos = 0; pos < tokens.length; pos++) {
      const token = tokens[pos];
      const posWeight = 1.0 + 1.0 / (pos + 1);

      // Whole-word hash projection
      let wordHash = 0x811c9dc5;
      for (let i = 0; i < token.length; i++) {
        wordHash ^= token.charCodeAt(i);
        wordHash = Math.imul(wordHash, 0x01000193);
      }
      const wordBucket = (wordHash >>> 0) % dim;
      const wordSign = (wordHash & 0x80000000) ? 1.0 : -1.0;
      vector[wordBucket] += wordSign * posWeight * 2.0;

      // Subword character 3-grams
      if (token.length >= 3) {
        for (let i = 0; i <= token.length - 3; i++) {
          const gram = token.slice(i, i + 3);
          let gramHash = 0x811c9dc5;
          for (let j = 0; j < 3; j++) {
            gramHash ^= gram.charCodeAt(j);
            gramHash = Math.imul(gramHash, 0x01000193);
          }
          const gramBucket = (gramHash >>> 0) % dim;
          const gramSign = (gramHash & 0x80000000) ? 1.0 : -1.0;
          vector[gramBucket] += gramSign * posWeight * 0.75;
        }
      }
    }

    // L2 unit-sphere normalization
    let sumSq = 0;
    for (let i = 0; i < dim; i++) {
      sumSq += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm > 1e-9) {
      for (let i = 0; i < dim; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  /**
   * Sub-microsecond Cosine similarity between two unit-normalized vectors.
   */
  public cosineSimilarity(v1: Float32Array, v2: Float32Array): number {
    if (v1.length !== v2.length) return 0;
    let dot = 0;
    for (let i = 0; i < v1.length; i++) {
      dot += v1[i] * v2[i];
    }
    return Math.max(0, Math.min(1, dot));
  }

  /**
   * Indexes a single document atomically into metadata, FTS5, and vector BLOB tables.
   */
  public indexDocument(doc: {
    docId: string;
    filePath: string;
    category: DocCategory;
    title: string;
    content: string;
  }): boolean {
    const contentHash = crypto.createHash("sha256").update(doc.content).digest("hex");
    const nowIso = new Date().toISOString();

    // Check if content already up to date
    const existing = this.db.prepare(`
      SELECT content_hash FROM eos_docs_metadata WHERE doc_id = ?
    `).get(doc.docId) as { content_hash: string } | undefined;

    if (existing && existing.content_hash === contentHash) {
      return false; // Skipped
    }

    const vector = this.generateDenseEmbedding(`${doc.title}\n${doc.content}`);
    const vectorBuf = Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);

    this.db.prepare(`
      INSERT OR REPLACE INTO eos_docs_metadata (doc_id, file_path, category, title, content_hash, indexed_at_iso)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(doc.docId, doc.filePath, doc.category, doc.title, contentHash, nowIso);

    // Update FTS5
    this.db.prepare(`DELETE FROM eos_docs_fts WHERE doc_id = ?`).run(doc.docId);
    this.db.prepare(`
      INSERT INTO eos_docs_fts (doc_id, title, content, category)
      VALUES (?, ?, ?, ?)
    `).run(doc.docId, doc.title, doc.content, doc.category);

    // Update Vector BLOB
    this.db.prepare(`
      INSERT OR REPLACE INTO eos_vector_nodes (doc_id, dimensions, vector_blob)
      VALUES (?, ?, ?)
    `).run(doc.docId, EosHybridKnowledgeEngine.VECTOR_DIMENSIONS, vectorBuf);

    // Update in-memory vector cache
    this.vectorCache.set(doc.docId, { vector, category: doc.category });
    return true;
  }

  /**
   * Scans filesystem directories incrementally and indexes OpenSpecs, Changes, Plans, and Code.
   */
  public indexCorpus(options?: {
    directories?: string[];
    forceReindex?: boolean;
  }): CorpusIndexReport {
    const startTime = performance.now();
    let indexedCount = 0;
    let skippedCount = 0;

    const targetDirs = options?.directories || [
      path.join(this.projectRoot, "openspec", "specs"),
      path.join(this.projectRoot, "openspec", "changes"),
      path.join(this.projectRoot, "docs", "plans"),
      path.join(this.projectRoot, "src", "core")
    ];

    for (const dir of targetDirs) {
      if (!fs.existsSync(dir)) continue;

      const entries = fs.readdirSync(dir, { recursive: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, String(entry));
        try {
          const stat = fs.statSync(fullPath);
          if (!stat.isFile()) continue;
        } catch {
          continue;
        }

        const isMd = fullPath.endsWith(".md");
        const isTs = fullPath.endsWith(".ts");
        if (!isMd && !isTs) continue;

        const relPath = path.relative(this.projectRoot, fullPath).replace(/\\/g, "/");
        const category = this.categorizePath(relPath);
        const content = fs.readFileSync(fullPath, "utf8");
        const docId = this.extractDocId(relPath, content);
        const title = this.extractTitle(content, docId);

        if (options?.forceReindex) {
          this.db.prepare(`DELETE FROM eos_docs_metadata WHERE doc_id = ?`).run(docId);
        }

        const updated = this.indexDocument({
          docId,
          filePath: relPath,
          category,
          title,
          content
        });

        if (updated) {
          indexedCount++;
        } else {
          skippedCount++;
        }
      }
    }

    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    const totalRow = this.db.prepare(`SELECT count(*) as count FROM eos_docs_metadata`).get() as { count: number };

    return {
      indexedCount,
      skippedCount,
      totalDocuments: totalRow ? Number(totalRow.count) : 0,
      durationMs
    };
  }

  /**
   * Executes hybrid search combining FTS5 lexical BM25 and vector cosine ranking via RRF.
   */
  public search(query: string, options?: SearchOptions): HybridSearchResult[] {
    const trimmed = (query || "").trim();
    if (!trimmed) return [];

    const topK = Math.max(1, options?.topK || 5);
    const mode = options?.mode || "hybrid";
    const categoryFilter = options?.category && options.category !== "ALL" ? options.category : null;

    if (mode === "lexical") {
      return this.searchLexical(trimmed, topK, categoryFilter);
    }

    if (mode === "vector") {
      return this.searchVector(trimmed, topK, categoryFilter);
    }

    return this.searchHybrid(trimmed, topK, categoryFilter);
  }

  private searchLexical(query: string, topK: number, categoryFilter: DocCategory | null): HybridSearchResult[] {
    const ftsQuery = this.sanitizeFtsQuery(query);
    if (!ftsQuery) return [];

    try {
      const sql = categoryFilter
        ? `
          SELECT m.doc_id, m.title, m.file_path, m.category,
                 snippet(eos_docs_fts, 2, '<b>', '</b>', '...', 16) AS snippet,
                 rank
          FROM eos_docs_fts
          JOIN eos_docs_metadata m ON eos_docs_fts.doc_id = m.doc_id
          WHERE eos_docs_fts MATCH ? AND m.category = ?
          ORDER BY rank
          LIMIT ?
        `
        : `
          SELECT m.doc_id, m.title, m.file_path, m.category,
                 snippet(eos_docs_fts, 2, '<b>', '</b>', '...', 16) AS snippet,
                 rank
          FROM eos_docs_fts
          JOIN eos_docs_metadata m ON eos_docs_fts.doc_id = m.doc_id
          WHERE eos_docs_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `;

      const params = categoryFilter ? [ftsQuery, categoryFilter, topK] : [ftsQuery, topK];
      const rows = this.db.prepare(sql).all(...params) as Array<{
        doc_id: string;
        title: string;
        file_path: string;
        category: string;
        snippet: string;
        rank: number;
      }>;

      return rows.map((r, idx) => ({
        id: r.doc_id,
        score: Number((1 / (1 + Math.abs(r.rank))).toFixed(4)),
        title: r.title,
        snippet: r.snippet || "",
        filePath: r.file_path,
        category: r.category as DocCategory,
        lexicalRank: idx + 1
      }));
    } catch {
      return [];
    }
  }

  private searchVector(query: string, topK: number, categoryFilter: DocCategory | null): HybridSearchResult[] {
    const queryVec = this.generateDenseEmbedding(query);
    const scored: Array<{ docId: string; score: number }> = [];

    for (const [docId, entry] of this.vectorCache.entries()) {
      if (categoryFilter && entry.category !== categoryFilter) continue;
      const score = this.cosineSimilarity(queryVec, entry.vector);
      if (score > 0.01) {
        scored.push({ docId, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const topScored = scored.slice(0, topK);

    return topScored.map((item, idx) => {
      const meta = this.getDocument(item.docId);
      return {
        id: item.docId,
        score: Number(item.score.toFixed(4)),
        title: meta?.title || item.docId,
        snippet: `[Vector Match] Score: ${item.score.toFixed(4)}`,
        filePath: meta?.filePath || "",
        category: (meta?.category || "DOC") as DocCategory,
        vectorRank: idx + 1
      };
    });
  }

  private searchHybrid(query: string, topK: number, categoryFilter: DocCategory | null): HybridSearchResult[] {
    const candidateLimit = Math.max(topK * 4, 30);
    const lexicalResults = this.searchLexical(query, candidateLimit, categoryFilter);

    // Vector search
    const queryVec = this.generateDenseEmbedding(query);
    const vectorScored: Array<{ docId: string; score: number }> = [];

    for (const [docId, entry] of this.vectorCache.entries()) {
      if (categoryFilter && entry.category !== categoryFilter) continue;
      const score = this.cosineSimilarity(queryVec, entry.vector);
      if (score > 0.01) {
        vectorScored.push({ docId, score });
      }
    }
    vectorScored.sort((a, b) => b.score - a.score);
    const topVector = vectorScored.slice(0, candidateLimit);

    // Reciprocal Rank Fusion (RRF)
    const k = EosHybridKnowledgeEngine.RRF_K;
    const rrfMap = new Map<string, {
      score: number;
      lexicalRank?: number;
      vectorRank?: number;
      snippet?: string;
    }>();

    lexicalResults.forEach((res, rank) => {
      const rrf = 1 / (k + rank + 1);
      rrfMap.set(res.id, {
        score: rrf,
        lexicalRank: rank + 1,
        snippet: res.snippet
      });
    });

    topVector.forEach((res, rank) => {
      const rrf = 1 / (k + rank + 1);
      const existing = rrfMap.get(res.docId);
      if (existing) {
        existing.score += rrf;
        existing.vectorRank = rank + 1;
      } else {
        rrfMap.set(res.docId, {
          score: rrf,
          vectorRank: rank + 1,
          snippet: `[Vector Match] Similarity: ${res.score.toFixed(4)}`
        });
      }
    });

    const merged = Array.from(rrfMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return merged.map((item) => {
      const meta = this.getDocument(item.id);
      return {
        id: item.id,
        score: Number(item.score.toFixed(6)),
        title: meta?.title || item.id,
        snippet: item.snippet || `[Hybrid Match] RRF Score: ${item.score.toFixed(6)}`,
        filePath: meta?.filePath || "",
        category: (meta?.category || "DOC") as DocCategory,
        lexicalRank: item.lexicalRank,
        vectorRank: item.vectorRank
      };
    });
  }

  public getDocument(docId: string): KnowledgeDocMeta | undefined {
    const row = this.db.prepare(`
      SELECT doc_id, file_path, category, title, content_hash, indexed_at_iso
      FROM eos_docs_metadata WHERE doc_id = ?
    `).get(docId) as {
      doc_id: string;
      file_path: string;
      category: string;
      title: string;
      content_hash: string;
      indexed_at_iso: string;
    } | undefined;

    if (!row) return undefined;
    return {
      docId: row.doc_id,
      filePath: row.file_path,
      category: row.category as DocCategory,
      title: row.title,
      contentHash: row.content_hash,
      indexedAtIso: row.indexed_at_iso
    };
  }

  public getStats(): { totalDocuments: number; isMemory: boolean; dbPath: string; vectorCount: number } {
    const row = this.db.prepare(`SELECT count(*) as count FROM eos_docs_metadata`).get() as { count: number };
    return {
      totalDocuments: row ? Number(row.count) : 0,
      vectorCount: this.vectorCache.size,
      isMemory: this.isMemory,
      dbPath: this.dbPath
    };
  }

  public close(): void {
    try {
      this.db.close();
    } catch {
      // Ignore if already closed
    }
  }

  private sanitizeFtsQuery(query: string): string {
    const terms = query
      .replace(/[^a-zA-Z0-9_\-\s]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && !STOPWORDS.has(t.toLowerCase()));

    if (terms.length === 0) return "";
    return terms.map((t) => `"${t}"*`).join(" OR ");
  }

  private categorizePath(relPath: string): DocCategory {
    if (relPath.includes("openspec/specs/")) return "SPEC";
    if (relPath.includes("openspec/changes/")) return "CHANGE";
    if (relPath.includes("docs/plans/")) return "PLAN";
    if (relPath.includes("docs/adr/")) return "ADR";
    if (relPath.startsWith("src/")) return "CODE";
    return "DOC";
  }

  private extractDocId(relPath: string, content: string): string {
    const base = path.basename(relPath, path.extname(relPath));
    const specMatch = content.match(/Specification ID\*?:\s*`?([A-Z0-9_\-]+)`?/i);
    if (specMatch && specMatch[1]) return specMatch[1];
    const changeMatch = content.match(/Change ID\*?:\s*`?([A-Z0-9_\-]+)`?/i);
    if (changeMatch && changeMatch[1]) return changeMatch[1];
    return base;
  }

  private extractTitle(content: string, fallback: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    if (match && match[1]) {
      return match[1].trim();
    }
    return fallback;
  }
}

let defaultKnowledgeEngine: EosHybridKnowledgeEngine | null = null;

export function getDefaultHybridKnowledgeEngine(projectRoot: string = process.cwd()): EosHybridKnowledgeEngine {
  if (!defaultKnowledgeEngine) {
    defaultKnowledgeEngine = new EosHybridKnowledgeEngine(projectRoot);
  }
  return defaultKnowledgeEngine;
}
