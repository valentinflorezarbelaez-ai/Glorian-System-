/**
 * Spotify Backstage Soundcheck Real-Time Fleet Scorecards Types
 *
 * SPEC-299 / CHANGE-161 (Phase 3.5)
 * Strict Zero Runtime Dependencies (Law V)
 */

export type SoundcheckPillarId =
  "LAW_V_CONFORMANCE" | "TEST_COVERAGE" | "SPECIFICATION_DRIFT" | "DORA_VELOCITY" | "SECURITY_POSTURE";

export type SoundcheckCertificationTier = "LEVEL_1_BRONZE" | "LEVEL_2_SILVER" | "LEVEL_3_GOLD" | "LEVEL_4_PLATINUM";

export type SoundcheckDoraVelocityTier = "ELITE" | "HIGH" | "MEDIUM" | "LOW";

export interface SoundcheckPillarEvaluation {
  pillarId: SoundcheckPillarId;
  name: string;
  score: number;
  weight: number;
  status: "CONFORMING" | "WARNING" | "BREACH";
  findings: string[];
}

export interface SoundcheckDoraMetrics {
  deploymentFrequency: string;
  leadTimeForChanges: string;
  changeFailureRatePercent: number;
  meanTimeToRestoreMinutes: number;
  tier: SoundcheckDoraVelocityTier;
}

export interface SoundcheckRepositoryScorecard {
  projectId: string;
  name: string;
  type: string;
  overallScore: number;
  certificationTier: SoundcheckCertificationTier;
  pillars: Record<SoundcheckPillarId, SoundcheckPillarEvaluation>;
  dora: SoundcheckDoraMetrics;
  driftDetected: boolean;
  remediationPlan: string[];
  evaluatedAt: string;
}

export interface FleetSoundcheckMatrix {
  timestampIso: string;
  totalRepositoriesScored: number;
  averageFleetScore: number;
  tierDistribution: Record<SoundcheckCertificationTier, number>;
  scorecards: SoundcheckRepositoryScorecard[];
}

export interface SoundcheckReceipt {
  timestampIso: string;
  specRef: string;
  totalRepositoriesScored: number;
  averageFleetScore: number;
  platinumTiersCount: number;
  goldTiersCount: number;
  silverTiersCount: number;
  bronzeTiersCount: number;
  sha256Signature: string;
}
