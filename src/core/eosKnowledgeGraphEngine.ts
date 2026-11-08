/**
 * src/core/eosKnowledgeGraphEngine.ts
 *
 * SPEC-145: Repository Knowledge Graph & Relational Impact Engine (Big Tech Standard)
 * Implements a persistent, zero-dependency directed property graph in SQLite WAL mode.
 *
 * Models architectural entities (SPEC, CHANGE, PLAN, ADR, BDD, MODULE, EVIDENCE)
 * and directed edges (IMPLEMENTS, VERIFIES, DECIDED_BY, MODIFIES, DEPENDS_ON,
 * SUPERSEDES, HAS_SCENARIO, INSTRUMENTS, COVERED_BY).
 * Supports a single-visit blast-radius walk, an in-memory adjacency
 * closure projected through EosOntologyCyclotron, and orphan drift detection.
 * Governed together with SPEC-151.
 *
 * ZERO runtime NPM dependencies — 100% Layer-0 Pure TypeScript.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { EosOntologyCyclotron } from "./eosOntologyCyclotron.ts";

export type NodeType = "SPEC" | "CHANGE" | "PLAN" | "ADR" | "BDD" | "MODULE" | "EVIDENCE";
export type EdgeRelation =
  | "IMPLEMENTS"
  | "VERIFIES"
  | "DECIDED_BY"
  | "MODIFIES"
  | "TOUCHES"
  | "DEPENDS_ON"
  | "SUPERSEDES"
  | "HAS_SCENARIO"
  | "INSTRUMENTS"
  | "COVERED_BY";

export interface GraphNode {
  readonly id: string;
  readonly type: NodeType;
  readonly title: string;
  readonly file: string;
  readonly metadata: Record<string, unknown>;
  readonly sha256: string;
  readonly updatedAt: number;
}

export interface GraphEdge {
  readonly sourceId: string;
  readonly targetId: string;
  readonly relation: EdgeRelation;
  readonly weight: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: number;
}

export interface BlastRadiusResult {
  readonly rootNodeId: string;
  readonly maxDepth: number;
  readonly direction: "BOTH" | "OUT" | "IN";
  readonly totalReachable: number;
  readonly nodes: Array<GraphNode & { depth: number; path: string }>;
  readonly edges: GraphEdge[];
  readonly durationMs: number;
}

export interface MemoryClosureResult {
  readonly rootNodeId: string;
  readonly maxDepth: number;
  readonly reachableNodeIds: readonly string[];
  readonly totalReachable: number;
  readonly depth: number;
  readonly executionUs: number;
  readonly index: "memory-adjacency";
}

export interface OrphanReport {
  readonly totalOrphans: number;
  readonly specsWithoutBdd: string[];
  readonly bddsWithoutSpec: string[];
  readonly unanchoredModules: string[];
  readonly disconnectedNodes: string[];
  readonly coverageRatio: number; // 0.0 to 1.0
  readonly durationMs: number;
}

export interface GraphStats {
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly nodesByType: Record<string, number>;
  readonly edgesByRelation: Record<string, number>;
  readonly density: number;
  readonly graphSha256: string;
  readonly topHubs: Array<{ id: string; type: NodeType; degree: number }>;
}

export class EosKnowledgeGraphEngine {
  public static readonly DEFAULT_DB_REL_PATH = "data/eos_knowledge_graph.db";

  public readonly projectRoot: string;
  public readonly dbPath: string;
  public readonly isMemory: boolean;
  public db!: DatabaseSync;
  private memoryGraph: EosOntologyCyclotron | null = null;
  private pendingCoverage: Array<{ sourceId: string; targetId: string }> = [];
  private declaredMcpTools: ReadonlySet<string> = new Set();

  constructor(projectRoot: string = process.cwd(), dbPath?: string) {
    this.projectRoot = path.resolve(projectRoot);

    if (dbPath === ":memory:") {
      this.dbPath = ":memory:";
      this.isMemory = true;
    } else if (dbPath) {
      this.dbPath = path.resolve(dbPath);
      this.isMemory = false;
    } else {
      this.dbPath = path.join(this.projectRoot, EosKnowledgeGraphEngine.DEFAULT_DB_REL_PATH);
      this.isMemory = false;
    }

    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    if (!this.isMemory) {
      try {
        fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
        this.db = new DatabaseSync(this.dbPath);
        this.db.exec("PRAGMA busy_timeout = 10000;");
        this.db.exec("PRAGMA journal_mode = WAL;");
      } catch {
        this.db = new DatabaseSync(":memory:");
      }
    } else {
      this.db = new DatabaseSync(":memory:");
    }

    try {
      this.db.exec("PRAGMA busy_timeout = 10000;");
      this.db.exec("PRAGMA synchronous = NORMAL;");
      this.db.exec("PRAGMA foreign_keys = ON;");

      // Nodes Table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS eos_kg_nodes (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          file TEXT NOT NULL,
          metadata TEXT,
          sha256 TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON eos_kg_nodes(type);
      `);

      // Edges Table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS eos_kg_edges (
          source_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          relation TEXT NOT NULL,
          weight REAL DEFAULT 1.0,
          metadata TEXT,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (source_id, target_id, relation),
          FOREIGN KEY (source_id) REFERENCES eos_kg_nodes(id) ON DELETE CASCADE,
          FOREIGN KEY (target_id) REFERENCES eos_kg_nodes(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON eos_kg_edges(source_id);
        CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON eos_kg_edges(target_id);
        CREATE INDEX IF NOT EXISTS idx_kg_edges_relation ON eos_kg_edges(relation);
      `);
    } catch {
      // In concurrent multi-process environments, if busy, fallback to :memory: safely
      try {
        this.db = new DatabaseSync(":memory:");
        this.db.exec("PRAGMA synchronous = NORMAL;");
        this.db.exec("PRAGMA foreign_keys = ON;");
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS eos_kg_nodes (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            file TEXT NOT NULL,
            metadata TEXT,
            sha256 TEXT NOT NULL,
            updated_at INTEGER NOT NULL
          );
          CREATE TABLE IF NOT EXISTS eos_kg_edges (
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            relation TEXT NOT NULL,
            weight REAL DEFAULT 1.0,
            metadata TEXT,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (source_id, target_id, relation)
          );
        `);
      } catch {}
    }
  }

  public close(): void {
    try {
      this.db.close();
    } catch {}
  }

  // ===========================================================================
  // CRUD OPERATIONS FOR NODES & EDGES
  // ===========================================================================

  public upsertNode(node: {
    id: string;
    type: NodeType;
    title: string;
    file: string;
    metadata?: Record<string, unknown>;
    sha256?: string;
  }): void {
    const sha256 =
      node.sha256 ||
      crypto
        .createHash("sha256")
        .update(node.title + node.file)
        .digest("hex");
    const metaStr = node.metadata ? JSON.stringify(node.metadata) : "{}";
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO eos_kg_nodes (id, type, title, file, metadata, sha256, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        title = excluded.title,
        file = excluded.file,
        metadata = excluded.metadata,
        sha256 = excluded.sha256,
        updated_at = excluded.updated_at
    `);
    stmt.run(node.id, node.type, node.title, node.file, metaStr, sha256, now);
  }

  public upsertEdge(edge: {
    sourceId: string;
    targetId: string;
    relation: EdgeRelation;
    weight?: number;
    metadata?: Record<string, unknown>;
  }): void {
    const weight = typeof edge.weight === "number" ? edge.weight : 1.0;
    const metaStr = edge.metadata ? JSON.stringify(edge.metadata) : "{}";
    const now = Date.now();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO eos_kg_edges (source_id, target_id, relation, weight, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_id, target_id, relation) DO UPDATE SET
          weight = excluded.weight,
          metadata = excluded.metadata
      `);
      stmt.run(edge.sourceId, edge.targetId, edge.relation, weight, metaStr, now);
    } catch {
      // If either foreign key does not exist yet in bulk ingestion, ignore gracefully
    }
  }

  public getNode(id: string): GraphNode | null {
    const stmt = this.db.prepare("SELECT * FROM eos_kg_nodes WHERE id = ?");
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapNodeRow(row);
  }

  private mapNodeRow(row: any): GraphNode {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = row.metadata ? JSON.parse(row.metadata) : {};
    } catch {}
    return {
      id: row.id,
      type: row.type as NodeType,
      title: row.title,
      file: row.file,
      metadata,
      sha256: row.sha256,
      updatedAt: Number(row.updated_at),
    };
  }

  private mapEdgeRow(row: any): GraphEdge {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = row.metadata ? JSON.parse(row.metadata) : {};
    } catch {}
    return {
      sourceId: row.source_id,
      targetId: row.target_id,
      relation: row.relation as EdgeRelation,
      weight: Number(row.weight),
      metadata,
      createdAt: Number(row.created_at),
    };
  }

  // ===========================================================================
  // AUTOMATED MULTI-SOURCE INGESTION & EXTRACTION
  // ===========================================================================

  public syncGraph(): {
    nodesAdded: number;
    edgesAdded: number;
    durationMs: number;
    graphSha256: string;
  } {
    const t0 = Date.now();
    this.pendingCoverage = [];
    this.declaredMcpTools = this.loadDeclaredMcpTools();
    this.memoryGraph = null;

    this.db.exec("BEGIN IMMEDIATE;");
    try {
      this.ingestOpenSpecs();
      this.ingestChanges();
      this.ingestPlansAndAdrs();
      this.ingestTests();
      this.ingestSourceModules();
      this.flushCoverage();
      this.db.exec("COMMIT;");
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }

    this.projectMemoryIndex();

    const durationMs = Date.now() - t0;
    const stats = this.getGraphStats();

    return {
      nodesAdded: stats.totalNodes,
      edgesAdded: stats.totalEdges,
      durationMs,
      graphSha256: stats.graphSha256,
    };
  }

  private ingestOpenSpecs(): void {
    const specsDir = path.join(this.projectRoot, "openspec", "specs");
    if (!fs.existsSync(specsDir)) return;

    const files = fs.readdirSync(specsDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const fullPath = path.join(specsDir, file);
      const content = fs.readFileSync(fullPath, "utf8");
      const relFile = path.relative(this.projectRoot, fullPath).replace(/\\/g, "/");

      const idMatch = content.match(/Specification ID\*?:\s*`?(SPEC-\d+)`?/i) || file.match(/(SPEC-\d+)/i);
      if (!idMatch) continue;
      const specId = idMatch[1].toUpperCase();

      const titleMatch = content.match(/^#\s+(?:SPEC-\d+:\s*)?([^\n\r]+)/m);
      const title = titleMatch ? titleMatch[1].trim() : specId;

      const statusMatch = content.match(/Status\*?:\s*`?([A-Z_]+)`?/i);
      const status = statusMatch ? statusMatch[1].toUpperCase() : "APPROVED";

      const fileSha256 = crypto.createHash("sha256").update(content).digest("hex");

      // Extract EARS requirements count
      const frMatches = content.match(/FR-\d+/g) || [];
      const frCount = new Set(frMatches).size;

      // Extract BDD scenarios
      const bddMatches = content.match(/BDD-\d+/g) || [];
      const bddIds = Array.from(new Set(bddMatches));

      this.upsertNode({
        id: specId,
        type: "SPEC",
        title,
        file: relFile,
        metadata: { status, frCount, bddCount: bddIds.length },
        sha256: fileSha256,
      });

      // Register BDD nodes and edges
      for (const bddId of bddIds) {
        this.upsertNode({
          id: bddId,
          type: "BDD",
          title: `Scenario ${bddId}`,
          file: relFile,
          metadata: { specRef: specId },
        });
        this.upsertEdge({
          sourceId: specId,
          targetId: bddId,
          relation: "HAS_SCENARIO",
        });
      }

      // Extract Related Specs (DEPENDS_ON)
      const relatedMatches = content.match(/Related Specs\*?:\s*([^\n\r]+)/i);
      if (relatedMatches) {
        const foundSpecs = relatedMatches[1].match(/SPEC-\d+/g) || [];
        for (const depSpec of foundSpecs) {
          if (depSpec !== specId) {
            this.upsertEdge({
              sourceId: specId,
              targetId: depSpec,
              relation: "DEPENDS_ON",
            });
          }
        }
      }

      // Extract ADR references (DECIDED_BY)
      const adrMatches = content.match(/ADR-\d+/g) || [];
      for (const adrId of new Set(adrMatches)) {
        this.upsertNode({
          id: adrId,
          type: "ADR",
          title: `Architectural Decision ${adrId}`,
          file: relFile,
          metadata: {},
        });
        this.upsertEdge({
          sourceId: specId,
          targetId: adrId,
          relation: "DECIDED_BY",
        });
      }

      // Extract Module Target (IMPLEMENTS)
      const targetMatch = content.match(/Module Target\*?:\s*([^\n\r]+)/i);
      if (targetMatch) {
        const paths = targetMatch[1].match(/(?:src|api|test)\/[a-zA-Z0-9_\-\.\/]+/g) || [];
        for (const targetPath of paths) {
          this.upsertNode({
            id: targetPath,
            type: "MODULE",
            title: path.basename(targetPath),
            file: targetPath,
            metadata: {},
          });
          this.upsertEdge({
            sourceId: targetPath,
            targetId: specId,
            relation: "IMPLEMENTS",
          });
        }
      }

      for (const toolName of this.mentionedMcpTools(content)) {
        const toolId = `mcp:${toolName}`;
        this.upsertNode({
          id: toolId,
          type: "MODULE",
          title: toolName,
          file: "src/mcp/eosMcpServer.ts",
          metadata: { role: "MCP_TOOL" },
        });
        this.upsertEdge({
          sourceId: specId,
          targetId: toolId,
          relation: "INSTRUMENTS",
        });
      }
    }
  }

  private loadDeclaredMcpTools(): ReadonlySet<string> {
    // Tool schemas live in eosMcpToolDefinitions.ts; the dispatcher stays in
    // eosMcpServer.ts. Scan both so declarations are never missed.
    const candidates = [
      path.join(this.projectRoot, "src", "mcp", "eosMcpServer.ts"),
      path.join(this.projectRoot, "src", "mcp", "eosMcpToolDefinitions.ts"),
    ];
    const names = new Set<string>();
    const matcher = /name:\s*"(eos_[a-z0-9_]+)"/g;
    for (const serverFile of candidates) {
      if (!fs.existsSync(serverFile)) continue;
      const text = fs.readFileSync(serverFile, "utf8");
      let match: RegExpExecArray | null;
      while ((match = matcher.exec(text)) !== null) {
        names.add(match[1]);
      }
      matcher.lastIndex = 0;
    }
    return names;
  }

  private mentionedMcpTools(content: string): string[] {
    const found = content.match(/\beos_[a-z0-9_]+\b/g) || [];
    return Array.from(new Set(found)).filter((name) => this.declaredMcpTools.has(name));
  }

  private queueCoverage(sourceId: string, targetId: string): void {
    this.pendingCoverage.push({ sourceId, targetId });
  }

  private flushCoverage(): void {
    for (const link of this.pendingCoverage) {
      if (this.getNode(link.sourceId) && this.getNode(link.targetId)) {
        this.upsertEdge({
          sourceId: link.sourceId,
          targetId: link.targetId,
          relation: "COVERED_BY",
        });
      }
    }
    this.pendingCoverage = [];
  }

  private ingestChanges(): void {
    const changesDir = path.join(this.projectRoot, "openspec", "changes");
    if (!fs.existsSync(changesDir)) return;

    const files = fs.readdirSync(changesDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const fullPath = path.join(changesDir, file);
      const content = fs.readFileSync(fullPath, "utf8");
      const relFile = path.relative(this.projectRoot, fullPath).replace(/\\/g, "/");

      const idMatch = content.match(/Change ID\*?:\s*`?(CHANGE-\d+)`?/i) || file.match(/(CHANGE-\d+)/i);
      if (!idMatch) continue;
      const changeId = idMatch[1].toUpperCase();

      const titleMatch = content.match(/^#\s+(?:CHANGE-\d+:\s*)?([^\n\r]+)/m);
      const title = titleMatch ? titleMatch[1].trim() : changeId;

      const specMatch = content.match(/Specification ID\*?:\s*`?(SPEC-\d+)`?/i);
      const specRef = specMatch ? specMatch[1].toUpperCase() : null;

      const fileSha256 = crypto.createHash("sha256").update(content).digest("hex");

      this.upsertNode({
        id: changeId,
        type: "CHANGE",
        title,
        file: relFile,
        metadata: { specRef },
        sha256: fileSha256,
      });

      if (specRef) {
        this.upsertEdge({
          sourceId: changeId,
          targetId: specRef,
          relation: "MODIFIES",
        });
      }

      // Extract target files (TOUCHES)
      const targetFiles = content.match(/(?:src|api|test|docs)\/[a-zA-Z0-9_\-\.\/]+/g) || [];
      for (const tFile of new Set(targetFiles)) {
        if (!tFile.endsWith(".md") && !tFile.endsWith(".json")) {
          this.upsertNode({
            id: tFile,
            type: "MODULE",
            title: path.basename(tFile),
            file: tFile,
            metadata: {},
          });
          this.upsertEdge({
            sourceId: changeId,
            targetId: tFile,
            relation: "TOUCHES",
          });
        }
      }
    }
  }

  private ingestPlansAndAdrs(): void {
    const plansDir = path.join(this.projectRoot, "docs", "plans");
    if (!fs.existsSync(plansDir)) return;

    const files = fs.readdirSync(plansDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const fullPath = path.join(plansDir, file);
      const content = fs.readFileSync(fullPath, "utf8");
      const relFile = path.relative(this.projectRoot, fullPath).replace(/\\/g, "/");

      const planMatch = file.match(/(PLAN-\d+)/i);
      const planId = planMatch ? planMatch[1].toUpperCase() : path.basename(file, ".md");

      this.upsertNode({
        id: planId,
        type: "PLAN",
        title: `Plan ${planId}`,
        file: relFile,
        metadata: {},
      });

      // Extract ADR headers e.g. "### ADR-0181: Inconditional Preemptive Worker..."
      const adrRegex = /###\s+(ADR-\d+)[:\s]+([^\n\r]+)/gi;
      let m: RegExpExecArray | null;
      while ((m = adrRegex.exec(content)) !== null) {
        const adrId = m[1].toUpperCase();
        const adrTitle = m[2].trim();

        this.upsertNode({
          id: adrId,
          type: "ADR",
          title: adrTitle,
          file: relFile,
          metadata: { planRef: planId },
        });

        this.upsertEdge({
          sourceId: planId,
          targetId: adrId,
          relation: "DECIDED_BY",
        });
      }
    }
  }

  private ingestTests(): void {
    const testDir = path.join(this.projectRoot, "test");
    if (!fs.existsSync(testDir)) return;

    const files = fs.readdirSync(testDir).filter((f) => f.endsWith(".test.mjs") || f.endsWith(".test.ts"));
    for (const file of files) {
      const fullPath = path.join(testDir, file);
      const content = fs.readFileSync(fullPath, "utf8");
      const relFile = path.relative(this.projectRoot, fullPath).replace(/\\/g, "/");

      const testId = `test/${file}`;
      this.upsertNode({
        id: testId,
        type: "MODULE",
        title: file,
        file: relFile,
        metadata: { role: "TEST_SUITE" },
      });

      // Find BDDs tested e.g. BDD-398
      const bddMatches = content.match(/BDD-\d+/g) || [];
      for (const bddId of new Set(bddMatches)) {
        this.upsertNode({
          id: bddId,
          type: "BDD",
          title: `Scenario ${bddId}`,
          file: relFile,
          metadata: {},
        });
        this.upsertEdge({
          sourceId: testId,
          targetId: bddId,
          relation: "VERIFIES",
        });
      }

      // Find Specs referenced in comments e.g. SPEC-144
      const specMatches = content.match(/SPEC-\d+/g) || [];
      for (const specId of new Set(specMatches)) {
        this.upsertEdge({
          sourceId: testId,
          targetId: specId,
          relation: "VERIFIES",
        });
        this.queueCoverage(specId, testId);
      }

      const importMatcher = /from\s+["'](\.\.?\/[^"']+)["']/g;
      let importMatch: RegExpExecArray | null;
      while ((importMatch = importMatcher.exec(content)) !== null) {
        const resolved = path.normalize(path.join(path.dirname(fullPath), importMatch[1]));
        let rel = path.relative(this.projectRoot, resolved).replace(/\\/g, "/");
        if (!/\.(?:ts|mjs|js)$/.test(rel) && fs.existsSync(`${resolved}.ts`)) {
          rel = `${rel}.ts`;
        }
        if (rel.startsWith("src/") || rel.startsWith("api/")) {
          this.queueCoverage(rel, testId);
        }
      }
    }
  }

  private ingestSourceModules(): void {
    const srcDir = path.join(this.projectRoot, "src");
    if (!fs.existsSync(srcDir)) return;

    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))) {
          const relFile = path.relative(this.projectRoot, fullPath).replace(/\\/g, "/");
          const content = fs.readFileSync(fullPath, "utf8");
          const fileSha256 = crypto.createHash("sha256").update(content).digest("hex");

          this.upsertNode({
            id: relFile,
            type: "MODULE",
            title: path.basename(relFile),
            file: relFile,
            metadata: { byteLength: content.length },
            sha256: fileSha256,
          });

          // Check spec references inside comments (e.g. SPEC-145, SPEC-144)
          const specMatches = content.match(/SPEC-\d+/g) || [];
          for (const specId of new Set(specMatches)) {
            this.upsertEdge({
              sourceId: relFile,
              targetId: specId,
              relation: "IMPLEMENTS",
            });
          }
        }
      }
    };

    scanDir(srcDir);
  }

  // ===========================================================================
  // GRAPH ALGORITHMS: BLAST RADIUS, NEIGHBORS, ORPHAN DETECTION
  // ===========================================================================

  public computeBlastRadius(
    rootNodeId: string,
    options: { maxDepth?: number; direction?: "BOTH" | "OUT" | "IN" } = {},
  ): BlastRadiusResult {
    this.requireKnownNode(rootNodeId);
    const t0 = process.hrtime.bigint();
    const maxDepth = Math.max(1, Math.min(10, options.maxDepth || 4));
    const direction = options.direction || "BOTH";

    const reached = new Map<string, { depth: number; path: string }>();
    const queue: Array<{ id: string; depth: number; path: string }> = [];
    let head = 0;
    reached.set(rootNodeId, { depth: 0, path: rootNodeId });
    queue.push({ id: rootNodeId, depth: 0, path: rootNodeId });

    const outStmt = this.db.prepare("SELECT target_id, relation FROM eos_kg_edges WHERE source_id = ?");
    const inStmt = this.db.prepare("SELECT source_id, relation FROM eos_kg_edges WHERE target_id = ?");

    while (head < queue.length) {
      const current = queue[head];
      head += 1;
      if (current.depth >= maxDepth) continue;

      if (direction === "OUT" || direction === "BOTH") {
        const outgoing = outStmt.all(current.id) as Array<{ target_id: string; relation: string }>;
        for (const edge of outgoing) {
          if (reached.has(edge.target_id)) continue;
          const nextPath = `${current.path} -> ${edge.relation} -> ${edge.target_id}`;
          const next = { id: edge.target_id, depth: current.depth + 1, path: nextPath };
          reached.set(edge.target_id, { depth: next.depth, path: next.path });
          queue.push(next);
        }
      }

      if (direction === "IN" || direction === "BOTH") {
        const incoming = inStmt.all(current.id) as Array<{ source_id: string; relation: string }>;
        for (const edge of incoming) {
          if (reached.has(edge.source_id)) continue;
          const nextPath = `${current.path} <- ${edge.relation} <- ${edge.source_id}`;
          const next = { id: edge.source_id, depth: current.depth + 1, path: nextPath };
          reached.set(edge.source_id, { depth: next.depth, path: next.path });
          queue.push(next);
        }
      }
    }

    const orderedIds = Array.from(reached.entries())
      .sort((a, b) => a[1].depth - b[1].depth || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([id]) => id);

    const nodes: Array<GraphNode & { depth: number; path: string }> = [];
    const nodeIds = new Set<string>();
    const nodeStmt = this.db.prepare("SELECT * FROM eos_kg_nodes WHERE id = ?");
    for (const id of orderedIds) {
      const row = nodeStmt.get(id) as any;
      if (!row) continue;
      const meta = reached.get(id)!;
      nodes.push({
        ...this.mapNodeRow(row),
        depth: meta.depth,
        path: meta.path,
      });
      nodeIds.add(id);
    }
    const edges: GraphEdge[] = [];
    if (nodeIds.size > 0) {
      const idsArray = Array.from(nodeIds);
      const chunkSize = 200;
      for (let i = 0; i < idsArray.length; i += chunkSize) {
        const chunk = idsArray.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => "?").join(",");
        const edgeRows = this.db
          .prepare(`SELECT * FROM eos_kg_edges WHERE source_id IN (${placeholders})`)
          .all(...chunk) as any[];

        for (const er of edgeRows) {
          if (nodeIds.has(er.target_id)) {
            edges.push(this.mapEdgeRow(er));
          }
        }
      }
    }

    const durationMs = Number(process.hrtime.bigint() - t0) / 1_000_000;

    return {
      rootNodeId,
      maxDepth,
      direction,
      totalReachable: nodes.length,
      nodes,
      edges,
      durationMs,
    };
  }

  public computeMemoryClosure(rootNodeId: string, options: { maxDepth?: number } = {}): MemoryClosureResult {
    this.requireKnownNode(rootNodeId);
    if (!this.memoryGraph) this.projectMemoryIndex();
    const maxDepth = Math.max(1, Math.min(16, options.maxDepth || 8));
    const closure = this.memoryGraph!.computeTransitiveClosure(rootNodeId, undefined, maxDepth);
    return {
      rootNodeId,
      maxDepth,
      reachableNodeIds: closure.reachableNodeIds,
      totalReachable: closure.totalReachable,
      depth: closure.depth,
      executionUs: closure.executionUs,
      index: "memory-adjacency",
    };
  }

  private requireKnownNode(nodeId: string): void {
    if (!nodeId || !this.getNode(nodeId)) {
      throw new Error(`Unknown knowledge graph node: ${nodeId}`);
    }
  }

  private projectMemoryIndex(): void {
    const cyclotron = new EosOntologyCyclotron();
    const nodeRows = this.db.prepare("SELECT id, type FROM eos_kg_nodes").all() as Array<{ id: string; type: string }>;
    for (const row of nodeRows) {
      cyclotron.registerNode(row.id, row.type, {});
    }
    const edgeRows = this.db.prepare("SELECT source_id, target_id, relation FROM eos_kg_edges").all() as Array<{
      source_id: string;
      target_id: string;
      relation: string;
    }>;
    for (const row of edgeRows) {
      cyclotron.registerEdge(row.source_id, row.target_id, row.relation);
    }
    this.memoryGraph = cyclotron;
  }

  public getNeighbors(
    nodeId: string,
    direction: "BOTH" | "OUT" | "IN" = "BOTH",
  ): {
    node: GraphNode | null;
    outgoing: Array<{ edge: GraphEdge; target: GraphNode }>;
    incoming: Array<{ edge: GraphEdge; source: GraphNode }>;
  } {
    const node = this.getNode(nodeId);
    if (!node) {
      return { node: null, outgoing: [], incoming: [] };
    }

    let outgoing: Array<{ edge: GraphEdge; target: GraphNode }> = [];
    let incoming: Array<{ edge: GraphEdge; source: GraphNode }> = [];

    if (direction === "BOTH" || direction === "OUT") {
      const outStmt = this.db.prepare(`
        SELECT e.*, n.type as n_type, n.title as n_title, n.file as n_file, n.metadata as n_metadata, n.sha256 as n_sha256, n.updated_at as n_updated_at
        FROM eos_kg_edges e
        JOIN eos_kg_nodes n ON e.target_id = n.id
        WHERE e.source_id = ?
      `);
      const outRows = outStmt.all(nodeId) as any[];
      outgoing = outRows.map((r) => ({
        edge: this.mapEdgeRow(r),
        target: this.mapNodeRow({
          id: r.target_id,
          type: r.n_type,
          title: r.n_title,
          file: r.n_file,
          metadata: r.n_metadata,
          sha256: r.n_sha256,
          updated_at: r.n_updated_at,
        }),
      }));
    }

    if (direction === "BOTH" || direction === "IN") {
      const inStmt = this.db.prepare(`
        SELECT e.*, n.type as n_type, n.title as n_title, n.file as n_file, n.metadata as n_metadata, n.sha256 as n_sha256, n.updated_at as n_updated_at
        FROM eos_kg_edges e
        JOIN eos_kg_nodes n ON e.source_id = n.id
        WHERE e.target_id = ?
      `);
      const inRows = inStmt.all(nodeId) as any[];
      incoming = inRows.map((r) => ({
        edge: this.mapEdgeRow(r),
        source: this.mapNodeRow({
          id: r.source_id,
          type: r.n_type,
          title: r.n_title,
          file: r.n_file,
          metadata: r.n_metadata,
          sha256: r.n_sha256,
          updated_at: r.n_updated_at,
        }),
      }));
    }

    return { node, outgoing, incoming };
  }

  public findOrphans(): OrphanReport {
    const t0 = Date.now();

    // 1. Specs without BDDs
    const specsNoBddStmt = this.db.prepare(`
      SELECT s.id FROM eos_kg_nodes s
      WHERE s.type = 'SPEC'
        AND s.id NOT IN (
          SELECT source_id FROM eos_kg_edges WHERE relation = 'HAS_SCENARIO'
        )
    `);
    const specsWithoutBdd = (specsNoBddStmt.all() as any[]).map((r) => r.id);

    // 2. BDDs without Specs
    const bddNoSpecStmt = this.db.prepare(`
      SELECT b.id FROM eos_kg_nodes b
      WHERE b.type = 'BDD'
        AND b.id NOT IN (
          SELECT target_id FROM eos_kg_edges WHERE relation = 'HAS_SCENARIO'
        )
    `);
    const bddsWithoutSpec = (bddNoSpecStmt.all() as any[]).map((r) => r.id);

    // 3. Disconnected nodes (degree 0)
    const disconnectedStmt = this.db.prepare(`
      SELECT id FROM eos_kg_nodes
      WHERE id NOT IN (SELECT source_id FROM eos_kg_edges)
        AND id NOT IN (SELECT target_id FROM eos_kg_edges)
    `);
    const disconnectedNodes = (disconnectedStmt.all() as any[]).map((r) => r.id);

    // 4. Total specs for coverage ratio
    const totalSpecsStmt = this.db.prepare("SELECT COUNT(*) as count FROM eos_kg_nodes WHERE type = 'SPEC'");
    const totalSpecs = Number((totalSpecsStmt.get() as any)?.count || 0);

    const specsWithBddCount = totalSpecs - specsWithoutBdd.length;
    const coverageRatio = totalSpecs > 0 ? specsWithBddCount / totalSpecs : 1.0;

    return {
      totalOrphans: specsWithoutBdd.length + bddsWithoutSpec.length + disconnectedNodes.length,
      specsWithoutBdd,
      bddsWithoutSpec,
      unanchoredModules: [],
      disconnectedNodes,
      coverageRatio,
      durationMs: Date.now() - t0,
    };
  }

  public getGraphStats(): GraphStats {
    const totalNodesStmt = this.db.prepare("SELECT COUNT(*) as c FROM eos_kg_nodes");
    const totalNodes = Number((totalNodesStmt.get() as any)?.c || 0);

    const totalEdgesStmt = this.db.prepare("SELECT COUNT(*) as c FROM eos_kg_edges");
    const totalEdges = Number((totalEdgesStmt.get() as any)?.c || 0);

    const nodesByTypeStmt = this.db.prepare("SELECT type, COUNT(*) as c FROM eos_kg_nodes GROUP BY type");
    const nodesByType: Record<string, number> = {};
    for (const r of nodesByTypeStmt.all() as any[]) {
      nodesByType[r.type] = Number(r.c);
    }

    const edgesByRelStmt = this.db.prepare("SELECT relation, COUNT(*) as c FROM eos_kg_edges GROUP BY relation");
    const edgesByRelation: Record<string, number> = {};
    for (const r of edgesByRelStmt.all() as any[]) {
      edgesByRelation[r.relation] = Number(r.c);
    }

    const maxPossibleEdges = totalNodes > 1 ? totalNodes * (totalNodes - 1) : 1;
    const density = totalNodes > 1 ? totalEdges / maxPossibleEdges : 0;

    // Top Hubs by Degree
    const hubsStmt = this.db.prepare(`
      SELECT n.id, n.type, (
        (SELECT COUNT(*) FROM eos_kg_edges WHERE source_id = n.id) +
        (SELECT COUNT(*) FROM eos_kg_edges WHERE target_id = n.id)
      ) as degree
      FROM eos_kg_nodes n
      ORDER BY degree DESC
      LIMIT 10
    `);
    const topHubs = (hubsStmt.all() as any[]).map((r) => ({
      id: r.id,
      type: r.type as NodeType,
      degree: Number(r.degree),
    }));

    // Cryptographic topology hash
    const allNodesStmt = this.db.prepare("SELECT id, sha256 FROM eos_kg_nodes ORDER BY id ASC");
    const allEdgesStmt = this.db.prepare(
      "SELECT source_id, target_id, relation FROM eos_kg_edges ORDER BY source_id, target_id, relation ASC",
    );

    const hasher = crypto.createHash("sha256");
    for (const n of allNodesStmt.all() as any[]) {
      hasher.update(`${n.id}:${n.sha256};`);
    }
    for (const e of allEdgesStmt.all() as any[]) {
      hasher.update(`${e.source_id}->${e.relation}->${e.target_id};`);
    }
    const graphSha256 = hasher.digest("hex");

    return {
      totalNodes,
      totalEdges,
      nodesByType,
      edgesByRelation,
      density,
      graphSha256,
      topHubs,
    };
  }
}

let defaultKnowledgeGraphEngineInstance: EosKnowledgeGraphEngine | null = null;

export function getDefaultKnowledgeGraphEngine(projectRoot: string = process.cwd()): EosKnowledgeGraphEngine {
  if (!defaultKnowledgeGraphEngineInstance) {
    defaultKnowledgeGraphEngineInstance = new EosKnowledgeGraphEngine(projectRoot);
  }
  return defaultKnowledgeGraphEngineInstance;
}
