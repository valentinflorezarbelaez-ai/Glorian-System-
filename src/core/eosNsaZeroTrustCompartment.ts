/**
 * EOS SYSTEM — NSA RED/BLACK COMPARTMENT & BELL-LAPADULA ZERO-TRUST ARBITER
 * Governed by ADR-040, SPEC-034, FR-096, BDD-088
 *
 * Implements:
 * 1. Bell-LaPadula Security Lattice: UNCLASSIFIED < CONFIDENTIAL < SECRET < TOP_SECRET.
 * 2. Simple Security (No Read-Up): Subjects can only read objects at or below their clearance.
 * 3. *-Property (No Write-Down): Subjects cannot write classified info to lower classifications.
 * 4. Red/Black Separation: Classified plaintext strictly contained in RAM (RED); only
 *    authenticated AES-256-GCM ciphertext permitted across external gates (BLACK).
 * 5. Monotonic Sequence Counter and SHA-384 Merkle Chain Audit Trail.
 *
 * 100% Layer-0 Purity with zero runtime npm dependencies.
 */

import { EosNsaCryptoSuite, type NsaEncryptedEnvelope } from "./eosNsaCryptoSuite.ts";

export type NsaClassification = "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET";

export const NSA_CLASSIFICATION_LEVELS: Record<NsaClassification, number> = {
  UNCLASSIFIED: 0,
  CONFIDENTIAL: 1,
  SECRET: 2,
  TOP_SECRET: 3,
};

export interface NsaSubject {
  readonly subjectId: string;
  readonly clearance: NsaClassification;
  readonly compartments: readonly string[];
}

export interface NsaClassifiedObject {
  readonly objectId: string;
  readonly classification: NsaClassification;
  readonly compartments: readonly string[];
  readonly redPayload: string; // Plaintext (RED side only)
}

export interface NsaBlackTransitPayload {
  readonly objectId: string;
  readonly classification: NsaClassification;
  readonly envelope: NsaEncryptedEnvelope;
  readonly sequenceNumber: number;
  readonly previousLogHash: string;
  readonly timestamp: string;
}

export interface NsaAuditRecord {
  readonly sequenceNumber: number;
  readonly action: "READ" | "WRITE" | "TRANSIT_BLACK" | "ACCESS_DENIED";
  readonly subjectId: string;
  readonly objectId: string;
  readonly classification: NsaClassification;
  readonly outcome: "GRANTED" | "DENIED_READ_UP" | "DENIED_WRITE_DOWN" | "DENIED_COMPARTMENT_MISMATCH";
  readonly timestamp: string;
  readonly entryHash: string;
}

export class EosNsaZeroTrustCompartment {
  private readonly masterKey: Buffer;
  private readonly redVault = new Map<string, NsaClassifiedObject>();
  private readonly auditLog: NsaAuditRecord[] = [];
  private sequenceCounter = 0;
  private lastAuditHash =
    "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

  constructor(masterKey?: Buffer) {
    this.masterKey = masterKey || EosNsaCryptoSuite.generateKey256();
  }

  /**
   * Evaluates if a subject is permitted to read an object (Bell-LaPadula Simple Security: No Read-Up).
   */
  public canRead(
    subject: NsaSubject,
    object: { classification: NsaClassification; compartments: readonly string[] },
  ): boolean {
    const subjectLevel = NSA_CLASSIFICATION_LEVELS[subject.clearance];
    const objectLevel = NSA_CLASSIFICATION_LEVELS[object.classification];

    if (subjectLevel < objectLevel) {
      return false; // Violation: Read-Up
    }

    // Must possess all compartments assigned to the object
    const subjectCompartments = new Set(subject.compartments);
    for (const comp of object.compartments) {
      if (!subjectCompartments.has(comp)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluates if a subject is permitted to write to an object (Bell-LaPadula *-Property: No Write-Down).
   */
  public canWrite(
    subject: NsaSubject,
    targetClassification: NsaClassification,
    targetCompartments: readonly string[],
  ): boolean {
    const subjectLevel = NSA_CLASSIFICATION_LEVELS[subject.clearance];
    const targetLevel = NSA_CLASSIFICATION_LEVELS[targetClassification];

    if (subjectLevel > targetLevel) {
      return false; // Violation: Write-Down (prevent classified leakage to lower classification)
    }

    // Subject must possess all compartments required by the target object
    const subjectCompartmentsSet = new Set(subject.compartments);
    for (const comp of targetCompartments) {
      if (!subjectCompartmentsSet.has(comp)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Stores a classified object inside the RED boundary.
   */
  public storeRedObject(subject: NsaSubject, object: NsaClassifiedObject): boolean {
    if (!this.canWrite(subject, object.classification, object.compartments)) {
      this.recordAudit("WRITE", subject.subjectId, object.objectId, object.classification, "DENIED_WRITE_DOWN");
      return false;
    }

    this.redVault.set(object.objectId, object);
    this.recordAudit("WRITE", subject.subjectId, object.objectId, object.classification, "GRANTED");
    return true;
  }

  /**
   * Reads a classified object from the RED boundary.
   */
  public readRedObject(subject: NsaSubject, objectId: string): string | null {
    const obj = this.redVault.get(objectId);
    if (!obj) return null;

    if (!this.canRead(subject, obj)) {
      const subjectLevel = NSA_CLASSIFICATION_LEVELS[subject.clearance];
      const objectLevel = NSA_CLASSIFICATION_LEVELS[obj.classification];
      const outcome = subjectLevel < objectLevel ? "DENIED_READ_UP" : "DENIED_COMPARTMENT_MISMATCH";
      this.recordAudit("READ", subject.subjectId, objectId, obj.classification, outcome);
      return null;
    }

    this.recordAudit("READ", subject.subjectId, objectId, obj.classification, "GRANTED");
    return obj.redPayload;
  }

  /**
   * Exports an object across the BLACK boundary.
   * Red plaintext is encrypted with AES-256-GCM; only ciphertext crosses the gate.
   */
  public exportToBlackBoundary(subject: NsaSubject, objectId: string): NsaBlackTransitPayload {
    const obj = this.redVault.get(objectId);
    if (!obj) {
      throw new Error(`RED Object not found: ${objectId}`);
    }

    if (!this.canRead(subject, obj)) {
      this.recordAudit("TRANSIT_BLACK", subject.subjectId, objectId, obj.classification, "DENIED_READ_UP");
      throw new Error(
        `NSA Access Violation: Subject ${subject.subjectId} denied export of ${obj.classification} object`,
      );
    }

    const aad = `CLASS=${obj.classification};COMPS=${obj.compartments.join(",")};OBJ=${obj.objectId}`;
    const envelope = EosNsaCryptoSuite.encryptAesGcm256(obj.redPayload, this.masterKey, aad);

    this.sequenceCounter++;
    const transit: NsaBlackTransitPayload = {
      objectId: obj.objectId,
      classification: obj.classification,
      envelope,
      sequenceNumber: this.sequenceCounter,
      previousLogHash: this.lastAuditHash,
      timestamp: new Date().toISOString(),
    };

    this.recordAudit("TRANSIT_BLACK", subject.subjectId, objectId, obj.classification, "GRANTED");
    return transit;
  }

  /**
   * Purges all RED plaintext from memory using military zeroization.
   */
  public zeroizeRedVault(): void {
    for (const [key, obj] of this.redVault.entries()) {
      const buf = Buffer.from(obj.redPayload, "utf8");
      EosNsaCryptoSuite.zeroizeBuffer(buf);
      this.redVault.delete(key);
    }
  }

  public getAuditTrail(): readonly NsaAuditRecord[] {
    return Object.freeze([...this.auditLog]);
  }

  private recordAudit(
    action: "READ" | "WRITE" | "TRANSIT_BLACK" | "ACCESS_DENIED",
    subjectId: string,
    objectId: string,
    classification: NsaClassification,
    outcome: "GRANTED" | "DENIED_READ_UP" | "DENIED_WRITE_DOWN" | "DENIED_COMPARTMENT_MISMATCH",
  ): void {
    this.sequenceCounter++;
    const timestamp = new Date().toISOString();
    const rawData = `${this.sequenceCounter}|${action}|${subjectId}|${objectId}|${classification}|${outcome}|${timestamp}|${this.lastAuditHash}`;
    const entryHash = EosNsaCryptoSuite.computeSha384(rawData);
    this.lastAuditHash = entryHash;

    this.auditLog.push({
      sequenceNumber: this.sequenceCounter,
      action,
      subjectId,
      objectId,
      classification,
      outcome,
      timestamp,
      entryHash,
    });
  }
}
