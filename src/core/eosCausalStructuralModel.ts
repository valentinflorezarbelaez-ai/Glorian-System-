/**
 * Glorian System — Autonomous Causal Discovery & Structural Equation Modeling Engine (SCM)
 * Governed by SPEC-338 / CHANGE-200 / ADR-200-001..003
 *
 * Implements:
 *  1. Acyclic Structural Causal Model (SCM) construction with topological sorting
 *     and fail-closed cycle rejection (SCM_CYCLE_DETECTED).
 *  2. Exact graphical d-separation via Lauritzen-Spiegelhalter ancestral moralization
 *     (handling chains, forks/confounders, and collider v-structures A -> C <- B).
 *  3. Backdoor Criterion verification and OLS backdoor adjustment de-biasing.
 *  4. Surgical graph mutilation G_{X_bar} under Pearl's do(X := x) operator.
 *  5. Three-step counterfactual inference (Abduction -> Action -> Prediction).
 *
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies, <= 800 lines.
 */

import { createHash } from "node:crypto";
import type {
  BackdoorCriterionReport,
  CounterfactualInferenceReport,
  DSeparationQueryResult,
  InterventionalAteReport,
  ObservationalBackdoorAdjustmentReport,
  ScmAuditReceipt,
  ScmErrorCode,
  StructuralVariableSpec,
} from "./eosCausalStructuralModel.types.ts";

export * from "./eosCausalStructuralModel.types.ts";

export class ScmError extends Error {
  public readonly code: ScmErrorCode;

  constructor(code: ScmErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "ScmError";
  }
}

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Autonomous Causal Discovery & Structural Equation Modeling Core.
 */
export class EosCausalStructuralModelCore {
  private readonly variables = new Map<string, StructuralVariableSpec>();
  private readonly childrenMap = new Map<string, Set<string>>();

  /** Register a variable and its parent links, failing closed if a cycle is created. */
  public addVariable(spec: StructuralVariableSpec): void {
    if (
      !spec ||
      typeof spec.name !== "string" ||
      !spec.name.trim() ||
      !Array.isArray(spec.parents) ||
      typeof spec.mechanism !== "function"
    ) {
      throw new ScmError("SCM_INVALID_PARAMETERS", "variable name, parents array, and mechanism function are required");
    }
    if (spec.parents.includes(spec.name)) {
      throw new ScmError("SCM_CYCLE_DETECTED", `self-loop detected on variable ${spec.name}`);
    }
    for (const parent of spec.parents) {
      if (typeof parent !== "string" || !parent.trim() || !this.variables.has(parent)) {
        throw new ScmError("SCM_UNKNOWN_VARIABLE", `unknown parent variable ${String(parent)} for ${spec.name}`);
      }
    }
    // Check if any parent is a descendant of spec.name
    const descendants = this.getDescendants(spec.name);
    for (const parent of spec.parents) {
      if (descendants.has(parent)) {
        throw new ScmError("SCM_CYCLE_DETECTED", `adding edge ${parent} -> ${spec.name} creates a directed cycle`);
      }
    }

    // Remove old parent links if updating
    const prev = this.variables.get(spec.name);
    if (prev) {
      for (const oldParent of prev.parents) {
        this.childrenMap.get(oldParent)?.delete(spec.name);
      }
    }

    this.variables.set(spec.name, {
      name: spec.name,
      parents: [...new Set(spec.parents)],
      mechanism: spec.mechanism,
    });
    if (!this.childrenMap.has(spec.name)) {
      this.childrenMap.set(spec.name, new Set());
    }
    for (const parent of spec.parents) {
      if (!this.childrenMap.has(parent)) {
        this.childrenMap.set(parent, new Set());
      }
      this.childrenMap.get(parent)!.add(spec.name);
    }

    // Verify global topological sort succeeds
    this.getTopologicalOrder();
  }

  public addDirectedEdge(from: string, to: string, weight = 1.0): void {
    const targetSpec = this.variables.get(to);
    if (!this.variables.has(from) || !targetSpec) {
      throw new ScmError("SCM_UNKNOWN_VARIABLE", `both endpoints (${from}, ${to}) must be registered`);
    }
    if (from === to || this.getDescendants(to).has(from)) {
      throw new ScmError("SCM_CYCLE_DETECTED", `edge ${from} -> ${to} creates a directed cycle`);
    }
    const nextParents = targetSpec.parents.includes(from) ? targetSpec.parents : [...targetSpec.parents, from];
    const prevMech = targetSpec.mechanism;
    this.addVariable({
      name: to,
      parents: nextParents,
      mechanism: (pa) => prevMech(pa) + weight * (pa[from] ?? 0),
    });
  }

  public getParents(variable: string): string[] {
    const spec = this.variables.get(variable);
    if (!spec) {
      throw new ScmError("SCM_UNKNOWN_VARIABLE", `unknown variable ${variable}`);
    }
    return [...spec.parents];
  }

  public getAncestors(nodes: Iterable<string>): Set<string> {
    if (nodes === null || nodes === undefined || typeof (nodes as Iterable<string>)[Symbol.iterator] !== "function") {
      throw new ScmError("SCM_INVALID_PARAMETERS", "nodes must be an iterable");
    }
    const visited = new Set<string>();
    const queue: string[] = [];
    for (const n of nodes) {
      if (!this.variables.has(n)) {
        throw new ScmError("SCM_UNKNOWN_VARIABLE", `unknown variable ${n}`);
      }
      visited.add(n);
      queue.push(n);
    }
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const spec = this.variables.get(cur);
      if (!spec) continue;
      for (const p of spec.parents) {
        if (!visited.has(p)) {
          visited.add(p);
          queue.push(p);
        }
      }
    }
    return visited;
  }

  public getDescendants(node: string): Set<string> {
    const visited = new Set<string>();
    const queue = [...(this.childrenMap.get(node) ?? [])];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const child of this.childrenMap.get(cur) ?? []) {
        if (!visited.has(child)) queue.push(child);
      }
    }
    return visited;
  }

  /** Kahn's algorithm for deterministic topological ordering. */
  public getTopologicalOrder(): string[] {
    const inDegree = new Map<string, number>();
    for (const [name, spec] of this.variables) {
      inDegree.set(name, spec.parents.filter((p) => this.variables.has(p)).length);
    }
    const queue = Array.from(inDegree.entries())
      .filter(([, deg]) => deg === 0)
      .map(([name]) => name)
      .sort();

    const order: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      order.push(u);
      const children = Array.from(this.childrenMap.get(u) ?? []).sort();
      for (const v of children) {
        if (!inDegree.has(v)) continue;
        const nextDeg = inDegree.get(v)! - 1;
        inDegree.set(v, nextDeg);
        if (nextDeg === 0) {
          queue.push(v);
          queue.sort();
        }
      }
    }

    if (order.length !== this.variables.size) {
      throw new ScmError("SCM_CYCLE_DETECTED", "causal graph contains a directed cycle");
    }
    return order;
  }

  // ---------------------------------------------------------------------------
  // Rung 1: Lauritzen-Spiegelhalter Ancestral Moralization d-Separation (FR-2)
  // ---------------------------------------------------------------------------

  /**
   * Test whether `source` and `target` are d-separated by `conditionedOn`
   * using the exact Lauritzen-Spiegelhalter ancestral moralization algorithm:
   *  1. Restrict G to Anc({source, target} U conditionedOn).
   *  2. Moralize: connect all pairs of parents sharing a child in the ancestral subgraph,
   *     then drop edge directions.
   *  3. Remove `conditionedOn` and test undirected connectivity between source and target.
   */
  public isDSeparated(
    source: string,
    target: string,
    conditionedOn: ReadonlyArray<string> = [],
  ): DSeparationQueryResult {
    return this.isDSeparatedWithIgnoredEdges(source, target, conditionedOn, new Set());
  }

  private isDSeparatedWithIgnoredEdges(
    source: string,
    target: string,
    conditionedOn: ReadonlyArray<string>,
    ignoredDirectedEdges: Set<string>,
  ): DSeparationQueryResult {
    if (!Array.isArray(conditionedOn)) {
      throw new ScmError("SCM_INVALID_PARAMETERS", "conditionedOn must be an array");
    }
    if (!this.variables.has(source) || !this.variables.has(target)) {
      throw new ScmError("SCM_UNKNOWN_VARIABLE", `unknown endpoint (${source}, ${target})`);
    }
    for (const z of conditionedOn) {
      if (!this.variables.has(z)) {
        throw new ScmError("SCM_UNKNOWN_VARIABLE", `unknown conditioning variable ${z}`);
      }
    }
    const zSet = new Set(conditionedOn);
    const seeds = new Set<string>([source, target, ...conditionedOn]);

    // Compute ancestors respecting ignoredDirectedEdges
    const ancestral = new Set<string>(seeds);
    const ancQueue = [...seeds];
    while (ancQueue.length > 0) {
      const cur = ancQueue.shift()!;
      const spec = this.variables.get(cur);
      if (!spec) continue;
      for (const p of spec.parents) {
        if (ignoredDirectedEdges.has(`${p}->${cur}`)) continue;
        if (!ancestral.has(p)) {
          ancestral.add(p);
          ancQueue.push(p);
        }
      }
    }

    // Build undirected moral graph over `ancestral`
    const adj = new Map<string, Set<string>>();
    for (const node of ancestral) adj.set(node, new Set());
    const link = (a: string, b: string) => {
      if (a === b) return;
      adj.get(a)!.add(b);
      adj.get(b)!.add(a);
    };

    for (const node of ancestral) {
      const spec = this.variables.get(node)!;
      const activeParents = spec.parents.filter((p) => ancestral.has(p) && !ignoredDirectedEdges.has(`${p}->${node}`));
      for (const p of activeParents) {
        link(p, node);
      }
      // Marry co-parents of `node`
      for (let i = 0; i < activeParents.length; i++) {
        for (let j = i + 1; j < activeParents.length; j++) {
          link(activeParents[i], activeParents[j]);
        }
      }
    }

    // BFS from `source` to `target` avoiding `zSet`
    if (zSet.has(source) || zSet.has(target)) {
      return {
        source,
        target,
        conditionedOn: [...zSet],
        dSeparated: true,
        ancestralSubgraphNodes: [...ancestral].sort(),
      };
    }

    const visited = new Set<string>([source]);
    const bfs = [source];
    let reachable = false;
    while (bfs.length > 0) {
      const u = bfs.shift()!;
      if (u === target) {
        reachable = true;
        break;
      }
      for (const v of adj.get(u) ?? []) {
        if (!visited.has(v) && !zSet.has(v)) {
          visited.add(v);
          bfs.push(v);
        }
      }
    }

    return {
      source,
      target,
      conditionedOn: [...zSet],
      dSeparated: !reachable,
      ancestralSubgraphNodes: [...ancestral].sort(),
    };
  }

  // ---------------------------------------------------------------------------
  // Rung 2: Backdoor Criterion & Surgical do(X := x) Interventions (FR-3, FR-4)
  // ---------------------------------------------------------------------------

  /**
   * Pearl's Backdoor Criterion: a set Z satisfies the backdoor criterion relative to (X, Y) iff:
   *  1. No node in Z is a descendant of X; and
   *  2. Z d-separates X and Y in the graph G_{X_underbar} obtained by deleting all outgoing edges from X.
   */
  public verifyBackdoorCriterion(
    treatment: string,
    outcome: string,
    candidateSet: ReadonlyArray<string>,
  ): BackdoorCriterionReport {
    if (!Array.isArray(candidateSet)) {
      throw new ScmError("SCM_INVALID_PARAMETERS", "candidateSet must be an array");
    }
    if (!this.variables.has(treatment) || !this.variables.has(outcome)) {
      throw new ScmError("SCM_UNKNOWN_VARIABLE", `unknown treatment or outcome (${treatment}, ${outcome})`);
    }
    const descendantsOfX = this.getDescendants(treatment);
    const containsDescendantsOfTreatment = candidateSet.some((z) => z === treatment || descendantsOfX.has(z));

    // Delete all outgoing edges X -> child (forming G_{X_underbar})
    const ignoredOutgoing = new Set<string>();
    for (const child of this.childrenMap.get(treatment) ?? []) {
      ignoredOutgoing.add(`${treatment}->${child}`);
    }
    const dsep = this.isDSeparatedWithIgnoredEdges(treatment, outcome, candidateSet, ignoredOutgoing);
    const blocksAllBackdoorPaths = dsep.dSeparated;

    return {
      treatment,
      outcome,
      candidateSet: [...candidateSet],
      containsDescendantsOfTreatment,
      blocksAllBackdoorPaths,
      validBackdoorSet: !containsDescendantsOfTreatment && blocksAllBackdoorPaths,
    };
  }

  /**
   * Construct a mutilated SCM G_{X_bar} under do(interventions): severs all incoming edges
   * into each intervened variable and replaces its mechanism with the clamped constant.
   */
  public mutilateGraph(interventions: Record<string, number>): EosCausalStructuralModelCore {
    if (!isPlainRecord(interventions)) {
      throw new ScmError("SCM_INVALID_PARAMETERS", "interventions must be a plain object");
    }
    for (const [k, v] of Object.entries(interventions)) {
      if (!this.variables.has(k)) {
        throw new ScmError("SCM_UNKNOWN_VARIABLE", `cannot intervene on unknown variable ${k}`);
      }
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new ScmError("SCM_INVALID_PARAMETERS", `non-finite intervention for ${k}`);
      }
    }
    const mutilated = new EosCausalStructuralModelCore();
    for (const name of this.getTopologicalOrder()) {
      const spec = this.variables.get(name)!;
      if (Object.prototype.hasOwnProperty.call(interventions, name)) {
        const clampedVal = interventions[name];
        mutilated.addVariable({
          name,
          parents: [],
          mechanism: () => clampedVal,
        });
      } else {
        mutilated.addVariable({
          name,
          parents: [...spec.parents],
          mechanism: spec.mechanism,
        });
      }
    }
    return mutilated;
  }

  /** Evaluate all endogenous variables in topological order given exogenous noise U. */
  public evaluateForward(
    exogenousNoise: Record<string, number> = {},
    interventions: Record<string, number> = {},
  ): Record<string, number> {
    if (!isPlainRecord(exogenousNoise) || !isPlainRecord(interventions)) {
      throw new ScmError("SCM_INVALID_PARAMETERS", "exogenousNoise and interventions must be plain objects");
    }
    for (const [k, v] of Object.entries(exogenousNoise)) {
      if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v))) {
        throw new ScmError("SCM_INVALID_PARAMETERS", `non-finite exogenous noise for ${k}`);
      }
    }
    const model = Object.keys(interventions).length > 0 ? this.mutilateGraph(interventions) : this;
    const values: Record<string, number> = {};
    for (const name of model.getTopologicalOrder()) {
      if (Object.prototype.hasOwnProperty.call(interventions, name)) {
        values[name] = interventions[name];
      } else {
        const spec = model.variables.get(name)!;
        const parentVals: Record<string, number> = {};
        for (const p of spec.parents) parentVals[p] = values[p];
        values[name] = spec.mechanism(parentVals) + (exogenousNoise[name] ?? 0);
      }
    }
    return values;
  }

  /** Compute exact interventional Average Treatment Effect E[Y | do(X = x1)] - E[Y | do(X = x0)]. */
  public computeInterventionalAte(
    treatment: string,
    outcome: string,
    treatedValue = 1,
    controlValue = 0,
    exogenousMeans: Record<string, number> = {},
  ): InterventionalAteReport {
    if (!this.variables.has(outcome)) {
      throw new ScmError("SCM_UNKNOWN_VARIABLE", `unknown variable ${outcome}`);
    }
    if (!Number.isFinite(treatedValue) || !Number.isFinite(controlValue)) {
      throw new ScmError("SCM_INVALID_PARAMETERS", "treatedValue and controlValue must be finite numbers");
    }
    const severedParents = this.getParents(treatment);
    const treatedRun = this.evaluateForward(exogenousMeans, { [treatment]: treatedValue });
    const controlRun = this.evaluateForward(exogenousMeans, { [treatment]: controlValue });
    const y1 = treatedRun[outcome];
    const y0 = controlRun[outcome];

    return {
      treatment,
      outcome,
      treatedValue,
      controlValue,
      expectedOutcomeTreated: y1,
      expectedOutcomeControl: y0,
      trueInterventionalAte: y1 - y0,
      severedParents,
    };
  }

  /**
   * Compare naive observational regression E[Y | X] against backdoor-adjusted regression
   * E_Z[E[Y | X, Z]] over deterministic pseudo-random observational realizations.
   */
  public estimateBackdoorAdjustedAte(params: {
    treatment: string;
    outcome: string;
    adjustmentSet: ReadonlyArray<string>;
    samples: ReadonlyArray<Record<string, number>>;
    trueInterventionalAte: number;
  }): ObservationalBackdoorAdjustmentReport {
    if (
      !params ||
      !Array.isArray(params.samples) ||
      params.samples.length < 2 ||
      !Number.isFinite(params.trueInterventionalAte)
    ) {
      throw new ScmError(
        "SCM_INVALID_PARAMETERS",
        "at least 2 observational samples and finite trueInterventionalAte are required",
      );
    }
    const { treatment, outcome, adjustmentSet, samples, trueInterventionalAte } = params;
    const check = this.verifyBackdoorCriterion(treatment, outcome, adjustmentSet);
    if (!check.validBackdoorSet) {
      throw new ScmError(
        "SCM_BACKDOOR_VIOLATION",
        `set {${adjustmentSet.join(", ")}} violates the backdoor criterion for (${treatment}, ${outcome})`,
      );
    }
    for (const row of samples) {
      if (
        !isPlainRecord(row) ||
        typeof row[treatment] !== "number" ||
        !Number.isFinite(row[treatment]) ||
        typeof row[outcome] !== "number" ||
        !Number.isFinite(row[outcome]) ||
        adjustmentSet.some((z) => typeof row[z] !== "number" || !Number.isFinite(row[z]))
      ) {
        throw new ScmError("SCM_INVALID_PARAMETERS", "sample contains missing or non-finite variable values");
      }
    }

    // 1. Naive simple linear regression Y ~ 1 + X
    const n = samples.length;
    let sumX = 0;
    let sumY = 0;
    for (const row of samples) {
      sumX += row[treatment];
      sumY += row[outcome];
    }
    const meanX = sumX / n;
    const meanY = sumY / n;
    let covXY = 0;
    let varX = 0;
    for (const row of samples) {
      const dx = row[treatment] - meanX;
      covXY += dx * (row[outcome] - meanY);
      varX += dx * dx;
    }
    const naiveObservationalSlope = covXY / Math.max(1e-12, varX);

    // 2. Backdoor-adjusted multiple linear regression Y ~ 1 + X + Z_1 + ... + Z_k
    const cols = 2 + adjustmentSet.length;
    const xtx: number[][] = Array.from({ length: cols }, () => new Array<number>(cols).fill(0));
    const xty = new Array<number>(cols).fill(0);

    for (const row of samples) {
      const feat = [1, row[treatment], ...adjustmentSet.map((z) => row[z])];
      const y = row[outcome];
      for (let i = 0; i < cols; i++) {
        xty[i] += feat[i] * y;
        for (let j = i; j < cols; j++) {
          xtx[i][j] += feat[i] * feat[j];
        }
      }
    }
    for (let i = 0; i < cols; i++) {
      xtx[i][i] += 1e-10;
      for (let j = 0; j < i; j++) xtx[i][j] = xtx[j][i];
    }

    const beta = this.solveLinearSystem(xtx, xty);
    const backdoorAdjustedAte = beta[1];

    return {
      sampleCount: n,
      naiveObservationalSlope,
      backdoorAdjustedAte,
      trueInterventionalAte,
      confoundingBias: naiveObservationalSlope - trueInterventionalAte,
      adjustedEstimationError: Math.abs(backdoorAdjustedAte - trueInterventionalAte),
    };
  }

  // ---------------------------------------------------------------------------
  // Rung 3: Pearl's Three-Step Counterfactual Inference (FR-5)
  // ---------------------------------------------------------------------------

  /**
   * Compute unit-level counterfactual outcome Y_{interventions}(u) given factual evidence:
   *  Step 1 (Abduction): u_i = factual[i] - f_i(factual_parents)
   *  Step 2 (Action):    Construct mutilated model G_{interventions}
   *  Step 3 (Prediction): Evaluate G_{interventions} forward with abducted u.
   */
  public inferCounterfactual(params: {
    factualEvidence: Record<string, number>;
    interventions: Record<string, number>;
    targetVariable: string;
  }): CounterfactualInferenceReport {
    if (!params || !isPlainRecord(params.factualEvidence) || !isPlainRecord(params.interventions)) {
      throw new ScmError("SCM_INVALID_PARAMETERS", "factualEvidence and interventions must be plain objects");
    }
    const { factualEvidence, interventions, targetVariable } = params;
    const order = this.getTopologicalOrder();
    for (const v of order) {
      if (
        !Object.prototype.hasOwnProperty.call(factualEvidence, v) ||
        typeof factualEvidence[v] !== "number" ||
        !Number.isFinite(factualEvidence[v])
      ) {
        throw new ScmError("SCM_INVALID_PARAMETERS", `missing or non-finite factual value for variable ${v}`);
      }
    }
    if (!this.variables.has(targetVariable)) {
      throw new ScmError("SCM_UNKNOWN_VARIABLE", `unknown target variable ${targetVariable}`);
    }

    // Step 1: Abduction
    const abductedExogenousNoise: Record<string, number> = {};
    for (const v of order) {
      const spec = this.variables.get(v)!;
      const pa: Record<string, number> = {};
      for (const p of spec.parents) pa[p] = factualEvidence[p];
      abductedExogenousNoise[v] = factualEvidence[v] - spec.mechanism(pa);
    }

    // Step 2 & Step 3: Action (graph mutilation) + Prediction
    const counterfactualAssignment = this.evaluateForward(abductedExogenousNoise, interventions);
    const factualTargetValue = factualEvidence[targetVariable];
    const counterfactualTargetValue = counterfactualAssignment[targetVariable];

    return {
      factualEvidence: { ...factualEvidence },
      abductedExogenousNoise,
      interventions: { ...interventions },
      counterfactualAssignment,
      targetVariable,
      factualTargetValue,
      counterfactualTargetValue,
      individualTreatmentEffect: counterfactualTargetValue - factualTargetValue,
    };
  }

  /**
   * Build canonical confounded + collider benchmark SCM:
   *  Z (confounder) -> X (treatment, weight 1.5), Z -> Y (outcome, weight 3.0)
   *  X -> Y (true causal effect = 2.0)
   *  X -> C <- Y (collider v-structure) and C -> D (descendant of collider).
   */
  public static createBenchmarkConfoundedColliderScm(): EosCausalStructuralModelCore {
    const scm = new EosCausalStructuralModelCore();
    scm.addVariable({ name: "Z", parents: [], mechanism: () => 0 });
    scm.addVariable({ name: "X", parents: ["Z"], mechanism: (pa) => 1.5 * pa.Z });
    scm.addVariable({ name: "Y", parents: ["X", "Z"], mechanism: (pa) => 2.0 * pa.X + 3.0 * pa.Z });
    scm.addVariable({ name: "C", parents: ["X", "Y"], mechanism: (pa) => 0.8 * pa.X + 0.6 * pa.Y });
    scm.addVariable({ name: "D", parents: ["C"], mechanism: (pa) => 1.2 * pa.C });
    return scm;
  }

  // ---------------------------------------------------------------------------
  // Audit (FR-6)
  // ---------------------------------------------------------------------------

  public audit(): ScmAuditReceipt {
    const scm = EosCausalStructuralModelCore.createBenchmarkConfoundedColliderScm();

    let dagAcyclicEnforced = false;
    try {
      scm.addDirectedEdge("Y", "Z");
    } catch (err) {
      dagAcyclicEnforced = err instanceof ScmError && err.code === "SCM_CYCLE_DETECTED";
    }

    // Collider d-separation check: {Z} d-separates X and Y if X->Y is absent; in a pure collider graph A -> C <- B -> D:
    const colliderGraph = new EosCausalStructuralModelCore();
    colliderGraph.addVariable({ name: "A", parents: [], mechanism: () => 0 });
    colliderGraph.addVariable({ name: "B", parents: [], mechanism: () => 0 });
    colliderGraph.addVariable({ name: "C", parents: ["A", "B"], mechanism: (pa) => pa.A + pa.B });
    colliderGraph.addVariable({ name: "D", parents: ["C"], mechanism: (pa) => pa.C });

    const marginalSep = colliderGraph.isDSeparated("A", "B", []).dSeparated;
    const condOnCollider = colliderGraph.isDSeparated("A", "B", ["C"]).dSeparated;
    const condOnDescendant = colliderGraph.isDSeparated("A", "B", ["D"]).dSeparated;
    const colliderDsepVerified = marginalSep === true && condOnCollider === false && condOnDescendant === false;

    const ateReport = scm.computeInterventionalAte("X", "Y", 1, 0);
    const doInterventionExact = Math.abs(ateReport.trueInterventionalAte - 2.0) < 1e-12;

    // Generate 60 deterministic observational samples to verify backdoor de-confounding
    const samples: Array<Record<string, number>> = [];
    for (let i = 1; i <= 60; i++) {
      const uZ = Math.sin(i * 1.7) * 2.0;
      const uX = Math.cos(i * 2.3) * 0.8;
      const uY = Math.sin(i * 3.1) * 0.05;
      samples.push(scm.evaluateForward({ Z: uZ, X: uX, Y: uY, C: 0, D: 0 }));
    }
    const adjReport = scm.estimateBackdoorAdjustedAte({
      treatment: "X",
      outcome: "Y",
      adjustmentSet: ["Z"],
      samples,
      trueInterventionalAte: ateReport.trueInterventionalAte,
    });
    const backdoorDeconfounded = Math.abs(adjReport.confoundingBias) > 1.0 && adjReport.adjustedEstimationError < 0.02;

    // Counterfactual consistency & effect check
    const factual = scm.evaluateForward({ Z: 2.0, X: 0.5, Y: -0.3, C: 0, D: 0 });
    const cfSame = scm.inferCounterfactual({
      factualEvidence: factual,
      interventions: { X: factual.X },
      targetVariable: "Y",
    });
    const cfShifted = scm.inferCounterfactual({
      factualEvidence: factual,
      interventions: { X: factual.X + 1.0 },
      targetVariable: "Y",
    });
    const counterfactualConsistent =
      Math.abs(cfSame.counterfactualTargetValue - factual.Y) < 1e-12 &&
      Math.abs(cfShifted.individualTreatmentEffect - 2.0) < 1e-12;

    const allPassed =
      dagAcyclicEnforced &&
      colliderDsepVerified &&
      backdoorDeconfounded &&
      doInterventionExact &&
      counterfactualConsistent;

    const round = (v: number) => Number(v.toFixed(6));
    const body = {
      specRef: "SPEC-338" as const,
      dagAcyclicEnforced,
      colliderDsepVerified,
      backdoorDeconfounded,
      doInterventionExact,
      counterfactualConsistent,
      trueAte: round(ateReport.trueInterventionalAte),
      naiveBiasedSlope: round(adjReport.naiveObservationalSlope),
      backdoorAdjustedAte: round(adjReport.backdoorAdjustedAte),
      allPassed,
    };
    return { ...body, sha256Digest: sha256Hex(JSON.stringify(body)) };
  }

  private solveLinearSystem(M: number[][], rhs: number[]): number[] {
    const n = rhs.length;
    const aug = M.map((row, i) => [...row, rhs[i]]);
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(aug[r][col]) > Math.abs(aug[pivot][col])) pivot = r;
      }
      if (pivot !== col) {
        const tmp = aug[col];
        aug[col] = aug[pivot];
        aug[pivot] = tmp;
      }
      const div = aug[col][col];
      for (let r = col + 1; r < n; r++) {
        const f = aug[r][col] / div;
        for (let c = col; c <= n; c++) aug[r][c] -= f * aug[col][c];
      }
    }
    const x = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = aug[i][n];
      for (let j = i + 1; j < n; j++) s -= aug[i][j] * x[j];
      x[i] = s / aug[i][i];
    }
    return x;
  }
}
