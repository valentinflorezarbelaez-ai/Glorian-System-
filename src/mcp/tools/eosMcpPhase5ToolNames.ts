/**
 * Phase-5 migrated tool name catalog (no core imports — breaks Layer-0 cycles).
 * Residual Spotify domain bundle + dead glorian_* purge targets.
 */

/** Spotify domain tools newly registered by Phase-5 handlers. */
export { PHASE5_MIGRATED_TOOL_NAMES } from "../../core/eosMcpToolTaxonomy.ts";

/** Dead god-file arms purged in Phase-5 (already registry-routed by Phase-3). */
export const PHASE5_PURGED_DEAD_SWITCH_ARMS: readonly string[] = Object.freeze([
  "glorian_constitutional_tribunal",
  "glorian_fleet_health_watchdog"
]);
