/**
 * @file eosVoiceNeuralInterface.test.mjs
 * @description Automated test suite for SPEC-363 / CHANGE-225: Voice Neural Interface with Gemini Live API.
 *
 * Verifies BDD-1957 through BDD-1962:
 * - BDD-1957: Linear PCM Audio Framing & Normalization
 * - BDD-1958: Mathematical Voice Activity Detection (VAD) Hysteresis
 * - BDD-1959: Gemini Live API Binary Message Serialization
 * - BDD-1960: Circular Audio Buffer Bounded Backpressure
 * - BDD-1961: Live HUD Audio Gateway & Webhook Bridge
 * - BDD-1962: Full Diagnostic Audit & Receipt Generation
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { EosVoiceNeuralInterface } from "../src/core/eosVoiceNeuralInterface.ts";

test("BDD-1957: Linear PCM Audio Framing & Normalization", () => {
  const engine = new EosVoiceNeuralInterface({ sampleRate: 16000, frameSizeMs: 20 });
  assert.equal(engine.getSampleRate(), 16000);
  assert.equal(engine.getVadState(), "SILENCE");

  // Ingest 640 bytes (320 samples @ 16-bit mono = 20ms @ 16kHz)
  const samples = new Int16Array(320);
  for (let i = 0; i < 320; i++) {
    samples[i] = 16384; // Half full-scale
  }
  const bytes = new Uint8Array(samples.buffer);

  const frames = engine.ingestPcmChunk(bytes);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].samplesCount, 320);
  assert.ok(Math.abs(frames[0].rmsEnergy - 0.5) < 0.01);
});

test("BDD-1958: Mathematical Voice Activity Detection (VAD) Hysteresis", () => {
  const engine = new EosVoiceNeuralInterface({ sampleRate: 16000 });

  // 1. Ingest silence frame -> SILENCE
  const silence = new Uint8Array(640);
  engine.ingestPcmChunk(silence);
  assert.equal(engine.getVadState(), "SILENCE");

  // 2. Ingest 440Hz sine wave speech frame -> SPEECH_START
  const speechSamples = new Int16Array(320);
  for (let i = 0; i < 320; i++) {
    speechSamples[i] = Math.floor(Math.sin((2 * Math.PI * 440 * i) / 16000) * 16000);
  }
  const speechBytes = new Uint8Array(speechSamples.buffer);

  engine.ingestPcmChunk(speechBytes);
  assert.equal(engine.getVadState(), "SPEECH_START");

  // 3. Second speech frame -> SPEECH_CONTINUOUS
  engine.ingestPcmChunk(speechBytes);
  assert.equal(engine.getVadState(), "SPEECH_CONTINUOUS");

  // 4. Ingest silence frames until hangover exhausts -> SPEECH_END then SILENCE
  engine.ingestPcmChunk(silence);
  engine.ingestPcmChunk(silence);
  engine.ingestPcmChunk(silence);
  engine.ingestPcmChunk(silence);
  assert.equal(engine.getVadState(), "SILENCE");
});

test("BDD-1959: Gemini Live API Binary Message Serialization", () => {
  const engine = new EosVoiceNeuralInterface({ sampleRate: 16000 });

  const speechSamples = new Int16Array(320);
  for (let i = 0; i < 320; i++) {
    speechSamples[i] = Math.floor(Math.sin((2 * Math.PI * 440 * i) / 16000) * 16000);
  }
  const speechBytes = new Uint8Array(speechSamples.buffer);

  engine.ingestPcmChunk(speechBytes);
  const binaryFrames = engine.drainSpeechFrames();

  assert.equal(binaryFrames.length, 1);
  assert.equal(binaryFrames[0].mimeType, "audio/pcm;rate=16000");
  assert.equal(binaryFrames[0].isSpeech, true);
  assert.equal(binaryFrames[0].sequenceNumber, 1);
  assert.ok(binaryFrames[0].frameDigest.length === 64);
  assert.equal(binaryFrames[0].payload.length, 640);
});

test("BDD-1960: Circular Audio Buffer Bounded Backpressure", () => {
  const engine = new EosVoiceNeuralInterface({ maxBufferFrames: 5 });
  const silence = new Uint8Array(640);

  // Ingest 15 frames into 5-frame buffer
  for (let i = 0; i < 15; i++) {
    engine.ingestPcmChunk(silence);
  }

  assert.equal(engine.getBufferedFramesCount(), 5);
});

test("BDD-1961: Live HUD Audio Gateway & Session Isolation", () => {
  const engine = new EosVoiceNeuralInterface();
  const session = engine.createEphemeralSession();

  assert.ok(session.sessionId.startsWith("VOX-"));
  assert.ok(session.token.length === 64);
  assert.ok(session.expiresAt > session.issuedAt);

  assert.equal(engine.validateSessionToken(session.token), true);
  assert.equal(engine.validateSessionToken("invalid-tampered-token"), false);
});

test("BDD-1962: Full Diagnostic Audit & Receipt Generation", async () => {
  const engine = new EosVoiceNeuralInterface();
  const receipt = await engine.audit();

  assert.equal(receipt.specId, "SPEC-363");
  assert.equal(receipt.changeId, "CHANGE-225");
  assert.equal(receipt.checks.pcmFramingNormalization, "PASS");
  assert.equal(receipt.checks.vadMathematicalHysteresis, "PASS");
  assert.equal(receipt.checks.geminiLiveMessageSerialization, "PASS");
  assert.equal(receipt.checks.circularBufferBackpressure, "PASS");
  assert.equal(receipt.checks.ephemeralSessionIsolation, "PASS");
  assert.equal(receipt.checks.zeroDependencyPurity, "PASS");
  assert.ok(receipt.integrityHash.length === 64);
  assert.ok(receipt.receiptId.startsWith("REC-VOICE-"));
});
