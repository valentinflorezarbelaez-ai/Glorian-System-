/**
 * EOS SLSA Provenance, In-Toto Attestations & Cryptographic SBOM Types
 *
 * SPEC-293 / CHANGE-155 / Step 7
 * Zero third-party runtime dependencies (Law V).
 */

export interface SlsaSbomComponent {
  name: string;
  version: string;
  purl?: string;
  type: "library" | "application" | "file";
  sha256: string;
  license?: string;
}

export interface SlsaCycloneDxDocument {
  bomFormat: "CycloneDX";
  specVersion: "1.5";
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    component: {
      name: string;
      version: string;
      type: string;
    };
    tools?: Array<{ vendor: string; name: string; version: string }>;
  };
  components: SlsaSbomComponent[];
}

export interface SlsaSpdxPackage {
  SPDXID: string;
  name: string;
  versionInfo: string;
  downloadLocation: string;
  filesAnalyzed: boolean;
  checksums: Array<{ algorithm: "SHA256"; checksumValue: string }>;
  licenseConcluded: string;
  licenseDeclared: string;
}

export interface SlsaSpdxDocument {
  spdxVersion: "SPDX-2.3";
  dataLicense: "CC0-1.0";
  SPDXID: string;
  name: string;
  documentNamespace: string;
  creationInfo: {
    created: string;
    creators: string[];
  };
  packages: SlsaSpdxPackage[];
}

export interface SlsaInTotoSubject {
  name: string;
  digest: Record<string, string>;
}

export interface SlsaV1Predicate {
  buildDefinition: {
    buildType: string;
    externalParameters: Record<string, unknown>;
    internalParameters?: Record<string, unknown>;
    resolvedDependencies?: Array<{
      uri: string;
      digest: Record<string, string>;
    }>;
  };
  runDetails: {
    builder: {
      id: string;
      version?: string;
    };
    metadata: {
      invocationId: string;
      startedOn: string;
      finishedOn: string;
    };
    byproducts?: Array<{
      name: string;
      digest: Record<string, string>;
    }>;
  };
}

export interface SlsaInTotoStatement {
  _type: "https://in-toto.io/Statement/v1";
  subject: SlsaInTotoSubject[];
  predicateType: "https://slsa.dev/provenance/v1";
  predicate: SlsaV1Predicate;
}

export interface SlsaDsseSignature {
  keyid: string;
  sig: string; // base64 encoded
}

export interface SlsaDsseEnvelope {
  payload: string; // base64 encoded
  payloadType: string;
  signatures: SlsaDsseSignature[];
}

export type SlsaLevel = "SLSA_LEVEL_0" | "SLSA_LEVEL_1" | "SLSA_LEVEL_2" | "SLSA_LEVEL_3" | "SLSA_LEVEL_4";

export interface SlsaEvaluationResult {
  slsaLevel: SlsaLevel;
  verifiedChecks: string[];
  violations: string[];
  isCompliant: boolean;
}

export interface ProvenanceAuditReceipt {
  timestampIso: string;
  specRef: string;
  totalArtifactsAttested: number;
  sbomComponentsCount: number;
  slsaLevelAchieved: SlsaLevel;
  envelopeSignatureValid: boolean;
  sha256Signature: string;
}
