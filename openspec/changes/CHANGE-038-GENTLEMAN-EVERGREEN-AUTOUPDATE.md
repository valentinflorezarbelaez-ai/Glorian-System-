# CHANGE-038: DELTA SPECIFICATION — GENTLEMAN AI STACK EVERGREEN AUTO-UPDATER (v51.0.0)

## Added Capabilities
1. `src/core/eosGentlemanAutoUpdater.ts`: Layer-0 zero-dependency Evergreen Auto-Updater engine (`parseSemVer`, `compareSemVer`, `selectLatestStableTag`, `verifyChecksumManifest`, `hotSwapExecutableWithRollback`, `syncSkillsTreeSafely`, `checkUpdates`, `applyUpdates`, `isCheckStale`).
2. `scripts/install-gentleman-autoupdate.mjs`: Cross-platform OS scheduler installer creating silent hidden VBScript runner + per-user Windows Scheduled Task `EOS-Gentleman-Stack-AutoUpdate` (every 6 hours) and POSIX cron helper support.
3. Opportunistic stale-TTL (`> 6h`) detached background auto-update trigger in `integrations/antigravity/eos-governance/scripts/eos-hook.mjs` (`SessionStart`).
4. MCP tool `eos_gentleman_update` (`action: "check" | "apply" | "status"`) in `src/mcp/eosMcpServer.ts` + `src/mcp/eosMcpToolCatalog.ts` and CLI subcommands `eos gentleman update [--check|--apply|--force|--quiet]` + `eos gentleman autoupdate:[install|status|uninstall]` in `bin/eos.mjs`.
5. Formal TLA+ specification `docs/formal/GentlemanAutoUpdateEngine.tla` (11th bounded JS simulation in `scripts/verify-formal-tla.mjs`).
6. Dedicated BDD verification suite `test/eosGentlemanAutoUpdater.test.mjs` (`BDD-133`..`BDD-137`).
