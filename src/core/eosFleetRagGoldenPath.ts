/**
 * EOS SYSTEM — FLEET RAG GOLDEN PATH (Layer 0)
 * Hermetic docs → hybrid vector+lexical retrieval → fail-closed Q&A evidence.
 * Product analogue: Biblioteca / Donaciones knowledge surfaces (fixture corpus).
 * Epistemic: FLEET_RAG_GOLDEN_PATH_WITHIN_TESTED_SCOPE — not Level-5 · not live LLM generation.
 */

import {
  assertPostcondition,
  assertPrecondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";
import { EosNeuralVectorStore } from "./eosNeuralVectorCore.ts";

export interface FleetRagCorpusDoc {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly source: string;
}

export interface FleetRagHit {
  readonly id: string;
  readonly title: string;
  readonly score: number;
  readonly snippet: string;
  readonly source: string;
}

export interface FleetRagGoldenPathResult {
  readonly status: "SUCCESS" | "FAILED";
  readonly query: string;
  readonly hits: readonly FleetRagHit[];
  readonly corpusSize: number;
  readonly topK: number;
  readonly epistemicState: "FLEET_RAG_GOLDEN_PATH_WITHIN_TESTED_SCOPE" | "BLOCKED";
  readonly sha256Receipt: string;
  readonly durationMs: number;
  readonly failingReason: string | null;
}

/** Default hermetic corpus — Biblioteca-shaped + Spotify platform doctrine snippets. */
export const DEFAULT_FLEET_RAG_CORPUS: readonly FleetRagCorpusDoc[] = deepFreeze([
  {
    id: "bib-pistis-sophia",
    title: "Pistis Sophia — light and repentance",
    text: "Pistis Sophia cries to the Light of lights. Sacred texts in Biblioteca Gnóstica preserve repentance, aeons, and the path of the soul without fabricating verses.",
    source: "fixture:biblioteca-gnostica"
  },
  {
    id: "bib-three-factors",
    title: "Three Factors of the Revolution of Consciousness",
    text: "Death of the ego, birth of the Being, and sacrifice for humanity. Donaciones embodies the Third Factor as conscious giving.",
    source: "fixture:biblioteca-gnostica"
  },
  {
    id: "spotify-authz",
    title: "Spotify Authorization Platform lens",
    text: "Authorization is a platform capability for creators, teams, agents, partners, and licensees. Least privilege, fail-closed denial, relational data at scale.",
    source: "fixture:spotify-authz-lens"
  },
  {
    id: "spotify-golden-paths",
    title: "Spotify Golden Paths and Backstage",
    text: "Golden Paths standardize microservices via Backstage Software Templates, TechDocs, fleet upgrades, and Soundcheck scorecards so autonomy does not become chaos.",
    source: "fixture:spotify-golden-paths"
  },
  {
    id: "spotify-music-expression",
    title: "Music Expression full-stack bar",
    text: "Music Expression engineers ship React TypeScript experiences with Java-shaped services so artists reach fans through Canvas, countdown, and listening parties with acoustic ethics.",
    source: "fixture:spotify-music-expression"
  },
  {
    id: "finops-mission",
    title: "Mission FinOps cost receipt",
    text: "eos_mission_run emits FINOPS_COST_RECEIPT with tier routing and estimated USD attestation. Subscription chat is not a production API invoice.",
    source: "fixture:glorian-finops"
  }
]);

function snippetOf(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/**
 * Runs the Fleet RAG Golden Path: index corpus → hybrid search → cryptographic receipt.
 */
export function runFleetRagGoldenPath(
  query: string,
  options: {
    readonly corpus?: readonly FleetRagCorpusDoc[];
    readonly topK?: number;
  } = {}
): FleetRagGoldenPathResult {
  const started = process.hrtime.bigint();
  const topK = typeof options.topK === "number" && options.topK > 0 ? Math.min(20, Math.floor(options.topK)) : 3;
  const corpus = options.corpus && options.corpus.length > 0 ? options.corpus : DEFAULT_FLEET_RAG_CORPUS;

  const fail = (reason: string): FleetRagGoldenPathResult => {
    const durationMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
    const sha256Receipt = pureSha256(
      JSON.stringify({ status: "FAILED", reason, query: typeof query === "string" ? query : "" })
    );
    return deepFreeze({
      status: "FAILED",
      query: typeof query === "string" ? query.trim() : "",
      hits: [],
      corpusSize: corpus.length,
      topK,
      epistemicState: "BLOCKED",
      sha256Receipt,
      durationMs,
      failingReason: reason
    });
  };

  if (typeof query !== "string" || query.trim().length === 0) {
    return fail("EMPTY_QUERY");
  }
  const cleanQuery = query.trim();
  assertPrecondition(Buffer.byteLength(cleanQuery, "utf8") <= 8192, "Query exceeds 8 KiB bound");

  const store = new EosNeuralVectorStore<{ title: string; source: string }>();
  for (const doc of corpus) {
    assertPrecondition(Boolean(doc.id && doc.text), "Corpus documents require id and text");
    store.addDocument(doc.id, `${doc.title}\n${doc.text}`, { title: doc.title, source: doc.source });
  }

  const ranked = store.searchHybrid(cleanQuery, topK);
  const hits: FleetRagHit[] = ranked.map((r) => ({
    id: r.id,
    title: r.metadata?.title || r.id,
    score: r.score,
    snippet: snippetOf(r.text),
    source: r.metadata?.source || "unknown"
  }));

  if (hits.length === 0) {
    return fail("NO_RETRIEVAL_HITS");
  }

  const durationMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
  const sha256Receipt = pureSha256(
    JSON.stringify({
      status: "SUCCESS",
      query: cleanQuery,
      hitIds: hits.map((h) => h.id),
      scores: hits.map((h) => Number(h.score.toFixed(6))),
      corpusSize: corpus.length
    })
  );
  assertPostcondition(sha256Receipt.length === 64, "RAG receipt must be 64-char SHA-256");

  return deepFreeze({
    status: "SUCCESS",
    query: cleanQuery,
    hits,
    corpusSize: corpus.length,
    topK,
    epistemicState: "FLEET_RAG_GOLDEN_PATH_WITHIN_TESTED_SCOPE",
    sha256Receipt,
    durationMs,
    failingReason: null
  });
}

export class EosFleetRagGoldenPath {
  public static run(
    query: string,
    options?: { readonly corpus?: readonly FleetRagCorpusDoc[]; readonly topK?: number }
  ): FleetRagGoldenPathResult {
    return runFleetRagGoldenPath(query, options);
  }
}
