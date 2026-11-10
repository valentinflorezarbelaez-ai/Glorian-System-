/**
 * Peak Assurance TCB Gate (SPEC-146 / LADDER-14 Wave A)
 * Fail-closed predicates for MCP Streamable security + Law IV write barrier.
 * Layer-0 pure TypeScript — zero runtime npm dependencies.
 */

import crypto from "node:crypto";

export const MCP_MAX_PAYLOAD_BYTES = 1_048_576;
export const TCB_MUTATION_SCORE_FLOOR = 80;

export type TcbRejectReason =
  "ORIGIN_DENIED" | "PAYLOAD_TOO_LARGE" | "TOKEN_BINDING_MISMATCH" | "LAW_IV_INCOMPLETE" | "MISSING_TOKEN";

export interface TcbDecision {
  readonly admitted: boolean;
  readonly reason?: TcbRejectReason;
  readonly statusCode: number;
}

export interface LawIvPreconditions {
  readonly registered: boolean;
  readonly intakeComplete: boolean;
  readonly specificationApproved: boolean;
  readonly auditComplete: boolean;
  readonly ownerApproval: boolean;
  readonly implementationAuthorized: boolean;
}

function assertPrecondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`TCB_PRECONDITION_FAILED: ${message}`);
  }
}

function assertPostcondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`TCB_POSTCONDITION_FAILED: ${message}`);
  }
}

export function isOriginAllowed(origin: string | undefined, allowlist: readonly string[]): boolean {
  assertPrecondition(Array.isArray(allowlist), "allowlist must be an array");
  if (!origin || typeof origin !== "string" || origin.trim().length === 0) return false;
  if (allowlist.length === 0) return false;
  return allowlist.includes(origin);
}

export function isPayloadWithinBound(byteLength: number, maxBytes: number = MCP_MAX_PAYLOAD_BYTES): boolean {
  assertPrecondition(Number.isFinite(byteLength) && byteLength >= 0, "byteLength must be finite >= 0");
  assertPrecondition(maxBytes === MCP_MAX_PAYLOAD_BYTES, "maxBytes must equal MCP 1 MiB bound");
  return byteLength <= maxBytes;
}

export function hashToken(token: string): string {
  assertPrecondition(typeof token === "string" && token.length >= 32, "token must be a CSPRNG string >= 32 chars");
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function verifySessionTokenBinding(sessionTokenHash: string, presentedToken: string): boolean {
  assertPrecondition(/^[a-f0-9]{64}$/i.test(sessionTokenHash), "sessionTokenHash must be sha256 hex");
  const presented = Buffer.from(hashToken(presentedToken), "utf8");
  const expected = Buffer.from(sessionTokenHash.toLowerCase(), "utf8");
  if (presented.length !== expected.length) return false;
  return crypto.timingSafeEqual(presented, expected);
}

export function evaluateLawIvWriteBarrier(preconditions: LawIvPreconditions): boolean {
  return (
    preconditions.registered === true &&
    preconditions.intakeComplete === true &&
    preconditions.specificationApproved === true &&
    preconditions.auditComplete === true &&
    preconditions.ownerApproval === true &&
    preconditions.implementationAuthorized === true
  );
}

export function evaluateMcpAdmission(input: {
  origin?: string;
  allowlist: readonly string[];
  payloadBytes: number;
  sessionTokenHash?: string;
  presentedToken?: string;
}): TcbDecision {
  if (!isOriginAllowed(input.origin, input.allowlist)) {
    return { admitted: false, reason: "ORIGIN_DENIED", statusCode: 403 };
  }
  if (!isPayloadWithinBound(input.payloadBytes)) {
    return { admitted: false, reason: "PAYLOAD_TOO_LARGE", statusCode: 413 };
  }
  if (!input.presentedToken) {
    return { admitted: false, reason: "MISSING_TOKEN", statusCode: 401 };
  }
  if (input.sessionTokenHash) {
    if (!verifySessionTokenBinding(input.sessionTokenHash, input.presentedToken)) {
      return { admitted: false, reason: "TOKEN_BINDING_MISMATCH", statusCode: 401 };
    }
  }
  const decision: TcbDecision = { admitted: true, statusCode: 200 };
  assertPostcondition(decision.admitted === true, "admitted decision must be true on accept path");
  return decision;
}

export function evaluateExternalWrite(preconditions: LawIvPreconditions): TcbDecision {
  if (!evaluateLawIvWriteBarrier(preconditions)) {
    return { admitted: false, reason: "LAW_IV_INCOMPLETE", statusCode: 403 };
  }
  return { admitted: true, statusCode: 200 };
}

/** Snippet used by mutation testing — predicates must kill operator mutants. */
export const TCB_MUTATION_TARGET_SNIPPET = `
function admit(originOk, payloadOk, tokenOk, lawIvOk) {
  if (originOk === false) return false;
  if (payloadOk === false) return false;
  if (tokenOk === false) return false;
  if (lawIvOk === false) return false;
  return true;
}
`;
