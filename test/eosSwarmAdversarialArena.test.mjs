/**
 * EosSwarmAdversarialArena Test Suite (SPEC-196 / CHANGE-081)
 *
 * Validates:
 * - Multi-agent role generation (Red, Blue, White) with cryptographic identities
 * - Red Team adversarial attack synthesis
 * - Blue Team defensive invariant hardening
 * - White Team Byzantine Fault Tolerant (BFT 3f+1) quorum consensus evaluation
 * - Full tournament execution and CLI invocation (glorian arena)
 *
 * Strict Layer-0 Purity: Node.js test runner and strict assertions.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EosSwarmAdversarialArena } from "../src/core/eosSwarmAdversarialArena.ts";

describe("SPEC-196: EosSwarmAdversarialArena", () => {
  it("BDD-999: Multi-agent role generation and initialization", () => {
    const swarm = EosSwarmAdversarialArena.initializeSwarm("test-cluster");

    assert.equal(swarm.length, 4); // 3f+1 with f=1 => 4 nodes
    assert.ok(swarm.some((a) => a.role === "RED_TEAM"));
    assert.ok(swarm.some((a) => a.role === "BLUE_TEAM"));
    assert.ok(swarm.filter((a) => a.role === "WHITE_TEAM").length >= 2);

    for (const agent of swarm) {
      assert.ok(agent.agentId.startsWith("SWARM-"));
      assert.equal(agent.reputationScore, 100);
      assert.equal(agent.publicKeyFingerprint.length, 16);
    }
  });

  it("BDD-1000: Red Team adversarial attack synthesis", () => {
    const attacks = EosSwarmAdversarialArena.synthesizeAttackVectors("git checkout -b feature");

    assert.ok(Array.isArray(attacks));
    assert.ok(attacks.length >= 4);

    const categories = attacks.map((a) => a.category);
    assert.ok(categories.includes("INJECTION"));
    assert.ok(categories.includes("CONCURRENCY_RACE"));
    assert.ok(categories.includes("MEMORY_PRESSURE"));
    assert.ok(categories.includes("PRIVILEGE_ESCALATION"));
  });

  it("BDD-1001: Blue Team defensive mitigation and invariant hardening", () => {
    const attack = {
      id: "ATK-MEM-03",
      category: "MEMORY_PRESSURE",
      payload: "payload_size_mb=2048",
      severity: "HIGH",
      expectedBreach: "Heap exhaustion",
    };

    const defense = EosSwarmAdversarialArena.synthesizeDefense(attack, "node app.js");

    assert.equal(defense.targetAttackId, "ATK-MEM-03");
    assert.equal(defense.strategy, "MEMORY_ZEROIZATION");
    assert.equal(defense.mitigated, true);
    assert.ok(defense.invariantAssertion.includes("enforceMemoryQuota"));
  });

  it("BDD-1002: White Team BFT 3f+1 quorum consensus evaluation", () => {
    // 1. Safe action evaluation
    const safeReport = EosSwarmAdversarialArena.executeTournament("npm test", 3);

    assert.equal(safeReport.totalRounds, 3);
    assert.equal(safeReport.mitigatedRounds, 3);
    assert.equal(safeReport.breachRounds, 0);
    assert.equal(safeReport.resilienceScore, 100);
    assert.equal(safeReport.bftVerdict, "CONSENSUS_HARDENED");
    assert.equal(safeReport.sha256Receipt.length, 64);

    for (const round of safeReport.rounds) {
      assert.equal(round.arbiterVerdict, "BLOCKED_BY_DEFENSE");
      assert.equal(round.bftVoteShares.consensusReached, true);
      assert.ok(round.bftVoteShares.yesVotes >= round.bftVoteShares.quorumThreshold);
    }

    // 2. Destructive attack evaluation
    const breachReport = EosSwarmAdversarialArena.executeTournament("sudo rm -rf /", 4);

    assert.ok(breachReport.breachRounds > 0);
    assert.ok(breachReport.resilienceScore < 85);
    assert.ok(breachReport.bftVerdict === "VETOED_BREACH" || breachReport.bftVerdict === "MITIGATION_REQUIRED");
  });

  it("BDD-1003: Full tournament execution and CLI output", () => {
    const root = path.resolve(".");
    const binPath = path.join(root, "bin", "eos.mjs");

    const stdout = execFileSync("node", [binPath, "arena", "npm run typecheck", "--rounds=3", "--json"], {
      cwd: root,
      encoding: "utf8",
    });

    const parsed = JSON.parse(stdout);
    assert.ok(parsed.tournamentId.startsWith("TOURNAMENT-"));
    assert.equal(parsed.totalRounds, 3);
    assert.equal(typeof parsed.resilienceScore, "number");
    assert.ok(parsed.resilienceScore >= 0 && parsed.resilienceScore <= 100);
    assert.ok(Array.isArray(parsed.participatingAgents));
    assert.equal(parsed.participatingAgents.length, 4);
    assert.equal(parsed.sha256Receipt.length, 64);
  });
});
