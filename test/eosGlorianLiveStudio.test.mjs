/**
 * @file eosGlorianLiveStudio.test.mjs
 * @description Automated test suite for SPEC-361 / CHANGE-223: Glorian Live Studio & Interactive Visual HUD.
 *
 * Verifies BDD-1945 through BDD-1950:
 * - BDD-1945: Native HTTP Server Lifecycle & Routing
 * - BDD-1946: Real-Time SSE Telemetry Stream Monotonicity
 * - BDD-1947: Single-File Reactive HUD Rendering
 * - BDD-1948: Interactive 2D Bitemporal Projection Endpoint
 * - BDD-1949: Interactive Transitive Blast-Radius Endpoint
 * - BDD-1950: Full Diagnostic Audit & Receipt Generation
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { EosGlorianLiveStudio } from "../src/core/eosGlorianLiveStudio.ts";

test("BDD-1945: Native HTTP Server Lifecycle & Routing", async () => {
  const studio = new EosGlorianLiveStudio({ port: 0 });
  assert.equal(studio.getState(), "STOPPED");

  const startRes = await studio.start();
  assert.equal(studio.getState(), "RUNNING");
  assert.ok(startRes.port > 0);
  assert.ok(startRes.url.startsWith("http://127.0.0.1:"));

  // Check /api/health
  const healthRes = await fetch(`${startRes.url}/api/health`);
  assert.equal(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.equal(healthData.status, "OK");
  assert.equal(healthData.state, "RUNNING");

  // Check /api/snapshot
  const snapshotRes = await fetch(`${startRes.url}/api/snapshot`);
  assert.equal(snapshotRes.status, 200);
  const snapshotData = await snapshotRes.json();
  assert.equal(snapshotData.system.componentId, "eos-system-control-plane");
  assert.ok(snapshotData.integrityHash.length === 64);

  // Stop server
  await studio.stop();
  assert.equal(studio.getState(), "STOPPED");
});

test("BDD-1946: Real-Time SSE Telemetry Stream Monotonicity", async () => {
  const studio = new EosGlorianLiveStudio({ port: 0 });
  const startRes = await studio.start();

  // Connect client to SSE stream
  const abortCtrl = new AbortController();
  const sseResponse = await fetch(`${startRes.url}/api/stream`, {
    signal: abortCtrl.signal,
  });

  assert.equal(sseResponse.status, 200);
  assert.ok(sseResponse.headers.get("content-type")?.includes("text/event-stream"));

  // Verify client is registered
  assert.equal(studio.getActiveSseClientsCount(), 1);

  // Broadcast events and verify monotonic sequence
  const ev1 = studio.broadcastEvent("SWARM_METRIC", "test_runner", { term: 15 });
  const ev2 = studio.broadcastEvent("SCHEDULER_METRIC", "test_runner", { ops: 500000 });
  assert.ok(ev2.id > ev1.id);

  abortCtrl.abort();
  await new Promise((r) => setTimeout(r, 50));
  await studio.stop();
});

test("BDD-1947: Single-File Reactive HUD Rendering", async () => {
  const studio = new EosGlorianLiveStudio({ port: 0 });
  const startRes = await studio.start();

  const rootRes = await fetch(`${startRes.url}/`);
  assert.equal(rootRes.status, 200);
  assert.ok(rootRes.headers.get("content-type")?.includes("text/html"));

  const html = await rootRes.text();
  assert.ok(html.includes("<!DOCTYPE html>"));
  assert.ok(html.includes("GLORIAN LIVE STUDIO"));
  assert.ok(html.includes("Sugiyama Layered DAG Layout"));
  assert.ok(html.includes('<svg width="100%"'));
  assert.ok(!html.includes('<script src="http'));
  assert.ok(!html.includes('<link rel="stylesheet" href="http'));

  // Check /api/canvas endpoint
  const canvasRes = await fetch(`${startRes.url}/api/canvas`);
  assert.equal(canvasRes.status, 200);
  assert.ok(canvasRes.headers.get("content-type")?.includes("image/svg+xml"));

  await studio.stop();
});

test("BDD-1948: Interactive 2D Bitemporal Projection Endpoint", async () => {
  const studio = new EosGlorianLiveStudio({ port: 0 });
  const startRes = await studio.start();

  // Test full projection
  const resFull = await fetch(`${startRes.url}/api/temporal/projection?asOfTx=42&asOfValid=1700000000000`);
  assert.equal(resFull.status, 200);
  const dataFull = await resFull.json();
  assert.equal(dataFull.asOfTx, 42);
  assert.ok(dataFull.activeEntities.length >= 8);
  assert.ok(dataFull.factsCount > 0);
  assert.ok(dataFull.queryDurationMs < 100);

  // Test historical slice
  const resHist = await fetch(`${startRes.url}/api/temporal/projection?asOfTx=20&asOfValid=1600000000000`);
  assert.equal(resHist.status, 200);
  const dataHist = await resHist.json();
  assert.equal(dataHist.asOfTx, 20);
  assert.equal(dataHist.activeEntities.length, 4);

  await studio.stop();
});

test("BDD-1949: Interactive Transitive Blast-Radius Endpoint", async () => {
  const studio = new EosGlorianLiveStudio({ port: 0 });
  const startRes = await studio.start();

  const blastRes = await fetch(`${startRes.url}/api/blast-radius?node=SPEC-361-glorian-live-studio`);
  assert.equal(blastRes.status, 200);
  const blast = await blastRes.json();

  assert.equal(blast.targetNode, "SPEC-361-glorian-live-studio");
  assert.ok(blast.upstreamAncestors.includes("SPEC-358-architectural-canvas"));
  assert.ok(blast.downstreamDependents.includes("cli-toolchain-studio"));
  assert.ok(blast.totalImpactedCount >= 5);
  assert.equal(blast.criticality, "CRITICAL");
  assert.ok(blast.calculationDurationMs < 50);

  await studio.stop();
});

test("BDD-1950: Full Diagnostic Audit & Receipt Generation", async () => {
  const studio = new EosGlorianLiveStudio({ port: 0 });
  const receipt = await studio.audit();

  assert.equal(receipt.specId, "SPEC-361");
  assert.equal(receipt.changeId, "CHANGE-223");
  assert.equal(receipt.checks.httpHealthRoute, "PASS");
  assert.equal(receipt.checks.hudHtmlDelivery, "PASS");
  assert.equal(receipt.checks.sseStreamMonotonicity, "PASS");
  assert.equal(receipt.checks.bitemporalProjection, "PASS");
  assert.equal(receipt.checks.blastRadiusComputation, "PASS");
  assert.equal(receipt.checks.zeroDependencyPurity, "PASS");
  assert.ok(receipt.integrityHash.length === 64);
  assert.ok(receipt.receiptId.startsWith("REC-STUDIO-"));
});
