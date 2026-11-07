/**
 * ============================================================================
 * EOS SYSTEM — NUBANK INSTITUTIONAL ENGINEERING CODEX (Layer 0)
 * ============================================================================
 * Implements the official institutional engineering standards of Nu (Nubank)
 * as documented on `https://building.nu.com/` (Building Nu):
 *
 * 1. FIGHTING COMPLEXITY & FUNCTIONAL SIMPLICITY:
 *    - Rich Hickey / Out of the Tar Pit doctrine: Simplicity is not "easy".
 *    - Pure functions operating on immutable data structures (maps, vectors, sets).
 *    - Separation of state, identity, and time.
 *
 * 2. HEXAGONAL ARCHITECTURE & HERMETIC ISOLATION:
 *    - Domain core 100% pure with zero framework/I/O dependencies.
 *    - Ingress/Egress Ports & Adapters for Finagle, Pedestal, Kafka, and Datomic.
 *
 * 3. DATOMIC IMMUTABLE BITEMPORAL LEDGER:
 *    - Database as an immutable value. Append-only facts (Datoms: [e, a, v, tx, op]).
 *    - Monotonic transaction timeline and point-in-time time-travel (queryAsOf, history).
 *
 * 4. SACHEM CONSUMER-DRIVEN CONTRACT TESTING:
 *    - Schema compatibility validation across microservices (Kafka & REST).
 *    - Eliminates flaky, brittle staging End-to-End (E2E) testing environments.
 *
 * 5. KAFKA ASYNCHRONOUS EVENT STREAMING & BANKING IDEMPOTENCY:
 *    - Entity-partitioned event streams for monotonic per-account ordering.
 *    - Banking-grade idempotency deduplication tokens preventing double mutations.
 *
 * 6. BLAMELESS INCIDENT MANAGEMENT & AUTONOMOUS SQUADS:
 *    - "You build it, you run it" culture.
 *    - 5 Whys, timeline reconstruction, cognitive ergonomics, and zero personal blame.
 *
 * Zero external runtime dependencies. Layer-0 Pure.
 * ============================================================================
 */

import { createHash } from "node:crypto";

export type DatomOp = "assert" | "retract";

export interface Datom {
  readonly entityId: string;
  readonly attribute: string;
  readonly value: any;
  readonly txTime: number;
  readonly op: DatomOp;
  readonly merkleHash: string;
}

export interface DatomicDatabase {
  readonly facts: readonly Datom[];
  readonly lastTxTime: number;
}

export interface DatomicTxResult {
  readonly dbBefore: DatomicDatabase;
  readonly dbAfter: DatomicDatabase;
  readonly txTime: number;
  readonly committedDatoms: readonly Datom[];
  readonly txHash: string;
}

export interface SachemSchemaField {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "object" | "array" | "uuid" | "timestamp";
  readonly required: boolean;
  readonly doc?: string;
}

export interface SachemSchema {
  readonly namespace: string;
  readonly version: string;
  readonly fields: readonly SachemSchemaField[];
}

export interface SachemCompatibilityResult {
  readonly isCompatible: boolean;
  readonly violations: readonly string[];
  readonly additiveChanges: readonly string[];
  readonly producerVersion: string;
  readonly consumerVersion: string;
}

export interface IncidentTimelineEvent {
  readonly timestamp: string;
  readonly description: string;
  readonly detectedBy: "alert" | "customer" | "engineer" | "sentinel";
}

export interface NubankIncidentReport {
  readonly incidentId: string;
  readonly title: string;
  readonly severity: "SEV1" | "SEV2" | "SEV3";
  readonly owningSquad: string;
  readonly affectedServices: readonly string[];
  readonly customerImpact: string;
  readonly startTime: string;
  readonly resolutionTime: string;
  readonly durationMinutes: number;
  readonly timeline: readonly IncidentTimelineEvent[];
  readonly fiveWhys: readonly string[];
  readonly cognitiveFactors: readonly string[];
  readonly systemicRemediations: readonly {
    readonly action: string;
    readonly owner: string;
    readonly deadline: string;
  }[];
}

export interface NubankArchitectureMetrics {
  readonly hasMutableStateInDomain: boolean;
  readonly usesHexagonalLayerIsolation: boolean;
  readonly usesContractTestingInsteadOfE2E: boolean;
  readonly enforcesKafkaIdempotencyTokens: boolean;
  readonly usesImmutableBitemporalLedgers: boolean;
  readonly hasBlamelessPostmortemProcess: boolean;
  readonly unitTestCoveragePercent: number;
}

export interface NubankHealthEvaluation {
  readonly institutionalScore: number; // 0 to 100
  readonly tier: "BUILDING_NU_APEX" | "HIGH_ALIGNMENT" | "NEEDS_REMEDIATION" | "HIGH_COMPLEXITY_RISK";
  readonly pillarScores: {
    readonly fightingComplexity: number;
    readonly hexagonalIsolation: number;
    readonly datomicBitemporality: number;
    readonly sachemContracts: number;
    readonly kafkaIdempotency: number;
    readonly blamelessSre: number;
  };
  readonly findings: readonly string[];
  readonly recommendations: readonly string[];
}

export interface SquadCharter {
  readonly squadName: string;
  readonly tribe: string;
  readonly mission: string;
  readonly servicesOwned: readonly string[];
  readonly slos: readonly {
    readonly metric: string;
    readonly target: string;
  }[];
  readonly rfcStandard: string;
  readonly onCallRotationUrl: string;
}

/**
 * 1. DATOMIC IMMUTABLE BITEMPORAL SIMULATOR
 * Creates an empty Datomic database snapshot.
 */
export function createEmptyDatomicDb(): DatomicDatabase {
  return {
    facts: Object.freeze([]),
    lastTxTime: 0,
  };
}

/**
 * Executes an atomic transaction against a Datomic database.
 * Every assertion or retraction generates immutable datoms.
 */
export function transactDatomic(
  db: DatomicDatabase,
  txData: readonly { entityId: string; attribute: string; value: any; op?: DatomOp }[],
): DatomicTxResult {
  let txTime = Date.now();
  if (txTime <= db.lastTxTime) {
    txTime = db.lastTxTime + 1; // Monotonic TrueTime invariant
  }

  const committedDatoms: Datom[] = [];
  const prevHash = db.facts.length > 0 ? db.facts[db.facts.length - 1].merkleHash : "0".repeat(64);

  let currentHash = prevHash;
  for (const item of txData) {
    const op = item.op ?? "assert";
    const raw = `${currentHash}:${item.entityId}:${item.attribute}:${JSON.stringify(item.value)}:${txTime}:${op}`;
    const merkleHash = createHash("sha256").update(raw).digest("hex");
    currentHash = merkleHash;

    committedDatoms.push(
      Object.freeze({
        entityId: item.entityId,
        attribute: item.attribute,
        value: item.value,
        txTime,
        op,
        merkleHash,
      }),
    );
  }

  const dbAfter: DatomicDatabase = {
    facts: Object.freeze([...db.facts, ...committedDatoms]),
    lastTxTime: txTime,
  };

  return {
    dbBefore: db,
    dbAfter,
    txTime,
    committedDatoms: Object.freeze(committedDatoms),
    txHash: currentHash,
  };
}

/**
 * Time-Travel Query (as-of):
 * Reconstructs the exact state of an entity as it existed at any historical txTime.
 */
export function queryDatomicAsOf(db: DatomicDatabase, entityId: string, asOfTxTime: number): Record<string, any> {
  const entityState: Record<string, any> = {};

  for (const datom of db.facts) {
    if (datom.txTime > asOfTxTime) continue;
    if (datom.entityId !== entityId) continue;

    if (datom.op === "assert") {
      entityState[datom.attribute] = datom.value;
    } else if (datom.op === "retract") {
      delete entityState[datom.attribute];
    }
  }

  return entityState;
}

/**
 * Returns full audit history of an entity across all transactions.
 */
export function queryDatomicHistory(db: DatomicDatabase, entityId: string): readonly Datom[] {
  return db.facts.filter((d) => d.entityId === entityId);
}

/**
 * 2. SACHEM CONSUMER-DRIVEN CONTRACT VERIFIER
 * Validates backward and forward compatibility between schema versions.
 * Rules (Building Nu Standard):
 * - Removing a field breaks backward compatibility.
 * - Changing the data type of an existing field breaks backward compatibility.
 * - Adding a new required field breaks backward compatibility for old producers.
 * - Adding a new optional field is fully backward compatible.
 */
export function verifySachemContract(
  previousSchema: SachemSchema,
  proposedSchema: SachemSchema,
): SachemCompatibilityResult {
  const violations: string[] = [];
  const additiveChanges: string[] = [];

  const prevFieldMap = new Map<string, SachemSchemaField>();
  for (const f of previousSchema.fields) {
    prevFieldMap.set(f.name, f);
  }

  const propFieldMap = new Map<string, SachemSchemaField>();
  for (const f of proposedSchema.fields) {
    propFieldMap.set(f.name, f);
  }

  // Check 1: Did we delete any fields?
  for (const [name, prevField] of prevFieldMap.entries()) {
    if (!propFieldMap.has(name)) {
      violations.push(`BREAKING_CHANGE: Field '${name}' was removed in schema ${proposedSchema.version}`);
    } else {
      const propField = propFieldMap.get(name)!;
      // Check 2: Did the type change?
      if (propField.type !== prevField.type) {
        violations.push(`TYPE_MISMATCH: Field '${name}' changed type from '${prevField.type}' to '${propField.type}'`);
      }
      // Check 3: Did an optional field become required?
      if (!prevField.required && propField.required) {
        violations.push(
          `CONSTRAINT_TIGHTENED: Optional field '${name}' was made required in schema ${proposedSchema.version}`,
        );
      }
    }
  }

  // Check 4: Inspect newly added fields
  for (const [name, propField] of propFieldMap.entries()) {
    if (!prevFieldMap.has(name)) {
      if (propField.required) {
        violations.push(
          `NEW_REQUIRED_FIELD: Field '${name}' was added as required, which breaks existing message consumers.`,
        );
      } else {
        additiveChanges.push(`ADDITIVE_FIELD: Optional field '${name}' (${propField.type}) added safely.`);
      }
    }
  }

  return {
    isCompatible: violations.length === 0,
    violations: Object.freeze(violations),
    additiveChanges: Object.freeze(additiveChanges),
    producerVersion: proposedSchema.version,
    consumerVersion: previousSchema.version,
  };
}

/**
 * 3. BLAMELESS INCIDENT MANAGEMENT & POSTMORTEM SYNTHESIZER
 * Synthesizes an institutional, blameless postmortem adhering to Nu SRE guidelines.
 */
export function synthesizeNubankBlamelessPostmortem(incident: NubankIncidentReport): {
  readonly markdown: string;
  readonly sha256Receipt: string;
} {
  const md = `# NUBANK BLAMELESS POSTMORTEM — ${incident.incidentId}: ${incident.title}
<!-- Standard: Building Nu Incident Management (building.nu.com) -->

## 1. Executive Summary
* **Incident ID**: \`${incident.incidentId}\`
* **Severity**: \`${incident.severity}\`
* **Owning Squad**: \`${incident.owningSquad}\`
* **Affected Services**: ${incident.affectedServices.map((s) => `\`${s}\``).join(", ")}
* **Start Time (UTC)**: ${incident.startTime}
* **Resolution Time (UTC)**: ${incident.resolutionTime}
* **Total Duration**: ${incident.durationMinutes} minutes
* **Customer Impact**: ${incident.customerImpact}

## 2. Chronological Timeline of Events
| Timestamp (UTC) | Description | Detection Source |
|---|---|---|
${incident.timeline.map((t) => `| ${t.timestamp} | ${t.description} | \`${t.detectedBy}\` |`).join("\n")}

## 3. The 5 Whys (Causal Analysis)
${incident.fiveWhys.map((why, idx) => `${idx + 1}. **Why?** ${why}`).join("\n")}

## 4. Human & Cognitive Ergonomics (Zero Blame Assessment)
Nubank treats human errors as symptoms of deeper architectural and systemic gaps.
${incident.cognitiveFactors.map((factor) => `- ${factor}`).join("\n")}

## 5. Systemic Remediations & Preventative Actions
| Action Item | Owning Engineer / Squad | Target Completion | Status |
|---|---|---|---|
${incident.systemicRemediations.map((r) => `| ${r.action} | \`${r.owner}\` | ${r.deadline} | \`COMMITTED\` |`).join("\n")}

---
*Attested by EOS Nubank Institutional Codex — Exit Code 0 Invariant.*
`;

  const sha256Receipt = createHash("sha256").update(md).digest("hex");
  return { markdown: md, sha256Receipt };
}

/**
 * 4. NUBANK ARCHITECTURE HEALTH EVALUATOR
 * Scores a project (0-100) against the 6 pillars of Building Nu.
 */
export function evaluateNubankArchitectureHealth(metrics: NubankArchitectureMetrics): NubankHealthEvaluation {
  const findings: string[] = [];
  const recommendations: string[] = [];

  // Pillar 1: Fighting Complexity (0-20)
  let fightingComplexity = 20;
  if (metrics.hasMutableStateInDomain) {
    fightingComplexity -= 15;
    findings.push("MUTABLE_STATE_DETECTED: Mutable objects or global state found in domain logic.");
    recommendations.push("Refactor domain models into immutable pure data maps (Rich Hickey doctrine).");
  }

  // Pillar 2: Hexagonal Layer Isolation (0-20)
  let hexagonalIsolation = 20;
  if (!metrics.usesHexagonalLayerIsolation) {
    hexagonalIsolation -= 15;
    findings.push("BROKEN_HEXAGONAL_ISOLATION: Domain depends directly on external frameworks/transports.");
    recommendations.push("Decouple core domain behind explicit ports and adapters (Finagle/Pedestal/Kafka).");
  }

  // Pillar 3: Datomic Bitemporality (0-15)
  let datomicBitemporality = 15;
  if (!metrics.usesImmutableBitemporalLedgers) {
    datomicBitemporality -= 10;
    findings.push("MUTABLE_DATABASE_UPDATES: In-place CRUD mutations lack bitemporal audit trail.");
    recommendations.push("Adopt append-only event ledgers or Datomic datom tuples to preserve forensic audit history.");
  }

  // Pillar 4: Sachem Contract Testing (0-15)
  let sachemContracts = 15;
  if (!metrics.usesContractTestingInsteadOfE2E) {
    sachemContracts -= 10;
    findings.push("FRAGILE_E2E_DEPENDENCY: Tests rely on brittle live cross-service environments.");
    recommendations.push("Implement consumer-driven schema contracts (Sachem pattern) for Kafka topics and REST APIs.");
  }

  // Pillar 5: Kafka Idempotency (0-15)
  let kafkaIdempotency = 15;
  if (!metrics.enforcesKafkaIdempotencyTokens) {
    kafkaIdempotency -= 15;
    findings.push("MISSING_IDEMPOTENCY_TOKENS: Events processed without deduplication tokens.");
    recommendations.push("Mandate Idempotency-Key headers on all mutations and Kafka consumer deduplication.");
  }

  // Pillar 6: Blameless SRE & Test Rigor (0-15)
  let blamelessSre = 15;
  if (!metrics.hasBlamelessPostmortemProcess) {
    blamelessSre -= 8;
    findings.push("NO_BLAMELESS_POSTMORTEM_STANDARD: Incidents lack systematic 5 Whys postmortem.");
    recommendations.push("Adopt Nu standard blameless postmortems with systemic ergonomics analysis.");
  }
  if (metrics.unitTestCoveragePercent < 85) {
    const penalty = Math.round((85 - metrics.unitTestCoveragePercent) / 5);
    blamelessSre = Math.max(0, blamelessSre - penalty);
    findings.push(`LOW_UNIT_COVERAGE: Coverage is ${metrics.unitTestCoveragePercent}% (threshold: >= 85%).`);
    recommendations.push("Increase pure unit test coverage on core financial calculations.");
  }

  const institutionalScore =
    fightingComplexity + hexagonalIsolation + datomicBitemporality + sachemContracts + kafkaIdempotency + blamelessSre;

  let tier: NubankHealthEvaluation["tier"] = "BUILDING_NU_APEX";
  if (institutionalScore < 60) tier = "HIGH_COMPLEXITY_RISK";
  else if (institutionalScore < 80) tier = "NEEDS_REMEDIATION";
  else if (institutionalScore < 95) tier = "HIGH_ALIGNMENT";

  return {
    institutionalScore,
    tier,
    pillarScores: {
      fightingComplexity,
      hexagonalIsolation,
      datomicBitemporality,
      sachemContracts,
      kafkaIdempotency,
      blamelessSre,
    },
    findings: Object.freeze(findings),
    recommendations: Object.freeze(recommendations),
  };
}

/**
 * 5. AUTONOMOUS SQUAD CHARTER SYNTHESIZER
 * Generates an institutional squad charter with RFC workflow.
 */
export function synthesizeNubankSquadCharter(config: {
  readonly squadName: string;
  readonly tribe: string;
  readonly mission: string;
  readonly servicesOwned: readonly string[];
  readonly slos: readonly { metric: string; target: string }[];
}): SquadCharter {
  return {
    squadName: config.squadName,
    tribe: config.tribe,
    mission: config.mission,
    servicesOwned: Object.freeze([...config.servicesOwned]),
    slos: Object.freeze([...config.slos]),
    rfcStandard: "RFC-NU-ARCHITECTURE: All cross-squad changes require written RFC with consensus window.",
    onCallRotationUrl: `https://pagerduty.internal.nu/${config.squadName}-oncall`,
  };
}
