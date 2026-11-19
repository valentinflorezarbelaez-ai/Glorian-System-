/**
 * @fileoverview Type definitions for EosVoiceNeuralInterface.
 *
 * Implements SPEC-363 / CHANGE-225: Voice Neural Interface with Gemini Live API.
 * Pure Layer-0 types with zero external dependencies.
 */

export type VoiceVadState = "SILENCE" | "SPEECH_START" | "SPEECH_CONTINUOUS" | "SPEECH_END";

export type VoiceSampleRate = 16000 | 24000;

export interface VoiceInterfaceConfig {
  /** Target sampling rate in Hz (16000 or 24000) */
  readonly sampleRate?: VoiceSampleRate;
  /** Duration of single audio frame in milliseconds (default: 20ms) */
  readonly frameSizeMs?: number;
  /** RMS signal energy threshold to trigger speech */
  readonly rmsEnergyThreshold?: number;
  /** Zero-crossing rate threshold to distinguish speech from DC offset */
  readonly zeroCrossingThreshold?: number;
  /** Maximum number of frames held in circular buffer */
  readonly maxBufferFrames?: number;
  /** Time to live for ephemeral voice session tokens in seconds */
  readonly ephemeralTokenTtlSec?: number;
}

export interface PcmAudioFrame {
  readonly frameId: number;
  readonly timestamp: number;
  readonly sampleRate: number;
  readonly samplesCount: number;
  readonly rmsEnergy: number;
  readonly zeroCrossingRate: number;
  readonly vadState: VoiceVadState;
  readonly rawBytes: Uint8Array;
}

export interface GeminiLiveBinaryFrame {
  readonly sequenceNumber: number;
  readonly mimeType: "audio/pcm;rate=16000" | "audio/pcm;rate=24000";
  readonly payload: Uint8Array;
  readonly isSpeech: boolean;
  readonly frameDigest: string;
}

export interface VoiceSession {
  readonly sessionId: string;
  readonly token: string;
  readonly sampleRate: VoiceSampleRate;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly activeVadState: VoiceVadState;
  readonly bufferedFramesCount: number;
  readonly totalFramesIngested: number;
  readonly speechFramesTransmitted: number;
}

export interface EosVoiceNeuralInterfaceReceipt {
  readonly receiptId: string;
  readonly specId: "SPEC-363";
  readonly changeId: "CHANGE-225";
  readonly timestamp: number;
  readonly sampleRate: VoiceSampleRate;
  readonly activeVadState: VoiceVadState;
  readonly framesProcessedCount: number;
  readonly speechFramesCount: number;
  readonly checks: {
    readonly pcmFramingNormalization: "PASS" | "FAIL";
    readonly vadMathematicalHysteresis: "PASS" | "FAIL";
    readonly geminiLiveMessageSerialization: "PASS" | "FAIL";
    readonly circularBufferBackpressure: "PASS" | "FAIL";
    readonly ephemeralSessionIsolation: "PASS" | "FAIL";
    readonly zeroDependencyPurity: "PASS" | "FAIL";
  };
  readonly integrityHash: string;
}
