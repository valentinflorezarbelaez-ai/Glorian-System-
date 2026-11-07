/**
 * src/core/eosUniversalAgentSessionContract.ts
 *
 * SPEC-152: Universal Agent Session Contract
 * SPEC-153: Durable ledger + preferred Cursor/Antigravity write gates
 *
 * ZERO runtime NPM dependencies — Layer-0 Pure TypeScript.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { assertPrecondition, assertPostcondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  EosAntigravityDirector,
  type AntigravityMissionProfile,
  type MissionDirectionPlan,
  type PrescribedMcpStep,
  type WriteBarrierStatus,
} from "./eosAntigravityDirector.ts";
import { EosGentlemanStackBridge } from "./eosGentlemanStackBridge.ts";

export type IdeFamily = "cursor" | "antigravity" | "claude-code" | "vscode";

export const SUPPORTED_IDE_FAMILIES: readonly IdeFamily[] = Object.freeze([
  "cursor",
  "antigravity",
  "claude-code",
  "vscode",
]);

/** Preferred enforcement surfaces (SPEC-153). */
export const PREFERRED_IDE_FAMILIES: readonly IdeFamily[] = Object.freeze(["cursor", "antigravity"]);

export interface AgentSessionRecord {
  readonly sessionId: string;
  readonly ideFamily: IdeFamily;
  readonly directive: string;
  readonly target: string;
  readonly profile: AntigravityMissionProfile;
  readonly writeBarrierStatus: WriteBarrierStatus;
  readonly missingPreconditions: readonly string[];
  readonly prescribedMcpDag: readonly PrescribedMcpStep[];
  readonly mandatoryTools: readonly string[];
  readonly completedTools: ReadonlySet<string>;
  readonly sessionReceipt: string;
  readonly missionReceipt: string;
  readonly openedAtMs: number;
  readonly expiresAtMs: number;
}

export interface OpenSessionResult {
  readonly sessionId: string;
  readonly ideFamily: IdeFamily;
  readonly profile: AntigravityMissionProfile;
  readonly writeBarrierStatus: WriteBarrierStatus;
  readonly missingPreconditions: readonly string[];
  readonly prescribedMcpDag: readonly PrescribedMcpStep[];
  readonly mandatoryTools: readonly string[];
  readonly sessionReceipt: string;
  readonly missionReceipt: string;
  readonly expiresAtMs: number;
}

export interface WriteAuthorizationDecision {
  readonly decision: "allow" | "deny";
  readonly reason: string;
  readonly sessionId: string | null;
  readonly sessionReceipt: string | null;
  readonly missingTools: readonly string[];
  readonly writeBarrierStatus: WriteBarrierStatus | null;
}

/** Compact Gentleman Programming Gentle-AI alignment bound to Glorian sessions (SPEC-154). */
export interface GentlemanSessionAlignment {
  readonly readinessScore: number;
  readonly status: string;
  readonly sha256Receipt: string;
  readonly constitutionPreserved: boolean;
  readonly protocol: readonly string[];
  readonly source: "Gentleman-Programming/gentle-ai-stack";
  readonly alignedAtMs: number;
}

interface DurableSessionBlob {
  sessionId: string;
  ideFamily: IdeFamily;
  directive: string;
  target: string;
  profile: AntigravityMissionProfile;
  writeBarrierStatus: WriteBarrierStatus;
  missingPreconditions: string[];
  prescribedMcpDag: PrescribedMcpStep[];
  mandatoryTools: string[];
  completedTools: string[];
  sessionReceipt: string;
  missionReceipt: string;
  openedAtMs: number;
  expiresAtMs: number;
}

interface DurableLedger {
  version: 1;
  activeByIde: Partial<Record<IdeFamily, string>>;
  sessions: Record<string, DurableSessionBlob>;
  gentlemanAlignment?: GentlemanSessionAlignment;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const LEDGER_LOCK_TIMEOUT_MS = 5_000;
const LEDGER_LOCK_STALE_MS = 10_000;
// Windows refuses to replace a file that another process holds open for reading.
const TRANSIENT_RENAME_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);
// Windows reports a held lock file as EPERM/EACCES instead of EEXIST.
const LOCK_CONTENTION_CODES = new Set(["EEXIST", "EPERM", "EACCES", "EBUSY"]);

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const DEFAULT_DIRECTIVE =
  "Govern engineering work under Glorian SPEC-152/153: classify mission, complete mandatory MCP DAG, then authorize writes.";

function isIdeFamily(value: string): value is IdeFamily {
  return (SUPPORTED_IDE_FAMILIES as readonly string[]).includes(value);
}

function isPreferredIde(value: string): value is IdeFamily {
  return (PREFERRED_IDE_FAMILIES as readonly string[]).includes(value);
}

export class EosUniversalAgentSessionContract {
  public static readonly LEDGER_REL_PATH = path.join(".eos", "state", "agent-sessions.json");

  private readonly projectRoot: string;
  private readonly ttlMs: number;
  private readonly ledgerPath: string;
  private readonly sessions = new Map<
    string,
    {
      record: AgentSessionRecord;
      completed: Set<string>;
    }
  >();
  private activeByIde: Partial<Record<IdeFamily, string>> = {};
  private gentlemanAlignment: GentlemanSessionAlignment | null = null;

  constructor(projectRoot: string = process.cwd(), ttlMs: number = DEFAULT_TTL_MS) {
    assertPrecondition(typeof projectRoot === "string" && projectRoot.length > 0, "projectRoot required");
    assertPrecondition(Number.isFinite(ttlMs) && ttlMs >= 1_000 && ttlMs <= 86_400_000, "ttlMs out of bounds");
    this.projectRoot = path.resolve(projectRoot);
    this.ttlMs = ttlMs;
    this.ledgerPath = path.join(this.projectRoot, EosUniversalAgentSessionContract.LEDGER_REL_PATH);
    this.reloadFromDisk();
  }

  public openSession(input: { ideFamily: string; directive: string; target?: string }): OpenSessionResult {
    assertPrecondition(typeof input.ideFamily === "string", "ideFamily must be a string");
    if (!isIdeFamily(input.ideFamily)) {
      throw new Error(`Unsupported ideFamily: ${input.ideFamily}`);
    }
    assertPrecondition(
      typeof input.directive === "string" && input.directive.trim().length > 0,
      "directive must be non-empty",
    );

    this.reloadFromDisk();

    const plan: MissionDirectionPlan = EosAntigravityDirector.directMission(
      input.directive.trim(),
      input.target || "eos-system",
      this.projectRoot,
    );

    const sessionId = crypto.randomUUID();
    const openedAtMs = Date.now();
    const expiresAtMs = openedAtMs + this.ttlMs;
    const mandatoryTools = plan.prescribedMcpDag.filter((step) => step.mandatory).map((step) => step.toolName);

    const sessionReceipt = pureSha256(
      JSON.stringify({
        sessionId,
        ideFamily: input.ideFamily,
        missionReceipt: plan.sha256Receipt,
        mandatoryTools,
        openedAtMs,
      }),
    );
    assertPostcondition(sessionReceipt.length === 64, "sessionReceipt must be 64-hex");

    const record: AgentSessionRecord = deepFreeze({
      sessionId,
      ideFamily: input.ideFamily,
      directive: plan.directive,
      target: plan.targetIdentifier,
      profile: plan.profile,
      writeBarrierStatus: plan.writeBarrierStatus,
      missingPreconditions: plan.missingPreconditions,
      prescribedMcpDag: plan.prescribedMcpDag,
      mandatoryTools,
      completedTools: new Set<string>(),
      sessionReceipt,
      missionReceipt: plan.sha256Receipt,
      openedAtMs,
      expiresAtMs,
    });

    this.sessions.set(sessionId, { record, completed: new Set() });
    this.activeByIde[input.ideFamily] = sessionId;
    this.persistToDisk();

    return this.toOpenResult(record);
  }

  public ensurePreferredIdeSession(input: {
    ideFamily: string;
    directive?: string;
    target?: string;
  }): OpenSessionResult {
    if (!isPreferredIde(input.ideFamily)) {
      throw new Error(`ensurePreferredIdeSession requires cursor or antigravity, got: ${input.ideFamily}`);
    }
    this.reloadFromDisk();
    this.alignGentlemanStack();
    const existing = this.getActiveSessionForIde(input.ideFamily);
    if (existing) {
      return this.toOpenResult(existing);
    }
    return this.openSession({
      ideFamily: input.ideFamily,
      directive: input.directive?.trim() || DEFAULT_DIRECTIVE,
      target: input.target || "eos-system",
    });
  }

  /**
   * SPEC-154: Probe Gentleman Programming Gentle-AI Stack and bind readiness to the ledger.
   * Glorian remains the constitutional gate; Gentle AI supplies memory, ODD workflow, and review.
   */
  public alignGentlemanStack(): GentlemanSessionAlignment {
    this.reloadFromDisk();
    const freshMs = 60 * 60 * 1000;
    if (this.gentlemanAlignment && Date.now() - this.gentlemanAlignment.alignedAtMs < freshMs) {
      return this.gentlemanAlignment;
    }
    const report = EosGentlemanStackBridge.auditStack(this.projectRoot);
    const alignment: GentlemanSessionAlignment = deepFreeze({
      readinessScore: report.readinessScore,
      status: report.status,
      sha256Receipt: report.sha256Receipt,
      constitutionPreserved: report.constitutionPreserved,
      protocol: EosGentlemanStackBridge.CO_GOVERNANCE_PROTOCOL,
      source: "Gentleman-Programming/gentle-ai-stack",
      alignedAtMs: Date.now(),
    });
    this.gentlemanAlignment = alignment;
    this.persistToDisk();
    return alignment;
  }

  public getGentlemanAlignment(): GentlemanSessionAlignment | null {
    this.reloadFromDisk();
    return this.gentlemanAlignment;
  }

  public formatCoGovernanceSessionMessage(ideFamily: string, session: OpenSessionResult): string {
    const alignment = this.gentlemanAlignment || this.alignGentlemanStack();
    const protocol = alignment.protocol.join(" ");
    const canon = EosGentlemanStackBridge.EXTERNAL_CANON;
    return (
      `EOS/Glorian SPEC-154 co-governs with Gentleman Programming Gentle-AI Stack ` +
      `(${canon.site} · ${canon.github} · ${canon.youtubeMain} · ${canon.youtubeVods}). ` +
      `Author=${canon.author}. ` +
      `ide=${ideFamily} sessionId=${session.sessionId} ` +
      `gentlemanStatus=${alignment.status} readiness=${alignment.readinessScore}/100. ` +
      `Glorian gates writes via eos_agent_session_contract / eos_mission_run; Gentle AI supplies Engram memory, ` +
      `ODD+SDD workflow (gentle-ai), focused agents, GGA review, Context7 docs, and agent-teams-lite. ` +
      `Doctrine: verification over generation; requirements before code; inline low-risk / delegate large; humans keep push/PR/merge. ` +
      `Protocol: ${protocol} ` +
      `Mandatory Glorian DAG before writes: ${session.mandatoryTools.join(", ") || "(none)"}.`
    );
  }

  public getActiveSessionForIde(ideFamily: string): AgentSessionRecord | null {
    if (!isIdeFamily(ideFamily)) return null;
    this.reloadFromDisk();
    const sessionId = this.activeByIde[ideFamily];
    if (!sessionId) return null;
    const live = this.sessions.get(sessionId);
    if (!live || Date.now() > live.record.expiresAtMs) {
      if (live) this.sessions.delete(sessionId);
      if (this.activeByIde[ideFamily] === sessionId) delete this.activeByIde[ideFamily];
      this.persistToDisk();
      return null;
    }
    return deepFreeze({
      ...live.record,
      completedTools: new Set(live.completed),
    });
  }

  public recordToolInvocation(
    sessionId: string,
    toolName: string,
  ): {
    readonly recorded: boolean;
    readonly completedTools: readonly string[];
    readonly remainingMandatory: readonly string[];
  } {
    this.reloadFromDisk();
    const live = this.requireLiveSession(sessionId);
    assertPrecondition(typeof toolName === "string" && toolName.length > 0, "toolName required");
    const known = live.record.prescribedMcpDag.some((s) => s.toolName === toolName);
    if (known) {
      live.completed.add(toolName);
      this.persistToDisk();
    }
    const remaining = live.record.mandatoryTools.filter((t) => !live.completed.has(t));
    return deepFreeze({
      recorded: known,
      completedTools: Array.from(live.completed).sort(),
      remainingMandatory: remaining,
    });
  }

  /**
   * Records a dispatched MCP tool against every live session that lists it in its DAG.
   */
  public recordToolAcrossLiveSessions(toolName: string): {
    readonly updatedSessionIds: readonly string[];
  } {
    this.reloadFromDisk();
    const updated: string[] = [];
    for (const [sessionId, live] of this.sessions) {
      if (Date.now() > live.record.expiresAtMs) continue;
      if (live.record.prescribedMcpDag.some((s) => s.toolName === toolName)) {
        if (!live.completed.has(toolName)) {
          live.completed.add(toolName);
          updated.push(sessionId);
        }
      }
    }
    if (updated.length > 0) this.persistToDisk();
    return deepFreeze({ updatedSessionIds: updated });
  }

  public authorizeWrite(input: {
    sessionId: string;
    sessionReceipt?: string;
    paths?: readonly string[];
  }): WriteAuthorizationDecision {
    this.reloadFromDisk();
    if (!input.sessionId || !this.sessions.has(input.sessionId)) {
      return deepFreeze({
        decision: "deny",
        reason: "SESSION_NOT_FOUND",
        sessionId: input.sessionId || null,
        sessionReceipt: null,
        missingTools: [],
        writeBarrierStatus: null,
      });
    }

    const live = this.sessions.get(input.sessionId)!;
    if (Date.now() > live.record.expiresAtMs) {
      this.sessions.delete(input.sessionId);
      this.persistToDisk();
      return deepFreeze({
        decision: "deny",
        reason: "SESSION_EXPIRED",
        sessionId: input.sessionId,
        sessionReceipt: null,
        missingTools: [],
        writeBarrierStatus: null,
      });
    }

    if (
      typeof input.sessionReceipt === "string" &&
      input.sessionReceipt.length > 0 &&
      input.sessionReceipt !== live.record.sessionReceipt
    ) {
      return deepFreeze({
        decision: "deny",
        reason: "RECEIPT_MISMATCH",
        sessionId: input.sessionId,
        sessionReceipt: live.record.sessionReceipt,
        missingTools: [],
        writeBarrierStatus: live.record.writeBarrierStatus,
      });
    }

    if (live.record.writeBarrierStatus === "BLOCKED_BY_LAW_IV") {
      return deepFreeze({
        decision: "deny",
        reason: "LAW_IV_BLOCKED",
        sessionId: input.sessionId,
        sessionReceipt: live.record.sessionReceipt,
        missingTools: [],
        writeBarrierStatus: live.record.writeBarrierStatus,
      });
    }

    const missingTools = live.record.mandatoryTools.filter((t) => !live.completed.has(t));
    if (missingTools.length > 0) {
      return deepFreeze({
        decision: "deny",
        reason: "MANDATORY_DAG_INCOMPLETE",
        sessionId: input.sessionId,
        sessionReceipt: live.record.sessionReceipt,
        missingTools,
        writeBarrierStatus: live.record.writeBarrierStatus,
      });
    }

    return deepFreeze({
      decision: "allow",
      reason: "DAG_COMPLETE",
      sessionId: input.sessionId,
      sessionReceipt: live.record.sessionReceipt,
      missingTools: [],
      writeBarrierStatus: live.record.writeBarrierStatus,
    });
  }

  public evaluatePreferredWriteGate(ideFamily: string, paths?: readonly string[]): WriteAuthorizationDecision {
    if (!isPreferredIde(ideFamily)) {
      return deepFreeze({
        decision: "deny",
        reason: "NOT_PREFERRED_IDE",
        sessionId: null,
        sessionReceipt: null,
        missingTools: [],
        writeBarrierStatus: null,
      });
    }
    const active = this.getActiveSessionForIde(ideFamily);
    if (!active) {
      return deepFreeze({
        decision: "deny",
        reason: "NO_ACTIVE_SESSION",
        sessionId: null,
        sessionReceipt: null,
        missingTools: [],
        writeBarrierStatus: null,
      });
    }
    return this.authorizeWrite({
      sessionId: active.sessionId,
      sessionReceipt: active.sessionReceipt,
      paths,
    });
  }

  public getSessionStatus(sessionId: string): {
    readonly found: boolean;
    readonly ideFamily?: IdeFamily;
    readonly profile?: AntigravityMissionProfile;
    readonly writeBarrierStatus?: WriteBarrierStatus;
    readonly mandatoryTools?: readonly string[];
    readonly completedTools?: readonly string[];
    readonly remainingMandatory?: readonly string[];
    readonly sessionReceipt?: string;
    readonly expiresAtMs?: number;
  } {
    this.reloadFromDisk();
    const live = this.sessions.get(sessionId);
    if (!live || Date.now() > live.record.expiresAtMs) {
      if (live) {
        this.sessions.delete(sessionId);
        this.persistToDisk();
      }
      return deepFreeze({ found: false });
    }
    const remaining = live.record.mandatoryTools.filter((t) => !live.completed.has(t));
    return deepFreeze({
      found: true,
      ideFamily: live.record.ideFamily,
      profile: live.record.profile,
      writeBarrierStatus: live.record.writeBarrierStatus,
      mandatoryTools: live.record.mandatoryTools,
      completedTools: Array.from(live.completed).sort(),
      remainingMandatory: remaining,
      sessionReceipt: live.record.sessionReceipt,
      expiresAtMs: live.record.expiresAtMs,
    });
  }

  public getLedgerPath(): string {
    return this.ledgerPath;
  }

  private toOpenResult(record: AgentSessionRecord): OpenSessionResult {
    return deepFreeze({
      sessionId: record.sessionId,
      ideFamily: record.ideFamily,
      profile: record.profile,
      writeBarrierStatus: record.writeBarrierStatus,
      missingPreconditions: record.missingPreconditions,
      prescribedMcpDag: record.prescribedMcpDag,
      mandatoryTools: record.mandatoryTools,
      sessionReceipt: record.sessionReceipt,
      missionReceipt: record.missionReceipt,
      expiresAtMs: record.expiresAtMs,
    });
  }

  private requireLiveSession(sessionId: string) {
    assertPrecondition(typeof sessionId === "string" && sessionId.length > 0, "sessionId required");
    const live = this.sessions.get(sessionId);
    if (!live) {
      throw new Error(`Unknown agent session: ${sessionId}`);
    }
    if (Date.now() > live.record.expiresAtMs) {
      this.sessions.delete(sessionId);
      this.persistToDisk();
      throw new Error(`Expired agent session: ${sessionId}`);
    }
    return live;
  }

  private reloadFromDisk(): void {
    const ledger = this.readLedgerFromDisk();
    if (!ledger) return;

    // Merge instead of clearing: another IDE/process may have written the ledger
    // while this instance kept live sessions in memory. Clearing here would make
    // concurrent agents invalidate each other's sessions.
    this.activeByIde = { ...(ledger.activeByIde || {}), ...this.activeByIde };
    if (
      ledger.gentlemanAlignment &&
      typeof ledger.gentlemanAlignment.readinessScore === "number" &&
      !this.gentlemanAlignment
    ) {
      this.gentlemanAlignment = deepFreeze({ ...ledger.gentlemanAlignment });
    }

    const now = Date.now();
    for (const [id, blob] of Object.entries(ledger.sessions || {})) {
      if (!blob || now > blob.expiresAtMs) continue;
      const existing = this.sessions.get(id);
      if (!existing) {
        this.sessions.set(id, this.liveFromBlob(blob));
        continue;
      }
      for (const toolName of blob.completedTools || []) {
        existing.completed.add(toolName);
      }
    }
  }

  private readLedgerFromDisk(): DurableLedger | null {
    try {
      if (!fs.existsSync(this.ledgerPath)) return null;
      const raw = fs.readFileSync(this.ledgerPath, "utf8");
      const ledger = JSON.parse(raw) as DurableLedger;
      if (!ledger || ledger.version !== 1 || typeof ledger.sessions !== "object") return null;
      return ledger;
    } catch {
      // Corrupt ledger: keep in-memory live sessions and let the next persist rewrite it.
      return null;
    }
  }

  private liveFromBlob(blob: DurableSessionBlob): {
    record: AgentSessionRecord;
    completed: Set<string>;
  } {
    return {
      record: deepFreeze({
        sessionId: blob.sessionId,
        ideFamily: blob.ideFamily,
        directive: blob.directive,
        target: blob.target,
        profile: blob.profile,
        writeBarrierStatus: blob.writeBarrierStatus,
        missingPreconditions: blob.missingPreconditions || [],
        prescribedMcpDag: blob.prescribedMcpDag || [],
        mandatoryTools: blob.mandatoryTools || [],
        completedTools: new Set(blob.completedTools || []),
        sessionReceipt: blob.sessionReceipt,
        missionReceipt: blob.missionReceipt,
        openedAtMs: blob.openedAtMs,
        expiresAtMs: blob.expiresAtMs,
      }),
      completed: new Set(blob.completedTools || []),
    };
  }

  private blobFromLive(record: AgentSessionRecord, completed: ReadonlySet<string>): DurableSessionBlob {
    return {
      sessionId: record.sessionId,
      ideFamily: record.ideFamily,
      directive: record.directive,
      target: record.target,
      profile: record.profile,
      writeBarrierStatus: record.writeBarrierStatus,
      missingPreconditions: [...record.missingPreconditions],
      prescribedMcpDag: record.prescribedMcpDag.map((step) => ({ ...step })),
      mandatoryTools: [...record.mandatoryTools],
      completedTools: Array.from(completed),
      sessionReceipt: record.sessionReceipt,
      missionReceipt: record.missionReceipt,
      openedAtMs: record.openedAtMs,
      expiresAtMs: record.expiresAtMs,
    };
  }

  private persistToDisk(): void {
    this.withLedgerLock(() => {
      const disk = this.readLedgerFromDisk();
      const now = Date.now();
      const sessions = new Map<string, DurableSessionBlob>();

      // Preserve sessions written by other processes before merging ours in.
      for (const [id, blob] of Object.entries(disk?.sessions || {})) {
        if (!blob || now > blob.expiresAtMs) continue;
        sessions.set(id, { ...blob, completedTools: [...(blob.completedTools || [])] });
      }

      for (const [id, live] of this.sessions) {
        if (now > live.record.expiresAtMs) continue;
        const prior = sessions.get(id);
        const completed = new Set([...(prior?.completedTools || []), ...live.completed]);
        sessions.set(id, this.blobFromLive(live.record, completed));
      }

      const ledger: DurableLedger = {
        version: 1,
        activeByIde: { ...(disk?.activeByIde || {}), ...this.activeByIde },
        sessions: Object.fromEntries(sessions),
        gentlemanAlignment: this.gentlemanAlignment || disk?.gentlemanAlignment || undefined,
      };

      const tempPath = `${this.ledgerPath}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
      try {
        fs.writeFileSync(tempPath, JSON.stringify(ledger, null, 2) + "\n", "utf8");
        this.replaceLedgerFile(tempPath);
      } catch (error) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // Best-effort cleanup; the original ledger stays intact.
        }
        throw error;
      }
    });
  }

  /**
   * Serializes read-merge-write across processes. Without it, two agents that
   * open sessions simultaneously can each write a snapshot missing the other.
   */
  private withLedgerLock<T>(operation: () => T): T {
    fs.mkdirSync(path.dirname(this.ledgerPath), { recursive: true });
    const lockPath = `${this.ledgerPath}.lock`;
    const deadline = Date.now() + LEDGER_LOCK_TIMEOUT_MS;
    let handle: number | null = null;

    while (handle === null) {
      try {
        handle = fs.openSync(lockPath, "wx");
      } catch (error) {
        if (!LOCK_CONTENTION_CODES.has((error as NodeJS.ErrnoException).code || "")) throw error;
        this.removeStaleLedgerLock(lockPath);
        if (Date.now() > deadline) {
          throw new Error(`Timed out waiting for agent session ledger lock: ${lockPath}`);
        }
        sleepSync(5 + Math.floor(Math.random() * 15));
      }
    }

    try {
      fs.writeSync(handle, `${process.pid}\n`);
      return operation();
    } finally {
      try {
        fs.closeSync(handle);
      } catch {
        // Handle already closed; the unlink below still releases the lock.
      }
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // Stale-lock collection on the next writer recovers this case.
      }
    }
  }

  private removeStaleLedgerLock(lockPath: string): void {
    try {
      const stats = fs.statSync(lockPath);
      if (Date.now() - stats.mtimeMs > LEDGER_LOCK_STALE_MS) {
        fs.unlinkSync(lockPath);
      }
    } catch {
      // Another process released the lock between our attempts.
    }
  }

  private replaceLedgerFile(tempPath: string): void {
    const deadline = Date.now() + 2_000;
    for (;;) {
      try {
        fs.renameSync(tempPath, this.ledgerPath);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (!TRANSIENT_RENAME_CODES.has(code || "") || Date.now() > deadline) throw error;
        sleepSync(5 + Math.floor(Math.random() * 10));
      }
    }
  }
}

const defaultContracts = new Map<string, EosUniversalAgentSessionContract>();

export function getDefaultAgentSessionContract(projectRoot: string = process.cwd()): EosUniversalAgentSessionContract {
  const key = path.resolve(projectRoot);
  let engine = defaultContracts.get(key);
  if (!engine) {
    engine = new EosUniversalAgentSessionContract(key);
    defaultContracts.set(key, engine);
  }
  return engine;
}
