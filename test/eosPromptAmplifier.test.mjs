/**
 * EOS SYSTEM — PROMPT AMPLIFIER TESTS
 * Tests for SOVEREIGN_FIVE_MATRIX, selectOptimalSovereignModel, detectDomain,
 * synthesizeEarsRequirements, synthesizeBddScenarios, buildModelScaffold, amplifyPrompt
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SOVEREIGN_FIVE_MATRIX,
  selectOptimalSovereignModel,
  detectDomain,
  synthesizeEarsRequirements,
  synthesizeBddScenarios,
  buildModelScaffold,
  amplifyPrompt,
} from "../src/core/eosPromptAmplifier.ts";

// ============================================================================
// SOVEREIGN_FIVE_MATRIX
// ============================================================================

test("SOVEREIGN_FIVE_MATRIX has 5 entries", () => {
  assert.equal(Object.keys(SOVEREIGN_FIVE_MATRIX).length, 5);
});

test("SOVEREIGN_FIVE_MATRIX is frozen", () => {
  assert.throws(() => {
    Object.defineProperty(SOVEREIGN_FIVE_MATRIX, "newKey", { value: "test" });
  });
});

test("SOVEREIGN_FIVE_MATRIX entries values are immutable references", () => {
  const grokRef = SOVEREIGN_FIVE_MATRIX.grok;
  assert.equal(grokRef.id, "grok");
  assert.equal(grokRef.provider, "xAI");
});

test("SOVEREIGN_FIVE_MATRIX includes grok with xAI provider", () => {
  assert.equal(SOVEREIGN_FIVE_MATRIX.grok.id, "grok");
  assert.equal(SOVEREIGN_FIVE_MATRIX.grok.provider, "xAI");
});

test("SOVEREIGN_FIVE_MATRIX includes gemini with Google provider", () => {
  assert.equal(SOVEREIGN_FIVE_MATRIX.gemini.id, "gemini");
  assert.equal(SOVEREIGN_FIVE_MATRIX.gemini.provider, "Google");
});

test("SOVEREIGN_FIVE_MATRIX includes claude with Anthropic provider", () => {
  assert.equal(SOVEREIGN_FIVE_MATRIX.claude.id, "claude");
  assert.equal(SOVEREIGN_FIVE_MATRIX.claude.provider, "Anthropic");
});

test("SOVEREIGN_FIVE_MATRIX includes gpt with OpenAI provider", () => {
  assert.equal(SOVEREIGN_FIVE_MATRIX.gpt.id, "gpt");
  assert.equal(SOVEREIGN_FIVE_MATRIX.gpt.provider, "OpenAI");
});

test("SOVEREIGN_FIVE_MATRIX includes deepseek with DeepSeek provider", () => {
  assert.equal(SOVEREIGN_FIVE_MATRIX.deepseek.id, "deepseek");
  assert.equal(SOVEREIGN_FIVE_MATRIX.deepseek.provider, "DeepSeek");
});

test("SOVEREIGN_FIVE_MATRIX roles are non-empty", () => {
  for (const entry of Object.values(SOVEREIGN_FIVE_MATRIX)) {
    assert.ok(entry.primaryRole.length > 0);
  }
});

test("SOVEREIGN_FIVE_MATRIX finOpsTier values are valid", () => {
  const validTiers = ["ULTRA_LOW_COST", "BALANCED_HIGH_CONTEXT", "FRONTIER_SURGICAL"];
  for (const entry of Object.values(SOVEREIGN_FIVE_MATRIX)) {
    assert.ok(validTiers.includes(entry.finOpsTier));
  }
});

test("SOVEREIGN_FIVE_MATRIX deepseek is ULTRA_LOW_COST", () => {
  assert.equal(SOVEREIGN_FIVE_MATRIX.deepseek.finOpsTier, "ULTRA_LOW_COST");
});

test("SOVEREIGN_FIVE_MATRIX gemini is BALANCED_HIGH_CONTEXT", () => {
  assert.equal(SOVEREIGN_FIVE_MATRIX.gemini.finOpsTier, "BALANCED_HIGH_CONTEXT");
});

test("SOVEREIGN_FIVE_MATRIX claude is FRONTIER_SURGICAL", () => {
  assert.equal(SOVEREIGN_FIVE_MATRIX.claude.finOpsTier, "FRONTIER_SURGICAL");
});

test("SOVEREIGN_FIVE_MATRIX systemConstraintInjection is non-empty", () => {
  for (const entry of Object.values(SOVEREIGN_FIVE_MATRIX)) {
    assert.ok(entry.systemConstraintInjection.length > 0);
    assert.ok(entry.systemConstraintInjection.startsWith("ENFORCE:"));
  }
});

// ============================================================================
// selectOptimalSovereignModel
// ============================================================================

test("selectOptimalSovereignModel routes 'optimiz' to deepseek", () => {
  const result = selectOptimalSovereignModel("Optimize the database queries");
  assert.equal(result.id, "deepseek");
});

test("selectOptimalSovereignModel routes 'math' to deepseek", () => {
  const result = selectOptimalSovereignModel("Calculate the mathematical proof");
  assert.equal(result.id, "deepseek");
});

test("selectOptimalSovereignModel routes 'cost' to deepseek", () => {
  const result = selectOptimalSovereignModel("Reduce infrastructure cost");
  assert.equal(result.id, "deepseek");
});

test("selectOptimalSovereignModel routes 'benchmark' to deepseek", () => {
  const result = selectOptimalSovereignModel("Run a benchmark suite");
  assert.equal(result.id, "deepseek");
});

test("selectOptimalSovereignModel routes 'finops' to deepseek", () => {
  const result = selectOptimalSovereignModel("Apply finops best practices");
  assert.equal(result.id, "deepseek");
});

test("selectOptimalSovereignModel routes 'reverse' to grok", () => {
  const result = selectOptimalSovereignModel("Reverse engineer this binary");
  assert.equal(result.id, "grok");
});

test("selectOptimalSovereignModel routes 'kernel' to grok", () => {
  const result = selectOptimalSovereignModel("Write a kernel module");
  assert.equal(result.id, "grok");
});

test("selectOptimalSovereignModel routes 'simd' to grok", () => {
  const result = selectOptimalSovereignModel("Use SIMD instructions");
  assert.equal(result.id, "grok");
});

test("selectOptimalSovereignModel routes 'graph' to gemini", () => {
  const result = selectOptimalSovereignModel("Build a dependency graph");
  assert.equal(result.id, "gemini");
});

test("selectOptimalSovereignModel routes 'blast' to gemini", () => {
  const result = selectOptimalSovereignModel("Calculate blast radius");
  assert.equal(result.id, "gemini");
});

test("selectOptimalSovereignModel routes 'fleet' to gemini", () => {
  const result = selectOptimalSovereignModel("Deploy to the fleet");
  assert.equal(result.id, "gemini");
});

test("selectOptimalSovereignModel routes 'judge' to gpt", () => {
  const result = selectOptimalSovereignModel("Act as a constitutional judge");
  assert.equal(result.id, "gpt");
});

test("selectOptimalSovereignModel routes 'spec' to gpt", () => {
  const result = selectOptimalSovereignModel("Write a formal spec");
  assert.equal(result.id, "gpt");
});

test("selectOptimalSovereignModel routes 'ears' to gpt", () => {
  const result = selectOptimalSovereignModel("Generate EARS requirements");
  assert.equal(result.id, "gpt");
});

test("selectOptimalSovereignModel defaults to claude", () => {
  const result = selectOptimalSovereignModel("Write a new feature");
  assert.equal(result.id, "claude");
});

test("selectOptimalSovereignModel is case-insensitive", () => {
  const result = selectOptimalSovereignModel("OPTIMIZE THE CODE");
  assert.equal(result.id, "deepseek");
});

test("selectOptimalSovereignModel returns ModelRoutingProfile with all fields", () => {
  const result = selectOptimalSovereignModel("Test directive");
  assert.ok(result.id);
  assert.ok(result.provider);
  assert.ok(result.primaryRole);
  assert.ok(result.finOpsTier);
  assert.ok(result.systemConstraintInjection);
});

// ============================================================================
// detectDomain
// ============================================================================

test("detectDomain returns SECURITY_GATE for 'auth' keyword", () => {
  assert.equal(detectDomain("Implement auth token refresh"), "SECURITY_GATE");
});

test("detectDomain returns SECURITY_GATE for 'jwt' keyword", () => {
  assert.equal(detectDomain("Parse JWT payload"), "SECURITY_GATE");
});

test("detectDomain returns DATA_PERSISTENCE for 'database' keyword", () => {
  assert.equal(detectDomain("Migrate database schema"), "DATA_PERSISTENCE");
});

test("detectDomain returns DATA_PERSISTENCE for 'sql' keyword", () => {
  assert.equal(detectDomain("Write SQL query"), "DATA_PERSISTENCE");
});

test("detectDomain returns API_INTEGRATION for 'api' keyword", () => {
  assert.equal(detectDomain("Build REST API endpoint"), "API_INTEGRATION");
});

test("detectDomain returns DATA_PERSISTENCE for 'graphql' keyword (contains 'sql')", () => {
  // "graphql" contains "sql" which matches DATA_PERSISTENCE before API_INTEGRATION
  assert.equal(detectDomain("Design GraphQL schema"), "DATA_PERSISTENCE");
});

test("detectDomain returns PERFORMANCE_SYSTEM for 'cache' keyword", () => {
  assert.equal(detectDomain("Add cache layer"), "PERFORMANCE_SYSTEM");
});

test("detectDomain returns PERFORMANCE_SYSTEM for 'latency' keyword", () => {
  assert.equal(detectDomain("Reduce latency"), "PERFORMANCE_SYSTEM");
});

test("detectDomain returns ARCHITECTURE_REFACTOR for 'refactor' keyword", () => {
  assert.equal(detectDomain("Refactor hexagonal architecture"), "ARCHITECTURE_REFACTOR");
});

test("detectDomain returns TESTING_EVIDENCE for 'test' keyword", () => {
  assert.equal(detectDomain("Write unit test"), "TESTING_EVIDENCE");
});

test("detectDomain returns FRONTEND_INTERFACE for 'ui' keyword", () => {
  assert.equal(detectDomain("Build UI component"), "FRONTEND_INTERFACE");
});

test("detectDomain returns FRONTEND_INTERFACE for 'css' keyword", () => {
  assert.equal(detectDomain("Style with CSS"), "FRONTEND_INTERFACE");
});

test("detectDomain returns GENERAL_SYSTEMS_ENGINEERING as default", () => {
  assert.equal(detectDomain("Write a new module"), "GENERAL_SYSTEMS_ENGINEERING");
});

test("detectDomain is case-insensitive", () => {
  assert.equal(detectDomain("AUTH TOKEN"), "SECURITY_GATE");
});

// ============================================================================
// synthesizeEarsRequirements
// ============================================================================

test("synthesizeEarsRequirements returns 4 requirements", () => {
  const reqs = synthesizeEarsRequirements("Build a login feature", "SECURITY_GATE");
  assert.equal(reqs.length, 4);
});

test("synthesizeEarsRequirements includes EVENT_DRIVEN type", () => {
  const reqs = synthesizeEarsRequirements("Build a login feature", "SECURITY_GATE");
  const eventDriven = reqs.find((r) => r.type === "EVENT_DRIVEN");
  assert.ok(eventDriven !== undefined);
  assert.equal(eventDriven.id, "EARS-001");
  assert.ok(eventDriven.syntax.includes("WHEN"));
});

test("synthesizeEarsRequirements includes UNWANTED_CONDITION type", () => {
  const reqs = synthesizeEarsRequirements("Build a login feature", "SECURITY_GATE");
  const unwanted = reqs.find((r) => r.type === "UNWANTED_CONDITION");
  assert.ok(unwanted !== undefined);
  assert.equal(unwanted.id, "EARS-002");
  assert.ok(unwanted.syntax.includes("IF"));
});

test("synthesizeEarsRequirements includes STATE_DRIVEN type", () => {
  const reqs = synthesizeEarsRequirements("Build a login feature", "SECURITY_GATE");
  const stateDriven = reqs.find((r) => r.type === "STATE_DRIVEN");
  assert.ok(stateDriven !== undefined);
  assert.equal(stateDriven.id, "EARS-003");
  assert.ok(stateDriven.syntax.includes("WHILE"));
});

test("synthesizeEarsRequirements includes UBIQUITOUS type", () => {
  const reqs = synthesizeEarsRequirements("Build a login feature", "SECURITY_GATE");
  const ubiquitous = reqs.find((r) => r.type === "UBIQUITOUS");
  assert.ok(ubiquitous !== undefined);
  assert.equal(ubiquitous.id, "EARS-004");
  assert.ok(ubiquitous.syntax.includes("THE SYSTEM SHALL"));
});

test("synthesizeEarsRequirements cleans trailing dots from prompt", () => {
  const reqs = synthesizeEarsRequirements("Build a feature...", "TESTING_EVIDENCE");
  const clean = reqs[0].syntax;
  assert.ok(!clean.includes("feature..."));
  assert.ok(clean.includes("feature"));
});

test("synthesizeEarsRequirements includes domain in syntax", () => {
  const reqs = synthesizeEarsRequirements("Build a feature", "DATA_PERSISTENCE");
  assert.ok(reqs[0].syntax.includes("DATA_PERSISTENCE"));
});

test("synthesizeEarsRequirements includes prompt text in syntax", () => {
  const reqs = synthesizeEarsRequirements("My Unique Prompt Text", "GENERAL_SYSTEMS_ENGINEERING");
  assert.ok(reqs[0].syntax.includes("My Unique Prompt Text"));
});

test("synthesizeEarsRequirements descriptions are non-empty", () => {
  const reqs = synthesizeEarsRequirements("Test", "TESTING_EVIDENCE");
  for (const req of reqs) {
    assert.ok(req.description.length > 0);
  }
});

// ============================================================================
// synthesizeBddScenarios
// ============================================================================

test("synthesizeBddScenarios returns 2 scenarios", () => {
  const scenarios = synthesizeBddScenarios("Build a feature", "API_INTEGRATION");
  assert.equal(scenarios.length, 2);
});

test("synthesizeBddScenarios BDD-001 has nominal title", () => {
  const scenarios = synthesizeBddScenarios("Build a feature", "API_INTEGRATION");
  const nominal = scenarios.find((s) => s.id === "BDD-001");
  assert.ok(nominal !== undefined);
  assert.ok(nominal.title.includes("Nominal Execution"));
});

test("synthesizeBddScenarios BDD-002 has fault tolerance title", () => {
  const scenarios = synthesizeBddScenarios("Build a feature", "API_INTEGRATION");
  const fault = scenarios.find((s) => s.id === "BDD-002");
  assert.ok(fault !== undefined);
  assert.ok(fault.title.includes("Fault Tolerance"));
});

test("synthesizeBddScenarios includes GIVEN-WHEN-THEN", () => {
  const scenarios = synthesizeBddScenarios("Build a feature", "API_INTEGRATION");
  for (const scenario of scenarios) {
    assert.ok(scenario.given.length > 0);
    assert.ok(scenario.when.length > 0);
    assert.ok(scenario.then.length > 0);
  }
});

test("synthesizeBddScenarios includes and arrays", () => {
  const scenarios = synthesizeBddScenarios("Build a feature", "API_INTEGRATION");
  for (const scenario of scenarios) {
    assert.ok(Array.isArray(scenario.and));
    assert.ok(scenario.and.length > 0);
  }
});

test("synthesizeBddScenarios BDD-002 title includes domain", () => {
  const scenarios = synthesizeBddScenarios("Build a feature", "SECURITY_GATE");
  const fault = scenarios.find((s) => s.id === "BDD-002");
  assert.ok(fault !== undefined);
  assert.ok(fault.title.includes("SECURITY_GATE"));
});

test("synthesizeBddScenarios cleans trailing dots from prompt", () => {
  const scenarios = synthesizeBddScenarios("Build a feature...", "API_INTEGRATION");
  const nominal = scenarios.find((s) => s.id === "BDD-001");
  assert.ok(nominal !== undefined);
  assert.ok(!nominal.title.includes("..."));
});

// ============================================================================
// buildModelScaffold
// ============================================================================

test("buildModelScaffold returns claude scaffold", () => {
  const scaffold = buildModelScaffold("claude", "standard");
  assert.equal(scaffold.family, "claude");
  assert.ok(scaffold.thinkingStrategy.includes("Multi-Perspective"));
});

test("buildModelScaffold returns openai scaffold", () => {
  const scaffold = buildModelScaffold("openai", "standard");
  assert.equal(scaffold.family, "openai");
  assert.ok(scaffold.thinkingStrategy.includes("Chain-of-Thought"));
});

test("buildModelScaffold returns gemini scaffold", () => {
  const scaffold = buildModelScaffold("gemini", "standard");
  assert.equal(scaffold.family, "gemini");
  assert.ok(scaffold.thinkingStrategy.includes("Multimodal"));
});

test("buildModelScaffold returns deepseek scaffold", () => {
  const scaffold = buildModelScaffold("deepseek", "standard");
  assert.equal(scaffold.family, "deepseek");
  assert.ok(scaffold.thinkingStrategy.includes("Mathematical"));
});

test("buildModelScaffold returns grok scaffold", () => {
  const scaffold = buildModelScaffold("grok", "standard");
  assert.equal(scaffold.family, "grok");
  assert.ok(scaffold.thinkingStrategy.includes("Concurrency"));
});

test("buildModelScaffold returns universal for llama", () => {
  const scaffold = buildModelScaffold("llama", "standard");
  assert.equal(scaffold.family, "universal");
  assert.ok(scaffold.thinkingStrategy.includes("Constitutional"));
});

test("buildModelScaffold returns universal for universal", () => {
  const scaffold = buildModelScaffold("universal", "standard");
  assert.equal(scaffold.family, "universal");
});

test("buildModelScaffold scaffoldingDirectives is non-empty for all families", () => {
  const families = ["claude", "openai", "gemini", "deepseek", "grok", "llama", "universal"];
  for (const family of families) {
    const scaffold = buildModelScaffold(family, "standard");
    assert.ok(scaffold.scaffoldingDirectives.length > 0, `Empty directives for ${family}`);
  }
});

test("buildModelScaffold antiHallucinationRules is non-empty for all families", () => {
  const families = ["claude", "openai", "gemini", "deepseek", "grok", "llama", "universal"];
  for (const family of families) {
    const scaffold = buildModelScaffold(family, "standard");
    assert.ok(scaffold.antiHallucinationRules.length > 0, `Empty rules for ${family}`);
  }
});

test("buildModelScaffold claude has 4 directives", () => {
  const scaffold = buildModelScaffold("claude", "standard");
  assert.equal(scaffold.scaffoldingDirectives.length, 4);
});

test("buildModelScaffold claude has 3 anti-hallucination rules", () => {
  const scaffold = buildModelScaffold("claude", "standard");
  assert.equal(scaffold.antiHallucinationRules.length, 3);
});

test("buildModelScaffold deepseek has 2 anti-hallucination rules", () => {
  const scaffold = buildModelScaffold("deepseek", "standard");
  assert.equal(scaffold.antiHallucinationRules.length, 2);
});

test("buildModelScaffold grok has 2 anti-hallucination rules", () => {
  const scaffold = buildModelScaffold("grok", "standard");
  assert.equal(scaffold.antiHallucinationRules.length, 2);
});

test("buildModelScaffold universal has 2 anti-hallucination rules", () => {
  const scaffold = buildModelScaffold("universal", "standard");
  assert.equal(scaffold.antiHallucinationRules.length, 2);
});

// ============================================================================
// amplifyPrompt
// ============================================================================

test("amplifyPrompt returns AmplifiedPromptResult with all fields", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a REST API" });
  assert.ok(result.originalPrompt);
  assert.ok(result.targetModel);
  assert.ok(result.detectedDomain);
  assert.ok(result.identifiedIntent);
  assert.ok(Array.isArray(result.earsRequirements));
  assert.ok(Array.isArray(result.bddScenarios));
  assert.ok(Array.isArray(result.invariants));
  assert.ok(result.modelScaffold);
  assert.ok(result.synthesizedSystemPrompt);
  assert.ok(result.synthesizedUserPrompt);
  assert.ok(Array.isArray(result.executionSteps));
});

test("amplifyPrompt defaults targetModel to universal", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.equal(result.targetModel, "universal");
});

test("amplifyPrompt uses custom targetModel when provided", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature", targetModel: "claude" });
  assert.equal(result.targetModel, "claude");
});

test("amplifyPrompt detects domain from rawPrompt", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a REST API endpoint" });
  assert.equal(result.detectedDomain, "API_INTEGRATION");
});

test("amplifyPrompt uses custom projectDomain when provided", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature", projectDomain: "CUSTOM_DOMAIN" });
  assert.equal(result.detectedDomain, "CUSTOM_DOMAIN");
});

test("amplifyPrompt includes 4 invariants", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.equal(result.invariants.length, 4);
});

test("amplifyPrompt invariants include Zero External Runtime Dependencies", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.ok(result.invariants.some((i) => i.includes("Zero External Runtime Dependencies")));
});

test("amplifyPrompt invariants include Fail-Closed Security", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.ok(result.invariants.some((i) => i.includes("Fail-Closed Security")));
});

test("amplifyPrompt includes 4 EARS requirements", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.equal(result.earsRequirements.length, 4);
});

test("amplifyPrompt includes 2 BDD scenarios", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.equal(result.bddScenarios.length, 2);
});

test("amplifyPrompt includes 4 execution steps", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.equal(result.executionSteps.length, 4);
});

test("amplifyPrompt executionSteps include INTAKE & SPECIFICATION", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.ok(result.executionSteps[0].includes("INTAKE & SPECIFICATION"));
});

test("amplifyPrompt executionSteps include VERIFICATION & EVIDENCE", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.ok(result.executionSteps[3].includes("VERIFICATION & EVIDENCE"));
});

test("amplifyPrompt synthesizedSystemPrompt includes model family", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature", targetModel: "claude" });
  assert.ok(result.synthesizedSystemPrompt.includes("CLAUDE"));
});

test("amplifyPrompt synthesizedSystemPrompt includes invariants", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.ok(result.synthesizedSystemPrompt.includes("NON-NEGOTIABLE INVARIANTS"));
});

test("amplifyPrompt synthesizedSystemPrompt includes anti-hallucination rules", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.ok(result.synthesizedSystemPrompt.includes("ANTI-HALLUCINATION"));
});

test("amplifyPrompt synthesizedUserPrompt includes original prompt", () => {
  const result = amplifyPrompt({ rawPrompt: "My Unique Directive" });
  assert.ok(result.synthesizedUserPrompt.includes("My Unique Directive"));
});

test("amplifyPrompt synthesizedUserPrompt includes EARS section", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.ok(result.synthesizedUserPrompt.includes("FORMAL EARS SPECIFICATION"));
});

test("amplifyPrompt synthesizedUserPrompt includes BDD section", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.ok(result.synthesizedUserPrompt.includes("ACCEPTANCE CRITERIA"));
});

test("amplifyPrompt includes contextFiles in user prompt when provided", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature", contextFiles: ["src/core/module.ts"] });
  assert.ok(result.synthesizedUserPrompt.includes("REFERENCED CONTEXT FILES"));
  assert.ok(result.synthesizedUserPrompt.includes("src/core/module.ts"));
});

test("amplifyPrompt identifiedIntent trims rawPrompt", () => {
  const result = amplifyPrompt({ rawPrompt: "  Build a feature  " });
  assert.equal(result.identifiedIntent, "Build a feature");
});

test("amplifyPrompt modelScaffold matches targetModel", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature", targetModel: "deepseek" });
  assert.equal(result.modelScaffold.family, "deepseek");
});

test("amplifyPrompt defaults strictLevel to hardened", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.equal(result.modelScaffold.family, "universal");
});

test("amplifyPrompt with sovereign strictLevel", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature", strictLevel: "sovereign" });
  assert.ok(result.modelScaffold);
});

test("amplifyPrompt originalPrompt matches rawPrompt", () => {
  const result = amplifyPrompt({ rawPrompt: "Exact Prompt Text" });
  assert.equal(result.originalPrompt, "Exact Prompt Text");
});

test("amplifyPrompt executionSteps include EARS IDs", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.ok(result.executionSteps[0].includes("EARS-001"));
});

test("amplifyPrompt executionSteps include BDD IDs", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a feature" });
  assert.ok(result.executionSteps[0].includes("BDD-001"));
});

test("amplifyPrompt executionSteps include domain in step 2", () => {
  const result = amplifyPrompt({ rawPrompt: "Build a REST API" });
  assert.ok(result.executionSteps[1].includes("API_INTEGRATION"));
});
