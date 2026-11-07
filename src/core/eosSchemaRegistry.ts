/**
 * EOS SYSTEM — SCHEMA REGISTRY WITH COMPATIBILITY MODES (Layer 0)
 * Governed by SPEC-182 (Confluent Schema Registry / Apicurio pattern)
 *
 * Implements:
 * - Versioned schema storage per subject with monotonic IDs
 * - Four compatibility modes: BACKWARD, FORWARD, FULL, NONE
 * - Field add/remove/type-change compatibility rules
 * - Canonical content digest for deduplication
 * - Subject listing + rollout safety verdict
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export type CompatibilityMode = "BACKWARD" | "FORWARD" | "FULL" | "NONE";

export interface RegistrySchemaField {
  readonly name: string;
  readonly type: string; // primitive name or "record:<subject>"
  readonly required: boolean;
  readonly defaultValue?: unknown;
}

export interface SchemaRecord {
  readonly subject: string;
  readonly version: number;
  readonly fields: readonly RegistrySchemaField[];
  readonly digest: string;
}

export interface CompatVerdict {
  readonly compatible: boolean;
  readonly mode: CompatibilityMode;
  readonly violations: readonly string[];
}

function shapeOf(fields: readonly RegistrySchemaField[]): Map<string, RegistrySchemaField> {
  const m = new Map<string, RegistrySchemaField>();
  for (const f of fields) m.set(f.name, f);
  return m;
}

function compareSchemas(older: SchemaRecord, newer: SchemaRecord, mode: CompatibilityMode): string[] {
  if (mode === "NONE") return [];
  const violations: string[] = [];
  const oldShape = shapeOf(older.fields);
  const newShape = shapeOf(newer.fields);

  // Rules for BACKWARD (new reader can read old data):
  //   - Removing a required field is BREAKING (old data has it, new doesn't accept)
  //   - Adding a required field without a default is BREAKING
  // FORWARD (old reader can read new data):
  //   - Adding a field is safe; removing any field present in old is BREAKING
  if (mode === "BACKWARD" || mode === "FULL") {
    for (const [name, oldField] of oldShape) {
      const newField = newShape.get(name);
      if (!newField) {
        if (oldField.required) violations.push(`BACKWARD: removed required field '${name}'`);
        continue;
      }
      if (oldField.type !== newField.type) violations.push(`type change '${name}' ${oldField.type}->${newField.type}`);
    }
    for (const [name, newField] of newShape) {
      if (!oldShape.has(name) && newField.required && newField.defaultValue === undefined) {
        violations.push(`BACKWARD: added required field '${name}' without default`);
      }
    }
  }

  if (mode === "FORWARD" || mode === "FULL") {
    for (const [name, oldField] of oldShape) {
      if (!newShape.has(name)) {
        violations.push(`FORWARD: dropped field '${name}' present in older schema`);
        void oldField;
      }
    }
    for (const [name, newField] of newShape) {
      const oldField = oldShape.get(name);
      if (oldField && oldField.type !== newField.type) {
        violations.push(`FORWARD: type change '${name}' ${oldField.type}->${newField.type}`);
      }
    }
  }

  return [...new Set(violations)];
}

export class EosSchemaRegistry {
  private readonly subjects: Map<string, SchemaRecord[]> = new Map();
  private readonly mode: Map<string, CompatibilityMode> = new Map();

  setMode(subject: string, compat: CompatibilityMode): void {
    this.mode.set(subject, compat);
  }

  private getMode(subject: string): CompatibilityMode {
    return this.mode.get(subject) ?? "BACKWARD";
  }

  /**
   * Registers a new schema for a subject if compatible with the previous one.
   * Throws on incompatible change.
   */
  register(subject: string, fields: readonly RegistrySchemaField[]): SchemaRecord {
    assertPrecondition(subject.length > 0, "subject required");
    const sortedFields = [...fields].sort((a, b) => a.name.localeCompare(b.name));
    const digest = pureSha256(JSON.stringify(sortedFields));
    const history = this.subjects.get(subject) ?? [];
    const version = history.length + 1;
    const record: SchemaRecord = deepFreeze({ subject, version, fields: sortedFields, digest });

    if (history.length > 0) {
      const previous = history[history.length - 1];
      const verdict = this.checkCompat(subject, previous, record);
      assertPrecondition(verdict.compatible, `incompatible schema: ${verdict.violations.join("; ")}`);
    }
    history.push(record);
    this.subjects.set(subject, history);
    return record;
  }

  checkCompat(subject: string, older: SchemaRecord, newer: SchemaRecord): CompatVerdict {
    const mode = this.getMode(subject);
    const violations = compareSchemas(older, newer, mode);
    return deepFreeze({ compatible: violations.length === 0, mode, violations });
  }

  latest(subject: string): SchemaRecord | null {
    const h = this.subjects.get(subject);
    return h && h.length ? h[h.length - 1] : null;
  }

  history(subject: string): readonly SchemaRecord[] {
    return this.subjects.get(subject) ?? [];
  }

  listSubjects(): readonly string[] {
    return [...this.subjects.keys()].sort();
  }

  registryDigest(): string {
    const snapshot: Record<string, string[]> = {};
    for (const [s, list] of this.subjects) snapshot[s] = list.map((r) => r.digest);
    return pureSha256(JSON.stringify(snapshot));
  }
}
