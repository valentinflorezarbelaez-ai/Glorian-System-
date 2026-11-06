/**
 * EOS SYSTEM — CONTRACT EVOLUTION GOVERNOR & BREAKING-CHANGE DETECTOR (Layer 0)
 * Governed by SPEC-050, CHANGE-043, ADR-056 (v56.0.0)
 *
 * Implements Nubank Sachem & Buf Protobuf Schema Compatibility Rules:
 * 1. Semantic Schema Contract Differencing across JSON Schema & TypeScript Interfaces.
 * 2. Deterministic Backward-Compatibility Categorization:
 *    - COMPATIBLE_EXPANSION (e.g. optional field added, enum widened).
 *    - BREAKING_CONTRACTION (e.g. field deleted, type altered, optional -> required).
 *    - DANGEROUS_MUTATION (e.g. SQL DDL drop column, non-null add without default).
 * 3. Fail-Closed Pre-Merge Deployment Gate (BREAKING_CHANGE_REJECTED).
 * 4. Relational Database Migration Hazard Scanner.
 * 5. Cryptographic Attestation & Durable SQLite WAL Ledger Recording.
 *
 * Zero external runtime dependencies. Node 24 strip-only compliant.
 */

import {
  assertPrecondition,
  assertPostcondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";
import { EosDurableSqliteLedger } from "./eosDurableSqliteLedger.ts";

export type CompatibilityCategory =
  | "COMPATIBLE_EXPANSION"
  | "BREAKING_CONTRACTION"
  | "DANGEROUS_MUTATION";

export type SchemaMutationType =
  | "FIELD_ADDED"
  | "FIELD_REMOVED"
  | "FIELD_TYPE_CHANGED"
  | "OPTIONAL_BECOMES_REQUIRED"
  | "REQUIRED_BECOMES_OPTIONAL"
  | "DDL_HAZARD";

export interface SchemaField {
  readonly name: string;
  readonly type: string;
  readonly optional: boolean;
  readonly description?: string;
}

export interface SchemaContract {
  readonly contractId: string;
  readonly version: string;
  readonly fields: readonly SchemaField[];
}

export interface SchemaFieldDiff {
  readonly mutationType: SchemaMutationType;
  readonly classification: CompatibilityCategory;
  readonly fieldName: string;
  readonly baseDetail?: string;
  readonly candidateDetail?: string;
  readonly message: string;
}

export interface SqlMigrationHazard {
  readonly ruleId: string;
  readonly classification: CompatibilityCategory;
  readonly lineNumber: number;
  readonly statement: string;
  readonly riskExplanation: string;
  readonly remediation: string;
}

export interface ContractEvolutionReport {
  readonly baseContractId: string;
  readonly candidateContractId: string;
  readonly gateVerdict: "APPROVED" | "BREAKING_CHANGE_REJECTED";
  readonly compatibleExpansionsCount: number;
  readonly breakingContractionsCount: number;
  readonly dangerousMutationsCount: number;
  readonly diffs: readonly SchemaFieldDiff[];
  readonly sqlHazards: readonly SqlMigrationHazard[];
  readonly sha256Receipt: string;
  readonly ledgerEntryId?: string;
}

export class EosContractEvolutionGovernor {
  /**
   * Compares a baseline schema contract with a candidate contract and categorizes all mutations.
   */
  public static compareContracts(
    base: SchemaContract,
    candidate: SchemaContract,
    options?: { allowBreakingChanges?: boolean }
  ): ContractEvolutionReport {
    assertPrecondition(Boolean(base && base.contractId), "Valid base contract required");
    assertPrecondition(Boolean(candidate && candidate.contractId), "Valid candidate contract required");

    const baseFields = new Map<string, SchemaField>();
    for (const f of base.fields) {
      baseFields.set(f.name, f);
    }

    const candidateFields = new Map<string, SchemaField>();
    for (const f of candidate.fields) {
      candidateFields.set(f.name, f);
    }

    const diffs: SchemaFieldDiff[] = [];
    let compatibleExpansionsCount = 0;
    let breakingContractionsCount = 0;
    let dangerousMutationsCount = 0;

    // 1. Check for removed or modified fields from base
    for (const [name, baseField] of baseFields.entries()) {
      if (!candidateFields.has(name)) {
        // Field deletion is breaking contraction
        diffs.push({
          mutationType: "FIELD_REMOVED",
          classification: "BREAKING_CONTRACTION",
          fieldName: name,
          baseDetail: `${baseField.name}: ${baseField.type}`,
          message: `Field '${name}' was deleted without deprecation`
        });
        breakingContractionsCount++;
      } else {
        const candField = candidateFields.get(name)!;

        // Type changed check
        if (baseField.type.trim() !== candField.type.trim()) {
          diffs.push({
            mutationType: "FIELD_TYPE_CHANGED",
            classification: "BREAKING_CONTRACTION",
            fieldName: name,
            baseDetail: baseField.type,
            candidateDetail: candField.type,
            message: `Field '${name}' type changed from '${baseField.type}' to '${candField.type}'`
          });
          breakingContractionsCount++;
        }

        // Optional becomes required check
        if (baseField.optional && !candField.optional) {
          diffs.push({
            mutationType: "OPTIONAL_BECOMES_REQUIRED",
            classification: "BREAKING_CONTRACTION",
            fieldName: name,
            baseDetail: "optional",
            candidateDetail: "required",
            message: `Optional field '${name}' was made required, breaking existing payloads`
          });
          breakingContractionsCount++;
        } else if (!baseField.optional && candField.optional) {
          diffs.push({
            mutationType: "REQUIRED_BECOMES_OPTIONAL",
            classification: "COMPATIBLE_EXPANSION",
            fieldName: name,
            baseDetail: "required",
            candidateDetail: "optional",
            message: `Required field '${name}' was relaxed to optional`
          });
          compatibleExpansionsCount++;
        }
      }
    }

    // 2. Check for added fields in candidate
    for (const [name, candField] of candidateFields.entries()) {
      if (!baseFields.has(name)) {
        if (candField.optional) {
          diffs.push({
            mutationType: "FIELD_ADDED",
            classification: "COMPATIBLE_EXPANSION",
            fieldName: name,
            candidateDetail: `${candField.name}?: ${candField.type}`,
            message: `Optional field '${name}' added cleanly`
          });
          compatibleExpansionsCount++;
        } else {
          // Adding a required field to an existing contract breaks old producers
          diffs.push({
            mutationType: "FIELD_ADDED",
            classification: "BREAKING_CONTRACTION",
            fieldName: name,
            candidateDetail: `${candField.name}: ${candField.type}`,
            message: `New field '${name}' added as required without default value`
          });
          breakingContractionsCount++;
        }
      }
    }

    const allowBreaking = options?.allowBreakingChanges === true;
    const gateVerdict =
      breakingContractionsCount > 0 && !allowBreaking
        ? "BREAKING_CHANGE_REJECTED"
        : "APPROVED";

    const sha256Receipt = pureSha256(
      `${base.contractId}:${candidate.contractId}:${gateVerdict}:${diffs.map((d) => d.mutationType + ":" + d.fieldName).join(",")}`
    );

    return deepFreeze({
      baseContractId: base.contractId,
      candidateContractId: candidate.contractId,
      gateVerdict,
      compatibleExpansionsCount,
      breakingContractionsCount,
      dangerousMutationsCount,
      diffs: deepFreeze(diffs),
      sqlHazards: deepFreeze([]),
      sha256Receipt
    });
  }

  /**
   * Scans raw SQL DDL script for table-lock, drop-column, and non-null column hazards.
   */
  public static scanSqlMigrationHazards(ddlSql: string): readonly SqlMigrationHazard[] {
    assertPrecondition(typeof ddlSql === "string", "ddlSql must be a string");
    const hazards: SqlMigrationHazard[] = [];
    const lines = ddlSql.split("\n");

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx].trim();
      if (!line || line.startsWith("--")) continue;

      const upper = line.toUpperCase();

      // Check DROP COLUMN
      if (/ALTER\s+TABLE\s+.*DROP\s+COLUMN/i.test(line)) {
        hazards.push({
          ruleId: "DROP_COLUMN_BREAKING_HAZARD",
          classification: "BREAKING_CONTRACTION",
          lineNumber: idx + 1,
          statement: line,
          riskExplanation: "Dropping columns immediately breaks running application replicas.",
          remediation: "Deprecate column in application code first, stop reading/writing, then drop in subsequent release."
        });
      }

      // Check DROP TABLE
      if (/DROP\s+TABLE/i.test(line)) {
        hazards.push({
          ruleId: "DROP_TABLE_DESTRUCTIVE_HAZARD",
          classification: "BREAKING_CONTRACTION",
          lineNumber: idx + 1,
          statement: line,
          riskExplanation: "Dropping a table permanently destroys data and causes immediate client errors.",
          remediation: "Archive table data and ensure zero queries reference the table before dropping."
        });
      }

      // Check ADD COLUMN ... NOT NULL without DEFAULT
      if (/ADD\s+(COLUMN\s+)?.*\bNOT\s+NULL\b/i.test(line) && !/\bDEFAULT\b/i.test(line)) {
        hazards.push({
          ruleId: "NOT_NULL_WITHOUT_DEFAULT_HAZARD",
          classification: "DANGEROUS_MUTATION",
          lineNumber: idx + 1,
          statement: line,
          riskExplanation: "Adding a NOT NULL column without DEFAULT locks the entire table and fails if existing rows exist.",
          remediation: "Add column as nullable, backfill data, and then apply NOT NULL constraint, or supply a DEFAULT value."
        });
      }
    }

    return deepFreeze(hazards);
  }

  /**
   * Synthesizes a SchemaContract from a TypeScript interface source snippet.
   */
  public static parseTypeScriptContract(interfaceSrc: string, contractId: string = "Contract"): SchemaContract {
    const fields: SchemaField[] = [];
    const lines = interfaceSrc.split("\n");

    for (const rawLine of lines) {
      const line = rawLine.trim().replace(/;$/, "");
      if (!line || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*") || line.startsWith("export interface")) {
        continue;
      }

      const match = line.match(/^([a-zA-Z0-9_$]+)(\??)\s*:\s*(.+)$/);
      if (match) {
        const [, name, optMark, type] = match;
        fields.push({
          name: name.trim(),
          type: type.trim(),
          optional: optMark === "?"
        });
      }
    }

    return deepFreeze({
      contractId,
      version: "vCurrent",
      fields: deepFreeze(fields)
    });
  }

  /**
   * Persists contract evolution audit receipt into SQLite WAL durable ledger.
   */
  public static recordEvolutionAttestation(
    report: ContractEvolutionReport,
    options?: { ledgerDbPath?: string; projectId?: string }
  ): string {
    if (options?.ledgerDbPath) {
      const ledger = new EosDurableSqliteLedger(options.ledgerDbPath);
      try {
        const rec = ledger.appendEntry({
          category: report.gateVerdict === "BREAKING_CHANGE_REJECTED" ? "SECURITY_AUDIT" : "ARCHITECTURE_DECISION",
          projectId: options.projectId || "eos-system",
          title: `Contract Evolution Gate: ${report.baseContractId} -> ${report.candidateContractId} [${report.gateVerdict}]`,
          payload: {
            baseContractId: report.baseContractId,
            candidateContractId: report.candidateContractId,
            gateVerdict: report.gateVerdict,
            expansions: report.compatibleExpansionsCount,
            contractions: report.breakingContractionsCount,
            mutations: report.dangerousMutationsCount,
            diffsCount: report.diffs.length,
            sha256Receipt: report.sha256Receipt
          },
          engramTopicKey: `eos/contracts/${report.baseContractId}`
        });
        return rec.entryId;
      } finally {
        ledger.close();
      }
    }
    return `CREC-${report.sha256Receipt.slice(0, 12)}`;
  }
}
