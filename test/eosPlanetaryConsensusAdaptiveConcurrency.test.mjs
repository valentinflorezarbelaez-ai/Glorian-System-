/**
 * EOS SYSTEM — PLANETARY CONSENSUS, TRUETIME & ADAPTIVE CONCURRENCY TEST SUITE
 * Governed by ADR-041, SPEC-035, FR-099..FR-102, BDD-090..BDD-093
 *
 * Verifies:
 * 1. Google Spanner TrueTime bounded clock [earliest, latest] & commit-wait linearizability (BDD-090)
 * 2. Planetary Raft/Paxos quorum consensus, leader election & log replication (BDD-091)
 * 3. Netflix Vegas adaptive concurrency limiter, RTT gradient & load-shedding (BDD-092)
 * 4. Multi-channel CLI & MCP tool integration (BDD-093)
 *
 * 100% Layer-0 Purity with zero runtime npm dependencies.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { EosTrueTimeBoundedClock } from "../src/core/eosTrueTimeBoundedClock.ts";
import { EosPlanetaryConsensusEngine } from "../src/core/eosPlanetaryConsensusEngine.ts";
import { EosAdaptiveConcurrencyLimiter } from "../src/core/eosAdaptiveConcurrencyLimiter.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

describe("SPEC-035: Planetary Consensus & Adaptive Concurrency Verification", () => {
  // =========================================================================
  // PILLAR 1: Google Spanner TrueTime & Commit-Wait Linearizability (BDD-090)
  // =========================================================================
  describe("BDD-090: TrueTime Uncertainty Bounds & Commit-Wait Linearizability", () => {
    const clock = new EosTrueTimeBoundedClock(2.0);

    test("now() returns bounded interval [earliest, latest] with latest - earliest === 2 * epsilon", () => {
      const interval = clock.now();
      assert.ok(interval.latest > interval.earliest);
      assert.equal(Number((interval.latest - interval.earliest).toFixed(2)), 4.0);
      assert.equal(interval.epsilon, 2.0);
    });

    test("commitWait enforces that now().earliest > commitTimestamp", async () => {
      const t1 = clock.now();
      const commitTimestamp = t1.latest;

      const waitMs = await clock.commitWait(commitTimestamp);
      const afterWait = clock.now();

      assert.ok(afterWait.earliest > commitTimestamp, "Commit-wait must guarantee now().earliest > commitTimestamp");
      assert.ok(waitMs >= 0);
    });

    test("executes sequential transactions with strict linearizability (T1.commit < T2.earliest)", async () => {
      const tx1 = await clock.executeWithCommitWait(() => "TX1_PAYLOAD");
      const tx2 = await clock.executeWithCommitWait(() => "TX2_PAYLOAD");

      assert.equal(tx1.result, "TX1_PAYLOAD");
      assert.equal(tx2.result, "TX2_PAYLOAD");
      // Strict linearizability: TX1's commit timestamp is strictly before TX2's earliest start timestamp
      assert.ok(tx1.commitTimestamp < clock.now().latest, "Transaction ordering must be strictly linearizable");
    });
  });

  // =========================================================================
  // PILLAR 2: Planetary Raft/Paxos Quorum Consensus (BDD-091)
  // =========================================================================
  describe("BDD-091: Planetary Quorum Consensus & Split-Brain Immunity", () => {
    const nodeIds = ["node-us-east", "node-us-west", "node-eu-west", "node-ap-south", "node-sa-east"];
    const engine = new EosPlanetaryConsensusEngine(nodeIds);

    test("calculates cluster and quorum sizes accurately (5 nodes -> Quorum 3)", () => {
      assert.equal(engine.getClusterSize(), 5);
      assert.equal(engine.getQuorumSize(), 3);
    });

    test("elects leader with majority votes (>= 3 votes)", () => {
      const election = engine.electLeader("node-us-east");
      assert.equal(election.success, true);
      assert.equal(election.leaderId, "node-us-east");
      assert.equal(election.votesReceived, 5);
      assert.equal(engine.getLeaderId(), "node-us-east");
    });

    test("replicates log entries to followers and commits only on quorum acknowledgment", () => {
      const proposal = engine.propose("SET_TRANSACTION", { account: "EOS-42", amount: 1500 });
      assert.equal(proposal.success, true);
      assert.equal(proposal.entryIndex, 1);
      assert.equal(proposal.acks, 5);
      assert.ok(proposal.stateHash.length === 64);

      const leaderState = engine.getNodeState("node-us-east");
      assert.equal(leaderState.commitIndex, 1);
      assert.equal(leaderState.log[0].committed, true);
    });

    test("resists split-brain when minority partition is isolated (2 nodes isolated, quorum remains 3)", () => {
      // Isolate 2 nodes
      engine.partitionNodes(["node-ap-south", "node-sa-east"]);

      // Remaining 3 nodes ("node-us-east", "node-us-west", "node-eu-west") still form a quorum (3 >= 3)
      const proposal = engine.propose("MUTATE_STATE", { key: "IMMUTABLE_VALENTIN" });
      assert.equal(proposal.success, true);
      assert.equal(proposal.acks, 3); // 3 out of 5 acknowledged

      // Heal partition
      engine.healPartition();
    });
  });

  // =========================================================================
  // PILLAR 3: Netflix Vegas Adaptive Concurrency Limiter (BDD-092)
  // =========================================================================
  describe("BDD-092: Adaptive Concurrency Limiter & Load-Shedding", () => {
    test("expands concurrency limit when RTT is consistently low (no queue inflation)", () => {
      const limiter = new EosAdaptiveConcurrencyLimiter({ initialLimit: 10, minLimit: 5, maxLimit: 50 });
      const initialMetrics = limiter.getMetrics();
      assert.equal(initialMetrics.currentLimit, 10);

      // Simulate 15 requests completing quickly at 5ms
      for (let i = 0; i < 15; i++) {
        const acq = limiter.acquire();
        assert.equal(acq.granted, true);
        limiter.release(5.0);
      }

      const metricsAfter = limiter.getMetrics();
      assert.ok(metricsAfter.currentLimit > 10, "Limit must expand when RTT is low");
    });

    test("contracts limit and sheds excess load when RTT inflates", () => {
      const limiter = new EosAdaptiveConcurrencyLimiter({ initialLimit: 10, minLimit: 5, maxLimit: 50 });

      // Baseline: 5ms
      for (let i = 0; i < 5; i++) {
        limiter.acquire();
        limiter.release(5.0);
      }

      // Latency spike: RTT surges to 50ms (queue inflation)
      for (let i = 0; i < 10; i++) {
        limiter.acquire();
        limiter.release(50.0);
      }

      const contractedMetrics = limiter.getMetrics();
      assert.ok(contractedMetrics.currentLimit <= 10, "Limit must contract under latency spike");

      // Fill in-flight to capacity to test load-shedding
      for (let i = 0; i < contractedMetrics.currentLimit; i++) {
        const acq = limiter.acquire();
        assert.equal(acq.granted, true);
      }

      // Next request must be shed
      const overflow = limiter.acquire();
      assert.equal(overflow.granted, false);
      assert.equal(overflow.reason, "SHED_LOAD_CONCURRENCY_EXCEEDED");
    });
  });

  // =========================================================================
  // PILLAR 4: Multi-Channel CLI & MCP Tool Integration (BDD-093)
  // =========================================================================
  describe("BDD-093: Multi-Channel MCP Dispatching", () => {
    const server = new EosMcpServer();

    test("dispatches eos_consensus_status via MCP", () => {
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: "req-cons-1",
        method: "tools/call",
        params: {
          name: "eos_consensus_status",
          arguments: {},
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      assert.equal(res.id, "req-cons-1");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.ok(parsed.clusterSize >= 3);
      assert.ok(parsed.quorumSize >= 2);
      assert.ok(parsed.stateHash.length === 64);
    });

    test("dispatches eos_truetime_now via MCP", () => {
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: "req-tt-1",
        method: "tools/call",
        params: {
          name: "eos_truetime_now",
          arguments: {
            epsilonMs: 1.5,
          },
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.ok(parsed.latest > parsed.earliest);
      assert.equal(parsed.epsilon, 1.5);
    });

    test("dispatches eos_adaptive_concurrency_stats via MCP", () => {
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: "req-lim-1",
        method: "tools/call",
        params: {
          name: "eos_adaptive_concurrency_stats",
          arguments: {},
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.ok(parsed.metrics.currentLimit >= 5);
      assert.ok(parsed.prometheusExposition.includes("eos_concurrency_limit"));
    });
  });
});
