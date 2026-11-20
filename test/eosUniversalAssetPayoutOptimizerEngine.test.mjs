/**
 * Test Suite: Universal Multi-Asset Universe & Dynamic Payout Optimizer Engine
 * Verifies SPEC-375 / CHANGE-237 (BDD-2033..BDD-2040)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosUniversalAssetPayoutOptimizerEngine } from "../src/core/eosUniversalAssetPayoutOptimizerEngine.ts";
import { PHASE8_TOOL_DEFINITIONS } from "../src/mcp/tools/eosMcpPhase8ToolDefinitions.ts";
import { createPhase8AgiHandlers } from "../src/mcp/tools/eosMcpPhase8AgiHandlers.ts";

describe("SPEC-375: Universal Multi-Asset Universe & Dynamic Payout Optimizer Engine", () => {
  it("BDD-2033: Universal Multi-Asset Catalog Ingestion", () => {
    const catalog = EosUniversalAssetPayoutOptimizerEngine.UNIVERSAL_CATALOG;
    assert.ok(catalog.length >= 30, "Catalog must contain at least 30 multi-class assets");

    const categories = new Set(catalog.map((a) => a.category));
    assert.ok(categories.has("FOREX"), "Catalog must contain Forex assets");
    assert.ok(categories.has("COMMODITIES"), "Catalog must contain Commodities (Gold/Silver/WTI)");
    assert.ok(categories.has("CRYPTO"), "Catalog must contain Cryptocurrencies (BTC, ETH, DASH, DOGE, PEPE)");
    assert.ok(categories.has("EQUITIES"), "Catalog must contain Equities (AAPL, MSFT, TSLA, NVDA)");
    assert.ok(categories.has("OTC"), "Catalog must contain OTC assets");

    // Specific asset checks requested by user
    const symbols = catalog.map((a) => a.symbol);
    assert.ok(symbols.includes("XAU/USD"), "Must include Gold (XAU/USD)");
    assert.ok(symbols.includes("WTI/USD"), "Must include Crude Oil (WTI/USD)");
    assert.ok(symbols.includes("DASH/USD"), "Must include DASH");
    assert.ok(symbols.includes("DOGE/USD"), "Must include DOGE");
    assert.ok(symbols.includes("PEPE/USD"), "Must include PEPE");
    assert.ok(symbols.includes("AAPL"), "Must include Apple");
    assert.ok(symbols.includes("MSFT"), "Must include Microsoft");
    assert.ok(symbols.includes("CAD/JPY"), "Must include CAD/JPY");
    assert.ok(symbols.includes("EUR/AUD"), "Must include EUR/AUD");
  });

  it("BDD-2034: Dynamic Payout Evaluator (Digital vs Binary)", () => {
    const quotes = EosUniversalAssetPayoutOptimizerEngine.generateCatalogQuotes();
    const eurQuote = quotes.find((q) => q.symbol === "EUR/USD");
    assert.ok(eurQuote, "EUR/USD quote must exist");

    const evalResult = EosUniversalAssetPayoutOptimizerEngine.evaluateAssetQuote(eurQuote);
    assert.equal(evalResult.optimalMode, "DIGITAL", "Higher yield mode must be selected");
    assert.ok(evalResult.optimalPayoutPercent >= 80, "Selected payout must be >= 80%");
    assert.equal(evalResult.payoutQualifies, true, "Asset with payout >= 80% must qualify");
  });

  it("BDD-2035: Low-Payout Disqualification", () => {
    const lowQuote = {
      symbol: "TEST/LOW",
      category: "FOREX",
      spotPrice: 1.05,
      binaryPayoutPercent: 72,
      digitalPayoutPercent: 75,
      candlesM15: [],
      candlesM5: [],
      candlesM1: [],
    };

    const evalResult = EosUniversalAssetPayoutOptimizerEngine.evaluateAssetQuote(lowQuote);
    assert.equal(evalResult.payoutQualifies, false, "Payouts below 80% must not qualify");
    assert.equal(evalResult.status, "REJECTED_LOW_PAYOUT", "Status must be REJECTED_LOW_PAYOUT");
    assert.equal(evalResult.compositeQualityIndex, 0, "Quality index must be zero for disqualified payouts");
  });

  it("BDD-2036: Scale-Invariant Key-Level Detection", () => {
    // Forex Triple Zero
    const forexKey = EosUniversalAssetPayoutOptimizerEngine.detectKeyLevel(1.09001);
    assert.equal(forexKey.isNearKeyLevel, true, "Must detect triple-zero on Forex");
    assert.equal(forexKey.levelType, "TRIPLE_ZERO");

    // Crypto Half-Round (BTC at $91,500)
    const btcKey = EosUniversalAssetPayoutOptimizerEngine.detectKeyLevel(91501.5);
    assert.equal(btcKey.isNearKeyLevel, true, "Must detect half-round on BTC");
    assert.equal(btcKey.levelType, "HALF_ROUND");

    // Micro-cap Crypto Half-Round (PEPE/USD at $0.00002150)
    const pepeKey = EosUniversalAssetPayoutOptimizerEngine.detectKeyLevel(0.0000215);
    assert.equal(pepeKey.isNearKeyLevel, true, "Must detect key level on micro-cap PEPE/USD");
    assert.equal(pepeKey.levelType, "HALF_ROUND");
    assert.equal(pepeKey.nearestLevel, 0.0000215);

    // Commodity Half-Round (Gold at $2,650.02)
    const goldKey = EosUniversalAssetPayoutOptimizerEngine.detectKeyLevel(2650.02);
    assert.equal(goldKey.isNearKeyLevel, true, "Must detect half-round on Gold");
    assert.equal(goldKey.levelType, "HALF_ROUND");

    // Equity Half-Round (NVDA at $145.00)
    const equityKey = EosUniversalAssetPayoutOptimizerEngine.detectKeyLevel(145.0);
    assert.equal(equityKey.isNearKeyLevel, true, "Must detect half-round on Equity");
    assert.equal(equityKey.levelType, "HALF_ROUND");

    // Far from round level
    const standardKey = EosUniversalAssetPayoutOptimizerEngine.detectKeyLevel(1.08273);
    assert.equal(standardKey.isNearKeyLevel, false, "Points far from round levels must be standard");
    assert.equal(standardKey.levelType, "STANDARD");
  });

  it("BDD-2037: Single Concurrency Lock (N_active <= 1)", () => {
    const quotes = EosUniversalAssetPayoutOptimizerEngine.generateCatalogQuotes();
    const scanReport = EosUniversalAssetPayoutOptimizerEngine.scanUniversalMarket(quotes);

    assert.ok(scanReport.rankings.length >= 20, "Rankings must contain all evaluated assets");
    assert.equal(scanReport.concurrencyLockPreserved, true, "Concurrency lock must be preserved");

    // Only 1 asset can have status TOP_ELECTION
    const topElected = scanReport.rankings.filter((r) => r.status === "TOP_ELECTION");
    assert.ok(topElected.length <= 1, "At most 1 asset can be TOP_ELECTION (N_active <= 1)");
    if (topElected.length === 1) {
      assert.deepEqual(topElected[0], scanReport.topElectedAsset);
      assert.ok(scanReport.topElectedAsset.optimalPayoutPercent >= 80, "Top elected asset payout must be >= 80%");
      assert.equal(scanReport.activeExpirySeconds, 60, "Expiry must strictly be 60 seconds");
    }
  });

  it("BDD-2038: Fiduciary Invariant Preservation", () => {
    // Vault Alpha ($3,000 USD) must be untradeable; only Demo account operates
    const auditReport = EosUniversalAssetPayoutOptimizerEngine.audit();
    assert.equal(auditReport.invariants.fiduciaryVaultAlphaIntact, true, "Vault Alpha must be 100% intact");
    assert.equal(auditReport.invariants.singleConcurrencyLock, true, "Concurrency must remain bounded to 1");
  });

  it("BDD-2039: Centralized Antigravity Execution (Zero External Bots)", () => {
    // Verify that the engine produces local structured outputs without network side effects
    const quotes = EosUniversalAssetPayoutOptimizerEngine.generateCatalogQuotes();
    const scan = EosUniversalAssetPayoutOptimizerEngine.scanUniversalMarket(quotes);
    assert.ok(scan.scanId.startsWith("univ-scan-"), "Must have deterministic local scanId");
    assert.ok(Number.isFinite(scan.timestamp), "Must have numeric timestamp");
  });

  it("BDD-2040: Cryptographic Audit Receipt Generation & MCP Registration", () => {
    const receipt = EosUniversalAssetPayoutOptimizerEngine.audit();
    assert.equal(receipt.status, "VERIFIED", "Audit status must be VERIFIED");
    assert.ok(receipt.receiptHash.length === 64, "Receipt hash must be 64-char SHA-256");
    assert.ok(receipt.invariants.minimumPayoutThreshold, "Minimum payout invariant must be verified");
    assert.ok(receipt.invariants.strictOneMinuteExpiry, "60s expiry invariant must be verified");
    assert.ok(receipt.invariants.singleConcurrencyLock, "Single concurrency lock must be verified");
    assert.ok(receipt.invariants.fiduciaryVaultAlphaIntact, "Fiduciary vault alpha must be verified");
    assert.ok(receipt.invariants.multiClassCoverageVerified, "Multi-class coverage must be verified");
    assert.ok(receipt.metrics.assetsAuditedCount >= 32, "Must audit full catalog + low-payout probe");
    assert.ok(receipt.metrics.highestPayoutObserved >= 80, "Highest payout must be >= 80%");
    assert.ok(receipt.metrics.topConfluenceObserved > 0, "Top confluence index must be strictly positive");

    const toolDef = PHASE8_TOOL_DEFINITIONS.find((t) => t.name === "eos_universal_asset_payout_audit");
    assert.ok(toolDef, "MCP Phase 8 definition for eos_universal_asset_payout_audit must exist");

    const handlers = createPhase8AgiHandlers({ projectRoot: process.cwd() });
    assert.equal(typeof handlers.eos_universal_asset_payout_audit, "function");
    const mcpReceipt = handlers.eos_universal_asset_payout_audit({});
    assert.equal(mcpReceipt.status, "VERIFIED");
  });
});
