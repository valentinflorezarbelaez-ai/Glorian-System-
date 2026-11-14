/**
 * SPEC-245 / CHANGE-123 — Layer-0 In-Toto Statement v1 & SLSA v1.0 Ed25519 Attestor Types.
 */

export interface InTotoSubjectEntry {
  readonly name: string;
  readonly digest: { readonly sha256: string };
}

export interface SlsaProvenancePredicateV1 {
  readonly buildDefinition: {
    readonly buildType: string;
    readonly externalParameters: Record<string, string>;
  };
  readonly runDetails: {
    readonly builder: { readonly id: string };
    readonly metadata: { readonly invocationId: string };
  };
}

export interface InTotoStatementV1 {
  readonly _type: "https://in-toto.io/Statement/v1";
  readonly subject: readonly InTotoSubjectEntry[];
  readonly predicateType: "https://slsa.dev/provenance/v1";
  readonly predicate: SlsaProvenancePredicateV1;
}

export interface DsseEnvelope {
  readonly payloadType: "application/vnd.in-toto+json";
  readonly payloadBase64: string;
  readonly signatures: readonly [{ readonly keyid: string; readonly sigBase64: string }];
}

export interface IssueShipAttestationOptions {
  readonly projectRoot?: string;
  readonly ticketId?: string;
  readonly headCommitSha?: string;
  readonly diffDigestSha256?: string;
  readonly sarifDigestSha256?: string;
  readonly contractDiffDigestSha256?: string;
  readonly staffVerdict?: string;
  readonly keySeed?: string;
  readonly writeAttestationToDisk?: boolean;
  readonly outputRelPath?: string;
}

export interface ShipAttestationBundle {
  readonly ticketId: string;
  readonly keyId: string;
  readonly publicKeyPem: string;
  readonly statement: InTotoStatementV1;
  readonly dsseEnvelope: DsseEnvelope;
  readonly verified: boolean;
  readonly writtenAttestationPath?: string;
  readonly attestationDigestSha256: string;
}

export interface VerifyDsseAttestationResult {
  readonly verified: boolean;
  readonly keyId: string;
  readonly payloadType: string;
  readonly statement?: InTotoStatementV1;
  readonly failureReason?: string;
}
