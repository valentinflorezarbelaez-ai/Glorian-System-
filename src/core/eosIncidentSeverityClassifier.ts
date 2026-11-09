/**
 * EOS SYSTEM — INCIDENT SEVERITY CLASSIFIER (Layer 0)
 * Governed by SPEC-150 (Google SRE / PagerDuty incident taxonomy)
 *
 * Auto-detects P0–P4 severity from:
 * - Error budget burn rate (from SLO governor)
 * - Blast radius (% of users/services affected)
 * - Duration since detection
 * - Data loss indicator
 *
 * Outputs escalation actions: page, ticket, log, or ignore.
 *
 * Zero external dependencies.
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Severity = "P0" | "P1" | "P2" | "P3" | "P4";

export type EscalationAction = "PAGE_ONCALL" | "ESCALATE_LEAD" | "TICKET" | "LOG_ONLY" | "NOISE";

export interface IncidentSignal {
  readonly burnRateMultiplier: number; // e.g., 14.4x, 6x, 1x
  readonly blastRadiusPercent: number; // 0-100 (% of entities affected)
  readonly durationMinutes: number; // Minutes since detection
  readonly dataLoss: boolean; // Irreversible data loss detected
  readonly customerFacing: boolean; // Impacts external users
  readonly errorBudgetRemaining: number; // 0-100 (% budget remaining)
}

export interface SeverityClassification {
  readonly severity: Severity;
  readonly actions: readonly EscalationAction[];
  readonly autoRevert: boolean;
  readonly warRoomRequired: boolean;
  readonly postMortemRequired: boolean;
  readonly rationale: string;
  readonly sha256Receipt: string;
}

// ---------------------------------------------------------------------------
// Severity Rules (Google SRE Workbook Ch. 6 + PagerDuty best practices)
// ---------------------------------------------------------------------------

interface SeverityRule {
  readonly severity: Severity;
  readonly match: (sig: IncidentSignal) => boolean;
  readonly actions: readonly EscalationAction[];
  readonly autoRevert: boolean;
  readonly warRoom: boolean;
  readonly postMortem: boolean;
  readonly rationale: string;
}

const RULES: readonly SeverityRule[] = [
  {
    severity: "P0",
    match: (s) => s.dataLoss || (s.customerFacing && s.blastRadiusPercent >= 50 && s.burnRateMultiplier >= 14.4),
    actions: ["PAGE_ONCALL", "ESCALATE_LEAD", "TICKET"],
    autoRevert: true,
    warRoom: true,
    postMortem: true,
    rationale: "Critical: data loss or >50% customer-facing outage at fast-burn threshold",
  },
  {
    severity: "P1",
    match: (s) => s.customerFacing && (s.blastRadiusPercent >= 20 || s.burnRateMultiplier >= 6),
    actions: ["PAGE_ONCALL", "TICKET"],
    autoRevert: true,
    warRoom: true,
    postMortem: true,
    rationale: "Major: customer-facing degradation >20% or 6x burn",
  },
  {
    severity: "P2",
    match: (s) => s.blastRadiusPercent >= 5 || s.burnRateMultiplier >= 1 || s.errorBudgetRemaining < 25,
    actions: ["ESCALATE_LEAD", "TICKET"],
    autoRevert: false,
    warRoom: false,
    postMortem: true,
    rationale: "Moderate: >5% blast radius, 1x burn, or <25% budget remaining",
  },
  {
    severity: "P3",
    match: (s) => s.blastRadiusPercent >= 1 || s.errorBudgetRemaining < 50,
    actions: ["TICKET", "LOG_ONLY"],
    autoRevert: false,
    warRoom: false,
    postMortem: false,
    rationale: "Minor: >1% affected or <50% budget remaining",
  },
  {
    severity: "P4",
    match: () => true, // Catch-all
    actions: ["LOG_ONLY"],
    autoRevert: false,
    warRoom: false,
    postMortem: false,
    rationale: "Noise: below all thresholds",
  },
];

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

export class EosIncidentSeverityClassifier {
  /**
   * Classifies an incident signal into P0-P4 with escalation actions.
   */
  classify(signal: IncidentSignal): SeverityClassification {
    deepFreeze(signal); // Immutable input

    const matched = RULES.find((r) => r.match(signal))!;
    const canonical = JSON.stringify({
      severity: matched.severity,
      burnRate: signal.burnRateMultiplier,
      blast: signal.blastRadiusPercent,
    });

    return deepFreeze({
      severity: matched.severity,
      actions: matched.actions,
      autoRevert: matched.autoRevert,
      warRoomRequired: matched.warRoom,
      postMortemRequired: matched.postMortem,
      rationale: matched.rationale,
      sha256Receipt: pureSha256(canonical),
    });
  }

  /**
   * Returns all classification rules for documentation.
   */
  getRules(): readonly { severity: Severity; rationale: string }[] {
    return RULES.map((r) => ({ severity: r.severity, rationale: r.rationale }));
  }
}
