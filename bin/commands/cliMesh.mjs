// cliMesh.mjs - Unified dispatcher for all mesh commands
// Consolidates 23 individual mesh handler imports into a single lazy dispatcher.
// This file replaces the 23 static imports in cliPlatform.mjs.

const meshHandlers = [
  // Handlers with (commandContext) signature
  { file: "./cliFrontierMesh.mjs", handler: "handleFrontierMeshCommands", sig: "ctx" },
  { file: "./cliZkR1csMesh.mjs", handler: "handleZkR1csCommands", sig: "ctx" },
  { file: "./cliCrdtMesh.mjs", handler: "handleCrdtCommands", sig: "ctx" },
  { file: "./cliMmrMesh.mjs", handler: "handleMmrCommands", sig: "ctx" },
  { file: "./cliVrfMesh.mjs", handler: "handleVrfCommands", sig: "ctx" },
  { file: "./cliSmtMesh.mjs", handler: "handleSmtCommands", sig: "ctx" },
  { file: "./cliFrostMesh.mjs", handler: "handleFrostCommands", sig: "ctx" },
  { file: "./cliKzgMesh.mjs", handler: "handleKzgCommands", sig: "ctx" },
  { file: "./cliMlKemMesh.mjs", handler: "handleMlKemCommands", sig: "ctx" },
  { file: "./cliBulletproofsMesh.mjs", handler: "handleBulletproofsCommands", sig: "ctx" },
  { file: "./cliHotStuffMesh.mjs", handler: "handleHotStuffCommands", sig: "ctx" },
  { file: "./cliTensorMesh.mjs", handler: "handleTensorCommands", sig: "ctx" },
  { file: "./cliFleetMesh.mjs", handler: "handleFleetMeshCommands", sig: "ctx" },
  { file: "./cliOtlpMesh.mjs", handler: "handleOtlpCommands", sig: "ctx" },
  // Handlers with (command, commandContext) signature
  { file: "./cliMlDsaMesh.mjs", handler: "handleMlDsaCommands", sig: "cmd_ctx" },
  { file: "./cliCongestionMesh.mjs", handler: "handleCongestionCommands", sig: "cmd_ctx" },
  { file: "./cliTrieMesh.mjs", handler: "handleTrieCommands", sig: "cmd_ctx" },
  { file: "./cliTimeLockMesh.mjs", handler: "handleTimeLockCommands", sig: "cmd_ctx" },
  { file: "./cliCuckooMesh.mjs", handler: "handleCuckooCommands", sig: "cmd_ctx" },
  { file: "./cliHllMesh.mjs", handler: "handleHllCommands", sig: "cmd_ctx" },
  { file: "./cliVssMesh.mjs", handler: "handleVssCommands", sig: "cmd_ctx" },
  { file: "./cliJarvisSdlcMesh.mjs", handler: "handleJarvisSdlcCommands", sig: "cmd_ctx" },
  { file: "./cliJarvisPolyglotFrontierMesh.mjs", handler: "handleJarvisPolyglotFrontierCommands", sig: "cmd_ctx" },
];

export async function handleMeshCommands(commandContext) {
  for (const entry of meshHandlers) {
    const mod = await import(entry.file);
    const fn = mod[entry.handler];
    if (!fn) continue;
    if (entry.sig === "cmd_ctx") {
      if (await fn(commandContext.command, commandContext)) return true;
    } else {
      if (await fn(commandContext)) return true;
    }
  }
  return false;
}
