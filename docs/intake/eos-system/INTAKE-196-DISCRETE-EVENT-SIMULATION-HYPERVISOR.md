# EOS Intake & Context Record: INTAKE-196 (SPEC-334 / CHANGE-196)

## 1. Context & Business Intent

- **System**: Glorian System (Control Plane & Layer-0 Core Engine)
- **Domain**: Deterministic Discrete-Event Simulation Hypervisor & Time-Travel Fault Injection Engine (DESH)
- **Objective**: Implement a pure Layer-0 TypeScript deterministic Discrete-Event Simulation Hypervisor and Time-Travel Fault Injection Engine (`EosDiscreteEventSimulationHypervisorCore`) with zero external runtime dependencies. This engine equips Glorian System with the sovereign testing capabilities of Antithesis, FoundationDB Simulation Testing, NASA JPL deep-space autonomous simulators, and Los Alamos / DARPA mission-critical verification hypervisors. It decouples execution time completely from host wall-clock time, enables 100% bit-exact replayability via 64-bit seeded PRNGs, provides Chandy-Lamport inspired atomic state snapshots for time-travel rollback, and injects severe Byzantine network/hardware/clock faults into virtualized node meshes.
- **Reference Architectures & Inspirations**:
  - Antithesis: Deterministic Hypervisor, Autonomous Software Fault Injection, and Bug Branching
  - FoundationDB: Deterministic Simulation Testing (Sim2), Actor Network Virtualization, and Seed Replay
  - Leslie Lamport: _Time, Clocks, and the Ordering of Events in a Distributed System_ (CACM 1978)
  - K. Mani Chandy & Leslie Lamport: _Distributed Snapshots: Determining Global States of Distributed Systems_ (ACM TOCS 1985)
  - Kyle Kingsbury: Jepsen Distributed Fault Injection, Network Partitioning, and Clock Drift Simulation
  - DARPA / NASA JPL Mission-Critical Spacecraft Autonomous Verification Hypervisors

## 2. Core Functional Requirements

1. **Virtual Nanosecond Monotonic Clock & Priority Event Queue**: Decouple simulation execution from real-world wall-clock time. Maintain a virtual time counter in nanoseconds, processing discrete events scheduled in a deterministic priority queue ordered by `(scheduledTimeNs, priority, sequenceId)`.
2. **Deterministic PRNG & Bit-Exact Replay**: Drive all non-deterministic decisions (latencies, schedule interleavings, fault triggers) through a pure 64-bit seeded pseudo-random number generator (SplitMix64 / XorShift128+), guaranteeing identical state trajectories across repeated runs with matching seeds.
3. **Virtual Node Mesh & Message Bus Interception**: Virtualize communicating actors/nodes exchanging strongly-typed envelopes. Intercept all inter-node traffic at the hypervisor boundary to control delivery order, latency jitter, and buffer backpressure.
4. **Chaos & Byzantine Fault Injection Matrix**: Provide active fault injection primitives:
   - Packet dropping, duplication, and bit-level payload mutation.
   - Symmetric and asymmetric network partitions (split-brain scenarios).
   - Node crash-stop, crash-recovery, and volatile memory wipes.
   - Virtual clock skews and localized time jumps.
   - Asynchronous storage and compute stalling.
5. **Chandy-Lamport Time-Travel Checkpointing & State Rollback**: Capture lightweight, consistent global state snapshots (virtual clock, PRNG registers, pending events, node states, in-flight envelopes). Support rolling back execution to any historical checkpoint to explore counterfactual branching paths or debug anomalies.
6. **Continuous Invariant Checking & Cryptographic Run Audit**: Evaluate system invariants after each discrete event execution step. Generate a SHA-256 sealed audit receipt summarizing execution metrics, seed, step count, faults applied, and invariant verification results.

## 3. Epistemic Status & Constraints

- **Epistemic State**: `INTAKE_RECORDED`
- **Dependencies**: `dependencies: {}` (Zero external npm packages)
- **Module Size**: $\le 800$ lines, $\ge 12$ lines headroom (`SPEC-250`)
- **CLI Parity**: 100% catalog parity verified by `hygiene:audit`
