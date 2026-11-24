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
import * as os from "node:os";
import * as path from "node:path";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
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

    const receiptFilePath = resolveEvidencePath("DURABLE_EXECUTION_RECEIPT.json");
    assert.ok(fs.existsSync(receiptFilePath));
    const saved = JSON.parse(fs.readFileSync(receiptFilePath, "utf8"));
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });

  // BDD-1545
  test("BDD-1545: Replay corruption checks, FAILED vs COMPENSATED states, best-effort compensation & store APIs", async () => {
    // Default constructor + getStore() + empty replay + resumeWorkflow missing
    const engine = new DurableWorkflowEngine();
    const store = engine.getStore();
    const emptyState = WorkflowReplayer.replay([]);
    assert.equal(emptyState.workflowId, "unknown");
    assert.equal(emptyState.currentSeq, 0);

    await assert.rejects(() => engine.resumeWorkflow("missing-wf", []), /Workflow not found: missing-wf/);

    // Workflow failing on first step (no completed activities -> status FAILED, not COMPENSATED)
    // Also tests activity returning undefined and non-Error thrown value
    const failFirstState = await engine.executeWorkflow(
      "wf-fail-first",
      "FailFirst",
      [
        {
          name: "noOutputStep",
          execute: () => undefined,
        },
        {
          name: "rawStringThrowStep",
          execute: () => {
            throw "raw-string-failure";
          },
        },
      ],
      {},
    );
    assert.equal(failFirstState.status, "FAILED");
    assert.equal(failFirstState.error, "raw-string-failure");
    assert.deepEqual(failFirstState.compensatedActivities, []);

    // Compensation error is swallowed (best-effort)
    const compThrowState = await engine.executeWorkflow(
      "wf-comp-throw",
      "CompThrow",
      [
        {
          name: "stepWithBadComp",
          execute: () => ({ ok: true }),
          compensate: () => {
            throw new Error("Compensate failed");
          },
        },
        {
          name: "failNext",
          execute: () => {
            throw new Error("Boom");
          },
        },
      ],
      {},
    );
    assert.equal(compThrowState.status, "FAILED");

    // Calling executeWorkflow on already COMPLETED workflow returns state idempotently
    const doneState = await engine.executeWorkflow(
      "wf-already-done",
      "DoneFlow",
      [{ name: "only", execute: () => ({ x: 1 }) }],
      {},
    );
    assert.equal(doneState.status, "COMPLETED");
    const repeatDone = await engine.executeWorkflow("wf-already-done", "DoneFlow", [], {});
    assert.equal(repeatDone.status, "COMPLETED");
    assert.equal(repeatDone.currentSeq, doneState.currentSeq);

    assert.ok(store.getAllStreams().size >= 3);

    // Replay edge cases: broken sequence, corrupted hash, fallback names/errors, duplicate completions
    const baseEvents = store.getEvents("wf-already-done");
    const brokenSeq = [{ ...baseEvents[0], seq: 2 }];
    assert.throws(() => WorkflowReplayer.replay(brokenSeq), /Sequence invariant broken/);

    const tamperedHash = [{ ...baseEvents[0], stateHash: "f".repeat(64) }];
    assert.throws(() => WorkflowReplayer.replay(tamperedHash), /Corrupted state hash detected/);

    const edgeStore = new DurableEventStore();
    edgeStore.appendEvent("wf-edge", "WorkflowStarted");
    edgeStore.appendEvent("wf-edge", "ActivityCompleted", { activityName: "a1" });
    edgeStore.appendEvent("wf-edge", "ActivityCompleted", { activityName: "a1", output: 9 });
    edgeStore.appendEvent("wf-edge", "ActivityCompensated", { activityName: "a1" });
    edgeStore.appendEvent("wf-edge", "ActivityCompensated", { activityName: "a1" });
    edgeStore.appendEvent("wf-edge", "ActivityFailed", {});
    const edgeReplayed = WorkflowReplayer.replay(edgeStore.getEvents("wf-edge"));
    assert.equal(edgeReplayed.workflowName, "unknown");
    assert.equal(edgeReplayed.error, "Unknown error");
    assert.deepEqual(edgeReplayed.completedActivities, ["a1"]);
    assert.deepEqual(edgeReplayed.compensatedActivities, ["a1"]);
  });

  // BDD-1546
  test("BDD-1546: Sidecar URL validation, HTTPS/error/timeout handling, and nested evidence dir creation", async () => {
    const sampleEvent = {
      workflowId: "wf-sidecar-edge",
      seq: 1,
      timestamp: new Date().toISOString(),
      type: "WorkflowStarted",
      payload: {},
      stateHash: "0".repeat(64),
    };

    // Invalid URL triggers catch block
    await assert.rejects(() => DurableEventStore.emitToSidecar("not-a-valid-url", sampleEvent));

    // HTTPS protocol branch (connection refused on port 1)
    await assert.rejects(() => DurableEventStore.emitToSidecar("https://127.0.0.1:1/events", sampleEvent));

    // Sidecar timeout branch (server accepts socket and withholds response past 2000ms)
    const slowSockets = new Set();
    const slowServer = http.createServer((req) => {
      req.resume();
    });
    slowServer.on("connection", (socket) => {
      slowSockets.add(socket);
      socket.on("close", () => slowSockets.delete(socket));
    });
    await new Promise((resolve) => slowServer.listen(0, "127.0.0.1", resolve));
    const slowPort = slowServer.address().port;
    try {
      await assert.rejects(
        () => DurableEventStore.emitToSidecar(`http://127.0.0.1:${slowPort}/slow`, sampleEvent),
        /Sidecar timeout/,
      );
    } finally {
      for (const s of slowSockets) s.destroy();
      await new Promise((resolve) => slowServer.close(resolve));
    }

    // Automatic sidecar emission during appendEvent (fail-open on unreachable port) + auditDurablePipeline mkdirSync
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "eos-durable-evd-"));
    const nestedEvd = path.join(tmpBase, "nested-evd");
    const prevSidecar = process.env.EOS_KAFKA_SIDECAR_URL;
    const prevEvd = process.env.EOS_EVIDENCE_DIR;
    try {
      process.env.EOS_KAFKA_SIDECAR_URL = "http://127.0.0.1:1/fail-open";
      const sidecarStore = new DurableEventStore();
      const ev = sidecarStore.appendEvent("wf-sidecar-env", "WorkflowStarted");
      assert.equal(ev.seq, 1);
      delete process.env.EOS_KAFKA_SIDECAR_URL;

      process.env.EOS_EVIDENCE_DIR = nestedEvd;
      const receipt = await auditDurablePipeline();
      assert.equal(receipt.specRef, "SPEC-294");
      assert.ok(fs.existsSync(path.join(nestedEvd, "DURABLE_EXECUTION_RECEIPT.json")));
    } finally {
      if (prevSidecar === undefined) {
        delete process.env.EOS_KAFKA_SIDECAR_URL;
      } else {
        process.env.EOS_KAFKA_SIDECAR_URL = prevSidecar;
      }
      if (prevEvd === undefined) {
        delete process.env.EOS_EVIDENCE_DIR;
      } else {
        process.env.EOS_EVIDENCE_DIR = prevEvd;
      }
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
