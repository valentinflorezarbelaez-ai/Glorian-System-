# OPENSPEC BASE SPECIFICATION: AUDIO DSP KERNEL & TRUE PEAK LIMITER (SPEC-013)

## 1. Scope

Governs real-time digital signal processing, Direct Form II Transposed Biquad filters, and ITU-R BS.1770 / EBU R128 Lookahead True Peak limiting.

## 2. Requirements (EARS)

- **UBIQUITOUS**: THE SYSTEM SHALL calculate normalized biquad coefficients for lowpass, highpass, peaking, and notch filters with zero external dependencies.
- **UBIQUITOUS**: THE SYSTEM SHALL enforce an absolute True Peak ceiling of -1.0 dBTP on audio buffers, soft-clamping transients via hyperbolic tangent saturation curves.
- **STATE-DRIVEN**: WHILE running continuous streaming DSP, THE SYSTEM SHALL sustain throughput $> 20,000,000$ samples/sec ($> 500\times$ real-time 44.1kHz audio).
