/**
 * EOS MUTATION TESTING SABOTEUR (SPEC-028, CHANGE-021)
 * Automates the deliberate injection of AST bugs into source code
 * to verify the rigor of test suites (Killed Mutants vs. Survived Mutants).
 *
 * Invariant: Pure Layer-0 TypeScript (dependencies: {}).
 */

export interface CodeMutant {
  id: string;
  originalOp: string;
  mutatedOp: string;
  line: number;
  mutatedCode: string;
  status: "KILLED" | "SURVIVED" | "UNTESTED";
  killerError?: string;
}

export interface MutationReport {
  targetSnippet: string;
  totalMutants: number;
  killedMutants: number;
  survivedMutants: number;
  mutationScore: number; // 0 - 100%
  grade: "TIER_S_CERTIFIED" | "SURVIVED_MUTANTS_DETECTED";
  mutants: CodeMutant[];
  timestamp: string;
}

export class EosMutationTester {
  /**
   * Generates mutant variants by mutating operators in code.
   */
  public generateMutants(code: string): CodeMutant[] {
    const lines = code.split("\n");
    const mutants: CodeMutant[] = [];
    let mutantCounter = 0;

    const mutationRules = [
      { regex: /===/g, replacement: "!==" },
      { regex: /!==/g, replacement: "===" },
      { regex: />=/g, replacement: "<" },
      { regex: /<=/g, replacement: ">" },
      { regex: />/g, replacement: "<=" },
      { regex: /</g, replacement: ">=" },
      { regex: /\btrue\b/g, replacement: "false" },
      { regex: /\bfalse\b/g, replacement: "true" },
      { regex: /\+\s*1\b/g, replacement: "- 1" },
    ];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      // Skip comments
      if (line.trim().startsWith("//") || line.trim().startsWith("/*")) continue;

      for (const rule of mutationRules) {
        if (rule.regex.test(line)) {
          mutantCounter++;
          const mutatedLine = line.replace(rule.regex, rule.replacement);
          const mutatedLines = [...lines];
          mutatedLines[lineIdx] = mutatedLine;

          mutants.push({
            id: `MUT-${String(mutantCounter).padStart(4, "0")}`,
            originalOp: rule.regex.source,
            mutatedOp: rule.replacement,
            line: lineIdx + 1,
            mutatedCode: mutatedLines.join("\n"),
            status: "UNTESTED",
          });
        }
      }
    }

    return mutants;
  }

  /**
   * Runs a test runner function against each mutant.
   * If the test throws or returns false, the mutant is KILLED.
   * If the test passes quietly, the mutant SURVIVED (proving weak test assertion).
   */
  public evaluateTestSuite(originalCode: string, testRunner: (code: string) => void | boolean): MutationReport {
    const mutants = this.generateMutants(originalCode);
    let killed = 0;
    let survived = 0;

    for (const mutant of mutants) {
      try {
        const res = testRunner(mutant.mutatedCode);
        if (res === false) {
          mutant.status = "KILLED";
          killed++;
        } else {
          mutant.status = "SURVIVED";
          survived++;
        }
      } catch (err: any) {
        mutant.status = "KILLED";
        mutant.killerError = err?.message || String(err);
        killed++;
      }
    }

    const total = mutants.length;
    const score = total > 0 ? Number(((killed / total) * 100).toFixed(1)) : 100;
    const grade = score >= 80 ? "TIER_S_CERTIFIED" : "SURVIVED_MUTANTS_DETECTED";

    return {
      targetSnippet: originalCode.slice(0, 120) + "...",
      totalMutants: total,
      killedMutants: killed,
      survivedMutants: survived,
      mutationScore: score,
      grade,
      mutants,
      timestamp: new Date().toISOString(),
    };
  }
}
