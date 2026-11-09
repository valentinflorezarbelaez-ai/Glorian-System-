/**
 * IAM Audit Ledger (Layer-0) — SPEC-184 FR-935
 * Append-only JSONL with hash-chained entries for MCP IAM decisions.
 * WITHIN_TESTED_SCOPE — local durable audit, not SIEM / not OIDC.
 *
 * Zero external runtime dependencies.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { deepFreeze } from "./eosKernelPrimitives.ts";
import type { IamDecision, IamPrincipal } from "./eosMultiTenantIamFoundation.ts";

export interface IamAuditAppendInput {
  readonly toolName: string;
  readonly decision: IamDecision;
  readonly principal: IamPrincipal | null;
  readonly resourceId: string | null;
  readonly requestId?: string | number | null;
}

export interface IamAuditEntry {
  readonly ts: string;
  readonly toolName: string;
  readonly code: string;
  readonly ok: boolean;
  readonly subjectId: string | null;
  readonly tenantId: string | null;
  readonly resourceId: string | null;
  readonly matchedPolicyId: string | null;
  readonly decisionReceipt: string;
  readonly requestId: string | null;
  readonly previousHash: string;
  readonly entryHash: string;
}

export interface IamAuditAppendResult {
  readonly entry: IamAuditEntry;
  readonly ledgerPath: string;
}

const GENESIS = "0".repeat(64);

function ledgerRelPath(): string {
  return path.join(".eos", "iam-audit.jsonl");
}

function readLastHash(ledgerPath: string): string {
  if (!fs.existsSync(ledgerPath)) return GENESIS;
  try {
    const raw = fs.readFileSync(ledgerPath, "utf8").trim();
    if (!raw) return GENESIS;
    const lines = raw.split("\n");
    const last = JSON.parse(lines[lines.length - 1]);
    return typeof last.entryHash === "string" && last.entryHash.length === 64 ? last.entryHash : GENESIS;
  } catch {
    return GENESIS;
  }
}

function hashEntry(payload: Omit<IamAuditEntry, "entryHash">): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Append one IAM decision. Fail-closed on I/O errors (throws) so callers can
 * decide whether to deny the tool call when audit cannot be durably recorded.
 */
export function appendIamAuditEntry(projectRoot: string, input: IamAuditAppendInput): IamAuditAppendResult {
  const ledgerPath = path.join(projectRoot, ledgerRelPath());
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const previousHash = readLastHash(ledgerPath);
  const base = {
    ts: new Date().toISOString(),
    toolName: input.toolName,
    code: input.decision.code,
    ok: input.decision.ok,
    subjectId: input.principal?.subjectId ?? null,
    tenantId: input.principal?.tenantId ?? null,
    resourceId: input.resourceId,
    matchedPolicyId: input.decision.matchedPolicyId,
    decisionReceipt: input.decision.sha256Receipt,
    requestId: input.requestId === undefined || input.requestId === null ? null : String(input.requestId),
    previousHash,
  };
  const entry: IamAuditEntry = deepFreeze({
    ...base,
    entryHash: hashEntry(base),
  });
  fs.appendFileSync(ledgerPath, JSON.stringify(entry) + "\n", "utf8");
  return deepFreeze({ entry, ledgerPath });
}

/** Verify hash chain integrity of an on-disk ledger. */
export function verifyIamAuditLedger(projectRoot: string): {
  readonly ok: boolean;
  readonly entries: number;
  readonly reason: string | null;
} {
  const ledgerPath = path.join(projectRoot, ledgerRelPath());
  if (!fs.existsSync(ledgerPath)) {
    return deepFreeze({ ok: true, entries: 0, reason: null });
  }
  const raw = fs.readFileSync(ledgerPath, "utf8").trim();
  if (!raw) return deepFreeze({ ok: true, entries: 0, reason: null });
  const lines = raw.split("\n");
  let previousHash = GENESIS;
  for (let i = 0; i < lines.length; i++) {
    let parsed: IamAuditEntry;
    try {
      parsed = JSON.parse(lines[i]);
    } catch {
      return deepFreeze({ ok: false, entries: i, reason: `INVALID_JSON_LINE_${i}` });
    }
    if (parsed.previousHash !== previousHash) {
      return deepFreeze({ ok: false, entries: i, reason: `CHAIN_BREAK_AT_${i}` });
    }
    const { entryHash, ...rest } = parsed;
    const expected = hashEntry(rest);
    if (entryHash !== expected) {
      return deepFreeze({ ok: false, entries: i, reason: `HASH_MISMATCH_AT_${i}` });
    }
    previousHash = entryHash;
  }
  return deepFreeze({ ok: true, entries: lines.length, reason: null });
}
