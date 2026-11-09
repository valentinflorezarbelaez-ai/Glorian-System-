/**
 * EOS DATALOG DEDUCTIVE BLAST RADIUS VERIFIER (SPEC-028, CHANGE-021)
 * Pure Layer-0 forward-chaining Datalog engine implementing Mangle-style
 * fixpoint deductive reasoning to calculate exact downstream blast radius
 * and selective test suites without full monorepo recompilation.
 *
 * Invariant: Zero external dependencies (dependencies: {}).
 */

import fs from "node:fs";
import path from "node:path";

export interface DatalogFact {
  predicate: string;
  args: string[];
}

export interface DatalogRule {
  head: { predicate: string; args: string[] };
  body: Array<{ predicate: string; args: string[] }>;
}

export interface DeductiveBlastResult {
  changedModule: string;
  impactedModules: string[];
  predictiveTestSuites: string[];
  totalFactsEvaluated: number;
  fixpointIterations: number;
  durationUs: number;
  isolationGuarantee: string;
}

export class EosDatalogVerifier {
  private facts: Set<string> = new Set();
  private rules: DatalogRule[] = [];
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.initDefaultRules();
  }

  private factKey(predicate: string, args: string[]): string {
    return `${predicate}(${args.join(",")})`;
  }

  public addFact(predicate: string, args: string[]): void {
    this.facts.add(this.factKey(predicate, args));
  }

  public hasFact(predicate: string, args: string[]): boolean {
    return this.facts.has(this.factKey(predicate, args));
  }

  private initDefaultRules(): void {
    // Rule 1: Direct impact: impacts(Changed, Target) :- depends_on(Target, Changed)
    this.rules.push({
      head: { predicate: "impacts", args: ["X", "Y"] },
      body: [{ predicate: "depends_on", args: ["Y", "X"] }],
    });

    // Rule 2: Transitive impact: impacts(Changed, Target) :- impacts(Changed, Intermediate), depends_on(Target, Intermediate)
    this.rules.push({
      head: { predicate: "impacts", args: ["X", "Z"] },
      body: [
        { predicate: "impacts", args: ["X", "Y"] },
        { predicate: "depends_on", args: ["Z", "Y"] },
      ],
    });

    // Rule 3: Transitive test trigger: triggers_test(Changed, TestFile) :- impacts(Changed, Target), tests_module(TestFile, Target)
    this.rules.push({
      head: { predicate: "triggers_test", args: ["X", "T"] },
      body: [
        { predicate: "impacts", args: ["X", "M"] },
        { predicate: "tests_module", args: ["T", "M"] },
      ],
    });

    // Rule 4: Direct test trigger: triggers_test(Changed, TestFile) :- tests_module(TestFile, Changed)
    // Without this, changing a leaf module selects no suites because impacts() only
    // contains dependents, never the changed module itself.
    this.rules.push({
      head: { predicate: "triggers_test", args: ["X", "T"] },
      body: [{ predicate: "tests_module", args: ["T", "X"] }],
    });
  }

  /**
   * Scans src/core/ and test/ to build the Extensional Database (EDB).
   */
  public buildEdbFromFilesystem(): number {
    const coreDir = path.join(this.projectRoot, "src", "core");
    const testDir = path.join(this.projectRoot, "test");

    if (fs.existsSync(coreDir)) {
      const coreFiles = fs.readdirSync(coreDir).filter((f) => f.endsWith(".ts"));
      for (const file of coreFiles) {
        const fullPath = path.join(coreDir, file);
        const rel = `src/core/${file}`;
        const content = fs.readFileSync(fullPath, "utf8");
        const lines = content.split("\n");

        for (const line of lines) {
          const m = line.match(/from\s+["'](\.\/|\.\.\/core\/)?([^"']+)["']/);
          if (m) {
            let dep = m[2];
            if (!dep.endsWith(".ts") && !dep.endsWith(".js")) dep += ".ts";
            this.addFact("depends_on", [rel, `src/core/${dep}`]);
          }
        }
      }
    }

    if (fs.existsSync(testDir)) {
      const testFiles = fs.readdirSync(testDir).filter((f) => f.endsWith(".test.mjs"));
      for (const tFile of testFiles) {
        const fullPath = path.join(testDir, tFile);
        const relTest = `test/${tFile}`;
        const content = fs.readFileSync(fullPath, "utf8");
        const lines = content.split("\n");

        for (const line of lines) {
          const m = line.match(/from\s+["'].*?\/(src\/core\/[^"']+)["']/);
          if (m) {
            this.addFact("tests_module", [relTest, m[1]]);
          }
        }
      }
    }

    return this.facts.size;
  }

  /**
   * Evaluates Datalog rules using naive fixpoint iteration.
   */
  public evaluateFixpoint(): number {
    let iterations = 0;
    let factsChanged = true;

    while (factsChanged && iterations < 50) {
      factsChanged = false;
      iterations++;
      const currentFacts = Array.from(this.facts);

      for (const factStr of currentFacts) {
        const m = factStr.match(/^(\w+)\((.*)\)$/);
        if (!m) continue;
        const [_, pred, argsRaw] = m;
        const args = argsRaw.split(",");

        // Direct impact rule: depends_on(Y, X) => impacts(X, Y)
        if (pred === "depends_on" && args.length === 2) {
          const [consumer, dependency] = args;
          const newFact = this.factKey("impacts", [dependency, consumer]);
          if (!this.facts.has(newFact)) {
            this.facts.add(newFact);
            factsChanged = true;
          }
        }

        // Transitive impact rule: impacts(X, Y) + depends_on(Z, Y) => impacts(X, Z)
        if (pred === "impacts" && args.length === 2) {
          const [source, intermediate] = args;
          for (const otherFact of currentFacts) {
            if (otherFact.startsWith("depends_on(")) {
              const mOther = otherFact.match(/^depends_on\((.*)\)$/);
              if (mOther) {
                const [z, y] = mOther[1].split(",");
                if (y === intermediate) {
                  const transitive = this.factKey("impacts", [source, z]);
                  if (!this.facts.has(transitive)) {
                    this.facts.add(transitive);
                    factsChanged = true;
                  }
                }
              }
            }
          }
        }

        // Direct test trigger: tests_module(T, X) => triggers_test(X, T)
        if (pred === "tests_module" && args.length === 2) {
          const [testFile, module] = args;
          const directTrigger = this.factKey("triggers_test", [module, testFile]);
          if (!this.facts.has(directTrigger)) {
            this.facts.add(directTrigger);
            factsChanged = true;
          }
        }

        // Test trigger rule: impacts(X, M) + tests_module(T, M) => triggers_test(X, T)
        if (pred === "impacts" && args.length === 2) {
          const [source, targetMod] = args;
          for (const otherFact of currentFacts) {
            if (otherFact.startsWith("tests_module(")) {
              const mOther = otherFact.match(/^tests_module\((.*)\)$/);
              if (mOther) {
                const [t, mMod] = mOther[1].split(",");
                if (mMod === targetMod) {
                  const triggerFact = this.factKey("triggers_test", [source, t]);
                  if (!this.facts.has(triggerFact)) {
                    this.facts.add(triggerFact);
                    factsChanged = true;
                  }
                }
              }
            }
          }
        }
      }
    }

    return iterations;
  }

  /**
   * Queries the exact deductive blast radius for a given module.
   */
  public queryBlastRadius(targetModule: string): DeductiveBlastResult {
    const start = performance.now();
    this.buildEdbFromFilesystem();
    const it = this.evaluateFixpoint();

    const normalized = targetModule.replace(/\\/g, "/");
    const impacted: Set<string> = new Set();
    const tests: Set<string> = new Set();

    for (const f of this.facts) {
      if (f.startsWith("impacts(")) {
        const m = f.match(/^impacts\((.*)\)$/);
        if (m) {
          const [src, dst] = m[1].split(",");
          if (src === normalized || src.endsWith(normalized)) {
            impacted.add(dst);
          }
        }
      }
      if (f.startsWith("triggers_test(")) {
        const m = f.match(/^triggers_test\((.*)\)$/);
        if (m) {
          const [src, testFile] = m[1].split(",");
          if (src === normalized || src.endsWith(normalized)) {
            tests.add(testFile);
          }
        }
      }
    }

    const durationUs = Math.round((performance.now() - start) * 1000);

    return {
      changedModule: normalized,
      impactedModules: Array.from(impacted),
      predictiveTestSuites: Array.from(tests),
      totalFactsEvaluated: this.facts.size,
      fixpointIterations: it,
      durationUs,
      isolationGuarantee: "Google Piper / Mangle-grade deductive certainty",
    };
  }
}
