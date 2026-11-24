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

const MESH_ENTRY_BY_FILE = new Map(meshHandlers.map((entry) => [entry.file, entry]));

const EXACT_MESH_ROUTE = new Map([
  ["ship", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["fleet:ship", "./cliJarvisPolyglotFrontierMesh.mjs"],
]);

const PREFIX_MESH_ROUTE = new Map([
  ["mcts", "./cliFrontierMesh.mjs"],
  ["tla", "./cliFrontierMesh.mjs"],
  ["raft", "./cliFrontierMesh.mjs"],
  ["compress", "./cliFrontierMesh.mjs"],
  ["decompress", "./cliFrontierMesh.mjs"],
  ["ans", "./cliFrontierMesh.mjs"],
  ["autodiff", "./cliFrontierMesh.mjs"],
  ["anomaly", "./cliFrontierMesh.mjs"],
  ["r1cs", "./cliZkR1csMesh.mjs"],
  ["crdt", "./cliCrdtMesh.mjs"],
  ["mmr", "./cliMmrMesh.mjs"],
  ["vrf", "./cliVrfMesh.mjs"],
  ["smt", "./cliSmtMesh.mjs"],
  ["frost", "./cliFrostMesh.mjs"],
  ["kzg", "./cliKzgMesh.mjs"],
  ["ml-kem", "./cliMlKemMesh.mjs"],
  ["bp", "./cliBulletproofsMesh.mjs"],
  ["hotstuff", "./cliHotStuffMesh.mjs"],
  ["tensor", "./cliTensorMesh.mjs"],
  ["fleet", "./cliFleetMesh.mjs"],
  ["trace", "./cliOtlpMesh.mjs"],
  ["ml-dsa", "./cliMlDsaMesh.mjs"],
  ["congestion", "./cliCongestionMesh.mjs"],
  ["trie", "./cliTrieMesh.mjs"],
  ["timelock", "./cliTimeLockMesh.mjs"],
  ["cuckoo", "./cliCuckooMesh.mjs"],
  ["hll", "./cliHllMesh.mjs"],
  ["vss", "./cliVssMesh.mjs"],
  ["jarvis", "./cliJarvisSdlcMesh.mjs"],
  ["polyglot", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["bridge", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["staff", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["diff", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["repomap", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["pbt", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["contract", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["sarif", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["attest", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["bench", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["eda", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["apollo", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["aladdin", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["roofline", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["spc", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["kalman", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["qec", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["leo", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["grid", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["bio", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["fusion", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["litho", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["privacy", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["lob", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["dvfs", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["beam", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["nav", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["cryo", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["dwdm", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["aero", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["rtgs", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["clock", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["insar", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["mpd", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["qnet", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["evm", "./cliJarvisPolyglotFrontierMesh.mjs"],
  ["hygiene", "./cliJarvisPolyglotFrontierMesh.mjs"],
]);

async function invokeMeshEntry(entry, commandContext) {
  const mod = await import(entry.file);
  const fn = mod[entry.handler];
  if (!fn) return false;
  return entry.sig === "cmd_ctx"
    ? Boolean(await fn(commandContext.command, commandContext))
    : Boolean(await fn(commandContext));
}

export async function handleMeshCommands(commandContext) {
  const cmd = String(commandContext.command || "").toLowerCase();
  const colonIdx = cmd.indexOf(":");
  const ns = colonIdx > 0 ? cmd.slice(0, colonIdx) : "";
  const fastFile = EXACT_MESH_ROUTE.get(cmd) ?? (ns ? PREFIX_MESH_ROUTE.get(ns) : undefined);
  if (fastFile) {
    const fastEntry = MESH_ENTRY_BY_FILE.get(fastFile);
    if (fastEntry && (await invokeMeshEntry(fastEntry, commandContext))) return true;
  }
  for (const entry of meshHandlers) {
    if (fastFile && entry.file === fastFile) continue;
    if (await invokeMeshEntry(entry, commandContext)) return true;
  }
  return false;
}
