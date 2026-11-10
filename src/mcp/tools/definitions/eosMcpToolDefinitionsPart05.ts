/**
 * EOS MCP TOOL DEFINITIONS — PART 05 of 5 (static "tools/list" schemas).
 * Ordered slice eos_fleet_verify .. eos_black_projects_triad_audit (23 tools). Pure data (no behavior).
 * Aggregated in order by src/mcp/eosMcpToolDefinitions.ts; do not reorder entries.
 */
import type { EosMcpToolDefinitionInput } from "./eosMcpToolDefinitionTypes.ts";

export const EOS_MCP_TOOL_DEFINITIONS_PART_05: ReadonlyArray<EosMcpToolDefinitionInput> = [
  {
    name: "eos_fleet_verify",
    description:
      "Fleet Production Living Verification & Bautismo de Fuego Engine (SPEC-056, v62.0.0): Executes live synthetic quality & security audits on all 10 registered production targets (HAM-SAH, Donaciones, Biblioteca, Portafolio, ATP, Aberamentho, Glorian/eos-system-ten, TaskFlow, Avo Pack, PTG), auditing TLS headers, WCAG 2.1 AA landmarks, and CWV.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Target URL to verify or 'all' for entire registered fleet" },
        timeoutMs: { type: "number", description: "Timeout limit in ms (default 10000)" },
        recordToLedger: {
          type: "boolean",
          description: "Whether to persist attestation receipts in SQLite WAL ledger",
        },
      },
    },
  },
  {
    name: "eos_unitotal_evaluate",
    description:
      "EOS Sovereign Unitotal Nexus & Universal Fleet Mesh (SPEC-057, v63.0.0): Evaluates the Gnostic 10-Sephiroth Architectural Vector (Kether to Malkuth) alongside multi-fleet governance and tooling drift across all registered repositories.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["evaluate", "audit_fleet", "heal_drift"], description: "Evaluation action" },
        repoId: { type: "string", description: "Target repository ID for heal_drift action" },
        recordToLedger: { type: "boolean", description: "Whether to persist attestation receipt in SQLite WAL ledger" },
      },
    },
  },
  {
    name: "eos_fuzz_hypervisor",
    description:
      "Autonomous Property-Based Fuzzing & Time-Travel Replay Hypervisor (SPEC-058, v64.0.0): Deterministic Mulberry32 seeded fuzzing, boundary mutations, Delta Shrinkage, SQLite WAL state time-travel replay, and 49 Levels of Subconscious Introspection.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["fuzz", "time_travel", "introspection", "fuzz_and_replay"],
          description: "Action to perform",
        },
        seed: { type: "number", description: "Deterministic integer seed for pseudo-random reproduction" },
        iterations: { type: "number", description: "Number of fuzzing iterations (default: 1000)" },
        targetHeight: { type: "number", description: "Target ledger transaction height for time-travel replay" },
        recordToLedger: {
          type: "boolean",
          description: "Whether to commit cryptographic verification receipt into SQLite WAL ledger",
        },
      },
    },
  },
  {
    name: "eos_conscious_witness",
    description:
      "Sovereign Conscious Witness & Hot-Patching Core (SPEC-059, v65.0.0): Metacognitive anti-hallucination gatekeeper, intention interrogation against formal EARS specs, and atomic in-memory hot-patching.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["interrogate", "hotpatch"], description: "Action to execute" },
        declaredSpecId: { type: "string", description: "Formal specification identifier (e.g. SPEC-059)" },
        targetFiles: {
          type: "array",
          items: { type: "string" },
          description: "List of files to be inspected or modified",
        },
        proposedAction: { type: "string", description: "Clear description of the proposed modification" },
        affirmedSymbols: {
          type: "array",
          items: { type: "string" },
          description: "Specific code symbols claimed to exist or be modified",
        },
      },
    },
  },
  {
    name: "eos_sapfix_autoshipper",
    description:
      "Meta SapFix Autonomous PR & Auto-Merge Engine (SPEC-060, v66.0.0): Automated fault intake, ephemeral worktree isolation, surgical AST remediation, and zero-regression PR manifest generation.",
    inputSchema: {
      type: "object",
      properties: {
        faultId: { type: "string", description: "Identifier of the fault or regression" },
        targetFile: { type: "string", description: "Target source file containing the fault" },
        currentTestCommand: { type: "string", description: "Test command to verify fix" },
        candidatePatch: { type: "string", description: "Optional pre-synthesized patch content" },
        dryRun: { type: "boolean", description: "If true, simulates repair cycle without opening PR or committing" },
      },
    },
  },
  {
    name: "eos_slsa_provenance_sbom",
    description:
      "SLSA Level 4 Provenance & CycloneDX v1.5 SBOM Engine (SPEC-061, v66.0.0): Generate tamper-evident software bill of materials and in-toto SLSA provenance statements with SHA-256 receipts.",
    inputSchema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["sbom", "slsa", "both"],
          description: "Whether to generate CycloneDX SBOM, SLSA provenance, or both (default: both)",
        },
        commitSha: { type: "string", description: "Git commit SHA for SLSA statement" },
        recordToLedger: {
          type: "boolean",
          description: "Whether to record cryptographic receipt into SQLite WAL ledger",
        },
      },
    },
  },
  {
    name: "eos_content_addressable_cache",
    description:
      "Content-Addressable Storage (CAS) & Action Cache Engine (SPEC-062, v66.0.0): Google Bazel-grade blob deduplication, content addressing, and action cache hit/miss execution tracking.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["stats", "put_blob", "get_blob", "has_blob", "put_action", "get_action"],
          description: "CAS or Action Cache operation",
        },
        content: { type: "string", description: "Blob content for put_blob" },
        digest: { type: "string", description: "SHA-256 digest for blob lookup" },
        actionKey: { type: "string", description: "Deterministic action key for Action Cache" },
        actionResult: { type: "object", description: "Action result payload for put_action" },
        recordToLedger: { type: "boolean", description: "Whether to record stats receipt into SQLite WAL ledger" },
      },
    },
  },
  {
    name: "eos_smt_reasoning_prover",
    description:
      "SMT Automated Reasoning & Formal Logic Prover (SPEC-063, v66.0.0): AWS-grade DPLL/SAT mathematical proof of ABAC security boundaries and topological graph acyclicity.",
    inputSchema: {
      type: "object",
      properties: {
        theoremType: {
          type: "string",
          enum: ["abac_safety", "topological_acyclic"],
          description: "Type of theorem to prove",
        },
        principalRole: { type: "string", description: "Role under evaluation (e.g. guest)" },
        targetAction: { type: "string", description: "Target action (e.g. ledger_write)" },
        rules: { type: "array", description: "ABAC rules list for safety proof" },
        nodes: {
          type: "array",
          items: { type: "string" },
          description: "Graph node identifiers for topological proof",
        },
        dependencies: { type: "object", description: "Dependency map (node -> array of dependencies)" },
        recordToLedger: { type: "boolean", description: "Whether to commit proof receipt into SQLite WAL ledger" },
      },
    },
  },
  {
    name: "eos_chaos_monkey_live",
    description:
      "Production Chaos Monkey & Resilience Hypervisor (SPEC-064, v66.0.0): Netflix-grade synthetic latency injection, random bit-flips, exceptions, and circuit breaker blast-radius containment.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["stats", "inject_fault", "run_experiment"],
          description: "Chaos action to execute",
        },
        seed: { type: "number", description: "PRNG seed for reproducible chaos" },
        maxFaultBudget: { type: "number", description: "Maximum allowed fault budget before circuit trip" },
        failureRate: { type: "number", description: "Failure probability (0.0 to 1.0)" },
        latencyRangeMs: {
          type: "array",
          items: { type: "number" },
          description: "[minMs, maxMs] latency injection range",
        },
        recordToLedger: { type: "boolean", description: "Whether to persist chaos report into SQLite WAL ledger" },
      },
    },
  },
  {
    name: "eos_bft_swarm_consensus",
    description:
      "Byzantine Fault Tolerant (BFT) Agent Swarm & Slashing Hypervisor (SPEC-065, v66.0.0): DeepMind-grade multi-agent quorum consensus, security veto enforcement, and quadratic reputation slashing.",
    inputSchema: {
      type: "object",
      properties: {
        proposalId: { type: "string", description: "Unique proposal identifier" },
        action: { type: "string", description: "Proposed action or change" },
        securityImpact: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
          description: "Assessed security impact",
        },
        targetFiles: { type: "array", items: { type: "string" }, description: "Target files affected by proposal" },
        votes: { type: "array", description: "Optional custom agent votes list" },
        recordToLedger: { type: "boolean", description: "Whether to commit consensus report into SQLite WAL ledger" },
      },
    },
  },
  {
    name: "eos_truetime_commit_wait",
    description:
      "Google Spanner TrueTime Uncertainty & Commit-Wait Linearizability Engine (SPEC-078/SPEC-082, v71.0.0): Returns bounded interval [earliest, latest], 2ε uncertainty, and evaluates causal commit-wait to guarantee strict linearizability.",
    inputSchema: {
      type: "object",
      properties: {
        epsilonMs: { type: "number", description: "Clock uncertainty half-width in ms (default: 5.0)" },
        recordToLedger: {
          type: "boolean",
          description: "Whether to record TrueTime attestation into SQLite WAL ledger",
        },
      },
    },
  },
  {
    name: "eos_lsm_storage_put_get",
    description:
      "Meta RocksDB LSM-Tree Storage Engine with Bloom Filter & SSTables (SPEC-079/SPEC-082, v71.0.0): Put/get key-value telemetry, flush MemTable to immutable SSTable L0, and point-lookup with 512-bit Bloom filter.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["put", "get", "flush", "stats"], description: "Storage action to execute" },
        key: { type: "string", description: "Key identifier" },
        value: { type: "string", description: "Value payload for put action" },
        recordToLedger: { type: "boolean", description: "Whether to record operation receipt into SQLite WAL ledger" },
      },
    },
  },
  {
    name: "eos_threshold_secret_split_combine",
    description:
      "Stripe Treasury Shamir (t, n) Threshold Cryptography Engine (SPEC-080/SPEC-082, v71.0.0): Split master secrets over 256-bit safe prime field F_p or reconstruct secret from threshold quorum shares via Lagrange interpolation.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["split", "combine"], description: "Threshold cryptographic action" },
        secret: { type: "string", description: "Master secret to split (text or hex)" },
        threshold: { type: "number", description: "Minimum quorum threshold t (default: 3)" },
        totalShares: { type: "number", description: "Total number of shares n (default: 5)" },
        shares: { type: "array", description: "Array of { x: number, yHex: string } shares for combine action" },
        recordToLedger: { type: "boolean", description: "Whether to record quorum attestation into SQLite WAL ledger" },
      },
    },
  },
  {
    name: "eos_microvm_enclave_generate",
    description:
      "AWS Nitro & Firecracker MicroVM Hardware Enclave Launcher (SPEC-081/SPEC-082, v71.0.0): Generates deterministic OCI Firecracker descriptors, Windows Hyper-V container specs, and evaluates host virtualization capabilities.",
    inputSchema: {
      type: "object",
      properties: {
        enclaveId: { type: "string", description: "Unique enclave identifier" },
        vcpuCount: { type: "number", description: "Allocated vCPUs (default: 2)" },
        memSizeMib: { type: "number", description: "Allocated RAM in MiB (default: 512)" },
        kernelPath: { type: "string", description: "Guest kernel path" },
        rootfsPath: { type: "string", description: "Root filesystem image path" },
        vsockCid: { type: "number", description: "Vsock Context Identifier (default: 3)" },
        recordToLedger: { type: "boolean", description: "Whether to record enclave descriptor into SQLite WAL ledger" },
      },
    },
  },
  {
    name: "eos_design_system_govern",
    description:
      "Tier S-0 Machine-Readable Design System Governor & AST Visual Linter (SPEC-128): audits markup (HTML, CSS, JSX/TSX) against the S-0 Design System Contract (4px grid, elevation shadows, spring transitions, contrast ratios, and dark tactical palette).",
    inputSchema: {
      type: "object",
      properties: {
        targetPaths: {
          type: "array",
          items: { type: "string" },
          description: "List of file paths relative to project root to audit (defaults to index.html and css/eos.css)",
        },
        strict: {
          type: "boolean",
          description: "If true, non-blocking anti-pattern warnings will also fail the audit",
        },
      },
    },
  },
  {
    name: "eos_neurosymbolic_fleet_healing",
    description:
      "Glorian Neuro-Symbolic Fleet LSC & Closed-Loop Autonomous Healing Control Plane (SPEC-131, v89.0.0): AWS-grade SMT DPLL formal invariant proving, Meta-grade closed-loop AST surgical fault remediation, and Google Rosie-grade fleet-wide Large Scale Change (LSC) campaign sharding and attestation.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["prove_invariant", "heal_fault", "run_lsc_campaign"],
          description: "Neuro-symbolic action to execute",
        },
        theoremName: {
          type: "string",
          description: "Theorem name for SMT invariant proving",
        },
        clauses: {
          type: "array",
          description: "CNF clauses for invariant proof (array of arrays of literal strings)",
        },
        faultId: {
          type: "string",
          description: "Unique fault identifier for closed-loop healing",
        },
        targetFilePath: {
          type: "string",
          description: "Target file path for AST surgical patch synthesis",
        },
        failingLine: {
          type: "number",
          description: "Failing line number (1-based)",
        },
        errorMessage: {
          type: "string",
          description: "Error message or diagnostic signal",
        },
        campaignId: {
          type: "string",
          description: "LSC campaign identifier",
        },
        description: {
          type: "string",
          description: "Campaign description",
        },
        targetModules: {
          type: "array",
          items: { type: "string" },
          description: "List of target modules or fleet repository paths",
        },
        transformationRule: {
          type: "string",
          description: "Declarative refactoring rule",
        },
      },
    },
  },
  {
    name: "eos_fleet_pulse",
    description:
      "Glorian Fleet Tactical Sovereignty Radar & Health Pulse (SPEC-132, v90.0.0): Real-time multi-repo porcelain health, branch, commit, production URL, Soundcheck score, and esoteric-gnostic archetype audit across all 9 fleet repositories.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["json", "table"],
          description: "Format of the output report: structured JSON or formatted ANSI TUI table (default: json)",
        },
      },
    },
  },
  {
    name: "eos_nocturnal_evolution",
    description:
      "Glorian Nocturnal Darwinian Evolution & Dead-Code Eradication Engine (SPEC-133, v91.0.0): Autonomous background refactoring audit, AST dead-code eradication, cyclomatic complexity reduction, and DeepMind AlphaEvolve multivariate fitness scoring.",
    inputSchema: {
      type: "object",
      properties: {
        targetDir: {
          type: "string",
          description: "Target directory relative to project root to audit (defaults to 'src/core')",
        },
        format: {
          type: "string",
          enum: ["json", "summary"],
          description: "Format of the report: structured JSON or formatted ANSI TUI summary (default: json)",
        },
      },
    },
  },
  {
    name: "glorian_fleet_health_watchdog",
    description:
      "Glorian Sovereign Fleet Health Watchdog & Synthetic Security Sentinel (SPEC-134, v92.0.0): Non-blocking synthetic availability probing, TTFB latency measurement, anti-SSRF isolation, and HSTS/CSP security header compliance across all registered fleet projects.",
    inputSchema: {
      type: "object",
      properties: {
        dryRun: {
          type: "boolean",
          description: "Whether to run in simulated nominal dry-run mode (default: false)",
        },
        format: {
          type: "string",
          enum: ["json", "summary"],
          description: "Output format: structured JSON or high-density terminal dashboard (default: json)",
        },
      },
    },
  },
  {
    name: "glorian_constitutional_tribunal",
    description:
      "Glorian Multi-Model Consensus Engine & Constitutional Tribunal (SPEC-135, v93.0.0): Tier-0 3-Judge Byzantine consensus auditing proposed code mutations, commands, and architecture plans against the 7 Inviolable Commandments with automatic fail-closed veto.",
    inputSchema: {
      type: "object",
      properties: {
        actionId: {
          type: "string",
          description: "Unique mutation or action identifier (e.g. 'MUT-001-ARCH-UPGRADE')",
        },
        category: {
          type: "string",
          enum: ["ARCHITECTURE", "DEPLOYMENT", "CODE_MUTATION", "CONFIG"],
          description: "Category of the proposed action",
        },
        description: {
          type: "string",
          description: "Detailed description of the proposed action and intended outcomes",
        },
        diffOrPayload: {
          type: "string",
          description: "Proposed code snippet, diff, or script payload to inspect",
        },
        targetDirectory: {
          type: "string",
          description: "Target directory or file path of the operation",
        },
        format: {
          type: "string",
          enum: ["json", "summary"],
          description: "Output format: structured JSON or formatted ANSI TUI summary (default: json)",
        },
      },
      required: ["actionId", "category", "description"],
    },
  },
  {
    name: "eos_autonomous_synthesize",
    description:
      "Autonomous Multi-Tier Code Synthesizer (SPEC-157): Synthesizes complete 4-tier hexagonal software bundles (Domain, Application, Infrastructure, Test) complying with NASA JPL Power of 10, Nubank Datomic, and fail-closed invariants.",
    inputSchema: {
      type: "object",
      properties: {
        directive: {
          type: "string",
          description: "Natural language specification of software capability to synthesize",
        },
        domain: {
          type: "string",
          enum: ["fintech", "audio", "platform", "govtech", "general"],
          description: "Optional architectural domain specialization",
        },
        write: {
          type: "boolean",
          description: "Materialize synthesized files directly to disk (default false)",
        },
        outDir: {
          type: "string",
          description: "Target directory for disk materialization (default 'generated-software')",
        },
      },
      required: ["directive"],
    },
  },
  {
    name: "eos_planetary_doctrine_audit",
    description:
      "Planetary Apex Operating Doctrine (SPEC-158): Audits the system against the 5 Apex Pillars: ASML Sub-Micron Precision, SpaceX Starship TMR Avionics, DeepMind Invariants, DARPA Hermetic Isolation, and NSA/Livermore Immutability.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["json", "summary"],
          description: "Output format: structured JSON or human-readable summary",
        },
      },
    },
  },
  {
    name: "eos_black_projects_triad_audit",
    description:
      "Black Projects Triad Operating Doctrine (SPEC-159): Software analogs of Skunk Works Kelly Johnson rules, DARPA OODA, and NRO multi-layer SAR. Denies black-budget/Area-51/Level-5 claims.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["json", "summary"],
          description: "Output format: structured JSON or human-readable summary",
        },
      },
    },
  },
];
