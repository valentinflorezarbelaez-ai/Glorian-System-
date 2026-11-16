/**
 * BDD Test Suite for SPEC-294 / CHANGE-156:
 * Event-Sourced Durable Execution Engine (Temporal Model)
 *
 * Verifies BDD-1539..BDD-1544.
 */

import { test, describe } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import {
  DurableEventStore,
  DurableWorkflowEngine,
  WorkflowReplayer,
  auditDurablePipeline,
} from "../src/core/eosDurableExecutionEngine.ts";

describe("SPEC-294: Event-Sourced Durable Execution Engine", () => {
  // BDD-1539
  test("BDD-1539: Workflow Event Sourcing & Monotonic Sequence Numbering", async () => {
    const store = new DurableEventStore();
    const engine = new DurableWorkflowEngine(store);
    const workflowId = "wf-seq-test-01";

    const activities = [
      { name: "stepA", execute: () => ({ ok: true }) },
      { name: "stepB", execute: () => ({ ok: true }) },
    ];

    const state = await engine.executeWorkflow(workflowId, "SequencePipeline", activities, {});
    assert.equal(state.status, "COMPLETED");
    assert.equal(state.completedActivities.length, 2);

    const events = store.getEvents(workflowId);
    assert.ok(events.length >= 5); // Started, SchedA, StartA, CompA, SchedB, StartB, CompB, Completed
    for (let i = 0; i < events.length; i++) {
      assert.equal(events[i].seq, i + 1);
      assert.equal(events[i].workflowId, workflowId);
      assert.equal(typeof events[i].stateHash, "string");
      assert.equal(events[i].stateHash.length, 64);
    }
  });

  // BDD-1540
  test("BDD-1540: Deterministic Replay & State Reconstruction without Side Effects", async () => {
    const store = new DurableEventStore();
    const engine = new DurableWorkflowEngine(store);
    const workflowId = "wf-replay-test-02";

    let executionCount = 0;
    const activities = [
      {
        name: "impureSideEffect",
        execute: () => {
          executionCount++;
          return { generatedValue: 42 };
        },
      },
    ];

    const state = await engine.executeWorkflow(workflowId, "SideEffectPipeline", activities, {});
    assert.equal(state.status, "COMPLETED");
    assert.equal(executionCount, 1);

    // Replay directly from event store
    const events = store.getEvents(workflowId);
    const replayed = WorkflowReplayer.replay(events);

    assert.equal(replayed.status, state.status);
    assert.equal(replayed.currentSeq, state.currentSeq);
    assert.equal(replayed.stateHash, state.stateHash);
    assert.equal(replayed.results.impureSideEffect.generatedValue, 42);
    // Crucial check: side-effect was NOT invoked during replay
    assert.equal(executionCount, 1);
  });

  // BDD-1541
  test("BDD-1541: Saga Pattern Reverse Compensation on Activity Failure", async () => {
    const store = new DurableEventStore();
    const engine = new DurableWorkflowEngine(store);
    const workflowId = "wf-saga-test-03";

    const compensationOrder = [];
    const activities = [
      {
        name: "allocateStorage",
        execute: () => ({ allocated: true }),
        compensate: () => {
          compensationOrder.push("allocateStorage");
        },
      },
      {
        name: "provisionPort",
        execute: () => ({ port: 8080 }),
        compensate: () => {
          compensationOrder.push("provisionPort");
        },
      },
      {
        name: "faultyAction",
        execute: () => {
          throw new Error("Disk quota exceeded during initialization");
        },
      },
    ];

    const state = await engine.executeWorkflow(workflowId, "SagaPipeline", activities, {});
    assert.equal(state.status, "COMPENSATED");
    assert.ok(state.error?.includes("Disk quota exceeded"));
    assert.equal(state.completedActivities.length, 2);
    assert.equal(state.compensatedActivities.length, 2);

    // Invariant: compensation runs in reverse order (provisionPort, then allocateStorage)
    assert.deepEqual(compensationOrder, ["provisionPort", "allocateStorage"]);
  });

  // BDD-1542
  test("BDD-1542: Durable Pause, Suspension & Multi-Process Resumption", async () => {
    const store = new DurableEventStore();
    const engine1 = new DurableWorkflowEngine(store);
    const workflowId = "wf-pause-resume-04";

    const activities = [
      { name: "step1", execute: () => ({ val: "A" }) },
      { name: "step2_wait", execute: () => ({ val: "B" }) },
      { name: "step3_final", execute: () => ({ val: "C" }) },
    ];

    // 1. Pause at step2_wait
    const paused = await engine1.executeWorkflow(
      workflowId,
      "PauseWorkflow",
      activities,
      {},
      { pauseAtActivity: "step2_wait" },
    );
    assert.equal(paused.status, "PAUSED");
    assert.deepEqual(paused.completedActivities, ["step1"]);

    // 2. Resume with a completely new engine instance (multi-process simulation)
    const engine2 = new DurableWorkflowEngine(store);
    const resumed = await engine2.resumeWorkflow(workflowId, activities);
    assert.equal(resumed.status, "COMPLETED");
    assert.deepEqual(resumed.completedActivities, ["step1", "step2_wait", "step3_final"]);
  });

  // BDD-1543
  test("BDD-1543: Outbox Sidecar Event Emission via Native HTTP", async () => {
    let receivedPayload = null;
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        receivedPayload = JSON.parse(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const sidecarUrl = `http://127.0.0.1:${port}/events`;

    const sampleEvent = {
      workflowId: "wf-kafka-outbox",
      seq: 1,
      timestamp: new Date().toISOString(),
      type: "WorkflowStarted",
      payload: { repo: "Glorian" },
      stateHash: "abcdef1234567890",
    };

    const res = await DurableEventStore.emitToSidecar(sidecarUrl, sampleEvent);
    assert.equal(res.status, 200);
    assert.ok(receivedPayload);
    assert.equal(receivedPayload.workflowId, "wf-kafka-outbox");
    assert.equal(receivedPayload.seq, 1);

    server.close();
  });

  // BDD-1544
  test("BDD-1544: Cryptographic Durable Execution Receipt Generation", async () => {
    const receipt = await auditDurablePipeline(process.cwd());

    assert.equal(receipt.specRef, "SPEC-294");
    assert.ok(receipt.totalEventsRecorded > 0);
    assert.equal(receipt.replayDeterministicMatch, true);
    assert.equal(receipt.sagaCompensationsVerified, true);
    assert.equal(receipt.sidecarOutboxTested, true);
    assert.equal(receipt.sha256Signature.length, 64);

    const receiptFilePath = path.join(process.cwd(), "docs", "evidence", "DURABLE_EXECUTION_RECEIPT.json");
    assert.ok(fs.existsSync(receiptFilePath));
    const saved = JSON.parse(fs.readFileSync(receiptFilePath, "utf8"));
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });
});
