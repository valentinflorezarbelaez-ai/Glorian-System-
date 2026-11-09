# OPENSPEC BASE SPECIFICATION: AUDIO DSP KERNEL & TRUE PEAK LIMITER (SPEC-013)

## 1. Scope

Governs real-time digital signal processing, Direct Form II Transposed Biquad filters, and ITU-R BS.1770 / EBU R128 Lookahead True Peak limiting.

## 2. Requirements (EARS)

- **UBIQUITOUS**: THE SYSTEM SHALL calculate normalized biquad coefficients for lowpass, highpass, peaking, and notch filters with zero external dependencies.
- **UBIQUITOUS**: THE SYSTEM SHALL enforce an absolute True Peak ceiling of -1.0 dBTP on audio buffers, soft-clamping transients via hyperbolic tangent saturation curves.
- **STATE-DRIVEN**: WHILE running continuous streaming DSP, THE SYSTEM SHALL sustain throughput $> 20,000,000$ samples/sec ($> 500\times$ real-time 44.1kHz audio).

## 3. Acceptance Criteria (BDD)

```gherkin
SCENARIO: Direct Form II Transposed Biquad Filtering (BDD-043)
  GIVEN an audio sample stream and target biquad filter specifications
  WHEN the DSP kernel filters the buffer
  THEN lowpass, highpass, or notch frequency responses match mathematical targets
  AND zero heap memory reallocations occur during streaming processing.

SCENARIO: True Peak Limiting & Transient Soft Clamping (BDD-043)
  GIVEN an audio signal with peak transients exceeding the target ceiling
  WHEN processed by the True Peak limiter
  THEN all output samples remain below the absolute -1.0 dBTP ceiling
  AND harmonic distortion is minimized via smooth hyperbolic tangent curves.
```
