/**
 * Phase-5 migrated tool name catalog (no core imports — breaks Layer-0 cycles).
 * Residual Spotify domain bundle + dead glorian_* purge targets.
 */

/** Spotify domain tools newly registered by Phase-5 handlers. */
export const PHASE5_MIGRATED_TOOL_NAMES: readonly string[] = Object.freeze([
  "eos_spotify_audit",
  "eos_spotify_canary_manifest",
  "eos_spotify_experiment",
  "eos_spotify_fleetshift_batch",
  "eos_spotify_honk_dispatch",
  "eos_spotify_mix_plan",
  "eos_spotify_postmortem",
  "eos_spotify_scaffold",
  "eos_spotify_shuffle",
  "eos_spotify_standup",
  "eos_spotify_taste_profile",
  "eos_spotify_xirp_context",
]);

/** Dead god-file arms purged in Phase-5 (already registry-routed by Phase-3). */
export const PHASE5_PURGED_DEAD_SWITCH_ARMS: readonly string[] = Object.freeze([
  "glorian_constitutional_tribunal",
  "glorian_fleet_health_watchdog",
]);
