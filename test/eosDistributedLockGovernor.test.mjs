/**
 * EOS System — Multi-Region Quorum Lease & Distributed Lock Governor Test Suite
 * SPEC-284 (CHANGE-146) — BDD-1479..1484
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { EosDistributedLockGovernor } from "../src/core/eosDistributedLockGovernor.ts";

const SAMPLE_PATH = path.resolve("templates/locks/sample-cluster-topology.json");
const RECEIPT_PATH = resolveEvidencePath("DISTRIBUTED_LOCK_RECEIPT.json");

describe("SPEC-284: Multi-Region Quorum Lease & Distributed Lock Governor", () => {
  const sampleTopo = JSON.parse(fs.readFileSync(SAMPLE_PATH, "utf8"));

  it("BDD-1479: Quorum Consensus Lock Acquisition and Monotonic Fencing Token", () => {
    const governor = new EosDistributedLockGovernor(sampleTopo);
    assert.equal(governor.getQuorumSize(), 2); // floor(3/2) + 1 = 2

    // Insufficient quorum rejected
    const denied = governor.acquireLock("res-1", "worker-1", 5000, 1);
    assert.equal(denied.success, false);
    assert.equal(denied.state, "DENIED");

    // Quorum satisfied granted
    const granted1 = governor.acquireLock("res-1", "worker-1", 5000, 2);
    assert.equal(granted1.success, true);
    assert.equal(granted1.state, "ACQUIRED");
    assert.equal(granted1.fencingToken, 1);
    assert.equal(granted1.lease?.owner, "worker-1");

    // Next lock has strictly higher fencing token
    const granted2 = governor.acquireLock("res-2", "worker-2", 5000, 3);
    assert.equal(granted2.success, true);
    assert.ok(granted2.fencingToken > granted1.fencingToken);
  });

  it("BDD-1480: Strict Mutual Exclusion and Conflict Rejection", () => {
    const governor = new EosDistributedLockGovernor(sampleTopo);
    const lock1 = governor.acquireLock("shared-state", "worker-alpha", 10000);
    assert.equal(lock1.success, true);

    // Competing worker blocked
    const lock2 = governor.acquireLock("shared-state", "worker-beta", 10000);
    assert.equal(lock2.success, false);
    assert.equal(lock2.state, "DENIED");
    assert.ok(lock2.reason?.includes("RESOURCE_LOCKED"));

    const status = governor.getLockStatus("shared-state");
    assert.equal(status?.owner, "worker-alpha");
    assert.equal(status?.fencingToken, lock1.fencingToken);
  });

  it("BDD-1481: Monotonic Clock TTL Expiration and Preemption", () => {
    const governor = new EosDistributedLockGovernor(sampleTopo);
    // Acquire with 1ms TTL
    const lock1 = governor.acquireLock("ephemeral-res", "worker-old", 1);
    assert.equal(lock1.success, true);

    // Artificially trigger expiry check by waiting or examining status
    const statusBefore = governor.getLockStatus("ephemeral-res");
    assert.ok(statusBefore);

    // Sleep 15ms to exceed TTL
    const start = Date.now();
    while (Date.now() - start < 15) {
      /* busy-wait for TTL */
    }

    // Now worker-new should acquire successfully
    const lock2 = governor.acquireLock("ephemeral-res", "worker-new", 5000);
    assert.equal(lock2.success, true);
    assert.equal(lock2.lease?.owner, "worker-new");
    assert.ok(lock2.fencingToken > lock1.fencingToken);
  });

  it("BDD-1482: Authenticated Heartbeat Renewal", () => {
    const governor = new EosDistributedLockGovernor(sampleTopo);
    const lock = governor.acquireLock("renew-res", "worker-alpha", 5000);
    const token = lock.fencingToken;

    // Wrong owner rejected
    const badOwner = governor.renewLock("renew-res", "impostor", token);
    assert.equal(badOwner.success, false);

    // Wrong token rejected
    const badToken = governor.renewLock("renew-res", "worker-alpha", token + 99);
    assert.equal(badToken.success, false);

    // Valid renewal succeeds
    const renew = governor.renewLock("renew-res", "worker-alpha", token, 10000);
    assert.equal(renew.success, true);
    assert.equal(renew.lease?.state, "RENEWED");
    assert.equal(renew.lease?.fencingToken, token);
  });

  it("BDD-1483: Explicit Authenticated Lock Release", () => {
    const governor = new EosDistributedLockGovernor(sampleTopo);
    const lock = governor.acquireLock("release-res", "worker-alpha", 5000);
    const token = lock.fencingToken;

    // Wrong token cannot release
    const badRelease = governor.releaseLock("release-res", "worker-alpha", token + 1);
    assert.equal(badRelease.success, false);

    // Valid release succeeds
    const release = governor.releaseLock("release-res", "worker-alpha", token);
    assert.equal(release.success, true);

    // Immediately available for worker-beta
    const lock2 = governor.acquireLock("release-res", "worker-beta", 5000);
    assert.equal(lock2.success, true);
    assert.equal(lock2.lease?.owner, "worker-beta");
  });

  it("BDD-1484: Cryptographic Evidence Receipt Emission", () => {
    const governor = new EosDistributedLockGovernor(sampleTopo);
    const lock = governor.acquireLock("audit-res", "worker-audit", 5000);
    assert.ok(lock.lease);

    const receipt = governor.generateReceipt(lock.lease, RECEIPT_PATH);
    assert.deepEqual(JSON.parse(fs.readFileSync(RECEIPT_PATH, "utf8")), receipt);
    assert.equal(receipt.resource, "audit-res");
    assert.equal(receipt.owner, "worker-audit");
    assert.equal(receipt.quorumPassed, true);
    assert.equal(typeof receipt.sha256Signature, "string");
    assert.equal(receipt.sha256Signature.length, 64);
  });
});
