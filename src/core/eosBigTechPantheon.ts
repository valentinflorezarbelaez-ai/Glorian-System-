/**
 * Educational references for the Big Tech section.
 *
 * These records describe local examples and their limits. They do not model
 * the referenced vendors or provide TLA+, chaos testing, or FDIR remediation.
 */

export interface BigTechCrownJewel {
  readonly id: string;
  readonly companyAndSystem: string;
  readonly engineeringBreakthrough: string;
  readonly eosSovereignTransmutation: string;
  readonly samaelianCorrespondence: string;
  readonly latencyOrInvariantTarget: string;
}

export type ChaosFaultScenarioId =
  | "secret-leak-attempt"
  | "orphan-ontology-link"
  | "spec-drift-mutation"
  | "heap-entropy-spike"
  | "race-condition-concurrent";

export interface BigTechScenarioDescription {
  readonly scenarioId: ChaosFaultScenarioId;
  readonly scenarioTitle: string;
  readonly example: string;
  readonly formulaReference: string;
}

export const BIGTECH_7_CROWN_JEWELS: readonly BigTechCrownJewel[] = [
  {
    id: "google-spanner-bazel",
    companyAndSystem: "Google · Spanner / Bazel",
    engineeringBreakthrough: "Distributed time and hermetic build patterns.",
    eosSovereignTransmutation: "EOS computes SHA-256 fingerprints for selected local data; this is not a distributed build system.",
    samaelianCorrespondence: "Metaphor used by the page; no clock or build guarantee.",
    latencyOrInvariantTarget: "No TrueTime or build performance metric is measured."
  },
  {
    id: "aws-tlaplus-nitro",
    companyAndSystem: "AWS · TLA+ / Nitro",
    engineeringBreakthrough: "Formal specification and model checking.",
    eosSovereignTransmutation: "The page displays formulas as references; no TLC model checker is run.",
    samaelianCorrespondence: "Metaphor used by the page; no formal proof is implied.",
    latencyOrInvariantTarget: "No state space or counterexample count is computed."
  },
  {
    id: "netflix-chaos-nasa-fdir",
    companyAndSystem: "Netflix · Chaos Monkey / NASA FDIR",
    engineeringBreakthrough: "Fault injection and fault detection, isolation, and recovery.",
    eosSovereignTransmutation: "The page displays a static scenario catalog.",
    samaelianCorrespondence: "Metaphor used by the page; no service is isolated or repaired.",
    latencyOrInvariantTarget: "No fault injection or MTTR measurement is performed."
  },
  {
    id: "stripe-idempotency-ledger",
    companyAndSystem: "Stripe · idempotency / financial ledgers",
    engineeringBreakthrough: "Safe retries and accounting invariants for payment operations.",
    eosSovereignTransmutation: "EOS has local memory previews; these are not payment transactions or a financial ledger.",
    samaelianCorrespondence: "Metaphor used by the page; no balance or payment guarantee.",
    latencyOrInvariantTarget: "No payment or double-entry invariant is checked."
  },
  {
    id: "meta-tao-buck2",
    companyAndSystem: "Meta · TAO / Buck2",
    engineeringBreakthrough: "Large-scale graph data and build systems.",
    eosSovereignTransmutation: "EOS provides local source graph analysis; it is not a distributed graph or build system.",
    samaelianCorrespondence: "Metaphor used by the page; no scale claim is implied.",
    latencyOrInvariantTarget: "No Meta-scale throughput or graph latency is measured."
  },
  {
    id: "apple-metal-unified",
    companyAndSystem: "Apple · Metal / Grand Central Dispatch",
    engineeringBreakthrough: "GPU programming, shared memory, and task scheduling.",
    eosSovereignTransmutation: "The page can measure a JavaScript loop; it does not execute Metal, CUDA, or GPU kernels.",
    samaelianCorrespondence: "Metaphor used by the page; no hardware property is implied.",
    latencyOrInvariantTarget: "No GPU latency, cache residency, or frame-rate target is measured."
  },
  {
    id: "linear-raycast-vercel",
    companyAndSystem: "Linear / Raycast · command palettes",
    engineeringBreakthrough: "Keyboard-first search and navigation.",
    eosSovereignTransmutation: "The native dialog searches and navigates local sections and commands.",
    samaelianCorrespondence: "Metaphor used by the page; no vendor integration is implied.",
    latencyOrInvariantTarget: "No sub-millisecond interaction or sync metric is promised."
  }
] as const;

export const BIGTECH_SCENARIO_CATALOG: Readonly<Record<ChaosFaultScenarioId, BigTechScenarioDescription>> = {
  "secret-leak-attempt": {
    scenarioId: "secret-leak-attempt",
    scenarioTitle: "Ejemplo de credencial guardada en un archivo",
    example: "Un actor intenta guardar una credencial en un archivo.",
    formulaReference: "□ (∀ commit ∈ Repo : PlainSecrets(commit) = ∅) ∧ ◇ QuarantineActive"
  },
  "orphan-ontology-link": {
    scenarioId: "orphan-ontology-link",
    scenarioTitle: "Ejemplo de tarea enlazada a un requisito inexistente",
    example: "Una tarea referencia un requisito que no existe en la especificación.",
    formulaReference: "□ (∀ t ∈ Tasks : ∃ s ∈ Specs : Linked(t, s)) ∧ ◇ GraphHarmonized"
  },
  "spec-drift-mutation": {
    scenarioId: "spec-drift-mutation",
    scenarioTitle: "Ejemplo de cambio sin requisito aprobado",
    example: "Un cambio de código no cuenta con un requisito aprobado asociado.",
    formulaReference: "□ (CodeChange ⇒ (SpecApproved ∧ AuthLevel ≥ 2)) ∧ ◇ DriftZero"
  },
  "heap-entropy-spike": {
    scenarioId: "heap-entropy-spike",
    scenarioTitle: "Ejemplo de carga con asignación elevada de memoria",
    example: "Una carga sintética puede aumentar las asignaciones de memoria.",
    formulaReference: "□ (HeapAllocInHotLoop = 0 ∧ L1ArenaBytes ≤ 65536) ∧ ◇ FrameTimeSub8ms"
  },
  "race-condition-concurrent": {
    scenarioId: "race-condition-concurrent",
    scenarioTitle: "Ejemplo de cambios concurrentes sobre un archivo",
    example: "Dos trabajadores intentan modificar el mismo archivo al mismo tiempo.",
    formulaReference: "□ (∀ a1, a2 ∈ Agents : a1 ≠ a2 ⇒ Worktree(a1) ∩ Worktree(a2) = ∅) ∧ ◇ LockFreeCAS"
  }
} as const;
