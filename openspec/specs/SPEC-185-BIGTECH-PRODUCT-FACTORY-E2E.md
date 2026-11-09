# SPEC-185: Big Tech Product Factory E2E Seal

## Status

- **Status**: APPROVED
- **Date**: 2026-11-09
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Product
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution
- **Module**: `src/core/eosBigTechProductFactory.ts`
- **Composes**: SPEC-039 (Foundry), SPEC-147/delivery orchestrator, SPEC-184 (IAM)

---

## 1. Context and Rationale

Glorian already has Foundry blueprints and a Product Delivery Orchestrator, but the
operator surface is fragmented: CLI `product:create` only prints a blueprint, IAM
is optional unless wired, and dogfood TTV does not prove zero→product delivery.

Advanced Big Tech product platforms (Google EngProd golden paths, Stripe API
lifecycle, Spotify Backstage templates) expose **one sealed E2E path**: authorize →
synthesize → verify gates → scorecard floor → cryptographic receipt. This
specification seals that path for Glorian without claiming Level-5 autonomy.

## 2. Functional Requirements (EARS Syntax)

- **FR-940 (Event-Driven - Factory Run)**: `WHEN the Big Tech Product Factory is invoked with a product manifest, THE SYSTEM SHALL authorize the caller for action mcp.tools.call on resource mcp/tools/eos_product_deliver_run, THEN run EosProductDeliveryOrchestrator.deliverProduct, THEN emit a factory receipt with IAM and delivery digests.`

- **FR-941 (Unwanted Condition - IAM Deny)**: `IF IAM denies the factory action, THEN THE SYSTEM SHALL return status BLOCKED with reason IAM_DENIED, SHALL NOT materialize product files, and SHALL still emit an audit receipt.`

- **FR-942 (Ubiquitous - Dry-Run Default)**: `THE SYSTEM SHALL default dryRun to true. WHEN dryRun is true, THE SYSTEM SHALL not write product packages under docs/products/.`

- **FR-943 (Event-Driven - Scorecard Floor)**: `WHEN delivery completes with a scorecard below the Product Quality floor, THE SYSTEM SHALL surface status BLOCKED with reason SCORECARD_FLOOR.`

- **FR-944 (Ubiquitous - Least-Privilege Defaults)**: `THE SYSTEM SHALL ship a default IAM policy pack that grants mcp.tools.call only on mcp/tools/eos_product_deliver_run and mcp/tools/eos_product_foundry_create for role engineer in tenant-local, not on the entire mcp/tools/ prefix.`

- **FR-945 (Event-Driven - Dogfood Seal)**: `WHEN npm run factory:e2e (or the TTV PRODUCT_FACTORY_E2E path) runs, THE SYSTEM SHALL execute a hermetic dry-run factory delivery and write docs/evidence/BIGTECH_PRODUCT_FACTORY_RECEIPT.json.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-940 authorized dry-run factory succeeds
  GIVEN a principal engineer in tenant-local with a matching least-privilege policy
  WHEN runBigTechProductFactory is called with dryRun true
  THEN status is SUCCESS or BLOCKED only for scorecard floor
  AND factory receipt sha256 length is 64
  AND no docs/products write occurs for a new id

SCENARIO: BDD-941 IAM denial blocks materialization
  GIVEN no policies and no principal
  WHEN runBigTechProductFactory is called with dryRun false
  THEN status is BLOCKED
  AND reason is IAM_DENIED

SCENARIO: BDD-942 default policy pack is least privilege
  GIVEN the shipped default IAM policy pack
  WHEN policies are inspected
  THEN no policy resourcePrefix equals mcp/tools/
  AND at least one policy targets mcp/tools/eos_product_deliver_run
```

## 4. Non-Claims

Not Level-5 · not autonomous coding agents shipping to production · not OIDC IdP ·
not a guarantee that every generated product passes CI in an external repo.
Epistemic state: `BIGTECH_PRODUCT_FACTORY_WITHIN_TESTED_SCOPE`.
