/**
 * LLMOps Privacy Lane — local / open-weight fail-closed gate (Layer-0).
 * SPEC-183: LLMOps Privacy Lane (Local / Open-Weight)
 * WITHIN_TESTED_SCOPE — software policy only; not a physical enclave claim.
 *
 * WHEN EOS_LLM_PRIVACY_LANE=local|open_weight, THE SYSTEM SHALL refuse cloud
 * model egress that would carry plaintext secrets or force remote providers.
 */

import { createHash } from "node:crypto";
import { deepFreeze } from "./eosKernelPrimitives.ts";

export type PrivacyLaneMode = "cloud_allowed" | "local" | "open_weight";

export type PrivacyLaneDecisionCode =
  "ALLOW_LOCAL" | "ALLOW_CLOUD" | "REJECT_CLOUD_IN_LOCAL_LANE" | "REJECT_PLAINTEXT_SECRET" | "REJECT_REMOTE_PROVIDER";

export interface PrivacyLaneDecision {
  readonly ok: boolean;
  readonly mode: PrivacyLaneMode;
  readonly code: PrivacyLaneDecisionCode;
  readonly reason: string;
  readonly sha256Attestation: string;
}

const SECRET_PATTERNS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/i,
  /\bAIza[0-9A-Za-z\-_]{20,}\b/,
  /\b-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

const CLOUD_PROVIDER_MARKERS: readonly string[] = [
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "api.groq.com",
  "api.deepseek.com",
];

export function resolvePrivacyLaneMode(env: NodeJS.ProcessEnv = process.env): PrivacyLaneMode {
  const raw = String(env.EOS_LLM_PRIVACY_LANE || "")
    .trim()
    .toLowerCase();
  if (raw === "local" || raw === "open_weight" || raw === "open-weight") {
    return raw === "open-weight" ? "open_weight" : (raw as PrivacyLaneMode);
  }
  return "cloud_allowed";
}

export function containsPlaintextSecret(payload: string): boolean {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(payload)) return true;
  }
  return false;
}

export function isRemoteProviderEndpoint(endpointOrModel: string): boolean {
  const lower = endpointOrModel.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return CLOUD_PROVIDER_MARKERS.some((marker) => lower.includes(marker));
  }
  // Bare model ids that imply hosted frontier APIs
  return /^(gpt-|o1|o3|claude-|gemini-|deepseek-|groq)/i.test(lower);
}

function attest(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/**
 * Gate a proposed LLM egress. Local/open-weight lanes force local SLM path and
 * reject plaintext secrets regardless of lane.
 */
export function evaluatePrivacyLane(input: {
  readonly promptOrPayload: string;
  readonly providerOrEndpoint: string;
  readonly preferLocalSlm?: boolean;
  readonly env?: NodeJS.ProcessEnv;
}): PrivacyLaneDecision {
  const mode = resolvePrivacyLaneMode(input.env);
  const payload = String(input.promptOrPayload ?? "");
  const provider = String(input.providerOrEndpoint ?? "");

  if (containsPlaintextSecret(payload)) {
    return deepFreeze({
      ok: false,
      mode,
      code: "REJECT_PLAINTEXT_SECRET",
      reason: "Plaintext secret pattern detected in payload — Law VI fail-closed.",
      sha256Attestation: attest(["SECRET", mode, provider]),
    });
  }

  const remote = isRemoteProviderEndpoint(provider);
  if ((mode === "local" || mode === "open_weight") && remote) {
    return deepFreeze({
      ok: false,
      mode,
      code: "REJECT_REMOTE_PROVIDER",
      reason: `Privacy lane '${mode}' forbids remote provider '${provider}'. Use local/open-weight endpoint.`,
      sha256Attestation: attest(["REMOTE", mode, provider]),
    });
  }

  if ((mode === "local" || mode === "open_weight") && !input.preferLocalSlm && remote) {
    return deepFreeze({
      ok: false,
      mode,
      code: "REJECT_CLOUD_IN_LOCAL_LANE",
      reason: "Cloud egress blocked while EOS_LLM_PRIVACY_LANE is local/open_weight.",
      sha256Attestation: attest(["CLOUD", mode, provider]),
    });
  }

  if (mode === "local" || mode === "open_weight") {
    return deepFreeze({
      ok: true,
      mode,
      code: "ALLOW_LOCAL",
      reason: `Privacy lane '${mode}' admits local/open-weight inference only.`,
      sha256Attestation: attest(["ALLOW_LOCAL", mode, provider]),
    });
  }

  return deepFreeze({
    ok: true,
    mode,
    code: "ALLOW_CLOUD",
    reason: "Default lane allows cloud providers; secrets still scanned fail-closed.",
    sha256Attestation: attest(["ALLOW_CLOUD", mode, provider]),
  });
}

export class EosLlmOpsPrivacyLane {
  public static evaluate(
    promptOrPayload: string,
    providerOrEndpoint: string,
    options?: { preferLocalSlm?: boolean; env?: NodeJS.ProcessEnv },
  ): PrivacyLaneDecision {
    return evaluatePrivacyLane({
      promptOrPayload,
      providerOrEndpoint,
      preferLocalSlm: options?.preferLocalSlm,
      env: options?.env,
    });
  }
}
