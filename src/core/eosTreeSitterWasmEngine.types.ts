/**
 * EOS High-Speed AST Code Graph Engine Types.
 * SPEC-290 / CHANGE-152: Zero-dependency polyglot AST parsing types.
 */

export type SupportedLanguage = "typescript" | "javascript" | "go" | "rust" | "python";

export type TreeSitterAstNodeKind =
  "function" | "class" | "interface" | "type" | "import" | "export" | "struct" | "enum" | "trait" | "variable";

export interface TreeSitterAstNode {
  kind: TreeSitterAstNodeKind;
  name: string;
  language: SupportedLanguage;
  startByte: number;
  endByte: number;
  startLine: number;
  endLine: number;
  signature: string;
  sourceModule?: string;
  isExported?: boolean;
}

export interface SymbolTable {
  filePath: string;
  language: SupportedLanguage;
  symbols: Map<string, TreeSitterAstNode>;
  imports: Array<{ symbol: string; sourceModule: string }>;
  exports: string[];
  contentHash: string;
}

export interface AstDiff {
  filePath: string;
  addedSymbols: string[];
  modifiedSymbols: string[];
  removedSymbols: string[];
  unchangedSymbols: string[];
}

export interface BlastRadiusResult {
  rootModule: string;
  impactedSymbols: string[];
  affectedModules: string[];
  fanOutScore: number;
  maxDepth: number;
  impactedTestSuites: string[];
}

export interface AstAuditReceipt {
  timestampIso: string;
  specRef: "SPEC-290";
  totalFilesParsed: number;
  totalSymbolsIndexed: number;
  graphEdgesCount: number;
  averageParseTimeMs: number;
  sha256Signature: string;
}
