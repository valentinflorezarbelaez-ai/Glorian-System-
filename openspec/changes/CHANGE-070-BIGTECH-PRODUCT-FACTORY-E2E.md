# CHANGE-070: Big Tech Product Factory E2E Seal

## Intent

Seal a single zero→product golden path that Big Tech EngProd would ship:
IAM authorize → Product Delivery Orchestrator → scorecard → receipt → dogfood.

## Scope

- SPEC-185 + `src/core/eosBigTechProductFactory.ts`
- Default least-privilege IAM pack under `docs/governance/`
- CLI `product:deliver` / npm `factory:e2e`
- Extend TTV dogfood with `PRODUCT_FACTORY_E2E`
- Add `eos_product_deliver_run` to MCP mutation-capable set

## Non-goals

- No new LLM dependency
- No automatic push/deploy
- No broadening IAM to full `mcp/tools/` prefix

## Status

APPROVED — owner directive to productize Glorian at Big Tech E2E quality.
