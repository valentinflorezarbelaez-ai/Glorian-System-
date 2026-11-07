/**
 * EOS SYSTEM — NEURAL VECTOR CORE (Layer 0)
 * Governed by ADR-014, FR-021 & BDD-016
 *
 * Implements deterministic high-dimensional semantic tokenization,
 * term-frequency sparse embeddings, and sub-millisecond cosine similarity
 * vector retrieval across sovereign system knowledge nodes.
 *
 * Zero external runtime dependencies.
 */

export interface VectorDocument<T = Record<string, unknown>> {
  readonly id: string;
  readonly text: string;
  readonly vector: Map<string, number>;
  readonly metadata?: T;
}

export interface VectorSearchResult<T = Record<string, unknown>> {
  readonly id: string;
  readonly score: number;
  readonly text: string;
  readonly metadata?: T;
}

const STOPWORDS = new Set([
  "a",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "de",
  "del",
  "en",
  "para",
  "por",
  "con",
  "sin",
  "sobre",
  "y",
  "o",
  "u",
  "e",
  "que",
  "es",
  "son",
  "fue",
  "era",
  "se",
  "su",
  "sus",
  "al",
  "lo",
  "como",
  "the",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "and",
  "or",
  "an",
  "is",
  "of",
]);

/**
 * Tokenizes natural language text into clean, normalized word stems/tokens.
 */
export function tokenize(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents for invariant matching
    .replace(/[^a-z0-9_\-\s]/g, " ")
    .split(/\s+/)
    .filter((tok) => tok.length > 1 && !STOPWORDS.has(tok));
}

/**
 * Computes L2-normalized term frequency vector for a token stream.
 */
export function computeTermFrequency(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  if (tokens.length === 0) return map;

  for (const token of tokens) {
    map.set(token, (map.get(token) || 0) + 1);
  }

  // Calculate L2 norm for unit sphere projection
  let sumSq = 0;
  for (const count of map.values()) {
    sumSq += count * count;
  }
  const norm = Math.sqrt(sumSq) || 1;

  for (const [key, count] of map.entries()) {
    map.set(key, count / norm);
  }

  return map;
}

/**
 * Calculates deterministic cosine similarity between two normalized vectors.
 * Returns a value in [0.0, 1.0].
 */
export function cosineSimilarity(v1: Map<string, number>, v2: Map<string, number>): number {
  if (v1.size === 0 || v2.size === 0) return 0;

  // Iterate over smaller vector for sub-microsecond O(min(|v1|, |v2|)) performance
  const [smaller, larger] = v1.size <= v2.size ? [v1, v2] : [v2, v1];
  let dotProduct = 0;

  for (const [term, weight] of smaller.entries()) {
    const w2 = larger.get(term);
    if (w2 !== undefined) {
      dotProduct += weight * w2;
    }
  }

  return Math.max(0, Math.min(1, dotProduct));
}

/**
 * In-Memory Deterministic Layer-0 Vector Store
 */
export class EosNeuralVectorStore<T = Record<string, unknown>> {
  private readonly documents: Map<string, VectorDocument<T>> = new Map();

  /**
   * Adds or updates a document in the vector index.
   */
  public addDocument(id: string, text: string, metadata?: T): void {
    const tokens = tokenize(text);
    const vector = computeTermFrequency(tokens);
    this.documents.set(id, { id, text, vector, metadata });
  }

  /**
   * Searches the store for the top-K most semantically similar documents.
   */
  public search(query: string, topK: number = 3): Array<VectorSearchResult<T>> {
    const queryTokens = tokenize(query);
    const queryVector = computeTermFrequency(queryTokens);
    if (queryVector.size === 0) return [];

    const results: Array<VectorSearchResult<T>> = [];

    for (const doc of this.documents.values()) {
      const score = cosineSimilarity(queryVector, doc.vector);
      if (score > 0) {
        results.push({
          id: doc.id,
          score,
          text: doc.text,
          metadata: doc.metadata,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, Math.max(1, topK));
  }

  /**
   * Hybrid RAG Retrieval using Reciprocal Rank Fusion (RRF).
   * Combines dense vector cosine similarity with sparse lexical exact-match ranking.
   */
  public searchHybrid(query: string, topK: number = 3, kRrf: number = 60): Array<VectorSearchResult<T>> {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];
    const queryVector = computeTermFrequency(queryTokens);

    // 1. Vector Cosine Ranking
    const vectorScored: Array<{ id: string; score: number }> = [];
    for (const doc of this.documents.values()) {
      const score = cosineSimilarity(queryVector, doc.vector);
      if (score > 0) {
        vectorScored.push({ id: doc.id, score });
      }
    }
    vectorScored.sort((a, b) => b.score - a.score);

    // 2. Lexical Exact-Token Ranking
    const lexicalScored: Array<{ id: string; score: number }> = [];
    const lowerQuery = query.toLowerCase();
    for (const doc of this.documents.values()) {
      let matchCount = 0;
      const lowerDoc = doc.text.toLowerCase();
      for (const tok of queryTokens) {
        if (lowerDoc.includes(tok)) matchCount++;
      }
      if (lowerDoc.includes(lowerQuery)) matchCount += 3; // Boost exact phrase
      if (matchCount > 0) {
        lexicalScored.push({ id: doc.id, score: matchCount });
      }
    }
    lexicalScored.sort((a, b) => b.score - a.score);

    // 3. Reciprocal Rank Fusion (RRF)
    const rrfScores = new Map<string, number>();

    vectorScored.forEach((item, rank) => {
      const prev = rrfScores.get(item.id) || 0;
      rrfScores.set(item.id, prev + 1 / (kRrf + rank + 1));
    });

    lexicalScored.forEach((item, rank) => {
      const prev = rrfScores.get(item.id) || 0;
      rrfScores.set(item.id, prev + 1 / (kRrf + rank + 1));
    });

    const results: Array<VectorSearchResult<T>> = [];
    for (const [id, rrfScore] of rrfScores.entries()) {
      const doc = this.documents.get(id);
      if (doc) {
        results.push({
          id: doc.id,
          score: Number(rrfScore.toFixed(6)),
          text: doc.text,
          metadata: doc.metadata,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, Math.max(1, topK));
  }

  public size(): number {
    return this.documents.size;
  }

  public clear(): void {
    this.documents.clear();
  }

  public getDocument(id: string): VectorDocument<T> | undefined {
    return this.documents.get(id);
  }
}

/**
 * Singleton instance pre-indexed with core EOS architectural knowledge.
 */
export function createDefaultEosKnowledgeStore(): EosNeuralVectorStore<{ domain: string }> {
  const store = new EosNeuralVectorStore<{ domain: string }>();

  store.addDocument(
    "DOC-FLEET-AUDIT",
    "Auditoría integral de la flota soberana, verificación de repositorios git, escáner de secretos y validación de producción",
    { domain: "Operations & Fleet" },
  );

  store.addDocument(
    "DOC-FLEET-DEPLOY",
    "Despliegue y publicación continua de la flota a producción en Vercel y GitHub con verificación previa",
    { domain: "CI/CD & Release" },
  );

  store.addDocument(
    "DOC-SECURITY-SAST",
    "Aduanas de seguridad SAST, OWASP Top 10, prevención de fuga de credenciales y firmas criptográficas Merkle SHA-256",
    { domain: "SecDevOps" },
  );

  store.addDocument(
    "DOC-LINUX-KERNEL",
    "Núcleo monolítico modular de Linux Ring-0, sistema virtual de archivos VFS, llamadas al sistema y Read-Copy-Update RCU",
    { domain: "Operating System" },
  );

  store.addDocument(
    "DOC-NANOSECOND-ENGINE",
    "Motor de computación de alta frecuencia en nanosegundos L1 Cache Struct-of-Arrays y traducción universal",
    { domain: "High Performance Computing" },
  );

  store.addDocument(
    "DOC-AKASHIC-MEMORY",
    "Memoria Akáshica permanente, grafo de conocimiento determinista y persistencia ontológica soberana",
    { domain: "Knowledge Management" },
  );

  return store;
}
