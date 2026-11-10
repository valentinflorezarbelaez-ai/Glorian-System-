/**
 * TYPE DEFINITIONS — eosSpotifyCodex (extracted for module-size governance)
 */

export interface AcousticVector {
  readonly tempo: number; // BPM normalized or raw (e.g. 120)
  readonly energy: number; // 0.0 - 1.0
  readonly danceability: number; // 0.0 - 1.0
  readonly valence: number; // 0.0 - 1.0 (musical happiness)
  readonly acousticness: number; // 0.0 - 1.0
  readonly instrumentalness: number; // 0.0 - 1.0
  readonly liveness: number; // 0.0 - 1.0
  readonly speechiness: number; // 0.0 - 1.0
}

export interface TrackCandidate {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly key: number; // 0 = C, 1 = C#, 2 = D ... 11 = B
  readonly mode: number; // 0 = minor, 1 = major
  readonly features: AcousticVector;
}

export interface LoudnessProfile {
  readonly targetLufs: number; // -14.0 LUFS standard
  readonly truePeakCeilingDb: number; // -1.0 dBTP standard
  readonly measuredLufs: number;
  readonly measuredTruePeakDb: number;
  readonly gainAdjustmentDb: number;
  readonly limiterRequired: boolean;
  readonly recommendedCodec: "OGG_VORBIS_320" | "AAC_256" | "FLAC_LOSSLESS";
}

export interface EqualPowerCrossfadeStep {
  readonly t: number;
  readonly gainA: number;
  readonly gainB: number;
  readonly totalPower: number;
}

export interface AudioStreamingReport {
  readonly chunkSizeKb: number;
  readonly totalChunksProcessed: number;
  readonly totalBytesStreamed: number;
  readonly throughputMbSec: number;
  readonly bufferUnderrunRiskPercent: null;
  readonly ringBufferCapacityChunks: number;
  readonly locklessConcurrencyTested: false;
  readonly simulationOnly: true;
  readonly durationUs: number;
}

export interface ScaffoldResult {
  readonly templateOnly: true;
  readonly created: boolean;
  readonly writeApplied: boolean;
  readonly filePath: string;
  readonly catalogYaml: string;
  readonly message: string;
}

export interface CamelotTransition {
  readonly compatible: boolean;
  readonly camelotA: string;
  readonly camelotB: string;
  readonly harmonicRelationship: "PERFECT_MATCH" | "ENERGY_BOOST" | "ENERGY_DROP" | "MODE_SHIFT" | "DISSONANT";
}

export interface SpotifyProjectAuditReport {
  readonly projectPath: string;
  readonly catalogInfoMarkersPresent: boolean;
  readonly localInventoryScore: number;
  readonly catalogInfoExists: boolean;
  readonly catalogInfoDetails?: {
    readonly apiVersion: string;
    readonly kind: string;
    readonly name: string;
    readonly owner: string;
    readonly lifecycle: string;
  };
  readonly audioInventory: {
    readonly audioAssetsDetected: number;
    readonly standardsChecked: false;
  };
  readonly recommendations: readonly string[];
  readonly resultFingerprintSha256: string;
  readonly timestamp: string;
}

export interface SquadManifest {
  readonly scope: "TEMPLATE_ONLY";
  readonly squadName: string;
  readonly tribe: string;
  readonly chapter:
    "Backend (Java/Python/Go)" | "Web (TypeScript/React)" | "Mobile (Kotlin/Swift)" | "Data & Machine Learning";
  readonly mission: string;
  readonly productManager: string;
  readonly techLead: string;
  readonly guilds: readonly string[];
  readonly kpis: readonly string[];
  readonly timezoneOverlap: {
    readonly localTimezone: string;
    readonly targetHubs: readonly string[];
    readonly synchronousWindow: string;
  };
}

export interface AsyncStandupOptions {
  readonly author?: string;
  readonly squadName?: string;
  readonly yesterdayTasks?: readonly string[];
  readonly todayTasks?: readonly string[];
  readonly blockers?: readonly string[];
  readonly prLinks?: readonly string[];
  readonly handoffNotes?: string;
}

export interface AsyncStandupReport {
  readonly scope: "DRAFT_ONLY";
  readonly timestamp: string;
  readonly author: string;
  readonly squad: string;
  readonly timezone: string;
  readonly yesterday: readonly string[];
  readonly today: readonly string[];
  readonly blockers: readonly string[];
  readonly prLinks: readonly string[];
  readonly handoffToEurope: string;
  readonly markdown: string;
}

export interface BlamelessPostMortemOptions {
  readonly incidentId?: string;
  readonly title?: string;
  readonly severity?: string;
  readonly durationMinutes?: number;
  readonly userImpactSummary?: string;
  readonly trigger?: string;
  readonly rootCause?: string;
  readonly fiveWhys?: readonly string[];
  readonly whatWentWell?: readonly string[];
  readonly whereWeGotLucky?: readonly string[];
  readonly actionItems?: ReadonlyArray<{
    readonly action: string;
    readonly owner: string;
    readonly priority: "P0" | "P1" | "P2";
    readonly jiraTicket: string;
  }>;
  readonly timeline?: ReadonlyArray<{ readonly time: string; readonly event: string }>;
}

export interface BlamelessPostMortem {
  readonly templateOnly: true;
  readonly incidentId: string;
  readonly title: string;
  readonly severity: string;
  readonly durationMinutes: number | null;
  readonly userImpact: string;
  readonly trigger: string;
  readonly timeline: ReadonlyArray<{ time: string; event: string }>;
  readonly fiveWhys: readonly string[];
  readonly rootCauseSummary: string;
  readonly systemicWeakness: string;
  readonly whatWentWell: readonly string[];
  readonly whereWeGotLucky: readonly string[];
  readonly actionItems: ReadonlyArray<{
    readonly action: string;
    readonly owner: string;
    readonly priority: "P0" | "P1" | "P2";
    readonly jiraTicket: string;
  }>;
  readonly markdown: string;
  readonly resultFingerprintSha256: string;
}

export interface CanaryExperimentOptions {
  readonly experimentKey?: string;
  readonly featureName?: string;
  readonly hypothesis?: string;
  readonly squad?: string;
  readonly primaryMetric?: string;
  readonly guardrails?: ReadonlyArray<{
    readonly metric: string;
    readonly maxThreshold: string;
    readonly autoRevert: boolean;
  }>;
}

export interface CanaryExperimentSpec {
  readonly scope: "TEMPLATE_ONLY";
  readonly experimentKey: string;
  readonly featureName: string;
  readonly hypothesis: string;
  readonly ownerSquad: string;
  readonly rolloutStages: ReadonlyArray<{
    readonly stage: string;
    readonly trafficPercentage: number;
    readonly minimumObservationHours: number;
    readonly passCriteria: string;
  }>;
  readonly primaryMetric: string;
  readonly guardrails: ReadonlyArray<{
    readonly metric: string;
    readonly maxThreshold: string;
    readonly autoRevert: boolean;
  }>;
  readonly killSwitchFlag: string;
  readonly featureFlagConfigJson: string;
  readonly markdown: string;
}

export interface GoldenPathScaffoldOptions {
  readonly serviceName?: string;
  readonly description?: string;
  readonly serviceType?: "backend-microservice" | "frontend-web" | "mobile-sdk" | "data-pipeline";
  readonly ownerSquad?: string;
  readonly systemName?: string;
}

export interface GoldenPathPackage {
  readonly templateOnly: true;
  readonly serviceName: string;
  readonly serviceType: string;
  readonly files: Record<string, string>;
}
