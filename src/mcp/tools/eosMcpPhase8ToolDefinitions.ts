/**
 * MCP tool schemas for the Phase-8 AGI, forge, context-window and spec-drift tools.
 * Extracted from eosMcpToolDefinitions.ts to keep that module under its size ceiling.
 */

export interface Phase8ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export const PHASE8_TOOL_DEFINITIONS: ReadonlyArray<Phase8ToolDefinition> = [
  {
    name: "eos_consult",
    description:
      "World-class consulting deliverable: 5-Whys root cause, ADR recommendation, implementation plan, risk matrix, and exact code — offline, no AI call needed.",
    inputSchema: {
      type: "object",
      properties: {
        problem: { type: "string", description: "Describe the problem, bug, architecture question, or decision" },
        engagementType: {
          type: "string",
          enum: [
            "ARCHITECTURE_REVIEW",
            "NEW_FEATURE",
            "BUG_INVESTIGATION",
            "PERFORMANCE_AUDIT",
            "SECURITY_AUDIT",
            "TECH_DEBT_REDUCTION",
            "MIGRATION",
            "INCIDENT_POSTMORTEM",
            "GENERAL",
          ],
        },
        techStack: {
          type: "string",
          enum: ["typescript", "javascript", "go", "rust", "python", "java", "sql", "terraform", "kubernetes"],
        },
        context: { type: "string", description: "Relevant code, error messages, or system context" },
        constraints: { type: "string", description: "Team size, timeline, performance budget" },
      },
      required: ["problem"],
    },
  },
  {
    name: "eos_agi_solve",
    description:
      "Runs the Tree of Thoughts solve cycle with live progress streaming — generates branches, evaluates each through the deterministic tribunal, crystallizes axioms from failures.",
    inputSchema: {
      type: "object",
      properties: {
        objective: { type: "string", description: "The engineering objective to solve" },
        branches: { type: "array", description: "Array of ThoughtBranch objects from eos_agi_axioms + model router" },
        testCommand: { type: "string", description: "Test command to use as tribunal (default: npm test)" },
        timeoutMs: { type: "number", description: "Timeout per branch in ms (default: 60000)" },
      },
      required: ["objective", "branches"],
    },
  },
  {
    name: "eos_pipeline",
    description:
      "End-to-end pipeline: assembles context → generates branches via model router → evaluates through tribunal → returns verified solution. Requires API key for model routing.",
    inputSchema: {
      type: "object",
      properties: {
        problem: { type: "string", description: "Natural language problem description" },
        targetFile: { type: "string", description: "Primary file to fix/modify (relative path)" },
        testCommand: { type: "string", description: "Test command as tribunal (must exit 0 on success)" },
        tokenBudget: { type: "number", description: "Max tokens for context (default: 32000)" },
        branchCount: { type: "number", description: "Number of solution branches (default: 3)" },
        timeoutMs: { type: "number", description: "Timeout per branch in ms (default: 30000)" },
      },
      required: ["problem", "targetFile", "testCommand"],
    },
  },
  {
    name: "eos_agi_axioms",
    description:
      "Returns all crystallized axioms learned from past failed branches — inject into AI prompts to prevent repeat errors.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "eos_forge_list",
    description: "Lists all dynamically forged MCP tools created at runtime by the AGI Core.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "eos_forge_tool",
    description: "Creates and registers a new MCP tool at runtime from provided ESM module source code.",
    inputSchema: {
      type: "object",
      properties: {
        toolName: { type: "string", description: "Tool name (eos_ prefix added automatically)" },
        description: { type: "string", description: "One-sentence tool description" },
        inputSchema: { type: "object", description: "JSON Schema for tool arguments" },
        moduleSource: {
          type: "string",
          description: "Complete ESM module source code exporting name, description, inputSchema, execute",
        },
      },
      required: ["toolName", "description", "moduleSource"],
    },
  },
  {
    name: "eos_context_window",
    description:
      "Assembles an LLM-ready context block for a target file within a token budget — selects relevant files via blast radius, compresses each, prioritizes by relevance.",
    inputSchema: {
      type: "object",
      properties: {
        objective: { type: "string", description: "What the AI needs to do" },
        targetFile: { type: "string", description: "Relative path to the primary file" },
        tokenBudget: { type: "number", description: "Max tokens (default: 32000)" },
        includeTests: { type: "boolean" },
        includeSpecs: { type: "boolean" },
      },
      required: ["objective", "targetFile"],
    },
  },
  {
    name: "eos_spec_drift",
    description:
      "Detects drift between source code and formal specs — finds modules without specs, specs without modules, and code newer than its spec.",
    inputSchema: {
      type: "object",
      properties: {
        driftThresholdDays: { type: "number", description: "Days of drift to flag (default: 7)" },
        checkOrphanSpecs: { type: "boolean" },
      },
    },
  },
  {
    name: "eos_ontological_hypergraph_audit",
    description:
      "Audits bitemporal N-ary ontological hypergraph invariants, entity resolution deduplication, and fail-closed MLS lattice containment (SPEC-333).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_desh_simulation_audit",
    description:
      "Executes a deterministic discrete-event simulation hypervisor run with snapshot checkpointing and virtual-time monotonicity verification (SPEC-334).",
    inputSchema: {
      type: "object",
      properties: {
        seed: { type: "string", description: "Deterministic PRNG seed" },
      },
    },
  },
  {
    name: "eos_pqmpc_threshold_audit",
    description:
      "Audits post-quantum threshold secret sharing, ciphertext additive homomorphism, and quorum decryption bounds (SPEC-335).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_pinn_hamiltonian_audit",
    description:
      "Audits physics-informed neural collocation solver residuals, CFL stability bounds, and symplectic Hamiltonian Liouville volume conservation (SPEC-336).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_euv_ilt_wavefront_audit",
    description:
      "Audits High-NA EUV optical proximity correction, Zernike aberration compensation, Marechal Strehl ratio guards, and inverse mask synthesis (SPEC-337).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_causal_scm_audit",
    description:
      "Audits Pearl do-calculus causal structural equation models, d-separation, backdoor adjustment, and three-step counterfactual inference (SPEC-338).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_agentic_harness_audit",
    description:
      "Audits SDD specification readiness gates, bounded harness retry loops, first-pass PR yield telemetry, and FinOps rework token amplification (SPEC-339).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_closed_loop_autopilot_audit",
    description:
      "Executes the Sovereign Closed-Loop Repository Autopilot uniting SPEC-333 ontology, SPEC-338 causal SCM, SPEC-334 DESH replay, and SPEC-339 Git harness yield (SPEC-340).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_blindspot_fleet_audit",
    description:
      "Audits all 9 registered fleet repositories with metamorphic boundary fuzzing campaigns and structural invariants (SPEC-341 / SPEC-124).",
    inputSchema: {
      type: "object",
      properties: {
        iterations: { type: "number", description: "Fuzz iterations per project (default: 50)" },
        seed: { type: "number", description: "PRNG seed (default: 2026341)" },
      },
    },
  },
  {
    name: "eos_blindspot_hunter_audit",
    description:
      "Runs recursive structural tree shrinking, differential oracle divergence hunting, metamorphic invariant checks, and 500-payload boundary fuzzing (SPEC-341).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_web_compiler_audit",
    description:
      "Audits the Sovereign Web Application & SaaS Compiler verifying WCAG 2.1 AAA contrast, SRI SHA-384 asset integrity, and Schema.org JSON-LD completeness (SPEC-343).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_agentic_context_audit",
    description:
      "Audits the Autonomous Agentic Context Engine verifying sliding-window chunking, prompt-injection defense barrier, token budget compaction, and semantic retrieval recall (SPEC-344).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_knowledge_graph_reflex_audit",
    description:
      "Audits the Closed-Loop Knowledge Graph & Semantic Reflex Engine verifying Tarjan SCC cycle detection, Kahn topological DAG sequencing, blast radius computation, and bounded reflex cascade depth (SPEC-345).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_agentic_swarm_bft_audit",
    description:
      "Audits the Autonomous Multi-Agent Swarm Orchestrator verifying PBFT 3-phase consensus, 3f+1 quorum thresholds, and byzantine slashing resilience (SPEC-346).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_wasmjit_compiler_audit",
    description:
      "Audits the Autonomous Dynamic WebAssembly JIT Compiler verifying binary synthesis, stack-safe AST compilation, and high-throughput execution (SPEC-347).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_crdt_memory_sync_audit",
    description:
      "Audits the Distributed Bitemporal CRDT Memory Synchronizer verifying Strong Eventual Consistency, join-semilattice merges, and bitemporal fidelity (SPEC-348).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_neural_symbolic_prover_audit",
    description:
      "Audits the Self-Synthesizing Neural-Symbolic Prover verifying DPLL/CDCL SAT solving, linear bound propagation, and CEGAR inductive invariant synthesis (SPEC-349).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_zk_circuit_synthesizer_audit",
    description:
      "Audits the Autonomous Zero-Knowledge Circuit Synthesizer verifying BN254 finite field arithmetic, R1CS arithmetization, boolean enforcement, and witness satisfiability (SPEC-350).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_sharded_transaction_mesh_audit",
    description:
      "Audits the Autonomous Quantum-Resilient Distributed Transaction Fabric & Sharded State Mesh verifying consistent hash ring balancing, MVCC snapshot isolation, 2PC atomic commits, and post-quantum HMAC-SHA384 receipts (SPEC-351).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_neuromorphic_planner_audit",
    description:
      "Audits the Autonomous Multi-Modal Neuromorphic Hyper-Heuristic Planner verifying Leaky Integrate-and-Fire (LIF) dynamics, STDP synaptic plasticity, rate/temporal encoding, and closed-loop feedback convergence (SPEC-352).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_causal_meta_learning_audit",
    description:
      "Audits the Autonomous Causal Meta-Learning & Counterfactual Policy Engine verifying SCM DAG acyclicity, Pearl's Do-calculus graph mutilation, backdoor criterion, and 3-step counterfactuals (SPEC-353).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_webgpu_tensor_audit",
    description:
      "Audits the Autonomous WebGPU WGSL Compute & SIMD Tensor Acceleration Engine verifying WGSL compute shaders, shared memory tiling, SIMD vectorization, and bit-exact software emulation (SPEC-354).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_zero_copy_ipc_audit",
    description:
      "Audits the Deterministic Zero-Copy Shared Memory Ring Buffer verifying power-of-2 allocation, 64-byte cache padding, binary framing, lock-free SPSC/MPSC, and sub-microsecond IPC (SPEC-355).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_work_stealing_scheduler_audit",
    description:
      "Audits the Self-Rebalancing Work-Stealing Scheduler verifying Chase-Lev lock-free deques, randomized peer stealing, starvation-free priority aging, and micro-task throughput (SPEC-356).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_bitemporal_ledger_audit",
    description:
      "Audits the Autonomous Bitemporal Event Sourcing Hyper-Ledger verifying Datomic dual-time coordinates, append-only SHA-256 blocks, Merkle root verification, and LIDR SDLC event auditability (SPEC-357).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_architectural_canvas_audit",
    description:
      "Audits the Live Self-Introspecting Architectural Canvas verifying dynamic DAG harvesting, pure Layer-0 Sugiyama layout, bi-directional cycle detection, and causal blast radius analysis (SPEC-358).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_agent_swarm_microkernel_audit",
    description:
      "Audits the Autonomous Self-Assembling Agent Swarm Micro-Kernel verifying Raft consensus, election terms, majority quorums, dynamic capability bidding, and anti-split-brain step-down (SPEC-359).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_inductive_proof_engine_audit",
    description:
      "Audits the Autonomous Formal Verification & Metamorphic Proof Engine verifying CEGIS inductive invariant synthesis, transition counterexample pruning, and metamorphic symmetry preservation (SPEC-360).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_glorian_live_studio_audit",
    description:
      "Audits the Glorian Live Studio & Interactive Visual HUD verifying zero-dependency HTTP server startup, reactive HTML HUD delivery, SSE telemetry streaming, and bitemporal projection (SPEC-361).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_autonomous_sentinel_audit",
    description:
      "Audits the Autonomous Continuous Sentinel Daemon 24/7 verifying background heartbeat execution, 5-dimensional health probes, AST drift detection, Raft swarm remediation leasing, and CEGIS-verified PR synthesis (SPEC-362).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_voice_neural_interface_audit",
    description:
      "Audits the Voice Neural Interface with Gemini Live API verifying linear PCM framing, mathematical VAD (RMS and ZCR), binary message serialization, and ephemeral session isolation (SPEC-363).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];
