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

export type ModuleImportKind = "static" | "reexport" | "dynamic" | "require";

export type ExportedDeclarationKind = "function" | "class" | "interface" | "type" | "const";

export interface ExtractedImportSpecifier {
  readonly specifier: string;
  readonly kind: ModuleImportKind;
  readonly line: number;
  readonly column: number;
}

export interface ExtractedExportSymbol {
  readonly name: string;
  readonly kind: ExportedDeclarationKind;
  readonly line: number;
  readonly column: number;
  readonly isReExport: boolean;
}

export interface ModuleSyntaxSummary {
  readonly imports: readonly ExtractedImportSpecifier[];
  readonly exports: readonly ExtractedExportSymbol[];
}

const STATEMENT_BOUNDARY_KEYWORDS: ReadonlySet<string> = new Set([
  "const",
  "let",
  "var",
  "function",
  "class",
  "export",
  "import",
  "return",
  "if",
  "for",
  "while",
  "try",
]);

function scanStaticImportFrom(tokens: readonly TsToken[], startIdx: number): ExtractedImportSpecifier | null {
  let braceDepth = 0;
  for (let j = startIdx; j < tokens.length; j++) {
    const scan = tokens[j]!;
    if (scan.kind === "PUNCT" && scan.value === "{") {
      braceDepth++;
      continue;
    }
    if (scan.kind === "PUNCT" && scan.value === "}") {
      if (braceDepth > 0) braceDepth--;
      continue;
    }
    if (braceDepth > 0) continue;
    if (scan.kind === "PUNCT" && scan.value === ";") return null;
    if (scan.kind === "IDENT" && STATEMENT_BOUNDARY_KEYWORDS.has(scan.value)) return null;
    if (scan.kind === "IDENT" && scan.value === "from" && tokens[j + 1]?.kind === "STRING") {
      const spec = tokens[j + 1]!;
      return { specifier: spec.value, kind: "static", line: spec.line, column: spec.column };
    }
  }
  return null;
}

function parseImportAt(tokens: readonly TsToken[], idx: number): ExtractedImportSpecifier | null {
  const prev = tokens[idx - 1];
  const next = tokens[idx + 1];
  if (prev?.kind === "PUNCT" && prev.value === ".") return null;
  if (!next || (next.kind === "PUNCT" && next.value === ".")) return null;
  if (next.kind === "STRING") {
    return { specifier: next.value, kind: "static", line: next.line, column: next.column };
  }
  if (next.kind === "PUNCT" && next.value === "(") {
    const arg = tokens[idx + 2];
    return arg?.kind === "STRING"
      ? { specifier: arg.value, kind: "dynamic", line: arg.line, column: arg.column }
      : null;
  }
  return scanStaticImportFrom(tokens, idx + 1);
}

function parseRequireAt(tokens: readonly TsToken[], idx: number): ExtractedImportSpecifier | null {
  const prev = tokens[idx - 1];
  if (prev?.kind === "PUNCT" && prev.value === ".") return null;
  if (prev?.kind === "IDENT" && (prev.value === "function" || prev.value === "async")) return null;
  if (tokens[idx + 1]?.kind !== "PUNCT" || tokens[idx + 1]!.value !== "(") return null;
  const arg = tokens[idx + 2];
  const close = tokens[idx + 3];
  if (arg?.kind === "STRING" && close?.kind === "PUNCT" && close.value === ")") {
    return { specifier: arg.value, kind: "require", line: arg.line, column: arg.column };
  }
  return null;
}

function mapDeclKind(kw: string): ExportedDeclarationKind | null {
  if (kw === "function" || kw === "class" || kw === "interface" || kw === "type") return kw;
  if (kw === "const" || kw === "let" || kw === "var" || kw === "enum") return "const";
  return null;
}

function parseBraceExportClause(
  tokens: readonly TsToken[],
  openBraceIdx: number,
  outerTypeOnly: boolean,
): { closeIdx: number; items: Array<{ name: string; kind: ExportedDeclarationKind; line: number; column: number }> } {
  const items: Array<{ name: string; kind: ExportedDeclarationKind; line: number; column: number }> = [];
  let cursor = openBraceIdx + 1;
  while (cursor < tokens.length) {
    const cur = tokens[cursor]!;
    if (cur.kind === "PUNCT" && cur.value === "}") return { closeIdx: cursor, items };
    if (cur.kind === "PUNCT" && cur.value === ",") {
      cursor++;
      continue;
    }
    let itemTypeOnly = outerTypeOnly;
    if (
      cur.kind === "IDENT" &&
      cur.value === "type" &&
      tokens[cursor + 1]?.kind === "IDENT" &&
      tokens[cursor + 1]!.value !== "as"
    ) {
      itemTypeOnly = true;
      cursor++;
    }
    const localTok = tokens[cursor];
    if (localTok?.kind === "IDENT") {
      let published = localTok;
      if (
        tokens[cursor + 1]?.kind === "IDENT" &&
        tokens[cursor + 1]!.value === "as" &&
        tokens[cursor + 2]?.kind === "IDENT"
      ) {
        published = tokens[cursor + 2]!;
        cursor += 3;
      } else {
        cursor++;
      }
      items.push({
        name: published.value,
        kind: itemTypeOnly ? "type" : "const",
        line: published.line,
        column: published.column,
      });
      continue;
    }
    cursor++;
  }
  return { closeIdx: cursor, items };
}

const EXPORT_MODIFIERS: ReadonlySet<string> = new Set(["declare", "default", "abstract", "async"]);

function parseExportAt(
  tokens: readonly TsToken[],
  idx: number,
  importsOut: ExtractedImportSpecifier[],
  exportsOut: ExtractedExportSymbol[],
): void {
  const prev = tokens[idx - 1];
  if (prev?.kind === "PUNCT" && prev.value === ".") return;

  let cursor = idx + 1;
  let sawTypeModifier = false;
  if (
    tokens[cursor]?.kind === "IDENT" &&
    tokens[cursor]!.value === "type" &&
    tokens[cursor + 1]?.kind === "PUNCT" &&
    (tokens[cursor + 1]!.value === "{" || tokens[cursor + 1]!.value === "*")
  ) {
    sawTypeModifier = true;
    cursor++;
  }

  if (tokens[cursor]?.kind === "PUNCT" && tokens[cursor]!.value === "*") {
    cursor++;
    if (tokens[cursor]?.kind === "IDENT" && tokens[cursor]!.value === "as" && tokens[cursor + 1]?.kind === "IDENT") {
      const ns = tokens[cursor + 1]!;
      exportsOut.push({
        name: ns.value,
        kind: sawTypeModifier ? "type" : "const",
        line: ns.line,
        column: ns.column,
        isReExport: true,
      });
      cursor += 2;
    }
    if (tokens[cursor]?.kind === "IDENT" && tokens[cursor]!.value === "from" && tokens[cursor + 1]?.kind === "STRING") {
      const spec = tokens[cursor + 1]!;
      importsOut.push({ specifier: spec.value, kind: "reexport", line: spec.line, column: spec.column });
    }
    return;
  }

  if (tokens[cursor]?.kind === "PUNCT" && tokens[cursor]!.value === "{") {
    const { closeIdx, items } = parseBraceExportClause(tokens, cursor, sawTypeModifier);
    const afterClose = tokens[closeIdx + 1];
    const specTok = tokens[closeIdx + 2];
    const isReExport = afterClose?.kind === "IDENT" && afterClose.value === "from" && specTok?.kind === "STRING";
    if (isReExport && specTok) {
      importsOut.push({ specifier: specTok.value, kind: "reexport", line: specTok.line, column: specTok.column });
    }
    for (const item of items) {
      exportsOut.push({ ...item, isReExport });
    }
    return;
  }

  while (tokens[cursor]?.kind === "IDENT" && EXPORT_MODIFIERS.has(tokens[cursor]!.value)) {
    cursor++;
  }
  const declKw = tokens[cursor];
  if (declKw?.kind !== "IDENT") return;
  const mappedKind = mapDeclKind(declKw.value);
  if (!mappedKind) return;
  let nameIdx = cursor + 1;
  if (declKw.value === "function" && tokens[nameIdx]?.kind === "PUNCT" && tokens[nameIdx]!.value === "*") {
    nameIdx++;
  }
  const declName = tokens[nameIdx];
  if (declName?.kind === "IDENT") {
    exportsOut.push({
      name: declName.value,
      kind: mappedKind,
      line: declName.line,
      column: declName.column,
      isReExport: false,
    });
  }
}

export function extractModuleSyntaxFromTokens(tokens: readonly TsToken[]): ModuleSyntaxSummary {
  const imports: ExtractedImportSpecifier[] = [];
  const exports: ExtractedExportSymbol[] = [];

  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx]!;
    if (tok.kind !== "IDENT") continue;
    if (tok.value === "import") {
      const parsed = parseImportAt(tokens, idx);
      if (parsed) imports.push(parsed);
    } else if (tok.value === "require") {
      const parsed = parseRequireAt(tokens, idx);
      if (parsed) imports.push(parsed);
    } else if (tok.value === "export") {
      parseExportAt(tokens, idx, imports, exports);
    }
  }

  return { imports, exports };
}
