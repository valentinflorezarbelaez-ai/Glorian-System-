/**
 * SPEC-241 / CHANGE-122 — Layer-0 API Contract Semantic Diff Core Types.
 */

export type ContractChangeKind =
  "REMOVED_PUBLIC_SYMBOL" | "ARITY_INCREASED_BREAKING" | "REMOVED_REQUIRED_FIELD" | "ADDITIVE_NON_BREAKING";

export type SemverBumpLevel = "MAJOR" | "MINOR" | "PATCH";

export interface ContractSymbolDescriptor {
  readonly name: string;
  readonly kind: "function" | "interface" | "class" | "type" | "const";
  readonly requiredParams: number;
  readonly fields: readonly string[];
  readonly optionalFields?: readonly string[];
}

export interface ContractChangeItem {
  readonly symbolName: string;
  readonly changeKind: ContractChangeKind;
  readonly breaking: boolean;
  readonly summary: string;
  readonly expandContractRemediation: string;
}

export interface CompareApiContractsInput {
  readonly contractId?: string;
  readonly baselineSource: string;
  readonly candidateSource: string;
}

export interface ApiContractDiffReport {
  readonly contractId: string;
  readonly baselineSymbolsCount: number;
  readonly candidateSymbolsCount: number;
  readonly breakingChanges: readonly ContractChangeItem[];
  readonly additiveChanges: readonly ContractChangeItem[];
  readonly backwardCompatible: boolean;
  readonly semverBumpRequired: SemverBumpLevel;
  readonly expandAndContractAdvice: readonly string[];
  readonly contractDiffDigestSha256: string;
}
