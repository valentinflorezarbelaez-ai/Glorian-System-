/**
 * EOS SYSTEM — SPEC-039 UNIVERSAL PRODUCT FOUNDRY VERIFICATION SUITE
 * Pure Layer-0 Unit & Invariant Test Suite (node:test)
 *
 * Verifies:
 * - BDD-104: Product Blueprint Synthesis from Structured Manifest
 * - BDD-105: Hexagonal Isolation & Dependency Rule Validation
 * - BDD-106: 100% EARS-to-BDD Requirements Traceability
 * - BDD-107: Multi-Complexity Support (MVP to PLANETARY)
 * - BDD-108: Multi-Channel MCP & CLI Tool Dispatch
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  EosUniversalProductFoundry,
} from "../src/core/eosUniversalProductFoundry.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

describe("SPEC-039: Universal Product Foundry Engine Verification", () => {
  const sampleManifest = {
    id: "apex-fintech-core",
    name: "Apex Planetary Clearinghouse",
    domain: "fintech",
    description: "High-throughput real-time payment settling engine with banking-grade idempotency",
    tier: "MISSION_CRITICAL",
    platforms: ["distributed-backend", "web"],
    entities: ["LedgerAccount", "SettlementTransaction", "AuditTrail"],
    commands: ["ExecuteSettlement", "ReverseTransaction", "FreezeAccount"],
    compliance: ["PCI_DSS", "SLSA_4", "WCAG_2_1_AA"],
  };

  describe("BDD-104: Product Blueprint Synthesis from Structured Manifest", () => {
    it("synthesizes bounded contexts, domain entities, and sachem contracts", () => {
      const blueprint = EosUniversalProductFoundry.createProductBlueprint(sampleManifest);

      assert.equal(blueprint.manifest.id, "apex-fintech-core");
      assert.ok(blueprint.boundedContexts.length >= 3);
      assert.equal(blueprint.domainEntities.length, 3);
      assert.equal(blueprint.useCases.length, 3);
      assert.equal(blueprint.sachemContracts.length, 3);
      assert.ok(blueprint.sha256MerkleRoot.length === 64);

      // Verify domain entities have inviolable fields
      const ledgerEnt = blueprint.domainEntities.find((e) => e.name === "LedgerAccount");
      assert.ok(ledgerEnt);
      assert.ok(ledgerEnt.fields.some((f) => f.name === "id" && f.immutable));
    });

    it("generates production scaffold code tree with Layer-0 purity", () => {
      const blueprint = EosUniversalProductFoundry.createProductBlueprint(sampleManifest);
      const tree = EosUniversalProductFoundry.generateScaffoldTree(blueprint);

      assert.ok(tree.has("package.json"));
      assert.ok(tree.has("docs/specs/spec.md"));
      assert.ok(tree.has("src/domain/LedgerAccount.ts"));
      assert.ok(tree.has("src/application/ExecuteSettlementHandler.ts"));

      const pkg = JSON.parse(tree.get("package.json"));
      assert.deepEqual(pkg.dependencies, {}, "Generated core domain must have 0 external dependencies");
    });
  });

  describe("BDD-105: Hexagonal Isolation & Dependency Rule Validation", () => {
    it("certifies topological purity and zero cyclic dependencies", () => {
      const blueprint = EosUniversalProductFoundry.createProductBlueprint(sampleManifest);
      const report = EosUniversalProductFoundry.validateProductTopology(blueprint);

      assert.equal(report.valid, true);
      assert.equal(report.acyclic, true);
      assert.equal(report.hermeticIsolationPassed, true);
      assert.equal(report.findings.length, 0);
      assert.ok(report.sha256Proof.length === 64);
    });

    it("flags boundary breach if illegal domain dependency is introduced", () => {
      const blueprint = EosUniversalProductFoundry.createProductBlueprint(sampleManifest);
      // Mutate layers artificially to simulate architectural drift
      const corruptedLayers = blueprint.layers.map((l) =>
        l.layer === "domain" ? { ...l, allowedImports: ["infrastructure"] } : l
      );
      const corruptedBlueprint = { ...blueprint, layers: corruptedLayers };
      const report = EosUniversalProductFoundry.validateProductTopology(corruptedBlueprint);

      assert.equal(report.valid, false);
      assert.equal(report.hermeticIsolationPassed, false);
      assert.ok(report.findings.length > 0);
    });
  });

  describe("BDD-106: 100% EARS-to-BDD Requirements Traceability", () => {
    it("ensures every use case has an EARS rule and BDD scenario", () => {
      const blueprint = EosUniversalProductFoundry.createProductBlueprint(sampleManifest);

      for (const uc of blueprint.useCases) {
        assert.ok(uc.earsRequirement.startsWith("CUANDO"));
        assert.ok(uc.bddScenario.includes("ESCENARIO:"));
        assert.ok(uc.bddScenario.includes("DADO"));
        assert.ok(uc.bddScenario.includes("CUANDO"));
        assert.ok(uc.bddScenario.includes("ENTONCES"));
      }

      const report = EosUniversalProductFoundry.validateProductTopology(blueprint);
      assert.equal(report.earsBddCoveragePercent, 100);
    });
  });

  describe("BDD-107: Multi-Complexity Support (MVP to PLANETARY)", () => {
    it("suggests external TLC model checking for MISSION_CRITICAL and PLANETARY tiers", () => {
      const planetaryManifest = { ...sampleManifest, tier: "PLANETARY" };
      const planetaryBlueprint = EosUniversalProductFoundry.createProductBlueprint(planetaryManifest);

      assert.ok(
        planetaryBlueprint.secDevOpsGates.some((g) => g.includes("Optional external step") && g.includes("TLC")),
        "PLANETARY tier should document an external, not-yet-run TLC step"
      );

      const mvpManifest = { ...sampleManifest, tier: "MVP" };
      const mvpBlueprint = EosUniversalProductFoundry.createProductBlueprint(mvpManifest);
      assert.ok(!mvpBlueprint.secDevOpsGates.some((g) => g.includes("TLA+")));
    });
  });

  describe("BDD-108: Multi-Channel MCP & CLI Tool Dispatch", () => {
    it("dispatches eos_product_foundry_create via MCP server", () => {
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "eos_product_foundry_create",
          arguments: {
            name: "HyperSonic Acoustic DJ",
            domain: "audio",
            tier: "ENTERPRISE",
            entities: ["Track", "MixSession"],
            commands: ["MixTracks", "AnalyzeHarmonics"]
          }
        }
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.status, "BLUEPRINT_CREATED");
      assert.ok(parsed.blueprint.sha256MerkleRoot);
    });

    it("dispatches eos_product_foundry_validate via MCP server", () => {
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "eos_product_foundry_validate",
          arguments: {
            domain: "fintech",
            tier: "MISSION_CRITICAL"
          }
        }
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.valid, true);
      assert.equal(parsed.hermeticIsolationPassed, true);
    });
  });
});
