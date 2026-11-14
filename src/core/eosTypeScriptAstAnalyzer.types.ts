/**
 * Type definitions and lexer tables for EosTypeScriptAstAnalyzer (SPEC-044, ADR-050).
 */

export type AstEngineMode = "TYPESCRIPT_COMPILER_AST" | "NATIVE_TS_TOKEN_AST";

export type AstViolationCode =
  "EXTERNAL_IMPORT_IN_LAYER0" | "TS_ENUM_PROHIBITED" | "TS_NAMESPACE_PROHIBITED" | "TS_PARAMETER_PROPERTY_PROHIBITED";

export interface AstViolation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly code: AstViolationCode;
  readonly message: string;
}

export interface FileAstMetrics {
  readonly file: string;
  readonly engineMode: AstEngineMode;
  readonly imports: readonly string[];
  readonly exportedSymbols: readonly string[];
  readonly cyclomaticComplexity: number;
  readonly violations: readonly AstViolation[];
}

export interface DirectoryAstAuditReport {
  readonly targetDir: string;
  readonly engineMode: AstEngineMode;
  readonly filesAnalyzed: number;
  readonly totalExportedSymbols: number;
  readonly averageCyclomaticComplexity: number;
  readonly maxCyclomaticFile: string | null;
  readonly maxCyclomaticComplexity: number;
  readonly layer0Pure: boolean;
  readonly stripOnlyCompatible: boolean;
  readonly violations: readonly AstViolation[];
  readonly sha256Receipt: string;
}

export interface TsToken {
  readonly kind: "IDENT" | "STRING" | "PUNCT" | "OTHER";
  readonly value: string;
  readonly line: number;
  readonly column: number;
}

export function isAllowedLayer0Specifier(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("node:");
}

export const REGEX_PRECEDING_KEYWORDS: ReadonlySet<string> = new Set([
  "return",
  "case",
  "throw",
  "typeof",
  "void",
  "delete",
  "in",
  "of",
  "instanceof",
  "new",
  "yield",
  "await",
]);

export const REGEX_PRECEDING_PUNCTS: ReadonlySet<string> = new Set([
  "(",
  "{",
  "[",
  ",",
  ";",
  ":",
  "=",
  "==",
  "===",
  "!=",
  "!==",
  "!",
  "&&",
  "||",
  "??",
  "?",
  "+",
  "-",
  "*",
  "%",
  "=>",
  "<",
  ">",
]);

export function canStartRegexLiteral(prevToken: TsToken | undefined): boolean {
  if (!prevToken) return true;
  if (prevToken.kind === "PUNCT") return REGEX_PRECEDING_PUNCTS.has(prevToken.value);
  if (prevToken.kind === "IDENT") return REGEX_PRECEDING_KEYWORDS.has(prevToken.value);
  return false;
}
