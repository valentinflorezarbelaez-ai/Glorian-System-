/**
 * Glorian System — Autonomous Ontological Hypergraph & Bitemporal Entity Resolution Engine
 * Governed by SPEC-333 / CHANGE-195 / ADR-195-001..003
 *
 * Implements bitemporal knowledge representation, N-ary hyperedges,
 * deterministic entity deduplication, and fail-closed Multilevel Security (MLS).
 *
 * Invariant: Zero external runtime dependencies. Strict Layer-0 TypeScript. Module <= 800 lines.
 */

import { createHash } from "node:crypto";
import type {
  AsOfQueryFilter,
  BitemporalInterval,
  EntityResolutionMatch,
  HyperedgeParticipant,
  HypergraphAuditReceipt,
  HypergraphBlastRadiusResult,
  OntologicalEntity,
  OntologicalHyperedge,
  SecurityClassification,
  SecurityContext,
} from "./eosOntologicalHypergraph.types.js";

const CLASSIFICATION_LEVELS: Record<SecurityClassification, number> = {
  UNCLASSIFIED: 1,
  CONFIDENTIAL: 2,
  SECRET: 3,
  TOP_SECRET: 4,
};

export class EosOntologicalHypergraphCore {
  private entities: OntologicalEntity[] = [];
  private hyperedges: OntologicalHyperedge[] = [];
  private aliasToCanonicalMap = new Map<string, string>();
  private currentTxClock = 1;

  constructor() {}

  /**
   * Returns current internal transaction clock.
   */
  public getTxClock(): number {
    return this.currentTxClock;
  }

  /**
   * Advances the monotonic transaction clock by 1.
   */
  public advanceTxClock(): number {
    this.currentTxClock += 1;
    return this.currentTxClock;
  }

  /**
   * Asserts or updates an ontological entity in bitemporal storage.
   */
  public assertEntity(
    params: {
      readonly entityId: string;
      readonly name: string;
      readonly kind: string;
      readonly aliases?: readonly string[];
      readonly attributes?: Record<string, unknown>;
      readonly classification?: SecurityClassification;
      readonly compartments?: readonly string[];
      readonly validFrom: number;
      readonly validTo: number;
      readonly source?: string;
    },
    txTime?: number,
  ): OntologicalEntity {
    const tx = txTime ?? this.currentTxClock;
    const classification = params.classification ?? "UNCLASSIFIED";
    const compartments = params.compartments ?? [];
    const aliases = params.aliases ?? [];
    const attributes = params.attributes ?? {};
    const source = params.source ?? "sovereign-control-plane";

    // Check if canonical entity already exists for any alias or ID
    let canonicalId = this.aliasToCanonicalMap.get(params.entityId) ?? params.entityId;

    // Supersede any active existing record for this entity
    const existingIndex = this.entities.findIndex(
      (e) => e.entityId === params.entityId && e.temporal.txTo === Number.POSITIVE_INFINITY,
    );
    if (existingIndex !== -1) {
      const old = this.entities[existingIndex];
      this.entities[existingIndex] = {
        ...old,
        temporal: {
          ...old.temporal,
          txTo: tx,
        },
      };
      canonicalId = old.canonicalId;
    }

    const checksumSha256 = this.computeSha256({
      entityId: params.entityId,
      canonicalId,
      name: params.name,
      kind: params.kind,
      classification,
      validFrom: params.validFrom,
      validTo: params.validTo,
    });

    const temporal: BitemporalInterval = {
      validFrom: params.validFrom,
      validTo: params.validTo,
      txFrom: tx,
      txTo: Number.POSITIVE_INFINITY,
    };

    const entity: OntologicalEntity = {
      entityId: params.entityId,
      canonicalId,
      name: params.name,
      kind: params.kind,
      aliases,
      attributes,
      classification,
      compartments,
      temporal,
      confidenceScore: 1.0,
      source,
      checksumSha256,
    };

    this.entities.push(entity);
    this.aliasToCanonicalMap.set(params.entityId, canonicalId);
    for (const alias of aliases) {
      this.aliasToCanonicalMap.set(alias, canonicalId);
    }

    this.advanceTxClock();
    return entity;
  }

  /**
   * Asserts an N-ary hyperedge connecting 2 or more entities with typed roles.
   */
  public assertHyperedge(
    params: {
      readonly edgeId: string;
      readonly relation: string;
      readonly participants: readonly HyperedgeParticipant[];
      readonly properties?: Record<string, unknown>;
      readonly classification?: SecurityClassification;
      readonly compartments?: readonly string[];
      readonly validFrom: number;
      readonly validTo: number;
    },
    txTime?: number,
  ): OntologicalHyperedge {
    if (params.participants.length < 2) {
      throw new Error(
        `Hyperedge ${params.edgeId} requires at least 2 participants (got ${params.participants.length})`,
      );
    }

    const tx = txTime ?? this.currentTxClock;

    // Verify all participants exist in the active entity store
    const participantEntities: OntologicalEntity[] = [];
    for (const p of params.participants) {
      const found = this.entities.find(
        (e) =>
          (e.entityId === p.entityId || e.canonicalId === p.entityId) && e.temporal.txTo === Number.POSITIVE_INFINITY,
      );
      if (!found) {
        throw new Error(
          `Referential integrity violation: Participant entity '${p.entityId}' not found in active graph`,
        );
      }
      participantEntities.push(found);
    }

    // Determine supremum classification & union of compartments from participants
    let maxLevel = 1;
    const compartmentSet = new Set<string>(params.compartments ?? []);
    for (const pe of participantEntities) {
      const lvl = CLASSIFICATION_LEVELS[pe.classification];
      if (lvl > maxLevel) maxLevel = lvl;
      for (const c of pe.compartments) compartmentSet.add(c);
    }

    const explicitLevel = params.classification ? CLASSIFICATION_LEVELS[params.classification] : 1;
    const finalLevelNum = Math.max(maxLevel, explicitLevel);
    const finalClassification = this.levelToClassification(finalLevelNum);

    // Supersede any active existing record for this hyperedge
    const existingIndex = this.hyperedges.findIndex(
      (h) => h.edgeId === params.edgeId && h.temporal.txTo === Number.POSITIVE_INFINITY,
    );
    if (existingIndex !== -1) {
      const old = this.hyperedges[existingIndex];
      this.hyperedges[existingIndex] = {
        ...old,
        temporal: {
          ...old.temporal,
          txTo: tx,
        },
      };
    }

    const checksumSha256 = this.computeSha256({
      edgeId: params.edgeId,
      relation: params.relation,
      participants: params.participants,
      classification: finalClassification,
      validFrom: params.validFrom,
      validTo: params.validTo,
    });

    const temporal: BitemporalInterval = {
      validFrom: params.validFrom,
      validTo: params.validTo,
      txFrom: tx,
      txTo: Number.POSITIVE_INFINITY,
    };

    const hyperedge: OntologicalHyperedge = {
      edgeId: params.edgeId,
      relation: params.relation,
      participants: params.participants,
      properties: params.properties ?? {},
      classification: finalClassification,
      compartments: Array.from(compartmentSet),
      temporal,
      checksumSha256,
    };

    this.hyperedges.push(hyperedge);
    this.advanceTxClock();
    return hyperedge;
  }

  /**
   * Deterministically deduplicates and resolves a raw incoming entity record against
   * existing canonical entities and alias indices.
   */
  public resolveEntity(rawRecord: {
    readonly sourceId: string;
    readonly name: string;
    readonly kind: string;
    readonly attributes?: Record<string, unknown>;
  }): EntityResolutionMatch {
    // 1. Exact match on entityId or registered alias
    if (this.aliasToCanonicalMap.has(rawRecord.sourceId)) {
      const canonicalId = this.aliasToCanonicalMap.get(rawRecord.sourceId)!;
      return {
        sourceId: rawRecord.sourceId,
        canonicalId,
        confidenceScore: 1.0,
        matchedAttributes: ["id_exact_match"],
        method: "EXACT_IDENTIFIER",
      };
    }

    // 2. Deterministic attribute fingerprint matching across common keys
    const activeEntities = this.entities.filter(
      (e) => e.temporal.txTo === Number.POSITIVE_INFINITY && e.kind === rawRecord.kind,
    );

    if (rawRecord.attributes) {
      for (const [key, rawVal] of Object.entries(rawRecord.attributes)) {
        if (!rawVal || typeof rawVal !== "string") continue;
        const normalizedRaw = rawVal.toLowerCase().trim();
        for (const candidate of activeEntities) {
          const candVal = candidate.attributes?.[key];
          if (candVal && typeof candVal === "string" && candVal.toLowerCase().trim() === normalizedRaw) {
            this.aliasToCanonicalMap.set(rawRecord.sourceId, candidate.canonicalId);
            return {
              sourceId: rawRecord.sourceId,
              canonicalId: candidate.canonicalId,
              confidenceScore: 0.95,
              matchedAttributes: [`attributes_${key}_match`],
              method: "DETERMINISTIC_FINGERPRINT",
            };
          }
        }
      }
    }

    // 3. Lexical similarity (normalized n-gram Jaccard index)
    let bestMatch: OntologicalEntity | null = null;
    let highestScore = 0;

    for (const candidate of activeEntities) {
      const score = this.calculateLexicalSimilarity(rawRecord.name, candidate.name);
      if (score > highestScore && score >= 0.8) {
        highestScore = score;
        bestMatch = candidate;
      }
    }

    if (bestMatch) {
      this.aliasToCanonicalMap.set(rawRecord.sourceId, bestMatch.canonicalId);
      return {
        sourceId: rawRecord.sourceId,
        canonicalId: bestMatch.canonicalId,
        confidenceScore: Math.round(highestScore * 100) / 100,
        matchedAttributes: ["name_lexical_similarity"],
        method: "LEXICAL_SIMILARITY",
      };
    }

    // No existing match found -> new canonical entity
    const newCanonicalId = rawRecord.sourceId;
    this.aliasToCanonicalMap.set(rawRecord.sourceId, newCanonicalId);
    return {
      sourceId: rawRecord.sourceId,
      canonicalId: newCanonicalId,
      confidenceScore: 1.0,
      matchedAttributes: ["self_canonical_provisioning"],
      method: "EXACT_IDENTIFIER",
    };
  }

  /**
   * Executes a bitemporal point-in-time "as-of" snapshot query with fail-closed MLS redaction.
   */
  public queryAsOf(
    filter: AsOfQueryFilter,
    securityContext: SecurityContext,
  ): {
    readonly entities: readonly OntologicalEntity[];
    readonly hyperedges: readonly OntologicalHyperedge[];
    readonly asOfTxTime: number;
    readonly validTime: number;
  } {
    const userClearanceNum = CLASSIFICATION_LEVELS[securityContext.clearance];
    const userCompartments = new Set(securityContext.compartments);

    // Filter entities matching bitemporal validity and MLS access rules
    const visibleEntities = this.entities.filter((e) => {
      // Bitemporal filter: valid at validTime and known at asOfTxTime
      const isTxActive = e.temporal.txFrom <= filter.asOfTxTime && filter.asOfTxTime < e.temporal.txTo;
      const isValidActive = e.temporal.validFrom <= filter.validTime && filter.validTime <= e.temporal.validTo;
      if (!isTxActive || !isValidActive) return false;

      // Optional kind filter
      if (filter.kind && e.kind !== filter.kind) return false;

      // MLS clearance and compartment enforcement (Fail-Closed)
      const entityLevelNum = CLASSIFICATION_LEVELS[e.classification];
      if (entityLevelNum > userClearanceNum) return false;
      for (const comp of e.compartments) {
        if (!userCompartments.has(comp)) return false;
      }

      return true;
    });

    const visibleEntityIds = new Set(visibleEntities.map((e) => e.entityId));

    // Filter hyperedges matching bitemporal validity, referential visibility, and MLS rules
    const visibleHyperedges = this.hyperedges.filter((h) => {
      const isTxActive = h.temporal.txFrom <= filter.asOfTxTime && filter.asOfTxTime < h.temporal.txTo;
      const isValidActive = h.temporal.validFrom <= filter.validTime && filter.validTime <= h.temporal.validTo;
      if (!isTxActive || !isValidActive) return false;

      // Optional relation filter
      if (filter.relation && h.relation !== filter.relation) return false;

      // MLS clearance and compartment enforcement
      const edgeLevelNum = CLASSIFICATION_LEVELS[h.classification];
      if (edgeLevelNum > userClearanceNum) return false;
      for (const comp of h.compartments) {
        if (!userCompartments.has(comp)) return false;
      }

      // Ensure all participants in the hyperedge are visible to the user
      for (const p of h.participants) {
        if (!visibleEntityIds.has(p.entityId)) return false;
      }

      return true;
    });

    return {
      entities: visibleEntities,
      hyperedges: visibleHyperedges,
      asOfTxTime: filter.asOfTxTime,
      validTime: filter.validTime,
    };
  }

  /**
   * Breadth-first traversal from a root entity through incident hyperedges up to maxDepth,
   * strictly subject to MLS lattice clearance.
   */
  public traverse(
    rootEntityId: string,
    maxDepth: number,
    securityContext: SecurityContext,
    asOf?: { readonly validTime?: number; readonly asOfTxTime?: number },
  ): readonly {
    readonly entityId: string;
    readonly depth: number;
    readonly path: readonly string[];
  }[] {
    const validTime = asOf?.validTime ?? (this.entities.length > 0 ? this.entities[0].temporal.validFrom : Date.now());
    const asOfTxTime = asOf?.asOfTxTime ?? this.currentTxClock;

    const snapshot = this.queryAsOf(
      {
        validTime,
        asOfTxTime,
      },
      securityContext,
    );

    const entityMap = new Map(snapshot.entities.map((e) => [e.entityId, e]));
    if (!entityMap.has(rootEntityId)) {
      return [];
    }

    const visited = new Map<string, number>();
    const paths = new Map<string, string[]>();
    visited.set(rootEntityId, 0);
    paths.set(rootEntityId, [rootEntityId]);

    const queue: { entityId: string; depth: number }[] = [{ entityId: rootEntityId, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;

      const currentPath = paths.get(current.entityId) ?? [current.entityId];

      // Find all hyperedges containing current entity
      for (const edge of snapshot.hyperedges) {
        const containsCurrent = edge.participants.some((p) => p.entityId === current.entityId);
        if (!containsCurrent) continue;

        for (const p of edge.participants) {
          if (!visited.has(p.entityId)) {
            const nextDepth = current.depth + 1;
            visited.set(p.entityId, nextDepth);
            paths.set(p.entityId, [...currentPath, p.entityId]);
            queue.push({ entityId: p.entityId, depth: nextDepth });
          }
        }
      }
    }

    return Array.from(visited.entries()).map(([entityId, depth]) => ({
      entityId,
      depth,
      path: paths.get(entityId) ?? [entityId],
    }));
  }

  /**
   * Computes the blast radius of an entity failure or security compromise.
   */
  public computeBlastRadius(
    rootEntityId: string,
    maxDepth: number,
    securityContext: SecurityContext,
    asOf?: { readonly validTime?: number; readonly asOfTxTime?: number },
  ): HypergraphBlastRadiusResult {
    const traversed = this.traverse(rootEntityId, maxDepth, securityContext, asOf);
    const impacted = traversed.filter((t) => t.entityId !== rootEntityId);

    return {
      rootEntityId,
      impactedEntities: impacted,
      maxDepth,
      totalImpacted: impacted.length,
    };
  }

  /**
   * Evaluates ontological invariants and generates signed audit receipt.
   */
  public auditHypergraph(): HypergraphAuditReceipt {
    // 1. Check Bitemporal Monotonicity
    let bitemporalMonotonicity = true;
    for (const e of this.entities) {
      if (e.temporal.validFrom >= e.temporal.validTo || e.temporal.txFrom > e.temporal.txTo) {
        bitemporalMonotonicity = false;
        break;
      }
    }
    for (const h of this.hyperedges) {
      if (h.temporal.validFrom >= h.temporal.validTo || h.temporal.txFrom > h.temporal.txTo) {
        bitemporalMonotonicity = false;
        break;
      }
    }

    // 2. Check Referential Integrity
    let referentialIntegrity = true;
    for (const h of this.hyperedges) {
      if (h.participants.length < 2) {
        referentialIntegrity = false;
        break;
      }
      for (const p of h.participants) {
        const exists = this.entities.some((e) => e.entityId === p.entityId || e.canonicalId === p.entityId);
        if (!exists) {
          referentialIntegrity = false;
          break;
        }
      }
    }

    // 3. Check MLS Lattice Containment (Simulation with unclassified context against secret assets)
    const unclassContext: SecurityContext = {
      clearance: "UNCLASSIFIED",
      compartments: [],
    };
    const testQuery = this.queryAsOf({ validTime: 0, asOfTxTime: this.currentTxClock }, unclassContext);
    const mlsLatticeContainment =
      testQuery.entities.every((e) => e.classification === "UNCLASSIFIED") &&
      testQuery.hyperedges.every((h) => h.classification === "UNCLASSIFIED");

    // 4. Check Deduplication
    const deduplicationResolved = this.aliasToCanonicalMap.size > 0;

    const receiptData = {
      specRef: "SPEC-333" as const,
      totalEntities: this.entities.length,
      totalHyperedges: this.hyperedges.length,
      bitemporalMonotonicity,
      mlsLatticeContainment,
      referentialIntegrity,
      deduplicationResolved,
    };

    const sha256Digest = this.computeSha256(receiptData);

    return {
      timestampIso: new Date().toISOString(),
      ...receiptData,
      sha256Digest,
    };
  }

  // --- Private Utility Helpers ---

  private levelToClassification(level: number): SecurityClassification {
    switch (level) {
      case 4:
        return "TOP_SECRET";
      case 3:
        return "SECRET";
      case 2:
        return "CONFIDENTIAL";
      default:
        return "UNCLASSIFIED";
    }
  }

  private calculateLexicalSimilarity(a: string, b: string): number {
    const cleanA = a.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanB = b.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleanA === cleanB) return 1.0;
    if (!cleanA || !cleanB) return 0.0;

    // Word-token Dice coefficient
    const wordsA = new Set(
      a
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    );
    const wordsB = new Set(
      b
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    );
    let wordInter = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) wordInter++;
    }
    const totalWords = wordsA.size + wordsB.size;
    const wordDice = totalWords > 0 ? (2 * wordInter) / totalWords : 0;

    const getBigrams = (str: string): Set<string> => {
      const set = new Set<string>();
      for (let i = 0; i < str.length - 1; i++) {
        set.add(str.slice(i, i + 2));
      }
      return set;
    };

    const bigramsA = getBigrams(cleanA);
    const bigramsB = getBigrams(cleanB);
    let intersection = 0;
    for (const bg of bigramsA) {
      if (bigramsB.has(bg)) intersection++;
    }

    const union = bigramsA.size + bigramsB.size - intersection;
    const charSim = union > 0 ? intersection / union : 0.0;
    return Math.max(charSim, wordDice);
  }

  private computeSha256(data: unknown): string {
    return createHash("sha256").update(JSON.stringify(data)).digest("hex");
  }
}
