# CHANGE-196: Deterministic Discrete-Event Simulation Hypervisor & Time-Travel Fault Injection Engine

## 1. Intent & Scope

Testing distributed, concurrent, and mission-critical software architectures (such as consensus clusters, sovereign ledgers, autonomous agents, and space telemetry meshes) against rare edge cases, race conditions, and catastrophic network splits is notoriously difficult under non-deterministic host environments. Traditional end-to-end testing suffers from flakiness, wall-clock slowness, inability to step time backward, and non-reproducible race conditions.

`CHANGE-196` introduces `EosDiscreteEventSimulationHypervisorCore` (DESH), establishing:

1. **Virtual Nanosecond Monotonic Clock & Priority Queue**: Absolute decoupling of execution time from wall-clock time, processing events along a deterministic virtual timeline.
2. **Deterministic Seed Replay**: 64-bit seeded SplitMix64/XorShift128+ PRNG driving all randomized scheduling decisions, network latency models, and fault triggers, guaranteeing 100% bit-exact replayability.
3. **Actor Mesh & Message Bus Interception**: Hypervisor-mediated actor/node virtualization where inter-node communication is intercepted, delayed, reordered, or partitioned under strict control.
4. **Comprehensive Byzantine Fault Injection Matrix**: Dynamic injection of network partitions, packet drops, byte corruptions, node crash-reboots, clock drifts, and asynchronous stalling.
5. **Chandy-Lamport Time-Travel Checkpointing & State Rollback**: Atomic global state snapshots allowing the simulation to pause, rewind to a prior checkpoint, and explore alternative counterfactual execution branches.
6. **Continuous Invariant Checking & Cryptographic Run Audit**: Automated invariant validation at every discrete step, yielding a SHA-256 sealed audit receipt for forensic verification.
7. **Formal TLA+ Model 78**: Mathematical proof of virtual time monotonicity, event queue total ordering, and state rollback consistency checked under Leslie Lamport's TLC.

## 2. Impacted Components

- `src/core/eosDiscreteEventSimulationHypervisor.ts`: Core Layer-0 Discrete-Event Simulation Hypervisor engine.
- `src/core/eosDiscreteEventSimulationHypervisor.types.ts`: Domain schemas, event definitions, fault configurations, checkpoint snapshots, and audit structures.
- `src/core/index.ts`: Module exports.
- `bin/commands/cliDiscreteEventSimulationHypervisor.mjs`: CLI subdispatcher under prefix `toolchain:desh:`.
- `bin/commands/cliToolchainRouter.mjs`: Router registration.
- `bin/commands/cliHelpCatalog.mjs`: Help catalog entries.
- `docs/DEVELOPER_GUIDE.md`: Developer guide and alphabetical index updates.
- `docs/formal/DiscreteEventSimulationHypervisor.tla` & `.cfg`: Formal TLA+ specification and model configuration.
- `scripts/run-tlc.mjs`: TLC runner registry.
- `test/eosDiscreteEventSimulationHypervisor.test.mjs`: BDD test suite (BDD-1779..1784).

## 3. Risk Assessment

- **Risk 1**: State accumulation leading to unbounded memory usage across long simulations with frequent checkpoints.
  - _Mitigation_: Bounded snapshot history ring buffer with configurable checkpoint retention and lightweight delta serialization.
- **Risk 2**: Subtle non-determinism introduced via asynchronous timers or host platform scheduling.
  - _Mitigation_: Pure synchronous event-loop stepping architecture where all state advancements are strictly driven by discrete queue dispatch.
