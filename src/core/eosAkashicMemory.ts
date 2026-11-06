/**
 * ============================================================================
 * EOS MEMORY TYPES, REFERENCE CATALOG, AND LOCAL HEURISTICS
 * ============================================================================
 * This module does not implement a memory store, MCP server, FTS5 index,
 * conflict tribunal, version history, or cryptographic hash chain. It exports
 * data types, a capability reference catalog, and small deterministic helpers.
 * ============================================================================
 */

export type SamaelianMemoryFactor =
  | "MORIR"      // Incineración de defectos, bugfixes, deuda técnica y anti-patrones (Devi Kundalini)
  | "NACER"      // Nacimiento Segundo: Arquitectura, patrones SoA/SIMD, transmutación del Hidrógeno SI-12
  | "SACRIFICIO";// Tercer Factor: Handoffs, mem_session_summary, documentación y servicio consciente

export type AkashicSephirah =
  | "Kether (Anciano de los Días · Raíz Suprema)"
  | "Chokmah (Cristo Cósmico · Sabiduría)"
  | "Binah (Espíritu Santo / RAM-IO · Inteligencia)"
  | "Daath (Gnosis / Conocimiento Akáshico)"
  | "Chesed (Átman · Íntimo)"
  | "Geburah (Rigor de la Ley · Tribunal de Anubis)"
  | "Tiphereth (Alma Humana · Voluntad Thelema)"
  | "Netzach (Mente Solar · Arquitectura)"
  | "Hod (Cuerpo Astral · Telemetría)"
  | "Yesod (Piedra Cúbica · Fundamento Vital)"
  | "Malkuth (Reino Físico · Producción Edge)";

export type EngramObservationType =
  | "architecture"
  | "decision"
  | "bugfix"
  | "pattern"
  | "config"
  | "discovery"
  | "learning"
  | "session_summary"
  | "manual";

export type EngramRelationVerb =
  | "related"
  | "compatible"
  | "scoped"
  | "conflicts_with"
  | "supersedes"
  | "not_conflict";

export interface AkashicObservation {
  readonly id: number;
  readonly project: string;
  readonly type: EngramObservationType;
  readonly title: string;
  readonly topic_key: string;
  readonly what: string;
  readonly where: string;
  readonly learned: string;
  readonly samaelianFactor: SamaelianMemoryFactor;
  readonly sephirah: AkashicSephirah;
  readonly pinned: boolean;
  readonly version_count: number;
  readonly updated_at: string;
}

export interface AkashicConflictJudgment {
  readonly judgment_id: string;
  readonly sync_id: string;
  readonly memory_id_a: number;
  readonly memory_id_b: number;
  readonly relation: EngramRelationVerb;
  readonly confidence: number;
  readonly reasoning: string;
  readonly anubicVerdict: string;
  readonly judgment_status: "pending" | "judged";
  readonly judged_at: string;
}

export interface OddProportionalRoute {
  readonly taskDescription: string;
  readonly sizeTier: "SMALL_INLINE" | "LARGE_FEATURE_DOC";
  readonly delegationReason:
    | "NONE_INLINE"
    | "EXPLORATION"
    | "PARALLEL_WRITERS"
    | "CONTEXT_BACKSTOP"
    | "INDEPENDENT_VERIFIER";
  readonly publicState: "Working" | "Checking" | "Ready" | "Needs your decision";
  readonly testFirstRule: string;
}

export interface RddFourRReview {
  /** Caller-supplied value retained for display; it is not verified here. */
  readonly suppliedCandidateFingerprint: string;
  readonly riskTier: "NOT_ASSESSED";
  readonly lenses: {
    readonly risk: string;
    readonly resilience: string;
    readonly readability: string;
    readonly reliability: string;
  };
  readonly epistemicVerdict: "NOT_EXECUTED_TEMPLATE";
}

export const MEMORY_CAPABILITY_REFERENCE_CATALOG: readonly {
  readonly capability: string;
  readonly eosCurrentBehavior: string;
}[] = [
  {
    capability: "Browser-local notes",
    eosCurrentBehavior: "The browser UI stores bounded note records in localStorage; this does not sync between devices or persist on the server."
  },
  {
    capability: "Text search and filters",
    eosCurrentBehavior: "The browser performs case-insensitive substring matching and local category/pinned filters; there is no FTS5 or semantic index."
  },
  {
    capability: "topic_key updates",
    eosCurrentBehavior: "Saving an existing key replaces that local record and increments an edit counter; previous versions are not retained."
  },
  {
    capability: "API memory actions",
    eosCurrentBehavior: "The stateless API serves fixtures and previews. Its diagnostics and judge responses explicitly report that checks or judgments did not execute."
  },
  {
    capability: "This TypeScript module",
    eosCurrentBehavior: "Exports types, a reference catalog, deterministic topic-key and factor helpers, a keyword router, and a review template."
  },
  {
    capability: "Export",
    eosCurrentBehavior: "The browser can download local notes as Markdown; there is no Obsidian integration or signed provenance."
  }
] as const;

export function suggestAkashicTopicKey(type: string, title: string): string {
  const cleanType = (type || "architecture")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "architecture";
  const slug = (title || "core-decision")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 44) || "core-decision";
  return `${cleanType}/${slug}`;
}

export function classifySamaelianFactorAndSephirah(
  type: EngramObservationType,
  text: string
): { factor: SamaelianMemoryFactor; sephirah: AkashicSephirah } {
  const lower = `${type} ${text}`.toLowerCase();
  if (type === "bugfix" || lower.includes("bug") || lower.includes("fix") || lower.includes("error") || lower.includes("fdir")) {
    return {
      factor: "MORIR",
      sephirah: "Geburah (Rigor de la Ley · Tribunal de Anubis)"
    };
  }
  if (type === "session_summary" || lower.includes("handoff") || lower.includes("resumen") || lower.includes("flota")) {
    return {
      factor: "SACRIFICIO",
      sephirah: "Tiphereth (Alma Humana · Voluntad Thelema)"
    };
  }
  return {
    factor: "NACER",
    sephirah: "Daath (Gnosis / Conocimiento Akáshico)"
  };
}

export function evaluateOddProportionalRouting(taskDescription: string): OddProportionalRoute {
  const lower = (taskDescription || "").toLowerCase();
  const isHighRisk =
    lower.includes("schema") ||
    lower.includes("database") ||
    lower.includes("security") ||
    lower.includes("auth") ||
    lower.includes("concurrency") ||
    lower.includes("migracion") ||
    lower.includes("cripto");

  if (isHighRisk) {
    return {
      taskDescription,
      sizeTier: "LARGE_FEATURE_DOC",
      delegationReason: "INDEPENDENT_VERIFIER",
      publicState: "Checking",
      testFirstRule: "1 RED behavior test per rule + 1 regression test per touched command + Independent 4R Verifier."
    };
  }
  return {
    taskDescription,
    sizeTier: "SMALL_INLINE",
    delegationReason: "NONE_INLINE",
    publicState: "Ready",
    testFirstRule: "Inline execution with 0 subagent overhead + deterministic functional verification."
  };
}

export function createRddFourRLensesReviewTemplate(
  candidateTitle: string,
  suppliedCandidateFingerprint: string
): RddFourRReview {
  return {
    suppliedCandidateFingerprint,
    riskTier: "NOT_ASSESSED",
    lenses: {
      risk: "[NOT RUN] No secrets scan or risk assessment was performed.",
      resilience: "[NOT RUN] No resilience or recovery checks were performed.",
      readability: "[NOT RUN] No readability or architecture review was performed.",
      reliability: `[NOT RUN] The review template for "${candidateTitle}" does not validate the supplied fingerprint or execute checks.`
    },
    epistemicVerdict: "NOT_EXECUTED_TEMPLATE"
  };
}
