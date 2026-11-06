# OPENSPEC BASE SPECIFICATION: AUDIO DSP KERNEL & TRUE PEAK LIMITER (SPEC-013)

## 1. Scope
Governs real-time digital signal processing, Direct Form II Transposed Biquad filters, and ITU-R BS.1770 / EBU R128 Lookahead True Peak limiting.

## 2. Requirements (EARS)
- **UBIQUITOUS**: THE SYSTEM SHALL calculate normalized biquad coefficients for lowpass, highpass, peaking, and notch filters with zero external dependencies.
- **UBIQUITOUS**: THE SYSTEM SHALL enforce an absolute True Peak ceiling of -1.0 dBTP on audio buffers, soft-clamping transients via hyperbolic tangent saturation curves.
- **STATE-DRIVEN**: WHILE running continuous streaming DSP, THE SYSTEM SHALL sustain throughput $> 20,000,000$ samples/sec ($> 500\times$ real-time 44.1kHz audio).

## 3. Acceptance Criteria (BDD Standard)
```gherkin
SCENARIO: True Peak Limiting and Biquad Normalization
  GIVEN an incoming audio stream with high transient dynamics
  WHEN the Lookahead True Peak limiter processes the audio buffer
  THEN peak amplitude must remain at or below -1.0 dBTP ceiling
  AND harmonic distortion must be softly saturated via hyperbolic tangent curves
```
