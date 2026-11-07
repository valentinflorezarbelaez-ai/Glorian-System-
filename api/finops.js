/**
 * FinOps cost-receipt API for Studio Console / cockpit.
 * Estimate only — not a live provider invoice. WITHIN_TESTED_SCOPE.
 */

const MAX_DIRECTIVE_BYTES = 32 * 1024;

async function _handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "eos-finops-cost-receipt",
      methods: ["GET", "POST"],
      body: { directive: "string", estimatedTokens: "number?" },
      epistemicState: "FINOPS_COST_RECEIPT_WITHIN_TESTED_SCOPE",
      policyCard: {
        note: "Estimate only — subscription chat ≠ production API invoice",
        tiers: [
          {
            id: "TIER_1_LOCAL_SLM",
            label: "Local / Flash",
            when: "Low-entropy format, lint, outline, boilerplate",
            model: "local-slm-or-gemini-flash",
            rateHintUsdPerMTok: { prompt: 0.075, completion: 0.3 },
          },
          {
            id: "TIER_2_BALANCED",
            label: "Balanced",
            when: "Standard component / business logic / verification",
            model: "gemini-2.5-pro",
            rateHintUsdPerMTok: { prompt: 1.25, completion: 5.0 },
          },
          {
            id: "TIER_3_FRONTIER_REASONING",
            label: "Frontier",
            when: "Formal proofs, TLA+, deep architecture adjudication",
            model: "claude-3-7-sonnet-or-o1",
            rateHintUsdPerMTok: { prompt: 3.0, completion: 15.0 },
          },
        ],
      },
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const directive = typeof body.directive === "string" ? body.directive.trim() : "";
    if (!directive) {
      return res.status(400).json({ ok: false, error: "DIRECTIVE_REQUIRED" });
    }
    if (Buffer.byteLength(directive, "utf8") > MAX_DIRECTIVE_BYTES) {
      return res.status(413).json({ ok: false, error: "DIRECTIVE_TOO_LARGE" });
    }

    const { EosAgenticFinOpsGovernor } = await import("../src/core/eosAgenticFinOpsGovernor.ts");
    const estimatedTokens =
      typeof body.estimatedTokens === "number" && body.estimatedTokens > 0
        ? Math.min(32_000, Math.floor(body.estimatedTokens))
        : Math.min(32_000, Math.max(1_000, Math.ceil(Buffer.byteLength(directive, "utf8") / 4) * 8));

    const routing = EosAgenticFinOpsGovernor.getInstance().classifyTaskCostTier(directive, estimatedTokens);

    return res.status(200).json({
      ok: true,
      epistemicState: "FINOPS_COST_RECEIPT_WITHIN_TESTED_SCOPE",
      note: "Estimate only — subscription chat ≠ production API invoice",
      estimatedTokens,
      tier: routing.tier,
      recommendedProviderModel: routing.recommendedProviderModel,
      estimatedCostUsd: routing.estimatedCostUsd,
      ratePerMillionUsd: routing.ratePerMillionUsd,
      rationale: routing.rationale,
      sha256Attestation: routing.sha256Attestation,
    });
  } catch {
    return res.status(503).json({ ok: false, error: "FINOPS_ENGINE_UNAVAILABLE" });
  }
}

// Rate limiting — 20 req/min burst per IP
import { withRateLimit } from "../src/core/eosApiRateLimit.ts";
export default withRateLimit({ capacity: 20, refillPerSecond: 0.33 })(_handler);
