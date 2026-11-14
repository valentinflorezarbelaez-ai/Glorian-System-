/**
 * SPEC-241 / CHANGE-122 — Layer-0 API Contract Semantic Diff Core.
 * Extracts public TypeScript exports without external dependencies and classifies
 * semantic breaking changes, required semver bumps, and Expand-and-Contract advice.
 */

import crypto from "node:crypto";
import { deepFreeze } from "./eosKernelPrimitives.ts";
import type {
  ApiContractDiffReport,
  CompareApiContractsInput,
  ContractChangeItem,
  ContractSymbolDescriptor,
  SemverBumpLevel,
} from "./eosApiContractSemanticDiffCore.types.ts";

function splitTopLevelParams(paramsRaw: string): readonly string[] {
  const trimmed = paramsRaw.trim();
  if (!trimmed) return [];
  const params: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of trimmed) {
    if (ch === "(" || ch === "<" || ch === "{" || ch === "[") depth++;
    else if ((ch === ")" || ch === ">" || ch === "}" || ch === "]") && depth > 0) depth--;
    if (ch === "," && depth === 0) {
      if (current.trim()) params.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) params.push(current.trim());
  return params;
}

function isRequiredParam(param: string): boolean {
  if (param.startsWith("...") || param.includes("=")) return false;
  const colonIdx = param.indexOf(":");
  const namePart = colonIdx >= 0 ? param.slice(0, colonIdx) : param;
  return !namePart.trim().endsWith("?");
}

function extractInterfaceFields(body: string): { required: string[]; optional: string[] } {
  const required: string[] = [];
  const optional: string[] = [];
  for (const segment of body.split(/[\n;]/)) {
    const clean = segment.replace(/\/\/.*$/, "").trim();
    const match = clean.match(/^(?:readonly\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(\??)\s*:/);
    if (!match) continue;
    if (match[2] === "?") optional.push(match[1]);
    else required.push(match[1]);
  }
  return { required, optional };
}

function collectExportedFunctions(source: string, out: Map<string, ContractSymbolDescriptor>): void {
  const fnRe = /export\s+(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g;
  for (const m of source.matchAll(fnRe)) {
    const requiredParams = splitTopLevelParams(m[2]).filter(isRequiredParam).length;
    out.set(m[1], { name: m[1], kind: "function", requiredParams, fields: [], optionalFields: [] });
  }
}

function collectExportedInterfaces(source: string, out: Map<string, ContractSymbolDescriptor>): void {
  const ifaceRe = /export\s+interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s*<[^>]*>)?\s*\{([^}]*)\}/g;
  for (const m of source.matchAll(ifaceRe)) {
    const parsed = extractInterfaceFields(m[2]);
    out.set(m[1], {
      name: m[1],
      kind: "interface",
      requiredParams: 0,
      fields: parsed.required,
      optionalFields: parsed.optional,
    });
  }
}

function collectSimpleExports(source: string, out: Map<string, ContractSymbolDescriptor>): void {
  const simpleRe = /export\s+(class|type|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  for (const m of source.matchAll(simpleRe)) {
    if (out.has(m[2])) continue;
    out.set(m[2], {
      name: m[2],
      kind: m[1] as "class" | "type" | "const",
      requiredParams: 0,
      fields: [],
      optionalFields: [],
    });
  }
}

function collectNamedReExports(source: string, out: Map<string, ContractSymbolDescriptor>): void {
  const reExportRe = /export\s+(?:type\s+)?\{([^}]+)\}/g;
  for (const m of source.matchAll(reExportRe)) {
    for (const raw of m[1].split(",")) {
      const cleaned = raw.trim().replace(/^type\s+/, "");
      const alias =
        cleaned
          .split(/\s+as\s+/)
          .pop()
          ?.trim() ?? "";
      if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(alias) || out.has(alias)) continue;
      out.set(alias, {
        name: alias,
        kind: "type",
        requiredParams: 0,
        fields: [],
        optionalFields: [],
      });
    }
  }
}

function compareMatchedSymbol(
  baseSym: ContractSymbolDescriptor,
  candSym: ContractSymbolDescriptor,
  breaking: ContractChangeItem[],
  additive: ContractChangeItem[],
): void {
  if (baseSym.kind === "function" && candSym.requiredParams > baseSym.requiredParams) {
    breaking.push({
      symbolName: baseSym.name,
      changeKind: "ARITY_INCREASED_BREAKING",
      breaking: true,
      summary: `Function '${baseSym.name}' increased required parameters from ${baseSym.requiredParams} to ${candSym.requiredParams}.`,
      expandContractRemediation: `Keep existing '${baseSym.name}' arity intact and introduce the new parameter as optional ('param?: T') or default-initialized.`,
    });
  }
  if (candSym.kind === "interface") {
    for (const field of baseSym.fields) {
      if (!candSym.fields.includes(field)) {
        breaking.push({
          symbolName: baseSym.name,
          changeKind: "REMOVED_REQUIRED_FIELD",
          breaking: true,
          summary: `Interface '${baseSym.name}' removed required field '${field}'.`,
          expandContractRemediation: `Retain deprecated field '${field}' during an Expand phase before contracting in the next major release.`,
        });
      }
    }
  }
  const baseOpt = new Set(baseSym.optionalFields ?? []);
  for (const optField of candSym.optionalFields ?? []) {
    if (!baseOpt.has(optField) && !baseSym.fields.includes(optField)) {
      additive.push({
        symbolName: candSym.name,
        changeKind: "ADDITIVE_NON_BREAKING",
        breaking: false,
        summary: `Interface '${candSym.name}' added optional field '${optField}'.`,
        expandContractRemediation: "Additive optional field preserves backward compatibility.",
      });
    }
  }
}

export class EosApiContractSemanticDiffCore {
  static extractPublicSymbols(source: string): readonly ContractSymbolDescriptor[] {
    const out = new Map<string, ContractSymbolDescriptor>();
    collectExportedFunctions(source, out);
    collectExportedInterfaces(source, out);
    collectSimpleExports(source, out);
    collectNamedReExports(source, out);
    return deepFreeze([...out.values()].sort((a, b) => a.name.localeCompare(b.name)));
  }

  static compareContracts(input: CompareApiContractsInput): ApiContractDiffReport {
    const contractId = (input.contractId ?? "CONTRACT-DIFF-001").trim() || "CONTRACT-DIFF-001";
    const baseline = this.extractPublicSymbols(input.baselineSource ?? "");
    const candidate = this.extractPublicSymbols(input.candidateSource ?? "");
    const baseMap = new Map(baseline.map((s) => [s.name, s]));
    const candMap = new Map(candidate.map((s) => [s.name, s]));

    const breakingChanges: ContractChangeItem[] = [];
    const additiveChanges: ContractChangeItem[] = [];

    for (const baseSym of baseline) {
      const candSym = candMap.get(baseSym.name);
      if (!candSym) {
        breakingChanges.push({
          symbolName: baseSym.name,
          changeKind: "REMOVED_PUBLIC_SYMBOL",
          breaking: true,
          summary: `Removed exported ${baseSym.kind} '${baseSym.name}' from public API surface.`,
          expandContractRemediation: `Restore '${baseSym.name}' with @deprecated alias pointing to the replacement symbol before removing.`,
        });
      } else {
        compareMatchedSymbol(baseSym, candSym, breakingChanges, additiveChanges);
      }
    }

    for (const candSym of candidate) {
      if (!baseMap.has(candSym.name)) {
        additiveChanges.push({
          symbolName: candSym.name,
          changeKind: "ADDITIVE_NON_BREAKING",
          breaking: false,
          summary: `Added exported ${candSym.kind} '${candSym.name}' without breaking callers.`,
          expandContractRemediation: "Additive export requires only a MINOR semver bump.",
        });
      }
    }

    const backwardCompatible = breakingChanges.length === 0;
    const semverBumpRequired: SemverBumpLevel = !backwardCompatible
      ? "MAJOR"
      : additiveChanges.length > 0
        ? "MINOR"
        : "PATCH";
    const expandAndContractAdvice = backwardCompatible
      ? ["Contract is backward compatible; safe to ship with Expand-and-Contract discipline."]
      : breakingChanges.map((item) => item.expandContractRemediation);

    const payload = {
      contractId,
      baselineSymbolsCount: baseline.length,
      candidateSymbolsCount: candidate.length,
      breakingChanges,
      additiveChanges,
      backwardCompatible,
      semverBumpRequired,
      expandAndContractAdvice,
    };
    const contractDiffDigestSha256 = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    return deepFreeze({ ...payload, contractDiffDigestSha256 });
  }
}
