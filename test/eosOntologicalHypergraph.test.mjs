/**
 * @file eosOntologicalHypergraph.test.mjs
 * @description BDD test suite for SPEC-333 / CHANGE-195: Autonomous Ontological Hypergraph
 * & Bitemporal Entity Resolution Engine (BDD-1773..1778).
 *
 * Invariant: Pure Layer-0 testing, zero external npm runtime dependencies.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { EosOntologicalHypergraphCore } from "../src/core/eosOntologicalHypergraph.ts";

const RECEIPT_PATH = path.join(os.tmpdir(), `eos-test-ONTOLOGICAL_HYPERGRAPH_RECEIPT-${process.pid}.json`);

test("SPEC-333 / CHANGE-195: Autonomous Ontological Hypergraph & Bitemporal Entity Resolution Engine", async (t) => {
  await t.test("BDD-1773: Bitemporal Assertion and Point-in-Time As-Of Snapshot Querying", () => {
    const engine = new EosOntologicalHypergraphCore();

    // T1: Initial assertion: Component active from valid time 100 to 500
    const entityV1 = engine.assertEntity(
      {
        entityId: "comp:payment-service",
        name: "Payment Service",
        kind: "Component",
        validFrom: 100,
        validTo: 500,
      },
      1, // Tx = 1
    );

    assert.strictEqual(entityV1.temporal.txFrom, 1);
    assert.strictEqual(entityV1.temporal.txTo, Number.POSITIVE_INFINITY);

    // T2: Query as-of Tx = 1 at valid time 200 -> Found
    const q1 = engine.queryAsOf({ validTime: 200, asOfTxTime: 1 }, { clearance: "UNCLASSIFIED", compartments: [] });
    assert.strictEqual(q1.entities.length, 1);
    assert.strictEqual(q1.entities[0].name, "Payment Service");

    // T3: Update / Correction at Tx = 3: Name corrected to "Global Payment Service", valid 100..600
    const entityV2 = engine.assertEntity(
      {
        entityId: "comp:payment-service",
        name: "Global Payment Service",
        kind: "Component",
        validFrom: 100,
        validTo: 600,
      },
      3, // Tx = 3
    );

    assert.strictEqual(entityV2.temporal.txFrom, 3);
    assert.strictEqual(entityV2.temporal.txTo, Number.POSITIVE_INFINITY);

    // Historical Audit: Query as-of Tx = 2 at valid time 200 -> Still reflects original assertion V1
    const qHistorical = engine.queryAsOf(
      { validTime: 200, asOfTxTime: 2 },
      { clearance: "UNCLASSIFIED", compartments: [] },
    );
    assert.strictEqual(qHistorical.entities.length, 1);
    assert.strictEqual(qHistorical.entities[0].name, "Payment Service");

    // Current Audit: Query as-of Tx = 4 at valid time 200 -> Reflects updated correction V2
    const qCurrent = engine.queryAsOf(
      { validTime: 200, asOfTxTime: 4 },
      { clearance: "UNCLASSIFIED", compartments: [] },
    );
    assert.strictEqual(qCurrent.entities.length, 1);
    assert.strictEqual(qCurrent.entities[0].name, "Global Payment Service");
  });

  await t.test("BDD-1774: Synthesis & Relational Linking of N-ary Multi-Entity Hyperedges", () => {
    const engine = new EosOntologicalHypergraphCore();

    // Register 4 distinct entities representing a multi-party deployment
    engine.assertEntity({
      entityId: "comp:gateway",
      name: "API Gateway",
      kind: "Component",
      validFrom: 0,
      validTo: 1000,
    });
    engine.assertEntity({
      entityId: "squad:edge-infra",
      name: "Edge Squad",
      kind: "Squad",
      validFrom: 0,
      validTo: 1000,
    });
    engine.assertEntity({
      entityId: "cert:pqc-tls",
      name: "Post-Quantum TLS Cert",
      kind: "Credential",
      validFrom: 0,
      validTo: 1000,
    });
    engine.assertEntity({
      entityId: "cluster:eu-west",
      name: "EU West Mesh",
      kind: "Cluster",
      validFrom: 0,
      validTo: 1000,
    });

    // Synthesize atomic 4-ary hyperedge
    const hyperedge = engine.assertHyperedge({
      edgeId: "edge:deploy-4way-001",
      relation: "DEPLOYMENT_AUTHORIZATION",
      participants: [
        { entityId: "comp:gateway", role: "DEPLOYABLE_TARGET" },
        { entityId: "squad:edge-infra", role: "AUTHORIZER_SQUAD" },
        { entityId: "cert:pqc-tls", role: "SECURITY_CREDENTIAL" },
        { entityId: "cluster:eu-west", role: "TARGET_INFRASTRUCTURE" },
      ],
      validFrom: 10,
      validTo: 900,
    });

    assert.strictEqual(hyperedge.edgeId, "edge:deploy-4way-001");
    assert.strictEqual(hyperedge.participants.length, 4);
    assert.strictEqual(hyperedge.classification, "UNCLASSIFIED");
    assert.ok(hyperedge.checksumSha256.length === 64);
  });

  await t.test("BDD-1775: Deterministic Entity Deduplication, Fingerprinting & Lexical Similarity", () => {
    const engine = new EosOntologicalHypergraphCore();

    // Assert canonical entity
    const canonical = engine.assertEntity({
      entityId: "catalog:spotify-audio-kernel",
      name: "Spotify Audio Kernel",
      kind: "Component",
      aliases: ["github:spotify/audio-kernel"],
      attributes: { repo: "spotify/audio-kernel", slug: "audio-kernel" },
      validFrom: 0,
      validTo: 5000,
    });

    // 1. Exact match via alias
    const matchAlias = engine.resolveEntity({
      sourceId: "github:spotify/audio-kernel",
      name: "Different Name",
      kind: "Component",
    });
    assert.strictEqual(matchAlias.canonicalId, canonical.canonicalId);
    assert.strictEqual(matchAlias.method, "EXACT_IDENTIFIER");
    assert.strictEqual(matchAlias.confidenceScore, 1.0);

    // 2. Deterministic attribute match on repo slug
    const matchAttr = engine.resolveEntity({
      sourceId: "datadog:srv_audio_kernel",
      name: "Random Ingestion Name",
      kind: "Component",
      attributes: { repo: "spotify/audio-kernel" },
    });
    assert.strictEqual(matchAttr.canonicalId, canonical.canonicalId);
    assert.strictEqual(matchAttr.method, "DETERMINISTIC_FINGERPRINT");
    assert.strictEqual(matchAttr.confidenceScore, 0.95);

    // 3. Lexical similarity match
    const matchLexical = engine.resolveEntity({
      sourceId: "jira:proj-audio-kernel",
      name: "Spotify Audio Kernel Service",
      kind: "Component",
    });
    assert.strictEqual(matchLexical.canonicalId, canonical.canonicalId);
    assert.strictEqual(matchLexical.method, "LEXICAL_SIMILARITY");
    assert.ok(matchLexical.confidenceScore >= 0.8);
  });

  await t.test("BDD-1776: Multilevel Security (MLS) Lattice & Fail-Closed Redaction", () => {
    const engine = new EosOntologicalHypergraphCore();

    // Add entities with diverse classification levels and compartments
    engine.assertEntity({
      entityId: "comp:public-docs",
      name: "Public Docs",
      kind: "Docs",
      classification: "UNCLASSIFIED",
      validFrom: 0,
      validTo: 1000,
    });
    engine.assertEntity({
      entityId: "comp:crypto-vault",
      name: "Crypto Vault",
      kind: "Vault",
      classification: "SECRET",
      validFrom: 0,
      validTo: 1000,
    });
    engine.assertEntity({
      entityId: "comp:defense-intel",
      name: "Defense Intelligence Core",
      kind: "Defense",
      classification: "TOP_SECRET",
      compartments: ["COMPARTMENT_CYBER"],
      validFrom: 0,
      validTo: 1000,
    });

    // Unclassified accessor can ONLY see unclassified entity
    const resUnclass = engine.queryAsOf(
      { validTime: 500, asOfTxTime: engine.getTxClock() },
      { clearance: "UNCLASSIFIED", compartments: [] },
    );
    assert.strictEqual(resUnclass.entities.length, 1);
    assert.strictEqual(resUnclass.entities[0].entityId, "comp:public-docs");

    // Secret accessor can see Unclassified + Secret
    const resSecret = engine.queryAsOf(
      { validTime: 500, asOfTxTime: engine.getTxClock() },
      { clearance: "SECRET", compartments: [] },
    );
    assert.strictEqual(resSecret.entities.length, 2);
    assert.ok(resSecret.entities.some((e) => e.entityId === "comp:public-docs"));
    assert.ok(resSecret.entities.some((e) => e.entityId === "comp:crypto-vault"));
    assert.ok(!resSecret.entities.some((e) => e.entityId === "comp:defense-intel"));

    // Top Secret without CYBER compartment CANNOT see compartmented Top Secret entity
    const resTopSecretNoComp = engine.queryAsOf(
      { validTime: 500, asOfTxTime: engine.getTxClock() },
      { clearance: "TOP_SECRET", compartments: [] },
    );
    assert.strictEqual(resTopSecretNoComp.entities.length, 2);

    // Top Secret WITH CYBER compartment sees all 3
    const resFull = engine.queryAsOf(
      { validTime: 500, asOfTxTime: engine.getTxClock() },
      { clearance: "TOP_SECRET", compartments: ["COMPARTMENT_CYBER"] },
    );
    assert.strictEqual(resFull.entities.length, 3);
  });

  await t.test("BDD-1777: Topological Graph Traversal and Blast Radius Impact Calculation", () => {
    const engine = new EosOntologicalHypergraphCore();

    engine.assertEntity({
      entityId: "db:primary",
      name: "Primary Database",
      kind: "Database",
      validFrom: 0,
      validTo: 1000,
    });
    engine.assertEntity({
      entityId: "svc:orders",
      name: "Orders Service",
      kind: "Component",
      validFrom: 0,
      validTo: 1000,
    });
    engine.assertEntity({
      entityId: "svc:billing",
      name: "Billing Service",
      kind: "Component",
      validFrom: 0,
      validTo: 1000,
    });
    engine.assertEntity({
      entityId: "svc:frontend",
      name: "Storefront UI",
      kind: "Component",
      validFrom: 0,
      validTo: 1000,
    });

    // Edge 1: DB -> Orders
    engine.assertHyperedge({
      edgeId: "edge:db-orders",
      relation: "DATA_DEPENDENCY",
      participants: [
        { entityId: "db:primary", role: "SOURCE" },
        { entityId: "svc:orders", role: "CONSUMER" },
      ],
      validFrom: 0,
      validTo: 1000,
    });

    // Edge 2: Orders -> Billing + Storefront
    engine.assertHyperedge({
      edgeId: "edge:orders-downstream",
      relation: "SERVICE_INTERCONNECT",
      participants: [
        { entityId: "svc:orders", role: "PRODUCER" },
        { entityId: "svc:billing", role: "SUBSCRIBER" },
        { entityId: "svc:frontend", role: "CLIENT" },
      ],
      validFrom: 0,
      validTo: 1000,
    });

    const blast = engine.computeBlastRadius(
      "db:primary",
      3,
      { clearance: "SECRET", compartments: [] },
      { validTime: 500, asOfTxTime: engine.getTxClock() },
    );

    assert.strictEqual(blast.rootEntityId, "db:primary");
    assert.strictEqual(blast.totalImpacted, 3);

    const ordersImpact = blast.impactedEntities.find((e) => e.entityId === "svc:orders");
    assert.ok(ordersImpact);
    assert.strictEqual(ordersImpact.depth, 1);

    const billingImpact = blast.impactedEntities.find((e) => e.entityId === "svc:billing");
    assert.ok(billingImpact);
    assert.strictEqual(billingImpact.depth, 2);
    assert.deepStrictEqual(billingImpact.path, ["db:primary", "svc:orders", "svc:billing"]);
  });

  await t.test("BDD-1778: Invariant Audit & Cryptographic Evidence Receipt Emission", () => {
    const engine = new EosOntologicalHypergraphCore();

    engine.assertEntity({ entityId: "comp:node1", name: "Node 1", kind: "Component", validFrom: 0, validTo: 100 });
    engine.assertEntity({ entityId: "comp:node2", name: "Node 2", kind: "Component", validFrom: 0, validTo: 100 });
    engine.assertHyperedge({
      edgeId: "edge:1-2",
      relation: "TEST_LINK",
      participants: [
        { entityId: "comp:node1", role: "A" },
        { entityId: "comp:node2", role: "B" },
      ],
      validFrom: 0,
      validTo: 100,
    });
    engine.resolveEntity({ sourceId: "ext:alias1", name: "Node 1", kind: "Component" });

    const receipt = engine.auditHypergraph();

    assert.strictEqual(receipt.specRef, "SPEC-333");
    assert.strictEqual(receipt.bitemporalMonotonicity, true);
    assert.strictEqual(receipt.mlsLatticeContainment, true);
    assert.strictEqual(receipt.referentialIntegrity, true);
    assert.strictEqual(receipt.deduplicationResolved, true);
    assert.strictEqual(receipt.totalEntities, 2);
    assert.strictEqual(receipt.totalHyperedges, 1);
    assert.strictEqual(typeof receipt.sha256Digest, "string");
    assert.strictEqual(receipt.sha256Digest.length, 64);

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");
    assert.ok(fs.existsSync(RECEIPT_PATH));
  });

  await t.test("Edge Case: Hyperedge requires >= 2 participants", () => {
    const engine = new EosOntologicalHypergraphCore();
    engine.assertEntity({ entityId: "comp:lone", name: "Lone", kind: "Component", validFrom: 0, validTo: 100 });

    assert.throws(() => {
      engine.assertHyperedge({
        edgeId: "edge:invalid",
        relation: "UNARY",
        participants: [{ entityId: "comp:lone", role: "SOLITARY" }],
        validFrom: 0,
        validTo: 100,
      });
    }, /requires at least 2 participants/);
  });

  await t.test("Edge Case: Referential integrity enforces participant existence", () => {
    const engine = new EosOntologicalHypergraphCore();
    engine.assertEntity({ entityId: "comp:existing", name: "Existing", kind: "Component", validFrom: 0, validTo: 100 });

    assert.throws(() => {
      engine.assertHyperedge({
        edgeId: "edge:nonexistent",
        relation: "GHOST_LINK",
        participants: [
          { entityId: "comp:existing", role: "VALID" },
          { entityId: "comp:ghost", role: "INVALID" },
        ],
        validFrom: 0,
        validTo: 100,
      });
    }, /Referential integrity violation: Participant entity 'comp:ghost' not found/);
  });

  await t.test("Edge Case: Superevaluation and Supremum Classification on Hyperedges", () => {
    const engine = new EosOntologicalHypergraphCore();
    engine.assertEntity({
      entityId: "comp:unclass",
      name: "Unclass",
      kind: "Component",
      classification: "UNCLASSIFIED",
      validFrom: 0,
      validTo: 100,
    });
    engine.assertEntity({
      entityId: "comp:secret",
      name: "Secret",
      kind: "Component",
      classification: "SECRET",
      validFrom: 0,
      validTo: 100,
    });

    const edge = engine.assertHyperedge({
      edgeId: "edge:unclass-secret",
      relation: "BRIDGE",
      participants: [
        { entityId: "comp:unclass", role: "SOURCE" },
        { entityId: "comp:secret", role: "TARGET" },
      ],
      validFrom: 0,
      validTo: 100,
    });

    // Supremum of UNCLASSIFIED (1) and SECRET (3) must be SECRET (3)
    assert.strictEqual(edge.classification, "SECRET");
  });

  await t.test("BDD-1778B: Mutation-Hardening Classification, Bitemporal & Lexical Edges", () => {
    const engine = new EosOntologicalHypergraphCore();
    assert.strictEqual(engine.getTxClock(), 1);
    assert.strictEqual(engine.advanceTxClock(), 2);

    // Empty graph audit -> deduplicationResolved = false
    const emptyAudit = engine.auditHypergraph();
    assert.strictEqual(emptyAudit.deduplicationResolved, false);

    // Empty-graph traverse exercises entities.length === 0 guard
    assert.deepStrictEqual(engine.traverse("none", 1, { clearance: "UNCLASSIFIED", compartments: [] }), []);

    // Exercise default source, confidenceScore = 1.0, CONFIDENTIAL, SECRET, TOP_SECRET supremum
    const eUnclass = engine.assertEntity(
      {
        entityId: "svc:alpha9",
        name: "Service Alpha 9",
        kind: "Component",
        attributes: { repo: "org/alpha-9", port: 8080 },
        classification: "UNCLASSIFIED",
        validFrom: 10,
        validTo: 50,
      },
      10,
    );
    assert.strictEqual(eUnclass.source, "sovereign-control-plane");
    assert.strictEqual(eUnclass.confidenceScore, 1.0);

    // Supersede entity at txTime = 11 to test entity txTo upper bound (asOfTxTime === 11 excludes old name)
    engine.assertEntity(
      {
        entityId: "svc:alpha9",
        name: "Service Alpha 9 V2",
        kind: "Component",
        attributes: { repo: "org/alpha-9", port: 8080 },
        classification: "UNCLASSIFIED",
        validFrom: 10,
        validTo: 50,
      },
      11,
    );
    const qSupersededEnt = engine.queryAsOf(
      { validTime: 25, asOfTxTime: 11 },
      { clearance: "UNCLASSIFIED", compartments: [] },
    );
    assert.strictEqual(qSupersededEnt.entities.length, 1);
    assert.strictEqual(qSupersededEnt.entities[0].name, "Service Alpha 9 V2");

    engine.assertEntity(
      {
        entityId: "svc:conf",
        name: "Service Conf",
        kind: "Component",
        classification: "CONFIDENTIAL",
        compartments: ["COMP_A"],
        validFrom: 10,
        validTo: 50,
      },
      11,
    );

    engine.assertEntity(
      {
        entityId: "svc:top",
        name: "Service Top",
        kind: "Service",
        classification: "TOP_SECRET",
        compartments: ["COMP_B"],
        validFrom: 10,
        validTo: 50,
      },
      12,
    );

    // Single entity in 1-item audit -> size === 1 => deduplicationResolved === true
    const confEdge = engine.assertHyperedge(
      {
        edgeId: "edge:conf",
        relation: "CONF_LINK",
        participants: [
          { entityId: "svc:alpha9", role: "A" },
          { entityId: "svc:conf", role: "B" },
        ],
        validFrom: 10,
        validTo: 50,
      },
      15,
    );
    assert.strictEqual(confEdge.classification, "CONFIDENTIAL");

    // Supersede hyperedge at tx = 20 with TOP_SECRET supremum
    const topEdge = engine.assertHyperedge(
      {
        edgeId: "edge:conf",
        relation: "TOP_LINK",
        participants: [
          { entityId: "svc:alpha9", role: "A" },
          { entityId: "svc:top", role: "B" },
        ],
        validFrom: 10,
        validTo: 50,
      },
      20,
    );
    assert.strictEqual(topEdge.classification, "TOP_SECRET");

    // Bitemporal boundary queries: txTo boundary (tx=20 must see ONLY new edge, not old) & validTime out of bounds
    const qAt15 = engine.queryAsOf(
      { validTime: 25, asOfTxTime: 15, relation: "CONF_LINK" },
      { clearance: "CONFIDENTIAL", compartments: ["COMP_A"] },
    );
    assert.strictEqual(qAt15.hyperedges.length, 1);

    const qAt20OldRel = engine.queryAsOf(
      { validTime: 25, asOfTxTime: 20, relation: "CONF_LINK" },
      { clearance: "TOP_SECRET", compartments: ["COMP_A", "COMP_B"] },
    );
    assert.strictEqual(qAt20OldRel.hyperedges.length, 0);

    // Missing compartment blocks edge even when entity clearance matches
    const qNoComp = engine.queryAsOf(
      { validTime: 25, asOfTxTime: 16 },
      { clearance: "CONFIDENTIAL", compartments: [] },
    );
    assert.strictEqual(qNoComp.hyperedges.length, 0);

    // Out of validTime range & kind filter
    assert.strictEqual(
      engine.queryAsOf(
        { validTime: 5, asOfTxTime: 25 },
        { clearance: "TOP_SECRET", compartments: ["COMP_A", "COMP_B"] },
      ).entities.length,
      0,
    );
    assert.strictEqual(
      engine.queryAsOf(
        { validTime: 60, asOfTxTime: 25 },
        { clearance: "TOP_SECRET", compartments: ["COMP_A", "COMP_B"] },
      ).entities.length,
      0,
    );
    assert.strictEqual(
      engine.queryAsOf(
        { validTime: 25, asOfTxTime: 25, kind: "Database" },
        { clearance: "TOP_SECRET", compartments: ["COMP_A", "COMP_B"] },
      ).entities.length,
      0,
    );

    // Single-entity traverse default validFrom & root depth === 0; missing root returns []
    assert.deepStrictEqual(
      engine.traverse("missing", 2, { clearance: "TOP_SECRET", compartments: ["COMP_A", "COMP_B"] }),
      [],
    );
    const singleEngine = new EosOntologicalHypergraphCore();
    singleEngine.assertEntity({ entityId: "solo:1", name: "Solo", kind: "Component", validFrom: 10, validTo: 20 });
    assert.strictEqual(singleEngine.auditHypergraph().deduplicationResolved, true);
    assert.deepStrictEqual(singleEngine.traverse("solo:1", 0, { clearance: "UNCLASSIFIED", compartments: [] }), [
      { entityId: "solo:1", depth: 0, path: ["solo:1"] },
    ]);

    // Explicit SECRET hyperedge over UNCLASSIFIED wide-window entities tests edge MLS & validFrom/validTo + redacted participant
    const edgeWindowEng = new EosOntologicalHypergraphCore();
    edgeWindowEng.assertEntity({ entityId: "w:a", name: "WA", kind: "C", validFrom: 0, validTo: 100 });
    edgeWindowEng.assertEntity({ entityId: "w:b", name: "WB", kind: "C", validFrom: 20, validTo: 40 });
    edgeWindowEng.assertHyperedge({
      edgeId: "w:edge-secret",
      relation: "SPAN",
      participants: [
        { entityId: "w:a", role: "A" },
        { entityId: "w:b", role: "B" },
      ],
      classification: "SECRET",
      validFrom: 15,
      validTo: 50,
    });
    const txW = edgeWindowEng.getTxClock();
    // Before hyperedge validFrom (valid=10 <= validTo 50, so OR bug wrongly passes)
    assert.strictEqual(
      edgeWindowEng.queryAsOf({ validTime: 10, asOfTxTime: txW }, { clearance: "SECRET", compartments: [] }).hyperedges
        .length,
      0,
    );
    // After hyperedge validTo (valid=60 >= validFrom 15, so OR bug wrongly passes)
    assert.strictEqual(
      edgeWindowEng.queryAsOf({ validTime: 60, asOfTxTime: txW }, { clearance: "SECRET", compartments: [] }).hyperedges
        .length,
      0,
    );
    // Valid time inside hyperedge (16) but participant w:b starts at 20 -> participant redacted hides hyperedge
    assert.strictEqual(
      edgeWindowEng.queryAsOf({ validTime: 16, asOfTxTime: txW }, { clearance: "SECRET", compartments: [] }).hyperedges
        .length,
      0,
    );
    // Valid time 25 inside both entities, queried as UNCLASSIFIED -> explicit SECRET edge blocked
    assert.strictEqual(
      edgeWindowEng.queryAsOf({ validTime: 25, asOfTxTime: txW }, { clearance: "UNCLASSIFIED", compartments: [] })
        .hyperedges.length,
      0,
    );
    // Valid time 25 inside both entities, queried as SECRET -> allowed
    assert.strictEqual(
      edgeWindowEng.queryAsOf({ validTime: 25, asOfTxTime: txW }, { clearance: "SECRET", compartments: [] }).hyperedges
        .length,
      1,
    );

    // ResolveEntity contracts: exact, attr non-string ignored, different kind rejected, lexical threshold & bigrams/digits
    const lexEng = new EosOntologicalHypergraphCore();
    lexEng.assertEntity({
      entityId: "node:num2",
      name: "Cluster Node 2",
      kind: "Node",
      attributes: { port: 8080, tag: "primary" },
      validFrom: 0,
      validTo: 100,
    });
    lexEng.assertEntity({ entityId: "twin:1", name: "Twin Zeta", kind: "Twin", validFrom: 0, validTo: 100 });
    lexEng.assertEntity({ entityId: "twin:2", name: "Twin Zeta", kind: "Twin", validFrom: 0, validTo: 100 });
    lexEng.assertEntity({ entityId: "bg:core", name: "hypergraphcorex", kind: "Kernel", validFrom: 0, validTo: 100 });

    // Non-string candidate attribute (port: 8080) must NOT crash when incoming attribute port is a string
    const nonStrAttr = lexEng.resolveEntity({
      sourceId: "ext:port-probe",
      name: "Unrelated Name ZZZ",
      kind: "Node",
      attributes: { port: "8080" },
    });
    assert.strictEqual(nonStrAttr.canonicalId, "ext:port-probe");

    // Digit sensitivity: "Cluster Node 3" shares 2 words of 4 -> 0.5/bigrams; wait: single token "n2" vs "n3"
    lexEng.assertEntity({ entityId: "dig:2", name: "n2", kind: "Digit", validFrom: 0, validTo: 100 });
    const digMismatch = lexEng.resolveEntity({ sourceId: "ext:dig3", name: "n3", kind: "Digit" });
    assert.strictEqual(digMismatch.canonicalId, "ext:dig3");

    // Empty cleaned alphanumeric ("---") vs "Twin Zeta" must not merge (returns 0.0 -> self-provisioned)
    const punctMismatch = lexEng.resolveEntity({ sourceId: "ext:punct", name: "--- +++", kind: "Twin" });
    assert.strictEqual(punctMismatch.canonicalId, "ext:punct");

    // Tied scores keep first candidate (score > highestScore, not >=)
    const twinRes = lexEng.resolveEntity({ sourceId: "ext:twin", name: "Twin Zeta", kind: "Twin" });
    assert.strictEqual(twinRes.canonicalId, "twin:1");

    // Single-token bigram similarity: 13/15 = 0.87, exercises bigram loop, wordInter=0, union calculation
    const bgRes = lexEng.resolveEntity({ sourceId: "ext:bg", name: "hypergraphcorey", kind: "Kernel" });
    assert.strictEqual(bgRes.canonicalId, "bg:core");
    assert.strictEqual(bgRes.method, "LEXICAL_SIMILARITY");
    assert.strictEqual(bgRes.confidenceScore, 0.87);

    const rExact = engine.resolveEntity({ sourceId: "svc:alpha9", name: "X", kind: "Component" });
    assert.deepStrictEqual(rExact.matchedAttributes, ["id_exact_match"]);

    const rDiffKind = engine.resolveEntity({
      sourceId: "other:alpha9",
      name: "Completely Different Name",
      kind: "Database",
      attributes: { repo: "org/alpha-9", port: 8080 },
    });
    assert.strictEqual(rDiffKind.method, "EXACT_IDENTIFIER");
    assert.strictEqual(rDiffKind.confidenceScore, 1.0);
    assert.deepStrictEqual(rDiffKind.matchedAttributes, ["self_canonical_provisioning"]);

    const rLexExact = engine.resolveEntity({
      sourceId: "ext:alpha9-punct",
      name: "Service Alpha 9 V2!",
      kind: "Component",
    });
    assert.strictEqual(rLexExact.method, "LEXICAL_SIMILARITY");
    assert.strictEqual(rLexExact.confidenceScore, 1.0);
    assert.deepStrictEqual(rLexExact.matchedAttributes, ["name_lexical_similarity"]);

    const rDigitDiff = engine.resolveEntity({
      sourceId: "ext:alpha10",
      name: "X",
      kind: "Component",
    });
    assert.strictEqual(rDigitDiff.canonicalId, "ext:alpha10");

    // Audit failure paths: invalid entity validFrom >= validTo and invalid hyperedge validFrom >= validTo
    const badEntEngine = new EosOntologicalHypergraphCore();
    badEntEngine.assertEntity({ entityId: "bad:e", name: "Bad", kind: "C", validFrom: 10, validTo: 10 });
    assert.strictEqual(badEntEngine.auditHypergraph().bitemporalMonotonicity, false);

    const badEdgeEngine = new EosOntologicalHypergraphCore();
    badEdgeEngine.assertEntity({ entityId: "ok:1", name: "O1", kind: "C", validFrom: 1, validTo: 20 });
    badEdgeEngine.assertEntity({ entityId: "ok:2", name: "O2", kind: "C", validFrom: 1, validTo: 20 });
    badEdgeEngine.assertHyperedge({
      edgeId: "bad:h",
      relation: "R",
      participants: [
        { entityId: "ok:1", role: "A" },
        { entityId: "ok:2", role: "B" },
      ],
      validFrom: 5,
      validTo: 5,
    });
    assert.strictEqual(badEdgeEngine.auditHypergraph().bitemporalMonotonicity, false);
  });
});
