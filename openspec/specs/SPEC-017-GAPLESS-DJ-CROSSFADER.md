# OPENSPEC BASE SPECIFICATION: GAPLESS DJ AUTOMIX & 3-BAND CROSSFADER (SPEC-017)

## 1. Scope

Governs the mathematical modeling and execution of seamless, gapless DJ transitions between audio tracks using 3-band frequency crossover separation (Linkwitz-Riley 2nd order at 250 Hz and 4 kHz), phase cancellation prevention, and Camelot harmonic distance optimization.

## 2. Requirements (EARS)

- **UBIQUITOUS**: THE SYSTEM SHALL separate audio signals into Low (< 250 Hz), Mid (250 Hz - 4 kHz), and High (> 4 kHz) frequency bands using normalized IIR coefficients with zero external dependencies.
- **EVENT-DRIVEN**: WHEN calculating an automix transition between Track A and Track B, THE SYSTEM SHALL stagger the Low-frequency crossfade such that the bassline of Track A attenuates prior to the entry of Track B's bassline, mathematically preventing low-end phase clash and headroom clipping.
- **UBIQUITOUS**: THE SYSTEM SHALL enforce an equal-power crossfade curve ($\cos^2(\theta) + \sin^2(\theta) \equiv 1.0$) across Mid and High bands to maintain continuous perceived acoustic loudness.
- **STATE-DRIVEN**: WHILE evaluating playlist transition sequences, THE SYSTEM SHALL compute harmonic transition cost based on Camelot Wheel distance ($\Delta \mathcal{H} \in [0, 1]$), penalizing key clashes and rewarding harmonic relative shifts.
