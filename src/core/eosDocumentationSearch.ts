/**
 * src/core/eosDocumentationSearch.ts
 * Instant Full-Text Search (FTS5) over Architecture Documentation and Specifications.
 * Uses Node.js native `node:sqlite` (`DatabaseSync`) with FTS5.
 *
 * SPEC-066: Architectural Knowledge Retrieval & Fast Indexing Engine
 * Zero runtime NPM dependencies (Strict Layer-0 Pure).
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  assertPrecondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";

export interface DocSearchResult {
  readonly path: string;
  readonly docType: string;
  readonly title: string;
  readonly snippet: string;
  readonly rank: number;
}

export interface DocIndexStats {
  readonly totalIndexed: number;
  readonly databasePath: string;
  readonly lastIndexedIso: string;
}

export class EosDocumentationSearch {
  private readonly dbPath: string;
  private readonly projectRoot: string;
  private readonly db: DatabaseSync;

  constructor(projectRoot: string = process.cwd(), dbPath?: string) {
    this.projectRoot = path.resolve(projectRoot);
    this.dbPath = dbPath
      ? (dbPath === ":memory:" ? ":memory:" : path.resolve(dbPath))
      : path.join(this.projectRoot, ".eos", "state", "eos_docs_fts.sqlite");

    if (this.dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS eos_docs_metadata (
        doc_path TEXT PRIMARY KEY,
        doc_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        updated_at_iso TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS eos_docs_fts USING fts5(
        doc_path UNINDEXED,
        doc_type,
        title,
        content,
        tokenize = 'unicode61'
      );
    `);
  }

  private detectDocType(relPath: string): string {
    const norm = relPath.replace(/\\/g, "/");
    if (norm.includes("openspec/specs/") || norm.includes("docs/specs/")) return "SPEC";
    if (norm.includes("docs/plans/")) return "PLAN";
    if (norm.includes("docs/tasks/")) return "TASK";
    if (norm.includes("docs/intake/")) return "INTAKE";
    if (norm.includes("docs/adr/")) return "ADR";
    if (norm.includes("docs/releases/")) return "RELEASE";
    return "DOC";
  }

  private extractTitle(content: string, fallback: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    if (match && match[1]) {
      return match[1].trim();
    }
    return fallback;
  }

  /**
   * Scans documentation directories and indexes markdown files.
   * Returns count of updated/indexed files.
   */
  public indexDocumentation(): number {
    const targetDirs = [
      path.join(this.projectRoot, "openspec", "specs"),
      path.join(this.projectRoot, "docs", "specs"),
      path.join(this.projectRoot, "docs", "plans"),
      path.join(this.projectRoot, "docs", "tasks"),
      path.join(this.projectRoot, "docs", "intake"),
      path.join(this.projectRoot, "docs", "releases")
    ];

    let indexedCount = 0;
    const nowIso = new Date().toISOString();

    const insertMeta = this.db.prepare(`
      INSERT OR REPLACE INTO eos_docs_metadata (doc_path, doc_type, title, content_hash, updated_at_iso)
      VALUES (?, ?, ?, ?, ?)
    `);

    const deleteFts = this.db.prepare(`
      DELETE FROM eos_docs_fts WHERE doc_path = ?
    `);

    const insertFts = this.db.prepare(`
      INSERT INTO eos_docs_fts (doc_path, doc_type, title, content)
      VALUES (?, ?, ?, ?)
    `);

    const selectHash = this.db.prepare(`
      SELECT content_hash FROM eos_docs_metadata WHERE doc_path = ?
    `);

    for (const dir of targetDirs) {
      if (!fs.existsSync(dir)) continue;

      const entries = fs.readdirSync(dir, { recursive: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, String(entry));
        if (!fs.statSync(fullPath).isFile() || !fullPath.endsWith(".md")) continue;

        const relPath = path.relative(this.projectRoot, fullPath).replace(/\\/g, "/");
        const content = fs.readFileSync(fullPath, "utf8");
        const contentHash = pureSha256(content);

        const existing = selectHash.get(relPath) as { content_hash: string } | undefined;
        if (existing && existing.content_hash === contentHash) {
          continue; // Unmodified, skip indexing
        }

        const docType = this.detectDocType(relPath);
        const title = this.extractTitle(content, path.basename(relPath, ".md"));

        // Update FTS index
        deleteFts.run(relPath);
        insertFts.run(relPath, docType, title, content);
        insertMeta.run(relPath, docType, title, contentHash, nowIso);

        indexedCount++;
      }
    }

    return indexedCount;
  }

  /**
   * Performs high-speed FTS5 search across indexed architecture documentation.
   */
  public search(query: string, limit: number = 10): readonly DocSearchResult[] {
    assertPrecondition(typeof query === "string" && query.trim().length > 0, "Search query must be a non-empty string");

    // Clean query for FTS5 syntax
    const sanitized = query.replace(/[^\w\s-]/g, " ").trim();
    if (!sanitized) return deepFreeze([]);

    // Format FTS5 query terms with prefix matching
    const terms = sanitized.split(/\s+/).map((t) => `"${t}"*`).join(" AND ");

    try {
      const stmt = this.db.prepare(`
        SELECT 
          doc_path, 
          doc_type, 
          title, 
          snippet(eos_docs_fts, 3, '>>', '<<', '...', 15) as snippet,
          rank
        FROM eos_docs_fts 
        WHERE eos_docs_fts MATCH ? 
        ORDER BY rank 
        LIMIT ?
      `);

      const rows = stmt.all(terms, Math.min(limit, 50)) as Array<{
        doc_path: string;
        doc_type: string;
        title: string;
        snippet: string;
        rank: number;
      }>;

      const results: DocSearchResult[] = rows.map((r) => ({
        path: r.doc_path,
        docType: r.doc_type,
        title: r.title,
        snippet: r.snippet.replace(/\n+/g, " "),
        rank: Number(r.rank)
      }));

      return deepFreeze(results);
    } catch {
      // Fallback simple search if FTS syntax error
      return deepFreeze([]);
    }
  }

  public getStats(): DocIndexStats {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM eos_docs_metadata").get() as { count: number };
    return deepFreeze({
      totalIndexed: row?.count || 0,
      databasePath: this.dbPath,
      lastIndexedIso: new Date().toISOString()
    });
  }

  public close(): void {
    this.db.close();
  }
}
