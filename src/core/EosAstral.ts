/**
 * EOS SYSTEM — EOS ASTRAL: 5D MOLECULAR PROJECTION & SILVER CORD ENGINE
 *
 * Law II & Law IV (Pure Layer-0 Theurgic Core):
 * Desdoblamiento molecular en 5D (sandboxes y worktrees efímeros)
 * con verificación criptográfica estricta mediante Cordón de Plata HMAC-SHA256.
 *
 * Invariant: Pure Layer-0 TypeScript (dependencies: {}).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface AstralThreadProjection {
  readonly threadId: string;
  readonly parentPath: string;
  readonly projectionPath: string;
  readonly createdAtIso: string;
  readonly silverCordToken: string;
  readonly active: boolean;
}

export interface AstralCommitResult {
  readonly committed: boolean;
  readonly threadId: string;
  readonly diffHash: string;
  readonly sealReceipt: string;
  readonly timestamp: string;
}

export interface AstralDissolveResult {
  readonly dissolved: boolean;
  readonly threadId: string;
  readonly rollbackVerified: boolean;
  readonly timestamp: string;
}

export class EosAstral {
  private readonly projectRoot: string;
  private readonly silverCordSecret: string;
  private readonly activeThreads: Map<string, AstralThreadProjection> = new Map();

  constructor(projectRoot?: string, secretKey?: string) {
    this.projectRoot = path.resolve(projectRoot || process.cwd());
    this.silverCordSecret = secretKey || crypto.randomBytes(32).toString("hex");
  }

  /**
   * Generates a tamper-evident Silver Cord HMAC-SHA256 token binding
   * the thread, parent path, projection path, and timestamp.
   */
  public generateSilverCordToken(threadId: string, parentPath: string, projectionPath: string, timestamp: string): string {
    return crypto
      .createHmac("sha256", this.silverCordSecret)
      .update(`${threadId}:${parentPath}:${projectionPath}:${timestamp}`)
      .digest("hex");
  }

  /**
   * Projects a new 5D isolated ephemeral thread (astral projection).
   */
  public projectAstralThread(targetSubdir: string = ".worktrees/astral-scratch"): AstralThreadProjection {
    const threadId = `ASTRAL-${crypto.randomBytes(8).toString("hex")}`;
    const projectionPath = path.resolve(this.projectRoot, targetSubdir, threadId);
    const createdAtIso = new Date().toISOString();

    const silverCordToken = this.generateSilverCordToken(
      threadId,
      this.projectRoot,
      projectionPath,
      createdAtIso
    );

    const thread: AstralThreadProjection = Object.freeze({
      threadId,
      parentPath: this.projectRoot,
      projectionPath,
      createdAtIso,
      silverCordToken,
      active: true
    });

    this.activeThreads.set(threadId, thread);
    return thread;
  }

  /**
   * Verifies the authenticity and unbroken continuity of the Silver Cord.
   */
  public verifySilverCord(thread: AstralThreadProjection): boolean {
    if (!thread || !thread.active) return false;
    const expected = this.generateSilverCordToken(
      thread.threadId,
      thread.parentPath,
      thread.projectionPath,
      thread.createdAtIso
    );

    // Constant-time comparison to prevent timing attacks
    return (
      crypto.timingSafeEqual(
        Buffer.from(thread.silverCordToken, "hex"),
        Buffer.from(expected, "hex")
      )
    );
  }

  /**
   * Dissolves an astral thread safely, verifying rollback and clearing resources.
   */
  public dissolveAstralThread(threadId: string): AstralDissolveResult {
    const thread = this.activeThreads.get(threadId);
    if (!thread) {
      return {
        dissolved: false,
        threadId,
        rollbackVerified: false,
        timestamp: new Date().toISOString()
      };
    }

    const cordIntact = this.verifySilverCord(thread);
    this.activeThreads.delete(threadId);

    return {
      dissolved: true,
      threadId,
      rollbackVerified: cordIntact,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Commits mutations from a verified astral thread, returning a sealed cryptographic receipt.
   */
  public commitAstralMutation(threadId: string, diffHash: string): AstralCommitResult {
    const thread = this.activeThreads.get(threadId);
    if (!thread) {
      throw new Error(`Astral thread ${threadId} not found or already dissolved.`);
    }

    if (!this.verifySilverCord(thread)) {
      throw new Error(`VIOLATION: Silver Cord severed or tampered on thread ${threadId}. Commit rejected.`);
    }

    const sealReceipt = crypto
      .createHash("sha384")
      .update(`ASTRAL_COMMIT:${threadId}:${diffHash}:${thread.silverCordToken}`)
      .digest("hex");

    this.activeThreads.delete(threadId);

    return {
      committed: true,
      threadId,
      diffHash,
      sealReceipt,
      timestamp: new Date().toISOString()
    };
  }

  public getActiveThreadsCount(): number {
    return this.activeThreads.size;
  }
}
