import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-269: Integridad y presencia del whitepaper formal en docs/whitepaper/ (SPEC-097)", () => {
  const whitepaperPath = path.join(projectRoot, "docs", "whitepaper", "EOS_SYSTEM_IEEE_FORMAL_SPECIFICATION.md");
  assert.ok(fs.existsSync(whitepaperPath), "Whitepaper document must exist");

  const content = fs.readFileSync(whitepaperPath, "utf8");

  // 1. Verify structure and key academic sections
  assert.ok(content.includes("### Abstract"), "Must include Abstract");
  assert.ok(content.includes("## I. Introduction & The Zero Vibe Coding Doctrine"), "Must include Section I");
  assert.ok(content.includes("## II. Mathematical Foundations & Distributed System Theorems"), "Must include Section II");
  assert.ok(content.includes("## III. The 8-State Epistemic Taxonomy & Evidence Hierarchy"), "Must include Section III");
  assert.ok(content.includes("## IV. Clean / Hexagonal Layer-0 System Architecture"), "Must include Section IV");
  assert.ok(content.includes("## V. Empirical Benchmark Evaluation"), "Must include Section V");
  assert.ok(content.includes("## VI. Comparative Evaluation with Industry Standards"), "Must include Section VI");
  assert.ok(content.includes("## VII. Conclusion & Reproducibility Guarantees"), "Must include Section VII");
  assert.ok(content.includes("## References"), "Must include Academic References");

  // 2. Verify all 8 Epistemic States are formally defined
  const states = [
    "AUDIT_EXECUTED",
    "FINDINGS_IDENTIFIED",
    "REMEDIATION_REQUIRED",
    "REMEDIATION_IN_PROGRESS",
    "REVALIDATION_REQUIRED",
    "VERIFIED",
    "PRODUCTION_READY_WITHIN_TESTED_SCOPE",
    "PRODUCTION_READY"
  ];
  for (const s of states) {
    assert.ok(content.includes(s), `Must formally define epistemic state: ${s}`);
  }

  // 3. Verify Layer-0 zero-dependency claim
  assert.ok(content.includes("dependencies: {}"), "Must document zero external dependencies");
});

test("BDD-270: Coherencia matemática de teoremas y formulaciones distribuidas (SPEC-097)", () => {
  const whitepaperPath = path.join(projectRoot, "docs", "whitepaper", "EOS_SYSTEM_IEEE_FORMAL_SPECIFICATION.md");
  const content = fs.readFileSync(whitepaperPath, "utf8");

  // 1. Verify Theorem 1: Spanner TrueTime commit-wait linearizability
  assert.ok(content.includes("Theorem 1 (Commit-Wait Linearizability):"), "Theorem 1 must be stated");
  assert.ok(content.includes("t_{\\text{commit}}"), "TrueTime commit formula must be present");
  assert.ok(content.includes("t_{\\text{earliest}}"), "TrueTime earliest bound must be present");

  // 2. Verify Theorem 2: Shamir Secret Sharing over finite field F_p
  assert.ok(content.includes("Theorem 2 (Lagrange Invertibility & Perfect Secrecy):"), "Theorem 2 must be stated");
  assert.ok(content.includes("\\ell_i(0) = \\prod_{\\substack{j=1 \\\\ j \\neq i}}^k \\frac{-x_j}{x_i - x_j} \\pmod p"), "Lagrange polynomial formula must be exact");

  // 3. Verify Theorem 3: Kademlia XOR Metric Space
  assert.ok(content.includes("Theorem 3 (Metric Space Compliance & Unidirectional Routing):"), "Theorem 3 must be stated");
  assert.ok(content.includes("d(x, y) = x \\oplus y"), "XOR metric formula must be present");
  assert.ok(content.includes("d(x, z) \\le d(x, y) \\oplus d(y, z)"), "Triangle inequality formulation must be present");

  // 4. Verify Theorem 4: TLA+ Temporal Inductive Invariant Preservation
  assert.ok(content.includes("Theorem 4: Temporal Inductive Invariant Preservation (TLA+)"), "Theorem 4 must be stated");
  assert.ok(content.includes("\\operatorname{Init}(s) \\implies \\operatorname{Inv}(s)"), "TLA+ induction base must be present");
  assert.ok(content.includes("\\operatorname{Next}(s, s')"), "TLA+ next action transition must be present");
});
