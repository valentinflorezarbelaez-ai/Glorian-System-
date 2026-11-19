----------------------- MODULE VoiceNeuralInterface -----------------------
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS MaxFrames, MaxBuffer

VARIABLES vadState, audioBufferCount, framesIngested, framesTransmitted, framesDropped

TypeOK ==
  /\ vadState \in {"SILENCE", "SPEECH_START", "SPEECH_CONTINUOUS", "SPEECH_END"}
  /\ audioBufferCount \in 0..MaxBuffer
  /\ framesIngested \in 0..MaxFrames
  /\ framesTransmitted \in 0..MaxFrames
  /\ framesDropped \in 0..MaxFrames

Init ==
  /\ vadState = "SILENCE"
  /\ audioBufferCount = 0
  /\ framesIngested = 0
  /\ framesTransmitted = 0
  /\ framesDropped = 0

IngestSilenceFrame ==
  /\ framesIngested < MaxFrames
  /\ framesIngested' = framesIngested + 1
  /\ IF audioBufferCount < MaxBuffer THEN
        /\ audioBufferCount' = audioBufferCount + 1
        /\ framesDropped' = framesDropped
     ELSE
        /\ audioBufferCount' = audioBufferCount
        /\ framesDropped' = framesDropped + 1
  /\ vadState' = IF vadState = "SPEECH_CONTINUOUS" THEN "SPEECH_END"
                 ELSE "SILENCE"
  /\ UNCHANGED <<framesTransmitted>>

IngestSpeechFrame ==
  /\ framesIngested < MaxFrames
  /\ framesIngested' = framesIngested + 1
  /\ IF audioBufferCount < MaxBuffer THEN
        /\ audioBufferCount' = audioBufferCount + 1
        /\ framesDropped' = framesDropped
     ELSE
        /\ audioBufferCount' = audioBufferCount
        /\ framesDropped' = framesDropped + 1
  /\ vadState' = IF vadState = "SILENCE" THEN "SPEECH_START"
                 ELSE "SPEECH_CONTINUOUS"
  /\ UNCHANGED <<framesTransmitted>>

TransmitSpeechFrame ==
  /\ audioBufferCount > 0
  /\ vadState \in {"SPEECH_START", "SPEECH_CONTINUOUS"}
  /\ framesTransmitted < MaxFrames
  /\ framesTransmitted' = framesTransmitted + 1
  /\ audioBufferCount' = audioBufferCount - 1
  /\ UNCHANGED <<vadState, framesIngested, framesDropped>>

DrainSilenceFrame ==
  /\ audioBufferCount > 0
  /\ vadState \in {"SILENCE", "SPEECH_END"}
  /\ audioBufferCount' = audioBufferCount - 1
  /\ framesDropped' = framesDropped + 1
  /\ UNCHANGED <<vadState, framesIngested, framesTransmitted>>

Next ==
  \/ IngestSilenceFrame
  \/ IngestSpeechFrame
  \/ TransmitSpeechFrame
  \/ DrainSilenceFrame

(* Invariants *)

BufferBounds ==
  audioBufferCount <= MaxBuffer

FrameConservation ==
  framesIngested = framesTransmitted + framesDropped + audioBufferCount

Spec == Init /\ [][Next]_<<vadState, audioBufferCount, framesIngested, framesTransmitted, framesDropped>>

=============================================================================
