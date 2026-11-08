/**
 * EOS SYSTEM — PHASE-5 DOMAIN MCP HANDLERS (SPEC-155 / T7c Big Tech Max-1)
 * Extracts residual Spotify full-profile tools from the god-file switch.
 * glorian_* tools already live in Phase-3; Phase-5 only purges their dead switch arms.
 * Explicitly NOT Spotify vendor control or Level 5.
 */

import { EosSpotifyCodex } from "../../core/eosSpotifyCodex.ts";
import { EosSpotifyAgenticFactory } from "../../core/eosSpotifyAgenticFactory.ts";
import { EosGaplessMixEngine } from "../../core/eosGaplessMixEngine.ts";
import { EosAcousticFeatureStore } from "../../core/eosAcousticFeatureStore.ts";
import { executeSpotifySmartShuffle, type TrackNode } from "../../core/eosSpotifyNubankEngine.ts";
import type { McpToolHandler } from "../eosMcpDispatchRegistry.ts";
import { PHASE5_MIGRATED_TOOL_NAMES } from "./eosMcpPhase5ToolNames.ts";

export { PHASE5_MIGRATED_TOOL_NAMES };

export interface Phase5DomainHandlerDeps {
  readonly projectRoot: string;
  readonly resolveProjectPath: (value: unknown, kind: "file" | "directory", fallback?: string) => string;
}

export function createPhase5DomainHandlers(deps: Phase5DomainHandlerDeps): Readonly<Record<string, McpToolHandler>> {
  const { projectRoot, resolveProjectPath } = deps;

  return {
    eos_spotify_audit: (args) => {
      const codex = new EosSpotifyCodex(projectRoot);
      const targetPath = resolveProjectPath(args.targetPath, "directory", ".");
      return codex.auditUniversalProject(targetPath);
    },

    eos_spotify_scaffold: (args) => {
      const codex = new EosSpotifyCodex(projectRoot);
      const targetPath = resolveProjectPath(args.targetPath, "directory", ".");
      return codex.scaffoldBackstageCatalog(targetPath, {
        name: args.name ? String(args.name) : undefined,
        owner: args.owner ? String(args.owner) : undefined,
        write: args.apply === true,
      });
    },

    eos_spotify_standup: (args) => {
      const codex = new EosSpotifyCodex(projectRoot);
      return codex.generateAsyncStandup(args);
    },

    eos_spotify_postmortem: (args) => {
      const codex = new EosSpotifyCodex(projectRoot);
      return codex.synthesizeBlamelessPostMortem(args);
    },

    eos_spotify_experiment: (args) => {
      const codex = new EosSpotifyCodex(projectRoot);
      return codex.designCanaryExperiment(args);
    },

    eos_spotify_honk_dispatch: (args) => {
      const factory = new EosSpotifyAgenticFactory(projectRoot);
      return factory.dispatchHonk({
        taskName: String(args.taskName || "Autonomous task"),
        stack: args.stack,
        specDescription: String(args.specDescription || ""),
        dryRun: true,
      });
    },

    eos_spotify_xirp_context: (args) => {
      const factory = new EosSpotifyAgenticFactory(projectRoot);
      if (args.syncFiles === true) {
        return factory.syncXirpContextFiles();
      }
      return factory.compileXirpContext();
    },

    eos_spotify_fleetshift_batch: (args) => {
      const factory = new EosSpotifyAgenticFactory(projectRoot);
      return factory.executeFleetshift({
        migrationId: String(args.migrationId || `FS-${Date.now()}`),
        description: `Fleetshift migration batch`,
        action: args.action || "apply_backstage_rfc42",
        targetFleet: Array.isArray(args.targetFleet) ? args.targetFleet : undefined,
        dryRun: args.apply !== true,
      });
    },

    eos_spotify_canary_manifest: (args) => {
      const factory = new EosSpotifyAgenticFactory(projectRoot);
      return factory.generateProgressiveCanary(
        String(args.serviceName || "spotify-service"),
        String(args.squad || "Audio-Platform"),
        Number(args.p99LatencyMs) || 100,
        Number(args.maxErrorRatePercent) || 0.1,
      );
    },

    eos_spotify_mix_plan: (args) => {
      const engine = new EosGaplessMixEngine();
      const keyA = String(args.keyA || "8A");
      const keyB = String(args.keyB || "9A");
      return engine.planTransition(
        {
          trackId: "track-A",
          title: `Track A (${keyA})`,
          bpm: Number(args.bpmA) || 126,
          camelotKey: keyA,
          sampleRateHz: 44100,
        },
        {
          trackId: "track-B",
          title: `Track B (${keyB})`,
          bpm: Number(args.bpmB) || 128,
          camelotKey: keyB,
          sampleRateHz: 44100,
        },
        Number(args.duration) || 5.0,
      );
    },

    eos_spotify_taste_profile: (args) => {
      const store = new EosAcousticFeatureStore();
      const userId = String(args.userId || "user-listener");
      store.recordListen(
        userId,
        "track-sample",
        {
          tempo: 0.7,
          energy: 0.85,
          danceability: 0.8,
          valence: 0.7,
          acousticness: 0.1,
          instrumentalness: 0.2,
          liveness: 0.15,
          speechiness: 0.08,
        },
        200,
        200,
      );
      return store.computeTasteCentroid(userId);
    },

    eos_spotify_shuffle: (args) => {
      const tracks: TrackNode[] =
        Array.isArray(args.tracks) && args.tracks.length > 0
          ? (args.tracks as TrackNode[])
          : [
              { id: "spotify:track:001", artistId: "Armin van Buuren", bpm: 132, camelotKey: "8A" },
              { id: "spotify:track:002", artistId: "Armin van Buuren", bpm: 134, camelotKey: "8A" },
              { id: "spotify:track:003", artistId: "Paul Oakenfold", bpm: 130, camelotKey: "9A" },
              { id: "spotify:track:004", artistId: "Paul Oakenfold", bpm: 132, camelotKey: "9A" },
              { id: "spotify:track:005", artistId: "Ferry Corsten", bpm: 130, camelotKey: "8B" },
            ];
      const seed = Number(args.seed) || 42108;
      return executeSpotifySmartShuffle(tracks, seed);
    },
  };
}
