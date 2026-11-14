# SPEC-253 — Layer-0 Kalman State Estimator & Quad-Modular Redundant Voter

## Metadata

- **SPEC ID**: SPEC-253
- **Change ID**: CHANGE-126
- **Intake ID**: INTAKE-126
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosKalmanStateEstimatorAndQuadVoterCore`

---

## 1. Overview

`EosKalmanStateEstimatorAndQuadVoterCore` fuses 4-channel redundant telemetry streams via a Quad-Modular Redundancy (`QMR`) median isolator before passing clean scalar measurements into a 2-state linear kinematic Kalman filter (`[position, velocity]`) with covariance convergence tracking.

---

## 2. Functional Requirements (EARS Syntax)

**FR-253-001** (Event-Driven)
WHEN `estimateTrajectoryWithQuadVoter(options)` runs on telemetry frames of 4 channels (`[c0, c1, c2, c3]`), THE SYSTEM SHALL compute each frame's median and isolate any channel whose absolute deviation exceeds `faultThreshold` (`> faultThreshold`), averaging the healthy channels into `zFused`.

**FR-253-002** (State-Driven)
WHILE healthy quorum holds (`>= 3` healthy channels or fallback valid mean), THE SYSTEM SHALL execute 2-state Kalman predict/update cycles (`F = [[1, dt], [0, 1]]`, `H = [1, 0]`) tracking `estimatedPosition`, `estimatedVelocity`, `innovation`, `kalmanGainPosition`, `nis`, and `covarianceTrace`.

**FR-253-003** (State-Driven & Error Condition)
IF any frame drops below `3` healthy channels, THEN THE SYSTEM SHALL classify `verdict` as `"GNC_QUORUM_LOST"`; ELSE IF at least one channel was isolated across frames, `"CHANNEL_ISOLATED_DEGRADED"`; OTHERWISE `"GNC_NOMINAL_LOCK"`. Empty frames or non-4-channel tuples SHALL throw explicit `Error`s.

---

## 3. BDD Acceptance Scenarios

### BDD-1286 — Nominal 4-Channel Kinematic Lock & Covariance Contraction

```gherkin
SCENARIO: Track constant-velocity telemetry across 8 nominal 4-channel frames
  GIVEN default 8 frames with tight 4-channel agreement and positive velocity
  WHEN estimateTrajectoryWithQuadVoter runs
  THEN verdict is "GNC_NOMINAL_LOCK", totalChannelsIsolated is 0, and covarianceTrace monotonically decreases
```

### BDD-1287 — Quad-Voter Byzantine Spike Isolation (1 Faulty Channel)

```gherkin
SCENARIO: Isolate single corrupted telemetry channel and hold trajectory lock
  GIVEN frames where channel index 2 injects +50.0 Byzantine outlier spike while 3 channels stay nominal
  WHEN estimateTrajectoryWithQuadVoter executes
  THEN isolatedChannelIndices contains 2, zFused ignores the spike, and verdict is "CHANNEL_ISOLATED_DEGRADED"
```

### BDD-1288 — Loss Of QMR Quorum With >= 2 Corrupted Channels

```gherkin
SCENARIO: Detect GNC_QUORUM_LOST when fewer than 3 channels agree
  GIVEN a telemetry frame with two heavily diverged outlier channels leaving < 3 healthy channels
  WHEN estimateTrajectoryWithQuadVoter executes
  THEN quorumLostFramesCount >= 1 and verdict is "GNC_QUORUM_LOST"
```

### BDD-1289 — Fail-Closed Input Validation & Deterministic Receipt

```gherkin
SCENARIO: Reject malformed frames and guarantee deterministic kalmanDigestSha256
  GIVEN empty frames array or non-4-tuple channel payload
  WHEN estimateTrajectoryWithQuadVoter runs
  THEN an Error is thrown, while identical valid inputs yield identical 64-hex kalmanDigestSha256
```

### BDD-1290 — CLI kalman:estimate & MCP kalman_quad_vote Dispatch

```gherkin
SCENARIO: Dispatch Kalman Quad-Voter via CLI and MCP Server
  GIVEN wired handlers for kalman:estimate and eos_enterprise_workspace action "kalman_quad_vote"
  WHEN invoked in JSON mode
  THEN both return GNC_NOMINAL_LOCK and valid 64-hex kalmanDigestSha256
```
