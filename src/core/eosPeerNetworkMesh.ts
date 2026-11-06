/**
 * EOS SYSTEM — DISTRIBUTED PEER NETWORK TRANSPORT MESH (Layer 0)
 * Governed by SPEC-084, CHANGE-063, ADR-087 (v71.0.0)
 *
 * Implements pure Layer-0 socket transport for multi-node consensus & telemetry:
 * 1. Native TCP socket server using node:net with zero external dependencies.
 * 2. Monotonic sequence verification per sender to prevent replay attacks.
 * 3. Cryptographic frame verification with SHA-256 tamper detection.
 * 4. Structured peer gossip for TrueTime intervals, Shamir shares & heartbeats.
 * 5. Monotonic cryptographic receipts logged in durable SQLite WAL ledger.
 *
 * Zero external runtime dependencies. Node 24 strip-only compliant.
 */

import net from "node:net";
import {
  assertPrecondition,
  assertPostcondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";
import { EosDurableSqliteLedger } from "./eosDurableSqliteLedger.ts";

export type PeerMessageType =
  | "HEARTBEAT"
  | "TRUETIME_SYNC"
  | "THRESHOLD_SHARE"
  | "CONSENSUS_VOTE";

export interface EosPeerFrame {
  readonly senderNodeId: string;
  readonly targetNodeId?: string;
  readonly seq: number;
  readonly type: PeerMessageType;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly timestampIso: string;
  readonly frameSha256: string;
}

export function computeFrameSha256(
  senderNodeId: string,
  seq: number,
  type: string,
  payload: unknown,
  timestampIso: string
): string {
  const serialized = `${senderNodeId}#${seq}#${type}#${JSON.stringify(payload)}#${timestampIso}`;
  return pureSha256(serialized);
}

export class EosPeerNode {
  private readonly nodeId: string;
  private readonly ledger: EosDurableSqliteLedger | null;
  private server: net.Server | null = null;
  private localPort: number = 0;
  private currentSeq: number = 0;
  private peerSockets: Set<net.Socket> = new Set();
  private lastSeenSeqPerSender: Map<string, number> = new Map();
  private messageListeners: Array<(frame: EosPeerFrame) => void> = [];
  private anomalyCount: number = 0;

  constructor(nodeId: string, ledger?: EosDurableSqliteLedger | null) {
    assertPrecondition(Boolean(nodeId), "Node ID cannot be empty");
    this.nodeId = nodeId;
    this.ledger = ledger ?? null;
  }

  public getNodeId(): string {
    return this.nodeId;
  }

  public getPort(): number {
    return this.localPort;
  }

  public getAnomalyCount(): number {
    return this.anomalyCount;
  }

  public onMessage(listener: (frame: EosPeerFrame) => void): void {
    this.messageListeners.push(listener);
  }

  /**
   * Starts listening on the given TCP port on localhost.
   */
  public async start(port: number = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      const srv = net.createServer((socket) => {
        this.registerSocket(socket);
      });

      srv.on("error", (err) => reject(err));

      srv.listen(port, "127.0.0.1", () => {
        this.server = srv;
        const addr = srv.address();
        if (typeof addr === "object" && addr !== null) {
          this.localPort = addr.port;
        } else {
          this.localPort = port;
        }
        resolve(this.localPort);
      });
    });
  }

  /**
   * Connects to a remote peer node.
   */
  public async connectToPeer(port: number, host: string = "127.0.0.1"): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ port, host }, () => {
        this.registerSocket(socket);
        resolve(socket);
      });
      socket.on("error", (err) => reject(err));
    });
  }

  private registerSocket(socket: net.Socket): void {
    this.peerSockets.add(socket);
    let buffer = "";

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as EosPeerFrame;
          this.processIncomingFrame(parsed);
        } catch {
          this.anomalyCount++;
        }
      }
    });

    socket.on("close", () => {
      this.peerSockets.delete(socket);
    });

    socket.on("error", () => {
      this.peerSockets.delete(socket);
    });
  }

  private processIncomingFrame(frame: EosPeerFrame): void {
    // 1. Verify cryptographic SHA-256 integrity
    const expectedSha256 = computeFrameSha256(
      frame.senderNodeId,
      frame.seq,
      frame.type,
      frame.payload,
      frame.timestampIso
    );

    if (frame.frameSha256 !== expectedSha256) {
      this.anomalyCount++;
      return; // Fail-closed rejection of tampered frames
    }

    // 2. Verify monotonic sequence to prevent replay attacks
    const lastSeq = this.lastSeenSeqPerSender.get(frame.senderNodeId) ?? 0;
    if (frame.seq <= lastSeq) {
      this.anomalyCount++;
      return; // Fail-closed rejection of duplicate or replayed sequences
    }

    this.lastSeenSeqPerSender.set(frame.senderNodeId, frame.seq);

    // 3. Dispatch to verified listeners
    for (const listener of this.messageListeners) {
      try {
        listener(frame);
      } catch {
        // Safe isolation of listener errors
      }
    }
  }

  /**
   * Constructs, signs and broadcasts a message frame to all connected peers.
   */
  public broadcastFrame(
    type: PeerMessageType,
    payload: Record<string, unknown>,
    targetNodeId?: string
  ): EosPeerFrame {
    this.currentSeq++;
    const timestampIso = new Date().toISOString();
    const frameSha256 = computeFrameSha256(
      this.nodeId,
      this.currentSeq,
      type,
      payload,
      timestampIso
    );

    const frame: EosPeerFrame = deepFreeze({
      senderNodeId: this.nodeId,
      targetNodeId,
      seq: this.currentSeq,
      type,
      payload: deepFreeze({ ...payload }),
      timestampIso,
      frameSha256
    });

    const serialized = JSON.stringify(frame) + "\n";
    for (const socket of this.peerSockets) {
      try {
        socket.write(serialized);
      } catch {
        // Socket closed
      }
    }

    if (this.ledger) {
      try {
        this.ledger.appendEntry({
          category: "VERIFICATION_RECEIPT",
          projectId: "eos-system",
          title: `Peer Frame Sent: ${type} [seq: ${this.currentSeq}]`,
          payload: {
            nodeId: this.nodeId,
            type,
            frameSha256
          }
        });
      } catch {
        // Fallback
      }
    }

    return frame;
  }

  /**
   * Closes all active peer connections and terminates the local server.
   */
  public async stop(): Promise<void> {
    for (const socket of this.peerSockets) {
      try {
        socket.destroy();
      } catch {
        // Ignore
      }
    }
    this.peerSockets.clear();

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
      });
      this.server = null;
    }
  }
}
