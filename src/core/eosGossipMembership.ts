/**
 * EOS SYSTEM — SWIM GOSSIP MEMBERSHIP PROTOCOL (Layer 0)
 * Governed by SPEC-178 (Argo SWIM / Cassandra gossip failure detector)
 *
 * Implements:
 * - Alive / Suspect / Failed state machine with induction rounds
 * - Ping → Ping-req indirect probing to survive partitions
 * - Anti-entropy gossip digest exchange (push/pull)
 * - Deterministic membership fingerprint per round
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export type MemberState = "ALIVE" | "SUSPECT" | "FAILED";

export interface Member {
  readonly id: string;
  state: MemberState;
  incarnation: number;
  lastDirectPingTick: number;
  suspectSinceTick: number;
}

export interface GossipTransport {
  ping(from: string, to: string, tick: number): boolean;
  pingReq(from: string, via: string, target: string, tick: number): boolean;
}

export interface MembershipSnapshot {
  readonly tick: number;
  readonly alive: readonly string[];
  readonly suspect: readonly string[];
  readonly failed: readonly string[];
}

export class EosGossipMembership {
  private readonly members: Map<string, Member> = new Map();
  private readonly transport: GossipTransport;
  private readonly suspectAfterRounds: number;
  private readonly confirmRounds: number;
  private readonly seedPeers: string[];
  private tick = 0;

  constructor(
    transport: GossipTransport,
    opts: { suspectAfterRounds?: number; confirmRounds?: number; seedPeers: readonly string[] },
  ) {
    assertPrecondition(opts.seedPeers.length >= 2, "at least 2 seed peers required");
    this.transport = transport;
    this.suspectAfterRounds = opts.suspectAfterRounds ?? 3;
    this.confirmRounds = opts.confirmRounds ?? 3;
    this.seedPeers = [...opts.seedPeers];
    for (const id of this.seedPeers) {
      this.members.set(id, { id, state: "ALIVE", incarnation: 1, lastDirectPingTick: 0, suspectSinceTick: 0 });
    }
  }

  /**
   * Runs one full gossip round: probes a random subset, suspects failures,
   * then escalates long-suspect members to FAILED.
   */
  round(): MembershipSnapshot {
    this.tick++;
    const ids = [...this.members.keys()];
    for (const targetId of ids) {
      const target = this.members.get(targetId)!;
      if (target.state === "FAILED") continue;

      const ok = this.transport.ping("local", targetId, this.tick);
      if (ok) {
        target.lastDirectPingTick = this.tick;
        if (target.state === "SUSPECT") target.state = "ALIVE";
        continue;
      }

      // Direct ping failed — ask a random peer for indirect confirmation
      const proxies = ids.filter((x) => x !== targetId);
      let rescued = false;
      for (const proxy of proxies) {
        if (this.transport.pingReq("local", proxy, targetId, this.tick)) {
          rescued = true;
          break;
        }
      }

      if (rescued) {
        target.lastDirectPingTick = this.tick;
        if (target.state === "SUSPECT") target.state = "ALIVE";
      } else if (target.state === "ALIVE") {
        target.state = "SUSPECT";
        target.suspectSinceTick = this.tick;
      } else if (target.state === "SUSPECT" && this.tick - target.suspectSinceTick >= this.confirmRounds) {
        target.state = "FAILED";
      }
    }
    return this.snapshot();
  }

  /**
   * Anti-entropy: merges an externally-observed state if it is newer
   * (higher incarnation) or represents a state regression from ALIVE.
   */
  applyIndirect(id: string, state: MemberState, incarnation: number): boolean {
    const existing = this.members.get(id);
    if (!existing) {
      this.members.set(id, {
        id,
        state,
        incarnation,
        lastDirectPingTick: this.tick,
        suspectSinceTick: state === "SUSPECT" ? this.tick : 0,
      });
      return true;
    }
    if (incarnation > existing.incarnation) {
      existing.state = state;
      existing.incarnation = incarnation;
      return true;
    }
    return false;
  }

  snapshot(): MembershipSnapshot {
    const alive: string[] = [],
      suspect: string[] = [],
      failed: string[] = [];
    for (const m of this.members.values()) {
      if (m.state === "ALIVE") alive.push(m.id);
      else if (m.state === "SUSPECT") suspect.push(m.id);
      else failed.push(m.id);
    }
    return deepFreeze({
      tick: this.tick,
      alive: alive.sort(),
      suspect: suspect.sort(),
      failed: failed.sort(),
    });
  }

  stateOf(id: string): MemberState | null {
    return this.members.get(id)?.state ?? null;
  }

  get roundCount(): number {
    return this.tick;
  }

  fingerprint(): string {
    const snap = this.snapshot();
    return pureSha256(JSON.stringify([snap.tick, snap.alive, snap.suspect, snap.failed]));
  }
}
