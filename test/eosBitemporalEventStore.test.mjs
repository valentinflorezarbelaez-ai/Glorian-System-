/**
 * Glorian System — Bitemporal Event Store & CDC Test Suite
 * Governed by SPEC-281 / CHANGE-143
 *
 * Verifies BDD-1461 through BDD-1466.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";

import { EosBitemporalEventStore } from "../src/core/eosBitemporalEventStore.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SAMPLE_STREAM_PATH = path.join(ROOT, "templates/events/sample-bitemporal-event-stream.json");

describe("SPEC-281: Bitemporal Event Store & Change Data Capture (CDC) Governor", () => {
  // -------------------------------------------------------------------------
  // BDD-1461: Conforming Bitemporal Event Append and Hash Chaining
  // -------------------------------------------------------------------------
  it("BDD-1461: appends bitemporal events with monotonic sequence and valid SHA-256 chaining", () => {
    const store = new EosBitemporalEventStore();
    const ev1 = store.appendEvent({
      streamId: "stream-001",
      eventType: "USER_REGISTERED",
      payload: { userId: "u-1", name: "Alice" },
      validTime: "2026-11-01T10:00:00Z",
    });

    assert.equal(ev1.sequenceNumber, 1);
    assert.equal(ev1.previousEventHash, "0".repeat(64));
    assert.equal(ev1.eventHash.length, 64);
    assert.ok(ev1.transactionTime);

    const ev2 = store.appendEvent({
      streamId: "stream-001",
      eventType: "USER_KYC_VERIFIED",
      payload: { kycLevel: 3 },
      validTime: "2026-11-02T10:00:00Z",
    });

    assert.equal(ev2.sequenceNumber, 2);
    assert.equal(ev2.previousEventHash, ev1.eventHash);
    assert.ok(store.verifyStreamIntegrity("stream-001"));
  });

  // -------------------------------------------------------------------------
  // BDD-1462: Exactly-Once Cryptographic Idempotency Deduplication
  // -------------------------------------------------------------------------
  it("BDD-1462: guarantees exactly-once append by deduplicating identical idempotencyKey", () => {
    const store = new EosBitemporalEventStore();
    const ev1 = store.appendEvent({
      streamId: "orders-stream",
      eventType: "ORDER_PLACED",
      payload: { orderId: "ord-99", totalUsd: 150 },
      idempotencyKey: "unique-order-key-99",
    });

    const ev2 = store.appendEvent({
      streamId: "orders-stream",
      eventType: "ORDER_PLACED",
      payload: { orderId: "ord-99", totalUsd: 150 },
      idempotencyKey: "unique-order-key-99",
    });

    assert.equal(ev1.eventHash, ev2.eventHash);
    assert.equal(store.getEvents("orders-stream").length, 1);
  });

  // -------------------------------------------------------------------------
  // BDD-1463: Deterministic Aggregate Replay & Time Travel
  // -------------------------------------------------------------------------
  it("BDD-1463: deterministically reconstructs entity state as-of past validTime", () => {
    const store = new EosBitemporalEventStore();
    const streamId = "account-100";

    store.appendEvent({
      streamId,
      eventType: "INITIAL_DEPOSIT",
      payload: { balance: 100 },
      validTime: "2026-11-01T00:00:00Z",
    });

    store.appendEvent({
      streamId,
      eventType: "DEPOSIT",
      payload: { balance: 250 },
      validTime: "2026-11-05T00:00:00Z",
    });

    store.appendEvent({
      streamId,
      eventType: "WITHDRAWAL",
      payload: { balance: 180 },
      validTime: "2026-11-10T00:00:00Z",
    });

    // Replay as of 2026-11-06 (before withdrawal)
    const midState = store.replayEvents(streamId, {
      asOfValidTime: "2026-11-06T00:00:00Z",
    });
    assert.equal(midState.balance, 250);

    // Replay latest
    const latestState = store.replayEvents(streamId);
    assert.equal(latestState.balance, 180);
  });

  // -------------------------------------------------------------------------
  // BDD-1464: Change Data Capture (CDC) Mutation Envelope Generation
  // -------------------------------------------------------------------------
  it("BDD-1464: emits sequential CDC change envelopes with before/after state diffs", () => {
    const store = new EosBitemporalEventStore();
    const streamId = "wallet-200";

    store.appendEvent({
      streamId,
      eventType: "WALLET_CREATED",
      payload: { tier: "SILVER", status: "PENDING" },
    });

    store.appendEvent({
      streamId,
      eventType: "WALLET_ACTIVATED",
      payload: { status: "ACTIVE" },
    });

    const cdc = store.getChangeStream(streamId);
    assert.equal(cdc.length, 2);

    assert.equal(cdc[0].operation, "CREATE");
    assert.equal(cdc[0].before, null);
    assert.equal(cdc[0].after.status, "PENDING");

    assert.equal(cdc[1].operation, "UPDATE");
    assert.equal(cdc[1].before.status, "PENDING");
    assert.equal(cdc[1].after.status, "ACTIVE");
    assert.deepEqual(cdc[1].diff.status, { before: "PENDING", after: "ACTIVE" });
  });

  // -------------------------------------------------------------------------
  // BDD-1465: Rejection of Corrupted or Tampered Event Hash Chaining
  // -------------------------------------------------------------------------
  it("BDD-1465: detects tampered event payloads via verifyStreamIntegrity", () => {
    const store = new EosBitemporalEventStore();
    const streamId = "audit-stream";

    store.appendEvent({
      streamId,
      eventType: "TX_1",
      payload: { amount: 50 },
    });
    store.appendEvent({
      streamId,
      eventType: "TX_2",
      payload: { amount: 100 },
    });

    assert.ok(store.verifyStreamIntegrity(streamId));

    // Tamper with event in-place
    const events = store.getEvents(streamId);
    events[0].payload.amount = 999999; // Malicious mutation

    // A fresh check on internal stream detects integrity violation
    // (internal array mutation or modified hash)
    const internalStream = store["streams"].get(streamId);
    internalStream[0].payload.amount = 999999;

    assert.equal(store.verifyStreamIntegrity(streamId), false);
  });

  // -------------------------------------------------------------------------
  // BDD-1466: Cryptographic SHA-256 Event Store Receipt Generation
  // -------------------------------------------------------------------------
  it("BDD-1466: generates verifiable receipt sealed with authentic SHA-256 signature", () => {
    assert.ok(fs.existsSync(SAMPLE_STREAM_PATH));
    const testReceiptPath = resolveEvidencePath("EVENTSTORE_RECEIPT.json", ROOT);
    const store = new EosBitemporalEventStore(testReceiptPath);

    store.appendEvent({
      streamId: "receipt-stream",
      eventType: "RECEIPT_EVENT",
      payload: { test: true },
    });

    const receipt = store.generateReceipt();

    assert.ok(fs.existsSync(testReceiptPath));
    assert.equal(typeof receipt.sha256, "string");
    assert.equal(receipt.sha256.length, 64);
    assert.equal(receipt.totalEvents, 1);
    assert.equal(receipt.totalStreams, 1);

    const onDisk = JSON.parse(fs.readFileSync(testReceiptPath, "utf8"));
    assert.equal(onDisk.evidenceSha256, receipt.sha256);
  });

  // -------------------------------------------------------------------------
  // BDD-1467: Validation errors, chain break, CDC DELETE/no-op diffs, bitemporal tx replay & clear
  // -------------------------------------------------------------------------
  it("BDD-1467: enforces input validation, chain links, CDC DELETE, bitemporal txTime replay, and clear", () => {
    const store = new EosBitemporalEventStore();

    // Missing streamId / eventType
    assert.throws(
      () => store.appendEvent({ streamId: "", eventType: "TEST", payload: {} }),
      /Invalid event: missing streamId or eventType/,
    );
    assert.throws(
      () => store.appendEvent({ streamId: "s-1", eventType: "", payload: {} }),
      /Invalid event: missing streamId or eventType/,
    );

    // Unknown stream defaults
    assert.deepEqual(store.getEvents("missing-stream"), []);
    assert.equal(store.verifyStreamIntegrity("missing-stream"), true);
    assert.deepEqual(store.replayEvents("missing-stream"), {});
    assert.deepEqual(store.getChangeStream("missing-stream"), []);

    // Undefined payload fallback + CDC CREATE -> UPDATE (with unchanged & new keys) -> DELETE
    const ev1 = store.appendEvent({
      streamId: "entity-1",
      eventType: "ENTITY_CREATED",
      payload: undefined,
      validTime: "2026-11-01T00:00:00Z",
    });
    assert.deepEqual(ev1.payload, {});

    const ev2 = store.appendEvent({
      streamId: "entity-1",
      eventType: "ENTITY_UPDATED",
      payload: { tier: "GOLD", status: "ACTIVE" },
      validTime: "2026-11-02T00:00:00Z",
      idempotencyKey: "k-update-1",
    });

    // Update setting tier to identical "GOLD" (skipped in diff) and introducing new key "region"
    store.appendEvent({
      streamId: "entity-1",
      eventType: "ENTITY_UPDATED",
      payload: { tier: "GOLD", region: "us-east" },
      validTime: "2026-11-03T00:00:00Z",
    });

    // DELETE event triggers DELETE branch in getChangeStream
    store.appendEvent({
      streamId: "entity-1",
      eventType: "ENTITY_DELETED",
      payload: {},
      validTime: "2026-11-04T00:00:00Z",
    });

    const cdc = store.getChangeStream("entity-1");
    assert.equal(cdc.length, 4);
    assert.equal(cdc[0].operation, "CREATE");
    assert.equal(cdc[1].operation, "UPDATE");
    assert.equal(cdc[2].operation, "UPDATE");
    assert.equal("tier" in cdc[2].diff, false);
    assert.deepEqual(cdc[2].diff.region, { before: null, after: "us-east" });
    assert.equal(cdc[3].operation, "DELETE");
    assert.equal(cdc[3].after, null);
    assert.deepEqual(cdc[3].diff.tier, { before: "GOLD", after: null });

    // Replay with asOfTransactionTime and custom initialState + reducer
    const pastTxState = store.replayEvents("entity-1", {
      asOfTransactionTime: "1970-01-01T00:00:00Z",
    });
    assert.deepEqual(pastTxState, {});

    const customReduced = store.replayEvents("entity-1", {
      asOfTransactionTime: ev2.transactionTime,
      initialState: { count: 0, lastType: "" },
      reducer: (acc, ev) => ({ count: acc.count + 1, lastType: ev.eventType }),
    });
    assert.ok(customReduced.count >= 2);
    assert.ok(customReduced.lastType.length > 0);

    // Broken previousEventHash chain detection
    const brokenStore = new EosBitemporalEventStore();
    brokenStore.appendEvent({ streamId: "chain-test", eventType: "EV1", payload: { a: 1 } });
    brokenStore.appendEvent({ streamId: "chain-test", eventType: "EV2", payload: { a: 2 } });
    brokenStore["streams"].get("chain-test")[1].previousEventHash = "a".repeat(64);
    assert.equal(brokenStore.verifyStreamIntegrity("chain-test"), false);

    // generateReceipt creating non-existent temp directory
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-evstore-rcpt-"));
    try {
      const nestedPath = path.join(tmpDir, "nested", "EVENTSTORE_RECEIPT.json");
      const receipt = store.generateReceipt(nestedPath);
      assert.ok(fs.existsSync(receipt.receiptPath));
      assert.equal(receipt.totalEvents, 4);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // clear() removes streams and idempotency index
    store.clear();
    assert.deepEqual(store.getEvents("entity-1"), []);
    const afterClear = store.appendEvent({
      streamId: "entity-1",
      eventType: "ENTITY_RECREATED",
      payload: { fresh: true },
      idempotencyKey: "k-update-1",
    });
    assert.equal(afterClear.sequenceNumber, 1);
    assert.equal(afterClear.eventType, "ENTITY_RECREATED");
  });
});
