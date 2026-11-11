# INTAKE-080: Dynamic Coverage-Guided Fuzzing Oracle

- **Owner directive**: Expand Glorian System with dynamic fuzzing capabilities modeled after DARPA Cyber Grand Challenge, Google OSS-Fuzz, and LLVM LibFuzzer, capable of autonomous edge-case generation and crash verification across runtime components.
- **Gap**: While Glorian has static neuro-symbolic verification and AST mutation, it lacks a high-throughput runtime fuzzing oracle (`glorian fuzz`) that tests boundary conditions, malformed Unicode, prototype pollution vectors, and numeric overflows with microsecond latency metrics.
- **Outcome**: A pure Layer-0 dynamic fuzzing engine (`src/core/eosDynamicFuzzingOracle.ts`) that generates corpus mutations, runs isolated fuzzing campaigns, computes stability scores (0-100), and emits tamper-evident SHA-256 receipts accessible via CLI and MCP.
