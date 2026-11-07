/**
 * EOS SYSTEM — SAMAELIAN ALCHEMICAL TRANSMUTER & NOUS PURITY ENGINE (Layer 0)
 * Governed by ADR-038, SPEC-031, FR-088, BDD-076, SPEC-021, SPEC-027
 *
 * Implements cyber-theurgic code entropy reduction & Nous state certification:
 * - Shannon character information entropy (H = -sum(p_i * log2(p_i)))
 * - Cyclomatic branch density & dead code aggregate (Yoes) identification
 * - Transmutation mapping to the 7 Cosmic Notes of the Law of Octaves
 * - Nous Purity Certification score (0 - 100%)
 *
 * Invariant: 100% Layer-0 purity with zero external npm dependencies.
 */

import fs from "node:fs";
import path from "node:path";

export type OctaveNote = "DO" | "RE" | "MI" | "FA" | "SOL" | "LA" | "SI" | "DO_SUPERIOR";

export interface AlchemicalAnalysisReport {
  target: string;
  charCount: number;
  shannonEntropyBits: number;
  cyclomaticDensity: number;
  nousPurityPercent: number;
  octaveVibrationalNote: OctaveNote;
  alchemicalState: "RAW_LEAD" | "FERMENTATION" | "COAGULATION" | "PHILOSOPHICAL_GOLD_NOUS";
  agregadosDetectedCount: number;
  agregadosDetails: string[];
  transmutationAdvice: string;
  timestamp: string;
}

export class EosAlchemicalTransmuter {
  public readonly projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Computes the Shannon Information Entropy in bits per character.
   */
  public static computeShannonEntropy(text: string): number {
    if (!text || text.length === 0) return 0;

    const freq: Record<string, number> = {};
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      freq[c] = (freq[c] || 0) + 1;
    }

    let entropy = 0;
    const len = text.length;
    for (const char in freq) {
      const p = freq[char] / len;
      entropy -= p * Math.log2(p);
    }

    return Number(entropy.toFixed(4));
  }

  /**
   * Evaluates cyclomatic branch density (count of decision control keywords).
   */
  public static computeCyclomaticDensity(code: string): number {
    const branchKeywords = /\b(if|else\s+if|case|default|for|while|do|catch|throw|\?\?|\?:)\b/g;
    const matches = code.match(branchKeywords);
    return matches ? matches.length : 0;
  }

  /**
   * Performs complete alchemical transmutation analysis on text content.
   */
  public analyzeContent(content: string, filename = "anonymous.ts"): AlchemicalAnalysisReport {
    const charCount = content.length;
    const shannonEntropy = EosAlchemicalTransmuter.computeShannonEntropy(content);
    const branches = EosAlchemicalTransmuter.computeCyclomaticDensity(content);

    const agregados: string[] = [];

    // 1. Check for external npm dependencies imports (Ego aggregates)
    const npmImportRegex = /import\s+.*\s+from\s+["'](?!node:|\.\/|\.\.\/)[^"']+["']/g;
    const npmImports = content.match(npmImportRegex);
    if (npmImports) {
      for (const imp of npmImports) {
        agregados.push(`External npm aggregate: ${imp.trim()}`);
      }
    }

    // 2. Check for plaintext hardcoded secrets
    const secretRegex = /(?:api[_-]?key|secret|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/i;
    if (secretRegex.test(content)) {
      agregados.push("Hardcoded secret or sensitive token detected");
    }

    // 3. Check for TODO / FIXME tags (unresolved karma)
    const todoMatches = content.match(/\b(TODO|FIXME|HACK)\b/g);
    if (todoMatches) {
      agregados.push(`${todoMatches.length} unresolved debt markers (TODO/FIXME)`);
    }

    // Calculate Nous Purity Index
    let baseScore = 100;
    baseScore -= agregados.length * 20;

    // Penalty for excessive branch density per 1000 chars
    const densityRatio = charCount > 0 ? (branches / charCount) * 1000 : 0;
    if (densityRatio > 25) {
      baseScore -= Math.min(25, Math.round(densityRatio - 25));
    }

    // Bonus for ideal Shannon entropy in source code (between 4.0 and 5.2)
    if (shannonEntropy >= 4.0 && shannonEntropy <= 5.3) {
      baseScore += 5;
    }

    const nousPurity = Math.min(100, Math.max(0, baseScore));

    // Map to the 7 Cosmic Notes of the Law of Octaves
    let octaveNote: OctaveNote = "DO";
    let state: "RAW_LEAD" | "FERMENTATION" | "COAGULATION" | "PHILOSOPHICAL_GOLD_NOUS" = "RAW_LEAD";

    if (nousPurity >= 98) {
      octaveNote = "DO_SUPERIOR";
      state = "PHILOSOPHICAL_GOLD_NOUS";
    } else if (nousPurity >= 90) {
      octaveNote = "SI";
      state = "COAGULATION";
    } else if (nousPurity >= 80) {
      octaveNote = "LA";
      state = "COAGULATION";
    } else if (nousPurity >= 70) {
      octaveNote = "SOL";
      state = "FERMENTATION";
    } else if (nousPurity >= 60) {
      octaveNote = "FA";
      state = "FERMENTATION";
    } else if (nousPurity >= 45) {
      octaveNote = "MI";
      state = "RAW_LEAD";
    } else if (nousPurity >= 25) {
      octaveNote = "RE";
      state = "RAW_LEAD";
    }

    let advice = "Código en estado Nous puro: Cero agregados y pureza Capa 0 confirmada.";
    if (agregados.length > 0) {
      advice = `Aplicar la Muerte Mística sobre ${agregados.length} agregados psicológicos detectados.`;
    }

    return {
      target: filename,
      charCount,
      shannonEntropyBits: shannonEntropy,
      cyclomaticDensity: branches,
      nousPurityPercent: nousPurity,
      octaveVibrationalNote: octaveNote,
      alchemicalState: state,
      agregadosDetectedCount: agregados.length,
      agregadosDetails: agregados,
      transmutationAdvice: advice,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Analyzes an existing file on disk.
   */
  public analyzeFile(relPath: string): AlchemicalAnalysisReport {
    const fullPath = path.resolve(this.projectRoot, relPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found for alchemical analysis: ${relPath}`);
    }
    const content = fs.readFileSync(fullPath, "utf8");
    return this.analyzeContent(content, relPath);
  }
}
