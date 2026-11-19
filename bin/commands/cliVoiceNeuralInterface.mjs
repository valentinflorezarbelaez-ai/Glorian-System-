/**
 * @file cliVoiceNeuralInterface.mjs
 * @description CLI handler for SPEC-363 / CHANGE-225: Voice Neural Interface with Gemini Live API.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosVoiceNeuralInterface } from "../../src/core/eosVoiceNeuralInterface.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("VOICE_NEURAL_INTERFACE_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_voice_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const engine = new EosVoiceNeuralInterface({ sampleRate: 16000, maxBufferFrames: 20 });
  const receipt = await engine.audit();
  const receiptPath = getReceiptPath(ROOT);

  try {
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
  } catch (err) {
    console.error(`Warning: Could not persist evidence receipt: ${err.message}`);
  }

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Voice Neural Interface with Gemini Live API (SPEC-363) ===");
    console.log(`Spec ID                 : ${receipt.specId}`);
    console.log(`Change ID               : ${receipt.changeId}`);
    console.log(`Sampling Rate           : ${receipt.sampleRate} Hz`);
    console.log(`Active VAD State        : ${receipt.activeVadState}`);
    console.log(`Frames Processed        : ${receipt.framesProcessedCount}`);
    console.log(`Speech Frames Count     : ${receipt.speechFramesCount}`);
    console.log(`Checks Summary          :`);
    console.log(`  - PCM Normalization   : ${receipt.checks.pcmFramingNormalization}`);
    console.log(`  - VAD Hysteresis      : ${receipt.checks.vadMathematicalHysteresis}`);
    console.log(`  - Gemini Message Ser  : ${receipt.checks.geminiLiveMessageSerialization}`);
    console.log(`  - Buffer Backpressure : ${receipt.checks.circularBufferBackpressure}`);
    console.log(`  - Session Isolation   : ${receipt.checks.ephemeralSessionIsolation}`);
    console.log(`  - Zero Dependency     : ${receipt.checks.zeroDependencyPurity}`);
    console.log(`Integrity Hash          : ${receipt.integrityHash}`);
    console.log(`Evidence Receipt        : ${receiptPath}`);
  }
}

async function cmd_voice_vad(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const engine = new EosVoiceNeuralInterface({ sampleRate: 16000 });

  // Generate synthetic test frame
  const samples = new Int16Array(320);
  for (let i = 0; i < samples.length; i++) {
    const t = i / 16000;
    samples[i] = Math.floor(Math.sin(2 * Math.PI * 440 * t) * 16000);
  }
  const rms = engine.computeRmsEnergy(samples);
  const zcr = engine.computeZeroCrossingRate(samples);
  const state = engine.updateVadState(rms, zcr);

  const result = {
    sampleRate: 16000,
    samplesCount: 320,
    rmsEnergy: parseFloat(rms.toFixed(4)),
    zeroCrossingRate: parseFloat(zcr.toFixed(4)),
    vadState: state,
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Voice Activity Detection (VAD) Evaluation ===");
    console.log(`RMS Signal Energy   : ${result.rmsEnergy}`);
    console.log(`Zero-Crossing Rate  : ${result.zeroCrossingRate}`);
    console.log(`VAD Classification  : ${result.vadState}`);
  }
}

async function cmd_voice_stream(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json") || true;
  const engine = new EosVoiceNeuralInterface({ sampleRate: 16000 });
  const session = engine.createEphemeralSession();

  if (isJson) {
    console.log(JSON.stringify(session, null, 2));
  } else {
    console.log("=== Voice Streaming Session ===");
    console.log(`Session ID : ${session.sessionId}`);
    console.log(`Token      : ${session.token.slice(0, 16)}...`);
    console.log(`Expires At : ${new Date(session.expiresAt).toISOString()}`);
  }
}

async function cmd_voice_start(commandContext) {
  const args = commandContext.args || [];
  const rateArg = args.find((a) => a.startsWith("--rate="));
  const rate = rateArg ? parseInt(rateArg.split("=")[1], 10) : 16000;

  const engine = new EosVoiceNeuralInterface({ sampleRate: rate });
  const session = engine.createEphemeralSession();

  console.log("=== Glorian Voice Neural Interface (Gemini Live API) ===");
  console.log(`Status       : ACTIVE (READY)`);
  console.log(`Sample Rate  : ${rate} Hz Mono (16-bit PCM)`);
  console.log(`Session ID   : ${session.sessionId}`);
  console.log(`VAD Engine   : RMS + ZCR Mathematical Hysteresis`);
  console.log(`HUD Bridge   : Integrated into EosGlorianLiveStudio`);
}

HANDLERS["toolchain:voice:audit"] = cmd_voice_audit;
HANDLERS["toolchain:voice:vad"] = cmd_voice_vad;
HANDLERS["toolchain:voice:stream"] = cmd_voice_stream;
HANDLERS["toolchain:voice:start"] = cmd_voice_start;

export async function handleVoiceNeuralInterfaceCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:voice command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
