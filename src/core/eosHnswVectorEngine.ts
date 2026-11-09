/**
 * EosHnswVectorEngine (Layer 0 — Pure Domain & Algorithms)
 * SPEC-038: Palantir HNSW Vector Reasoning & Aladdin Risk Ledger Engine
 *
 * Implements Hierarchical Navigable Small World (HNSW) graph indexing,
 * sub-millisecond k-NN semantic search, deterministic token embedding projection,
 * and vector similarity operations.
 *
 * Inspired by Palantir Gotham/Foundry Semantic Layer and Apple Spotlight.
 * ZERO external dependencies — 100% pure TypeScript.
 */

export type DistanceMetric = "cosine" | "euclidean";

export interface HnswNode {
  readonly id: string;
  readonly vector: Float32Array;
  readonly level: number;
  readonly neighbors: number[][]; // neighbors[layer] = array of node indices
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface HnswSearchResult {
  readonly id: string;
  readonly distance: number;
  readonly similarity: number; // 1 / (1 + distance) or cosine similarity
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface HnswConfig {
  readonly dimensions?: number | undefined;
  readonly m?: number | undefined; // Max connections per node per layer (default 16)
  readonly efConstruction?: number | undefined; // Candidate list size during index build (default 64)
  readonly efSearch?: number | undefined; // Candidate list size during search (default 32)
  readonly metric?: DistanceMetric | undefined;
  readonly seed?: number | undefined;
}

export interface HnswIndexStats {
  readonly totalNodes: number;
  readonly dimensions: number;
  readonly maxLevel: number;
  readonly metric: DistanceMetric;
  readonly m: number;
  readonly efConstruction: number;
  readonly efSearch: number;
}

export class EosHnswVectorEngine {
  private readonly dimensions: number;
  private readonly m: number;
  private readonly m0: number; // Max connections on layer 0 (typically 2 * M)
  private readonly efConstruction: number;
  private readonly efSearch: number;
  private readonly metric: DistanceMetric;
  private readonly mL: number; // 1 / ln(M)

  private nodes: HnswNode[] = [];
  private idToIndex: Map<string, number> = new Map();
  private entryPointIndex: number = -1;
  private maxLevel: number = -1;
  private prng: () => number;

  constructor(config: HnswConfig = {}) {
    this.dimensions = config.dimensions ?? 128;
    this.m = Math.max(4, config.m ?? 16);
    this.m0 = 2 * this.m;
    this.efConstruction = Math.max(this.m, config.efConstruction ?? 64);
    this.efSearch = Math.max(1, config.efSearch ?? 32);
    this.metric = config.metric ?? "cosine";
    this.mL = 1.0 / Math.log(this.m);

    let seed = config.seed ?? 1337;
    this.prng = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Pure Layer-0 Distance Metrics
   */
  public computeDistance(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} !== ${b.length}`);
    }

    if (this.metric === "euclidean") {
      let sumSq = 0;
      for (let i = 0; i < a.length; i++) {
        const diff = a[i]! - b[i]!;
        sumSq += diff * diff;
      }
      return Math.sqrt(sumSq);
    }

    // Default: Cosine distance = 1 - cosine_similarity
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      const va = a[i]!;
      const vb = b[i]!;
      dot += va * vb;
      normA += va * va;
      normB += vb * vb;
    }

    if (normA <= 0 || normB <= 0) return 1.0;
    const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.max(0, 1.0 - similarity);
  }

  /**
   * Deterministic positional n-gram text projection to unit vector.
   * Produces reproducible offline embeddings without remote API dependencies.
   */
  public static projectTextToVector(text: string, dimensions = 128): Float32Array {
    const vector = new Float32Array(dimensions);
    if (!text || text.length === 0) return vector;

    const normalized = text.toLowerCase().trim();
    const len = normalized.length;

    // Character 1-gram, 2-gram, 3-gram feature projection
    for (let i = 0; i < len; i++) {
      // 1-gram
      const c1 = normalized.charCodeAt(i);
      const idx1 = (c1 * 31 + i) % dimensions;
      vector[idx1] = (vector[idx1] ?? 0) + 1.0;

      // 2-gram
      if (i + 1 < len) {
        const c2 = normalized.charCodeAt(i + 1);
        const hash2 = (c1 * 31 + c2 * 17 + i) >>> 0;
        const idx2 = hash2 % dimensions;
        vector[idx2] = (vector[idx2] ?? 0) + 1.5;
      }

      // 3-gram
      if (i + 2 < len) {
        const c2 = normalized.charCodeAt(i + 1);
        const c3 = normalized.charCodeAt(i + 2);
        const hash3 = (c1 * 961 + c2 * 31 + c3 + i) >>> 0;
        const idx3 = hash3 % dimensions;
        vector[idx3] = (vector[idx3] ?? 0) + 2.0;
      }
    }

    // L2 Normalization to unit hypersphere
    let normSq = 0;
    for (let i = 0; i < dimensions; i++) {
      normSq += vector[i]! * vector[i]!;
    }

    if (normSq > 0) {
      const invNorm = 1.0 / Math.sqrt(normSq);
      for (let i = 0; i < dimensions; i++) {
        vector[i] = vector[i]! * invNorm;
      }
    }

    return vector;
  }

  private assignRandomLevel(): number {
    const r = Math.max(1e-9, this.prng());
    return Math.floor(-Math.log(r) * this.mL);
  }

  /**
   * Adds a high-dimensional vector point to the HNSW graph.
   */
  public addPoint(id: string, rawVector: Float32Array | number[], metadata?: Record<string, unknown>): void {
    if (this.idToIndex.has(id)) {
      throw new Error(`Node with id "${id}" already exists in index.`);
    }

    const vector = rawVector instanceof Float32Array ? rawVector : new Float32Array(rawVector);
    if (vector.length !== this.dimensions) {
      throw new Error(`Vector dimension ${vector.length} must match index dimension ${this.dimensions}`);
    }

    const nodeLevel = this.assignRandomLevel();
    const nodeIndex = this.nodes.length;
    const neighbors: number[][] = [];
    for (let l = 0; l <= nodeLevel; l++) {
      neighbors.push([]);
    }

    const newNode: HnswNode = {
      id,
      vector,
      level: nodeLevel,
      neighbors,
      metadata,
    };

    this.nodes.push(newNode);
    this.idToIndex.set(id, nodeIndex);

    // First node inserted becomes entry point
    if (this.entryPointIndex === -1) {
      this.entryPointIndex = nodeIndex;
      this.maxLevel = nodeLevel;
      return;
    }

    let currObj = this.entryPointIndex;
    let currDist = this.computeDistance(vector, this.nodes[currObj]!.vector);

    // Phase 1: Greedy traversal from top level down to nodeLevel + 1
    for (let level = this.maxLevel; level > nodeLevel; level--) {
      let changed = true;
      while (changed) {
        changed = false;
        const currentNeighbors = this.nodes[currObj]!.neighbors[level] ?? [];
        for (const neighborIdx of currentNeighbors) {
          const neighborNode = this.nodes[neighborIdx]!;
          const d = this.computeDistance(vector, neighborNode.vector);
          if (d < currDist) {
            currDist = d;
            currObj = neighborIdx;
            changed = true;
          }
        }
      }
    }

    // Phase 2: From min(nodeLevel, maxLevel) down to 0, search and connect neighbors
    const topSearchLevel = Math.min(nodeLevel, this.maxLevel);
    for (let level = topSearchLevel; level >= 0; level--) {
      const candidates = this.searchLayer(vector, currObj, this.efConstruction, level);
      const maxM = level === 0 ? this.m0 : this.m;

      // Select M closest neighbors
      const selected = candidates.slice(0, maxM);
      for (const item of selected) {
        // Bi-directional edge
        newNode.neighbors[level]!.push(item.index);
        const neighborNode = this.nodes[item.index]!;
        if (!neighborNode.neighbors[level]) {
          neighborNode.neighbors[level] = [];
        }
        neighborNode.neighbors[level]!.push(nodeIndex);

        // Shrink neighbor connections if capacity exceeded
        if (neighborNode.neighbors[level]!.length > maxM) {
          this.pruneConnections(neighborNode, level, maxM);
        }
      }

      if (candidates.length > 0 && candidates[0] !== undefined) {
        currObj = candidates[0].index;
      }
    }

    if (nodeLevel > this.maxLevel) {
      this.maxLevel = nodeLevel;
      this.entryPointIndex = nodeIndex;
    }
  }

  /**
   * Helper to index documents by raw text with automatic projection.
   */
  public addDocument(id: string, text: string, metadata?: Record<string, unknown>): void {
    const vec = EosHnswVectorEngine.projectTextToVector(text, this.dimensions);
    this.addPoint(id, vec, { text, ...metadata });
  }

  /**
   * Search layer using bounded candidate exploration.
   */
  private searchLayer(
    queryVector: Float32Array,
    entryPoint: number,
    ef: number,
    level: number,
  ): { index: number; distance: number }[] {
    const visited = new Set<number>();
    visited.add(entryPoint);

    const epDist = this.computeDistance(queryVector, this.nodes[entryPoint]!.vector);
    const candidates: { index: number; distance: number }[] = [{ index: entryPoint, distance: epDist }];
    const results: { index: number; distance: number }[] = [{ index: entryPoint, distance: epDist }];

    while (candidates.length > 0) {
      candidates.sort((a, b) => a.distance - b.distance);
      const curr = candidates.shift()!;

      const furthestResult = results[results.length - 1]!;
      if (curr.distance > furthestResult.distance && results.length >= ef) {
        break;
      }

      const neighbors = this.nodes[curr.index]!.neighbors[level] ?? [];
      for (const neighborIdx of neighbors) {
        if (!visited.has(neighborIdx)) {
          visited.add(neighborIdx);
          const neighborNode = this.nodes[neighborIdx]!;
          const d = this.computeDistance(queryVector, neighborNode.vector);

          const worstCurrent = results[results.length - 1]!;
          if (d < worstCurrent.distance || results.length < ef) {
            candidates.push({ index: neighborIdx, distance: d });
            results.push({ index: neighborIdx, distance: d });
            results.sort((a, b) => a.distance - b.distance);
            if (results.length > ef) {
              results.pop();
            }
          }
        }
      }
    }

    return results;
  }

  private pruneConnections(node: HnswNode, level: number, maxM: number): void {
    const conn = node.neighbors[level] ?? [];
    if (conn.length <= maxM) return;

    const scored = conn.map((idx) => ({
      index: idx,
      distance: this.computeDistance(node.vector, this.nodes[idx]!.vector),
    }));
    scored.sort((a, b) => a.distance - b.distance);
    node.neighbors[level] = scored.slice(0, maxM).map((s) => s.index);
  }

  /**
   * Approximate k-Nearest Neighbor (k-NN) search.
   */
  public searchKnn(rawQuery: Float32Array | number[], k: number = 10, efSearch?: number): HnswSearchResult[] {
    if (this.nodes.length === 0 || this.entryPointIndex === -1) {
      return [];
    }

    const query = rawQuery instanceof Float32Array ? rawQuery : new Float32Array(rawQuery);
    if (query.length !== this.dimensions) {
      throw new Error(`Query vector dimension ${query.length} must match ${this.dimensions}`);
    }

    const ef = Math.max(k, efSearch ?? this.efSearch);
    let currObj = this.entryPointIndex;
    let currDist = this.computeDistance(query, this.nodes[currObj]!.vector);

    // Traverse from top level down to level 1 greedy
    for (let level = this.maxLevel; level > 0; level--) {
      let changed = true;
      while (changed) {
        changed = false;
        const currentNeighbors = this.nodes[currObj]!.neighbors[level] ?? [];
        for (const neighborIdx of currentNeighbors) {
          const neighborNode = this.nodes[neighborIdx]!;
          const d = this.computeDistance(query, neighborNode.vector);
          if (d < currDist) {
            currDist = d;
            currObj = neighborIdx;
            changed = true;
          }
        }
      }
    }

    // Bottom layer search with efSearch
    const candidates = this.searchLayer(query, currObj, ef, 0);
    candidates.sort((a, b) => a.distance - b.distance);

    const topK = candidates.slice(0, k);
    return topK.map((c) => {
      const node = this.nodes[c.index]!;
      const similarity = this.metric === "cosine" ? Math.max(0, 1.0 - c.distance) : 1.0 / (1.0 + c.distance);

      return {
        id: node.id,
        distance: Math.round(c.distance * 10000) / 10000,
        similarity: Math.round(similarity * 10000) / 10000,
        metadata: node.metadata,
      };
    });
  }

  /**
   * Approximate k-NN search querying by text string.
   */
  public searchByText(queryText: string, k: number = 10, efSearch?: number): HnswSearchResult[] {
    const queryVector = EosHnswVectorEngine.projectTextToVector(queryText, this.dimensions);
    return this.searchKnn(queryVector, k, efSearch);
  }

  public getStats(): HnswIndexStats {
    return {
      totalNodes: this.nodes.length,
      dimensions: this.dimensions,
      maxLevel: this.maxLevel,
      metric: this.metric,
      m: this.m,
      efConstruction: this.efConstruction,
      efSearch: this.efSearch,
    };
  }

  public clear(): void {
    this.nodes = [];
    this.idToIndex.clear();
    this.entryPointIndex = -1;
    this.maxLevel = -1;
  }
}
