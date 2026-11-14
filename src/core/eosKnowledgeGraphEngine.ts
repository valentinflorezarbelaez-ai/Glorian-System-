/**
 * src/core/eosKnowledgeGraphEngine.ts
 *
 * SPEC-145: Repository Knowledge Graph & Relational Impact Engine (Big Tech Standard)
 * Implements a persistent, zero-dependency directed property graph in SQLite WAL mode.
 * Governed together with SPEC-151.
 *
 * ZERO runtime NPM dependencies — 100% Layer-0 Pure TypeScript.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { EosOntologyCyclotron } from "./eosOntologyCyclotron.ts";
import type {
  NodeType,
  EdgeRelation,
  GraphNode,
  GraphEdge,
  BlastRadiusResult,
  MemoryClosureResult,
  OrphanReport,
  GraphStats,
} from "./eosKnowledgeGraphEngine.types.ts";

export type {
  NodeType,
  EdgeRelation,
  GraphNode,
  GraphEdge,
  BlastRadiusResult,
  MemoryClosureResult,
  OrphanReport,
  GraphStats,
};

const KG_SCHEMA_SQL = [
  "CREATE TABLE IF NOT EXISTS eos_kg_nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, file TEXT NOT NULL, metadata TEXT, sha256 TEXT NOT NULL, updated_at INTEGER NOT NULL);",
  "CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON eos_kg_nodes(type);",
  "CREATE TABLE IF NOT EXISTS eos_kg_edges (source_id TEXT NOT NULL, target_id TEXT NOT NULL, relation TEXT NOT NULL, weight REAL DEFAULT 1.0, metadata TEXT, created_at INTEGER NOT NULL, PRIMARY KEY (source_id, target_id, relation), FOREIGN KEY (source_id) REFERENCES eos_kg_nodes(id) ON DELETE CASCADE, FOREIGN KEY (target_id) REFERENCES eos_kg_nodes(id) ON DELETE CASCADE);",
  "CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON eos_kg_edges(source_id);",
  "CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON eos_kg_edges(target_id);",
  "CREATE INDEX IF NOT EXISTS idx_kg_edges_relation ON eos_kg_edges(relation);",
].join("\n");

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
        this.db.exec("PRAGMA busy_timeout = 10000; PRAGMA journal_mode = WAL;");
      } catch {
        this.db = new DatabaseSync(":memory:");
      }
    } else {
      this.db = new DatabaseSync(":memory:");
    }

    try {
      this.db.exec("PRAGMA busy_timeout = 10000; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;");
      this.db.exec(KG_SCHEMA_SQL);
    } catch {
      try {
        this.db = new DatabaseSync(":memory:");
        this.db.exec("PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;");
        this.db.exec(KG_SCHEMA_SQL);
      } catch {}
    }
  }

  public close(): void {
    try {
      this.db.close();
    } catch {}
  }

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
    const stmt = this.db.prepare(
      "INSERT INTO eos_kg_nodes (id, type, title, file, metadata, sha256, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET type = excluded.type, title = excluded.title, file = excluded.file, metadata = excluded.metadata, sha256 = excluded.sha256, updated_at = excluded.updated_at",
    );
    stmt.run(node.id, node.type, node.title, node.file, metaStr, sha256, Date.now());
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
    try {
      const stmt = this.db.prepare(
        "INSERT INTO eos_kg_edges (source_id, target_id, relation, weight, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(source_id, target_id, relation) DO UPDATE SET weight = excluded.weight, metadata = excluded.metadata",
      );
      stmt.run(edge.sourceId, edge.targetId, edge.relation, weight, metaStr, Date.now());
    } catch {}
  }

  public getNode(id: string): GraphNode | null {
    const row = this.db.prepare("SELECT * FROM eos_kg_nodes WHERE id = ?").get(id) as any;
    return row ? this.mapNodeRow(row) : null;
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

    for (const file of fs.readdirSync(specsDir).filter((f) => f.endsWith(".md"))) {
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
      const frCount = new Set(content.match(/FR-\d+/g) || []).size;
      const bddIds = Array.from(new Set(content.match(/BDD-\d+/g) || []));

      this.upsertNode({
        id: specId,
        type: "SPEC",
        title,
        file: relFile,
        metadata: { status, frCount, bddCount: bddIds.length },
        sha256: fileSha256,
      });

      for (const bddId of bddIds) {
        this.upsertNode({
          id: bddId,
          type: "BDD",
          title: `Scenario ${bddId}`,
          file: relFile,
          metadata: { specRef: specId },
        });
        this.upsertEdge({ sourceId: specId, targetId: bddId, relation: "HAS_SCENARIO" });
      }

      const relatedMatches = content.match(/Related Specs\*?:\s*([^\n\r]+)/i);
      if (relatedMatches) {
        for (const depSpec of relatedMatches[1].match(/SPEC-\d+/g) || []) {
          if (depSpec !== specId) this.upsertEdge({ sourceId: specId, targetId: depSpec, relation: "DEPENDS_ON" });
        }
      }

      for (const adrId of new Set(content.match(/ADR-\d+/g) || [])) {
        this.upsertNode({
          id: adrId,
          type: "ADR",
          title: `Architectural Decision ${adrId}`,
          file: relFile,
          metadata: {},
        });
        this.upsertEdge({ sourceId: specId, targetId: adrId, relation: "DECIDED_BY" });
      }

      const targetMatch = content.match(/Module Target\*?:\s*([^\n\r]+)/i);
      if (targetMatch) {
        for (const targetPath of targetMatch[1].match(/(?:src|api|test)\/[a-zA-Z0-9_\-\.\/]+/g) || []) {
          this.upsertNode({
            id: targetPath,
            type: "MODULE",
            title: path.basename(targetPath),
            file: targetPath,
            metadata: {},
          });
          this.upsertEdge({ sourceId: targetPath, targetId: specId, relation: "IMPLEMENTS" });
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
        this.upsertEdge({ sourceId: specId, targetId: toolId, relation: "INSTRUMENTS" });
      }
    }
  }

  private loadDeclaredMcpTools(): ReadonlySet<string> {
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
      while ((match = matcher.exec(text)) !== null) names.add(match[1]);
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
        this.upsertEdge({ sourceId: link.sourceId, targetId: link.targetId, relation: "COVERED_BY" });
      }
    }
    this.pendingCoverage = [];
  }

  private ingestChanges(): void {
    const changesDir = path.join(this.projectRoot, "openspec", "changes");
    if (!fs.existsSync(changesDir)) return;

    for (const file of fs.readdirSync(changesDir).filter((f) => f.endsWith(".md"))) {
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
      if (specRef) this.upsertEdge({ sourceId: changeId, targetId: specRef, relation: "MODIFIES" });

      for (const tFile of new Set(content.match(/(?:src|api|test|docs)\/[a-zA-Z0-9_\-\.\/]+/g) || [])) {
        if (!tFile.endsWith(".md") && !tFile.endsWith(".json")) {
          this.upsertNode({ id: tFile, type: "MODULE", title: path.basename(tFile), file: tFile, metadata: {} });
          this.upsertEdge({ sourceId: changeId, targetId: tFile, relation: "TOUCHES" });
        }
      }
    }
  }

  private ingestPlansAndAdrs(): void {
    const plansDir = path.join(this.projectRoot, "docs", "plans");
    if (!fs.existsSync(plansDir)) return;

    for (const file of fs.readdirSync(plansDir).filter((f) => f.endsWith(".md"))) {
      const fullPath = path.join(plansDir, file);
      const content = fs.readFileSync(fullPath, "utf8");
      const relFile = path.relative(this.projectRoot, fullPath).replace(/\\/g, "/");
      const planMatch = file.match(/(PLAN-\d+)/i);
      const planId = planMatch ? planMatch[1].toUpperCase() : path.basename(file, ".md");

      this.upsertNode({ id: planId, type: "PLAN", title: `Plan ${planId}`, file: relFile, metadata: {} });

      const adrRegex = /###\s+(ADR-\d+)[:\s]+([^\n\r]+)/gi;
      let m: RegExpExecArray | null;
      while ((m = adrRegex.exec(content)) !== null) {
        const adrId = m[1].toUpperCase();
        this.upsertNode({
          id: adrId,
          type: "ADR",
          title: m[2].trim(),
          file: relFile,
          metadata: { planRef: planId },
        });
        this.upsertEdge({ sourceId: planId, targetId: adrId, relation: "DECIDED_BY" });
      }
    }
  }

  private ingestTests(): void {
    const testDir = path.join(this.projectRoot, "test");
    if (!fs.existsSync(testDir)) return;

    for (const file of fs.readdirSync(testDir).filter((f) => f.endsWith(".test.mjs") || f.endsWith(".test.ts"))) {
      const fullPath = path.join(testDir, file);
      const content = fs.readFileSync(fullPath, "utf8");
      const relFile = path.relative(this.projectRoot, fullPath).replace(/\\/g, "/");
      const testId = `test/${file}`;

      this.upsertNode({ id: testId, type: "MODULE", title: file, file: relFile, metadata: { role: "TEST_SUITE" } });

      for (const bddId of new Set(content.match(/BDD-\d+/g) || [])) {
        this.upsertNode({ id: bddId, type: "BDD", title: `Scenario ${bddId}`, file: relFile, metadata: {} });
        this.upsertEdge({ sourceId: testId, targetId: bddId, relation: "VERIFIES" });
      }

      for (const specId of new Set(content.match(/SPEC-\d+/g) || [])) {
        this.upsertEdge({ sourceId: testId, targetId: specId, relation: "VERIFIES" });
        this.queueCoverage(specId, testId);
      }

      const importMatcher = /from\s+["'](\.\.?\/[^"']+)["']/g;
      let importMatch: RegExpExecArray | null;
      while ((importMatch = importMatcher.exec(content)) !== null) {
        const resolved = path.normalize(path.join(path.dirname(fullPath), importMatch[1]));
        let rel = path.relative(this.projectRoot, resolved).replace(/\\/g, "/");
        if (!/\.(?:ts|mjs|js)$/.test(rel) && fs.existsSync(`${resolved}.ts`)) rel = `${rel}.ts`;
        if (rel.startsWith("src/") || rel.startsWith("api/")) this.queueCoverage(rel, testId);
      }
    }
  }

  private ingestSourceModules(): void {
    const srcDir = path.join(this.projectRoot, "src");
    if (!fs.existsSync(srcDir)) return;

    const scanDir = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
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
          for (const specId of new Set(content.match(/SPEC-\d+/g) || [])) {
            this.upsertEdge({ sourceId: relFile, targetId: specId, relation: "IMPLEMENTS" });
          }
        }
      }
    };
    scanDir(srcDir);
  }

  public computeBlastRadius(
    rootNodeId: string,
    options: { maxDepth?: number; direction?: "BOTH" | "OUT" | "IN" } = {},
  ): BlastRadiusResult {
    this.requireKnownNode(rootNodeId);
    const t0 = process.hrtime.bigint();
    const maxDepth = Math.max(1, Math.min(10, options.maxDepth || 4));
    const direction = options.direction || "BOTH";

    const reached = new Map<string, { depth: number; path: string }>([[rootNodeId, { depth: 0, path: rootNodeId }]]);
    const queue: Array<{ id: string; depth: number; path: string }> = [{ id: rootNodeId, depth: 0, path: rootNodeId }];
    let head = 0;

    const outStmt = this.db.prepare("SELECT target_id, relation FROM eos_kg_edges WHERE source_id = ?");
    const inStmt = this.db.prepare("SELECT source_id, relation FROM eos_kg_edges WHERE target_id = ?");

    while (head < queue.length) {
      const current = queue[head++];
      if (current.depth >= maxDepth) continue;

      if (direction === "OUT" || direction === "BOTH") {
        for (const edge of outStmt.all(current.id) as Array<{ target_id: string; relation: string }>) {
          if (reached.has(edge.target_id)) continue;
          const next = {
            id: edge.target_id,
            depth: current.depth + 1,
            path: `${current.path} -> ${edge.relation} -> ${edge.target_id}`,
          };
          reached.set(edge.target_id, { depth: next.depth, path: next.path });
          queue.push(next);
        }
      }
      if (direction === "IN" || direction === "BOTH") {
        for (const edge of inStmt.all(current.id) as Array<{ source_id: string; relation: string }>) {
          if (reached.has(edge.source_id)) continue;
          const next = {
            id: edge.source_id,
            depth: current.depth + 1,
            path: `${current.path} <- ${edge.relation} <- ${edge.source_id}`,
          };
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
      nodes.push({ ...this.mapNodeRow(row), depth: meta.depth, path: meta.path });
      nodeIds.add(id);
    }

    const edges: GraphEdge[] = [];
    if (nodeIds.size > 0) {
      const idsArray = Array.from(nodeIds);
      for (let i = 0; i < idsArray.length; i += 200) {
        const chunk = idsArray.slice(i, i + 200);
        const placeholders = chunk.map(() => "?").join(",");
        const edgeRows = this.db
          .prepare(`SELECT * FROM eos_kg_edges WHERE source_id IN (${placeholders})`)
          .all(...chunk) as any[];
        for (const er of edgeRows) {
          if (nodeIds.has(er.target_id)) edges.push(this.mapEdgeRow(er));
        }
      }
    }

    return {
      rootNodeId,
      maxDepth,
      direction,
      totalReachable: nodes.length,
      nodes,
      edges,
      durationMs: Number(process.hrtime.bigint() - t0) / 1_000_000,
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
    if (!nodeId || !this.getNode(nodeId)) throw new Error(`Unknown knowledge graph node: ${nodeId}`);
  }

  private projectMemoryIndex(): void {
    const cyclotron = new EosOntologyCyclotron();
    for (const row of this.db.prepare("SELECT id, type FROM eos_kg_nodes").all() as Array<{
      id: string;
      type: string;
    }>) {
      cyclotron.registerNode(row.id, row.type, {});
    }
    for (const row of this.db.prepare("SELECT source_id, target_id, relation FROM eos_kg_edges").all() as Array<{
      source_id: string;
      target_id: string;
      relation: string;
    }>) {
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
    if (!node) return { node: null, outgoing: [], incoming: [] };

    const mapJoined = (r: any, idKey: "target_id" | "source_id") =>
      this.mapNodeRow({
        id: r[idKey],
        type: r.n_type,
        title: r.n_title,
        file: r.n_file,
        metadata: r.n_metadata,
        sha256: r.n_sha256,
        updated_at: r.n_updated_at,
      });

    const outRows =
      direction === "BOTH" || direction === "OUT"
        ? (this.db
            .prepare(
              "SELECT e.*, n.type as n_type, n.title as n_title, n.file as n_file, n.metadata as n_metadata, n.sha256 as n_sha256, n.updated_at as n_updated_at FROM eos_kg_edges e JOIN eos_kg_nodes n ON e.target_id = n.id WHERE e.source_id = ?",
            )
            .all(nodeId) as any[])
        : [];
    const inRows =
      direction === "BOTH" || direction === "IN"
        ? (this.db
            .prepare(
              "SELECT e.*, n.type as n_type, n.title as n_title, n.file as n_file, n.metadata as n_metadata, n.sha256 as n_sha256, n.updated_at as n_updated_at FROM eos_kg_edges e JOIN eos_kg_nodes n ON e.source_id = n.id WHERE e.target_id = ?",
            )
            .all(nodeId) as any[])
        : [];

    return {
      node,
      outgoing: outRows.map((r) => ({ edge: this.mapEdgeRow(r), target: mapJoined(r, "target_id") })),
      incoming: inRows.map((r) => ({ edge: this.mapEdgeRow(r), source: mapJoined(r, "source_id") })),
    };
  }

  public findOrphans(): OrphanReport {
    const t0 = Date.now();
    const specsWithoutBdd = (
      this.db
        .prepare(
          "SELECT s.id FROM eos_kg_nodes s WHERE s.type = 'SPEC' AND s.id NOT IN (SELECT source_id FROM eos_kg_edges WHERE relation = 'HAS_SCENARIO')",
        )
        .all() as any[]
    ).map((r) => r.id);
    const bddsWithoutSpec = (
      this.db
        .prepare(
          "SELECT b.id FROM eos_kg_nodes b WHERE b.type = 'BDD' AND b.id NOT IN (SELECT target_id FROM eos_kg_edges WHERE relation = 'HAS_SCENARIO')",
        )
        .all() as any[]
    ).map((r) => r.id);
    const disconnectedNodes = (
      this.db
        .prepare(
          "SELECT id FROM eos_kg_nodes WHERE id NOT IN (SELECT source_id FROM eos_kg_edges) AND id NOT IN (SELECT target_id FROM eos_kg_edges)",
        )
        .all() as any[]
    ).map((r) => r.id);

    const totalSpecs = Number(
      (this.db.prepare("SELECT COUNT(*) as count FROM eos_kg_nodes WHERE type = 'SPEC'").get() as any)?.count || 0,
    );
    const coverageRatio = totalSpecs > 0 ? (totalSpecs - specsWithoutBdd.length) / totalSpecs : 1.0;

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
    const totalNodes = Number((this.db.prepare("SELECT COUNT(*) as c FROM eos_kg_nodes").get() as any)?.c || 0);
    const totalEdges = Number((this.db.prepare("SELECT COUNT(*) as c FROM eos_kg_edges").get() as any)?.c || 0);

    const nodesByType: Record<string, number> = {};
    for (const r of this.db.prepare("SELECT type, COUNT(*) as c FROM eos_kg_nodes GROUP BY type").all() as any[]) {
      nodesByType[r.type] = Number(r.c);
    }

    const edgesByRelation: Record<string, number> = {};
    for (const r of this.db
      .prepare("SELECT relation, COUNT(*) as c FROM eos_kg_edges GROUP BY relation")
      .all() as any[]) {
      edgesByRelation[r.relation] = Number(r.c);
    }

    const density = totalNodes > 1 ? totalEdges / (totalNodes * (totalNodes - 1)) : 0;
    const topHubs = (
      this.db
        .prepare(
          "SELECT n.id, n.type, ((SELECT COUNT(*) FROM eos_kg_edges WHERE source_id = n.id) + (SELECT COUNT(*) FROM eos_kg_edges WHERE target_id = n.id)) as degree FROM eos_kg_nodes n ORDER BY degree DESC LIMIT 10",
        )
        .all() as any[]
    ).map((r) => ({ id: r.id, type: r.type as NodeType, degree: Number(r.degree) }));

    const hasher = crypto.createHash("sha256");
    for (const n of this.db.prepare("SELECT id, sha256 FROM eos_kg_nodes ORDER BY id ASC").all() as any[]) {
      hasher.update(`${n.id}:${n.sha256};`);
    }
    for (const e of this.db
      .prepare("SELECT source_id, target_id, relation FROM eos_kg_edges ORDER BY source_id, target_id, relation ASC")
      .all() as any[]) {
      hasher.update(`${e.source_id}->${e.relation}->${e.target_id};`);
    }

    return {
      totalNodes,
      totalEdges,
      nodesByType,
      edgesByRelation,
      density,
      graphSha256: hasher.digest("hex"),
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
