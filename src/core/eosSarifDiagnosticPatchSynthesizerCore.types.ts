/**
 * SPEC-242 / CHANGE-122 — Layer-0 SARIF 2.1.0 & Unified Patch Synthesizer Types.
 */

export type SarifSeverityLevel = "error" | "warning" | "note";

export interface DiagnosticFindingInput {
  readonly ruleId: string;
  readonly level: SarifSeverityLevel;
  readonly message: string;
  readonly filePath: string;
  readonly startLine?: number;
  readonly startColumn?: number;
  readonly originalLine?: string;
  readonly replacementLine?: string;
}

export interface SynthesizeSarifOptions {
  readonly projectRoot?: string;
  readonly runTitle?: string;
  readonly findings: readonly DiagnosticFindingInput[];
  readonly writeSarifToDisk?: boolean;
  readonly outputRelPath?: string;
}

export interface SarifPhysicalLocation {
  readonly artifactLocation: { readonly uri: string };
  readonly region: { readonly startLine: number; readonly startColumn: number };
}

export interface SarifFixDescriptor {
  readonly description: { readonly text: string };
  readonly artifactChanges: readonly {
    readonly artifactLocation: { readonly uri: string };
    readonly replacements: readonly {
      readonly deletedRegion: { readonly startLine: number; readonly startColumn: number };
      readonly insertedContent: { readonly text: string };
    }[];
  }[];
}

export interface SarifResultEntry {
  readonly ruleId: string;
  readonly level: SarifSeverityLevel;
  readonly message: { readonly text: string };
  readonly locations: readonly { readonly physicalLocation: SarifPhysicalLocation }[];
  readonly fixes?: readonly SarifFixDescriptor[];
}

export interface SarifDocument210 {
  readonly $schema: "https://json.schemastore.org/sarif-2.1.0.json";
  readonly version: "2.1.0";
  readonly runs: readonly [
    {
      readonly tool: {
        readonly driver: {
          readonly name: string;
          readonly version: string;
          readonly rules: readonly { readonly id: string; readonly shortDescription: { readonly text: string } }[];
        };
      };
      readonly results: readonly SarifResultEntry[];
    },
  ];
}

export interface SarifSynthesisReport {
  readonly runTitle: string;
  readonly totalResults: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly sarifDocument: SarifDocument210;
  readonly synthesizedUnifiedDiff: string;
  readonly writtenSarifPath?: string;
  readonly sarifDigestSha256: string;
}
