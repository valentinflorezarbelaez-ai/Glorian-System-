/**
 * EOS SYSTEM — COMPILER-GRADE TYPESCRIPT AST ARCHITECTURE & STRIP-ONLY VERIFIER (Layer 0)
 * Governed by SPEC-044, CHANGE-037, ADR-050, FR-135, BDD-131 (v50.0.0)
 *
 * Dual-Engine Compiler-Grade AST Verifier:
 * 1. `TYPESCRIPT_COMPILER_AST`: Uses `ts.createSourceFile` when classic TypeScript JS AST API is present.
 * 2. `NATIVE_TS_TOKEN_AST`: Built-in zero-dependency ECMAScript/TypeScript state-machine lexer
 *    (full line/block comment, string, template-literal `${...}`, and regex-literal awareness) +
 *    structural token-AST analyzer designed for TypeScript 7 (`tsgo` native Go compiler) and
 *    stripped zero-dependency production containers.
 *
 * Zero external runtime npm dependencies (Law V).
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  assertPrecondition,
  assertPostcondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";

export type AstEngineMode = "TYPESCRIPT_COMPILER_AST" | "NATIVE_TS_TOKEN_AST";

export type AstViolationCode =
  | "EXTERNAL_IMPORT_IN_LAYER0"
  | "TS_ENUM_PROHIBITED"
  | "TS_NAMESPACE_PROHIBITED"
  | "TS_PARAMETER_PROPERTY_PROHIBITED";

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

interface TsToken {
  readonly kind: "IDENT" | "STRING" | "PUNCT" | "OTHER";
  readonly value: string;
  readonly line: number;
  readonly column: number;
}

let cachedTsModule: any | null | undefined;

function loadTypeScriptCompilerOptional(): any | null {
  if (cachedTsModule !== undefined) return cachedTsModule;
  try {
    const req = createRequire(import.meta.url);
    const mod = req("typescript");
    if (mod && typeof mod.createSourceFile === "function") {
      cachedTsModule = mod;
      return cachedTsModule;
    }
    cachedTsModule = null;
    return null;
  } catch {
    cachedTsModule = null;
    return null;
  }
}

function isAllowedLayer0Specifier(specifier: string): boolean {
  return (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("node:")
  );
}

const REGEX_PRECEDING_KEYWORDS: ReadonlySet<string> = new Set([
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
  "await"
]);

const REGEX_PRECEDING_PUNCTS: ReadonlySet<string> = new Set([
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
  ">"
]);

function canStartRegexLiteral(prevToken: TsToken | undefined): boolean {
  if (!prevToken) return true;
  if (prevToken.kind === "PUNCT") {
    return REGEX_PRECEDING_PUNCTS.has(prevToken.value);
  }
  if (prevToken.kind === "IDENT") {
    return REGEX_PRECEDING_KEYWORDS.has(prevToken.value);
  }
  return false;
}

/**
 * State-machine TypeScript lexer that strips line/block comments, skips regex & template text,
 * captures string literal values, and records exact 1-based `(line, column)` coordinates.
 */
export function tokenizeTypeScriptAstStream(source: string): TsToken[] {
  const tokens: TsToken[] = [];
  const len = source.length;
  let i = 0;
  let line = 1;
  let col = 1;
  const templateBraceDepthStack: number[] = [];
  let braceDepth = 0;

  const advance = (count: number = 1): void => {
    for (let k = 0; k < count && i < len; k++) {
      if (source.charCodeAt(i) === 10) {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  };

  const consumeTemplateBody = (): void => {
    while (i < len) {
      const ch = source[i]!;
      if (ch === "\\") {
        advance(2);
        continue;
      }
      if (ch === "`") {
        advance(1);
        return;
      }
      if (ch === "$" && source[i + 1] === "{") {
        advance(2);
        templateBraceDepthStack.push(braceDepth);
        braceDepth++;
        return;
      }
      advance(1);
    }
  };

  while (i < len) {
    const ch = source[i]!;
    const next = source[i + 1];

    // Whitespace
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      advance(1);
      continue;
    }

    // Single-line comment
    if (ch === "/" && next === "/") {
      advance(2);
      while (i < len && source.charCodeAt(i) !== 10) {
        advance(1);
      }
      continue;
    }

    // Multi-line block comment
    if (ch === "/" && next === "*") {
      advance(2);
      while (i < len && !(source[i] === "*" && source[i + 1] === "/")) {
        advance(1);
      }
      advance(2);
      continue;
    }

    // Resume template literal when closing `${ ... }`
    if (
      ch === "}" &&
      templateBraceDepthStack.length > 0 &&
      braceDepth - 1 === templateBraceDepthStack[templateBraceDepthStack.length - 1]
    ) {
      braceDepth--;
      templateBraceDepthStack.pop();
      advance(1);
      consumeTemplateBody();
      continue;
    }

    // String literal ('...' or "...")
    if (ch === "'" || ch === '"') {
      const quote = ch;
      const startLine = line;
      const startCol = col;
      advance(1);
      let val = "";
      while (i < len && source[i] !== quote) {
        if (source[i] === "\\") {
          val += source[i + 1] || "";
          advance(2);
        } else {
          val += source[i];
          advance(1);
        }
      }
      advance(1);
      tokens.push({ kind: "STRING", value: val, line: startLine, column: startCol });
      continue;
    }

    // Template literal (`...`)
    if (ch === "`") {
      const startLine = line;
      const startCol = col;
      advance(1);
      tokens.push({ kind: "OTHER", value: "`", line: startLine, column: startCol });
      consumeTemplateBody();
      continue;
    }

    // Regex literal (/.../) vs division operator
    if (ch === "/" && next !== "/" && next !== "*") {
      const prev = tokens[tokens.length - 1];
      if (canStartRegexLiteral(prev)) {
        const startLine = line;
        const startCol = col;
        advance(1);
        let inCharClass = false;
        while (i < len) {
          const rc = source[i]!;
          if (rc === "\n") break;
          if (rc === "\\") {
            advance(2);
            continue;
          }
          if (rc === "[") inCharClass = true;
          else if (rc === "]") inCharClass = false;
          else if (rc === "/" && !inCharClass) {
            advance(1);
            while (i < len && /[a-z]/i.test(source[i]!)) advance(1);
            break;
          }
          advance(1);
        }
        tokens.push({ kind: "OTHER", value: "/regex/", line: startLine, column: startCol });
        continue;
      }
    }

    // Identifier / Keyword
    if (/[A-Za-z_$]/.test(ch)) {
      const startLine = line;
      const startCol = col;
      let ident = "";
      while (i < len && /[A-Za-z0-9_$]/.test(source[i]!)) {
        ident += source[i];
        advance(1);
      }
      tokens.push({ kind: "IDENT", value: ident, line: startLine, column: startCol });
      continue;
    }

    // Numeric literal
    if (/[0-9]/.test(ch)) {
      const startLine = line;
      const startCol = col;
      let num = "";
      while (i < len && /[0-9a-fA-FxXoObBn_.]/.test(source[i]!)) {
        num += source[i];
        advance(1);
      }
      tokens.push({ kind: "OTHER", value: num, line: startLine, column: startCol });
      continue;
    }

    // Multi-char operators
    const startLine = line;
    const startCol = col;
    const three = source.slice(i, i + 3);
    if (three === "===" || three === "!==" || three === "...") {
      advance(3);
      tokens.push({ kind: "PUNCT", value: three, line: startLine, column: startCol });
      continue;
    }
    const two = source.slice(i, i + 2);
    if (
      two === "&&" ||
      two === "||" ||
      two === "??" ||
      two === "?." ||
      two === "=>" ||
      two === "==" ||
      two === "!=" ||
      two === "<=" ||
      two === ">="
    ) {
      advance(2);
      tokens.push({ kind: "PUNCT", value: two, line: startLine, column: startCol });
      continue;
    }

    if (ch === "{") braceDepth++;
    else if (ch === "}" && braceDepth > 0) braceDepth--;

    advance(1);
    tokens.push({ kind: "PUNCT", value: ch, line: startLine, column: startCol });
  }

  return tokens;
}

export class EosTypeScriptAstAnalyzer {
  /**
   * Analyzes a single TypeScript source string using compiler-grade AST parsing.
   */
  public static analyzeSource(
    sourceText: string,
    virtualFilePath: string = "src/core/sample.ts",
    enforceLayer0Purity: boolean = true
  ): FileAstMetrics {
    assertPrecondition(typeof sourceText === "string", "sourceText must be a string");
    const ts = loadTypeScriptCompilerOptional();
    if (ts) {
      return this.analyzeWithTsCompilerApi(ts, sourceText, virtualFilePath, enforceLayer0Purity);
    }
    return this.analyzeWithNativeTokenAst(sourceText, virtualFilePath, enforceLayer0Purity);
  }

  private static analyzeWithNativeTokenAst(
    sourceText: string,
    virtualFilePath: string,
    enforceLayer0Purity: boolean
  ): FileAstMetrics {
    const tokens = tokenizeTypeScriptAstStream(sourceText);
    const imports: string[] = [];
    const exportedSymbols: string[] = [];
    const violations: AstViolation[] = [];
    let cyclomaticComplexity = 1;

    const recordSpecifier = (specTok: TsToken): void => {
      imports.push(specTok.value);
      if (enforceLayer0Purity && !isAllowedLayer0Specifier(specTok.value)) {
        violations.push({
          file: virtualFilePath,
          line: specTok.line,
          column: specTok.column,
          code: "EXTERNAL_IMPORT_IN_LAYER0",
          message: `External module '${specTok.value}' prohibited in Layer-0 (use 'node:*' built-ins or relative imports).`
        });
      }
    };

    for (let idx = 0; idx < tokens.length; idx++) {
      const tok = tokens[idx]!;
      const prev = tokens[idx - 1];
      const next = tokens[idx + 1];

      // 1. Static import / re-export declarations
      if (
        tok.kind === "IDENT" &&
        tok.value === "import" &&
        !(prev?.kind === "PUNCT" && prev.value === ".")
      ) {
        // Side-effect import: import "specifier"
        if (next?.kind === "STRING") {
          recordSpecifier(next);
        } else if (!(next?.kind === "PUNCT" && next.value === "(")) {
          // Scan ahead to matching `from "specifier"`
          for (let j = idx + 1; j < tokens.length; j++) {
            const scan = tokens[j]!;
            if (scan.kind === "PUNCT" && scan.value === ";") break;
            if (scan.kind === "IDENT" && scan.value === "from" && tokens[j + 1]?.kind === "STRING") {
              recordSpecifier(tokens[j + 1]!);
              break;
            }
          }
        }
      }

      // Re-exports & exported symbols
      if (tok.kind === "IDENT" && tok.value === "export") {
        let cursor = idx + 1;
        if (tokens[cursor]?.kind === "IDENT" && tokens[cursor]!.value === "default") {
          cursor++;
        }
        if (tokens[cursor]?.kind === "IDENT" && tokens[cursor]!.value === "abstract") {
          cursor++;
        }
        if (tokens[cursor]?.kind === "IDENT" && tokens[cursor]!.value === "async") {
          cursor++;
        }
        const declKw = tokens[cursor];
        const declName = tokens[cursor + 1];
        if (
          declKw?.kind === "IDENT" &&
          ["class", "function", "interface", "type", "const", "let", "var", "enum"].includes(declKw.value) &&
          declName?.kind === "IDENT"
        ) {
          exportedSymbols.push(declName.value);
        } else {
          // Check export { ... } from "specifier" or export * from "specifier"
          for (let j = idx + 1; j < tokens.length; j++) {
            const scan = tokens[j]!;
            if (scan.kind === "PUNCT" && scan.value === ";") break;
            if (scan.kind === "IDENT" && ["class", "function", "interface", "const"].includes(scan.value)) {
              break;
            }
            if (scan.kind === "IDENT" && scan.value === "from" && tokens[j + 1]?.kind === "STRING") {
              recordSpecifier(tokens[j + 1]!);
              break;
            }
          }
        }
      }

      // 2. Prohibited TypeScript `enum`
      if (
        tok.kind === "IDENT" &&
        tok.value === "enum" &&
        next?.kind === "IDENT" &&
        !(prev?.kind === "PUNCT" && prev.value === ".")
      ) {
        violations.push({
          file: virtualFilePath,
          line: tok.line,
          column: tok.column,
          code: "TS_ENUM_PROHIBITED",
          message: `TypeScript 'enum ${next.value}' breaks Node 24 strip-only execution; use string literal unions.`
        });
      }

      // 3. Prohibited TypeScript `namespace`
      if (
        tok.kind === "IDENT" &&
        tok.value === "namespace" &&
        next?.kind === "IDENT" &&
        tokens[idx + 2]?.kind === "PUNCT" &&
        tokens[idx + 2]?.value === "{" &&
        !(prev?.kind === "PUNCT" && prev.value === ".")
      ) {
        violations.push({
          file: virtualFilePath,
          line: tok.line,
          column: tok.column,
          code: "TS_NAMESPACE_PROHIBITED",
          message: `TypeScript 'namespace ${next.value}' breaks Node 24 strip-only execution.`
        });
      }

      // 4. Prohibited constructor parameter properties: constructor(public x: number)
      if (
        tok.kind === "IDENT" &&
        tok.value === "constructor" &&
        next?.kind === "PUNCT" &&
        next.value === "(" &&
        !(prev?.kind === "PUNCT" && prev.value === ".")
      ) {
        let parenDepth = 1;
        let atParamStart = true;
        for (let j = idx + 2; j < tokens.length && parenDepth > 0; j++) {
          const pTok = tokens[j]!;
          if (pTok.kind === "PUNCT") {
            if (pTok.value === "(" || pTok.value === "[" || pTok.value === "<") {
              parenDepth++;
            } else if (pTok.value === ")" || pTok.value === "]" || pTok.value === ">") {
              parenDepth--;
              if (parenDepth === 0) break;
            } else if (pTok.value === "," && parenDepth === 1) {
              atParamStart = true;
              continue;
            } else if ((pTok.value === ":" || pTok.value === "=") && parenDepth === 1) {
              atParamStart = false;
            }
          } else if (atParamStart && parenDepth === 1 && pTok.kind === "IDENT") {
            if (["public", "private", "protected", "readonly", "override"].includes(pTok.value)) {
              violations.push({
                file: virtualFilePath,
                line: pTok.line,
                column: pTok.column,
                code: "TS_PARAMETER_PROPERTY_PROHIBITED",
                message: `Constructor parameter property '${pTok.value}' breaks Node 24 strip-only TypeScript; declare explicit class fields.`
              });
              atParamStart = false;
            } else {
              atParamStart = false;
            }
          }
        }
      }

      // 5. Cyclomatic complexity decision points
      if (
        tok.kind === "IDENT" &&
        ["if", "for", "while", "case", "catch"].includes(tok.value) &&
        !(prev?.kind === "PUNCT" && prev.value === ".")
      ) {
        cyclomaticComplexity++;
      } else if (
        tok.kind === "PUNCT" &&
        (tok.value === "&&" || tok.value === "||" || tok.value === "??")
      ) {
        cyclomaticComplexity++;
      } else if (
        tok.kind === "PUNCT" &&
        tok.value === "?" &&
        !(next?.kind === "PUNCT" && next.value === ":")
      ) {
        // Distinguish ternary `cond ? a : b` from TypeScript optional parameter/property `name?: Type`
        const isOptionalTypeAnnotation =
          prev?.kind === "IDENT" && next?.kind === "PUNCT" && next.value === ":";
        if (!isOptionalTypeAnnotation) {
          cyclomaticComplexity++;
        }
      }
    }

    return deepFreeze({
      file: virtualFilePath,
      engineMode: "NATIVE_TS_TOKEN_AST",
      imports,
      exportedSymbols,
      cyclomaticComplexity,
      violations
    });
  }

  private static analyzeWithTsCompilerApi(
    ts: any,
    sourceText: string,
    virtualFilePath: string,
    enforceLayer0Purity: boolean
  ): FileAstMetrics {
    const sf = ts.createSourceFile(
      virtualFilePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    const imports: string[] = [];
    const exportedSymbols: string[] = [];
    const violations: AstViolation[] = [];
    let cyclomaticComplexity = 1;

    const recordViolation = (node: any, code: AstViolationCode, message: string): void => {
      const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      violations.push({
        file: virtualFilePath,
        line: pos.line + 1,
        column: pos.character + 1,
        code,
        message
      });
    };

    const hasExportModifier = (node: any): boolean => {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      return Boolean(modifiers && modifiers.some((m: any) => m.kind === ts.SyntaxKind.ExportKeyword));
    };

    const visit = (node: any): void => {
      switch (node.kind) {
        case ts.SyntaxKind.ImportDeclaration:
        case ts.SyntaxKind.ExportDeclaration: {
          if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            const spec = String(node.moduleSpecifier.text);
            imports.push(spec);
            if (enforceLayer0Purity && !isAllowedLayer0Specifier(spec)) {
              recordViolation(
                node.moduleSpecifier,
                "EXTERNAL_IMPORT_IN_LAYER0",
                `External module '${spec}' prohibited in Layer-0 (use 'node:*' built-ins or relative imports).`
              );
            }
          }
          break;
        }
        case ts.SyntaxKind.EnumDeclaration: {
          recordViolation(
            node,
            "TS_ENUM_PROHIBITED",
            `TypeScript 'enum ${node.name?.text || ""}' breaks Node 24 strip-only execution; use string literal unions.`
          );
          break;
        }
        case ts.SyntaxKind.ModuleDeclaration: {
          const isGlobalAugmentation = Boolean(node.flags & ts.NodeFlags.GlobalAugmentation);
          if (!isGlobalAugmentation && node.name && ts.isIdentifier(node.name)) {
            recordViolation(
              node,
              "TS_NAMESPACE_PROHIBITED",
              `TypeScript 'namespace ${node.name.text}' breaks Node 24 strip-only execution.`
            );
          }
          break;
        }
        case ts.SyntaxKind.Constructor: {
          for (const param of node.parameters || []) {
            const modifiers = ts.canHaveModifiers(param) ? ts.getModifiers(param) : undefined;
            const hasParamProp = Boolean(
              modifiers &&
                modifiers.some((m: any) =>
                  [
                    ts.SyntaxKind.PublicKeyword,
                    ts.SyntaxKind.PrivateKeyword,
                    ts.SyntaxKind.ProtectedKeyword,
                    ts.SyntaxKind.ReadonlyKeyword
                  ].includes(m.kind)
                )
            );
            if (hasParamProp) {
              recordViolation(
                param,
                "TS_PARAMETER_PROPERTY_PROHIBITED",
                "Constructor parameter properties break Node 24 strip-only TypeScript; declare explicit class fields."
              );
            }
          }
          break;
        }
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration: {
          if (hasExportModifier(node) && node.name?.text) {
            exportedSymbols.push(String(node.name.text));
          }
          break;
        }
        case ts.SyntaxKind.VariableStatement: {
          if (hasExportModifier(node)) {
            for (const decl of node.declarationList?.declarations || []) {
              if (decl.name && ts.isIdentifier(decl.name)) {
                exportedSymbols.push(String(decl.name.text));
              }
            }
          }
          break;
        }
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.ConditionalExpression: {
          cyclomaticComplexity++;
          break;
        }
        case ts.SyntaxKind.BinaryExpression: {
          const op = node.operatorToken?.kind;
          if (
            op === ts.SyntaxKind.AmpersandAmpersandToken ||
            op === ts.SyntaxKind.BarBarToken ||
            op === ts.SyntaxKind.QuestionQuestionToken
          ) {
            cyclomaticComplexity++;
          }
          break;
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sf);

    return deepFreeze({
      file: virtualFilePath,
      engineMode: "TYPESCRIPT_COMPILER_AST",
      imports,
      exportedSymbols,
      cyclomaticComplexity,
      violations
    });
  }

  /**
   * Audits all `.ts` files inside a target directory recursively.
   */
  public static analyzeDirectory(
    targetDir: string,
    projectRoot: string = process.cwd()
  ): DirectoryAstAuditReport {
    const resolvedDir = path.resolve(targetDir);
    const resolvedRoot = path.resolve(projectRoot);
    assertPrecondition(fs.existsSync(resolvedDir), `Target directory does not exist: ${resolvedDir}`);

    const tsFiles = this.collectTsFiles(resolvedDir);
    const allViolations: AstViolation[] = [];
    let totalExports = 0;
    let totalComplexity = 0;
    let maxComplexity = 0;
    let maxFile: string | null = null;
    let engineMode: AstEngineMode =
      loadTypeScriptCompilerOptional() ? "TYPESCRIPT_COMPILER_AST" : "NATIVE_TS_TOKEN_AST";

    for (const fullPath of tsFiles) {
      const rel = path.relative(resolvedRoot, fullPath).replace(/\\/g, "/");
      const isLayer0 = rel.startsWith("src/core/") || resolvedDir.replace(/\\/g, "/").endsWith("src/core");
      const content = fs.readFileSync(fullPath, "utf8");
      const metrics = this.analyzeSource(content, rel, isLayer0);
      engineMode = metrics.engineMode;
      totalExports += metrics.exportedSymbols.length;
      totalComplexity += metrics.cyclomaticComplexity;
      if (metrics.cyclomaticComplexity > maxComplexity) {
        maxComplexity = metrics.cyclomaticComplexity;
        maxFile = rel;
      }
      for (const v of metrics.violations) {
        allViolations.push(v);
      }
    }

    const avgComplexity = tsFiles.length > 0 ? Number((totalComplexity / tsFiles.length).toFixed(2)) : 0;
    const layer0Pure = !allViolations.some((v) => v.code === "EXTERNAL_IMPORT_IN_LAYER0");
    const stripOnlyCompatible = !allViolations.some((v) => v.code !== "EXTERNAL_IMPORT_IN_LAYER0");

    const sha256Receipt = pureSha256(
      JSON.stringify({
        targetDir: path.relative(resolvedRoot, resolvedDir).replace(/\\/g, "/") || ".",
        engineMode,
        filesAnalyzed: tsFiles.length,
        totalExports,
        violationCount: allViolations.length,
        layer0Pure,
        stripOnlyCompatible
      })
    );
    assertPostcondition(sha256Receipt.length === 64, "AST audit receipt must be 64-char SHA-256");

    return deepFreeze({
      targetDir: resolvedDir,
      engineMode,
      filesAnalyzed: tsFiles.length,
      totalExportedSymbols: totalExports,
      averageCyclomaticComplexity: avgComplexity,
      maxCyclomaticFile: maxFile,
      maxCyclomaticComplexity: maxComplexity,
      layer0Pure,
      stripOnlyCompatible,
      violations: allViolations,
      sha256Receipt
    });
  }

  private static collectTsFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name.startsWith(".worktree")) {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.collectTsFiles(full, acc);
      } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        acc.push(full);
      }
    }
    return acc.sort();
  }
}
