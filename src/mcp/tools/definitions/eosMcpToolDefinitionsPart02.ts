/**
 * EOS MCP TOOL DEFINITIONS — PART 02 of 5 (static "tools/list" schemas).
 * Ordered slice eos_nubank_audit .. eos_zero_copy_scan (51 tools). Pure data (no behavior).
 * Aggregated in order by src/mcp/eosMcpToolDefinitions.ts; do not reorder entries.
 */
import type { EosMcpToolDefinitionInput } from "./eosMcpToolDefinitionTypes.ts";

export const EOS_MCP_TOOL_DEFINITIONS_PART_02: ReadonlyArray<EosMcpToolDefinitionInput> = [
  {
    name: "eos_nubank_audit",
    description:
      "Audits any service or system against the 6 Building Nu institutional engineering pillars (https://building.nu.com/).",
    inputSchema: {
      type: "object",
      properties: {
        hasMutableStateInDomain: { type: "boolean", description: "Whether mutable state exists in the domain layer" },
        usesHexagonalLayerIsolation: { type: "boolean", description: "Whether hexagonal isolation is enforced" },
        usesContractTestingInsteadOfE2E: {
          type: "boolean",
          description: "Whether consumer-driven contracts (Sachem) are used",
        },
        enforcesKafkaIdempotencyTokens: {
          type: "boolean",
          description: "Whether Kafka idempotency tokens are verified",
        },
        usesImmutableBitemporalLedgers: {
          type: "boolean",
          description: "Whether Datomic/append-only immutable ledgers are used",
        },
        hasBlamelessPostmortemProcess: {
          type: "boolean",
          description: "Whether Nu blameless postmortems are practiced",
        },
        unitTestCoveragePercent: { type: "number", description: "Pure domain unit test coverage percentage" },
      },
    },
  },
  {
    name: "eos_nubank_sachem_verify",
    description:
      "Verifies consumer-driven contract schema backward and forward compatibility according to Nubank Sachem standards.",
    inputSchema: {
      type: "object",
      properties: {
        previousSchema: { type: "object", description: "The active production schema definition" },
        proposedSchema: { type: "object", description: "The proposed evolution schema definition" },
      },
      required: ["previousSchema", "proposedSchema"],
    },
  },
  {
    name: "eos_nubank_postmortem",
    description:
      "Synthesizes an institutional, certified blameless postmortem adhering to Nu SRE guidelines (building.nu.com).",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Unique incident identifier (e.g. INC-2026-NU-001)" },
        title: { type: "string", description: "Incident title" },
        severity: { type: "string", enum: ["SEV1", "SEV2", "SEV3"], description: "Incident severity tier" },
        owningSquad: { type: "string", description: "Squad responsible for the impacted services" },
        affectedServices: { type: "array", items: { type: "string" }, description: "List of affected service names" },
        customerImpact: { type: "string", description: "Description and percentage of customer impact" },
        startTime: { type: "string", description: "UTC start timestamp" },
        resolutionTime: { type: "string", description: "UTC resolution timestamp" },
        durationMinutes: { type: "number", description: "Outage duration in minutes" },
        timeline: { type: "array", description: "Chronological timeline of events" },
        fiveWhys: { type: "array", items: { type: "string" }, description: "5 Whys root cause analysis" },
        cognitiveFactors: {
          type: "array",
          items: { type: "string" },
          description: "Systemic/cognitive ergonomics observations",
        },
        systemicRemediations: { type: "array", description: "Action items with owners and deadlines" },
      },
      required: [
        "incidentId",
        "title",
        "severity",
        "owningSquad",
        "affectedServices",
        "customerImpact",
        "startTime",
        "resolutionTime",
        "durationMinutes",
        "timeline",
        "fiveWhys",
        "cognitiveFactors",
        "systemicRemediations",
      ],
    },
  },
  {
    name: "eos_nubank_datomic_transact",
    description:
      "Executes an immutable Datomic bitemporal transaction simulation with Datom assertions/retractions and Merkle hashing.",
    inputSchema: {
      type: "object",
      properties: {
        txData: {
          type: "array",
          description: "List of Datom operations to transact: [{ entityId, attribute, value, op? }]",
        },
      },
      required: ["txData"],
    },
  },
  {
    name: "eos_spotify_audit_institutional",
    description:
      "Audits a service against the 6 Spotify Institutional Engineering Pillars (https://engineering.atspotify.com/).",
    inputSchema: {
      type: "object",
      properties: {
        usesGoldenPath: { type: "boolean", description: "Whether service adheres to a Backstage Golden Path" },
        hasCatalogInfoYaml: { type: "boolean", description: "Whether catalog-info.yaml is present" },
        hasTechDocsAndRunbook: { type: "boolean", description: "Whether TechDocs and on-call runbook are present" },
        compliesWithBS1770Loudness: {
          type: "boolean",
          description: "Whether audio complies with -14.0 LUFS and -1.0 dBTP",
        },
        hasProgressiveCanaryPipeline: {
          type: "boolean",
          description: "Whether progressive canary rollout is configured",
        },
        hasAutomatedKillSwitch: {
          type: "boolean",
          description: "Whether automated fail-closed rollback is configured",
        },
        hasBlamelessPostmortemProcess: {
          type: "boolean",
          description: "Whether blameless SRE postmortems are practiced",
        },
        unitTestCoveragePercent: { type: "number", description: "Unit test coverage percentage" },
      },
    },
  },
  {
    name: "eos_spotify_golden_path_verify",
    description: "Validates repository metadata against Spotify Backstage RFC-42 Golden Path and Soundcheck standards.",
    inputSchema: {
      type: "object",
      properties: {
        serviceName: { type: "string", description: "Name of the component" },
        filesPresent: { type: "array", items: { type: "string" }, description: "Files present in the repository" },
        catalogInfoContent: { type: "string", description: "Raw content of catalog-info.yaml" },
      },
      required: ["serviceName", "filesPresent"],
    },
  },
  {
    name: "eos_spotify_canary_gate",
    description:
      "Evaluates progressive canary rollout metrics and enforces automated kill-switch fail-closed thresholds.",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string", enum: ["1%", "5%", "25%", "100%"], description: "Current canary stage" },
        trafficPercentage: { type: "number", description: "Active traffic percentage" },
        totalRequests: { type: "number", description: "Total requests evaluated" },
        errorCount: { type: "number", description: "Number of failed requests" },
        p99LatencyMs: { type: "number", description: "Observed p99 latency in milliseconds" },
        maxAllowedP99Ms: { type: "number", description: "Maximum allowed p99 latency budget" },
        observationWindowMinutes: { type: "number", description: "Observation window in minutes" },
      },
      required: [
        "stage",
        "trafficPercentage",
        "totalRequests",
        "errorCount",
        "p99LatencyMs",
        "maxAllowedP99Ms",
        "observationWindowMinutes",
      ],
    },
  },
  {
    name: "eos_spotify_fleetshift_plan",
    description:
      "Generates an automated batch transformation plan for multi-repository fleets according to Spotify Fleetshift standards.",
    inputSchema: {
      type: "object",
      properties: {
        migrationId: { type: "string", description: "Unique migration ID" },
        description: { type: "string", description: "Migration objective" },
        targetRepos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
            },
            required: ["id", "name"],
          },
          description: "Repositories targeted by the migration",
        },
        action: { type: "string", description: "Codemod or migration action identifier" },
      },
      required: ["migrationId", "description", "targetRepos", "action"],
    },
  },
  {
    name: "eos_apex_route_model",
    description:
      "Routes any engineering directive to the optimal frontier AI model (Gemini, Claude, GPT, DeepSeek, Grok) based on cognitive specialization and FinOps cost budgets.",
    inputSchema: {
      type: "object",
      properties: {
        directivePrompt: { type: "string", description: "Engineering task prompt or directive" },
        sourceContext: { type: "string", description: "Optional source code context to compress and analyze" },
      },
      required: ["directivePrompt"],
    },
  },
  {
    name: "eos_apex_compress_context",
    description:
      "Compresses source code context by 70-85% using AST symbol outline extraction, keeping all public types, interfaces and signatures while pruning internal bodies.",
    inputSchema: {
      type: "object",
      properties: {
        sourceContent: { type: "string", description: "Full source code to compress" },
        fileName: { type: "string", description: "Source file name or path" },
      },
      required: ["sourceContent"],
    },
  },
  {
    name: "eos_apex_autonomous_heal",
    description:
      "Checks one local file for trailing whitespace and CRLF. It returns a local heuristic report; writing requires apply=true and is limited to files inside the configured project root.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Project-relative path to a regular file" },
        apply: { type: "boolean", description: "Only the JSON boolean true writes local formatting fixes." },
      },
      required: ["filePath"],
    },
  },
  {
    name: "eos_apex_go_benchmark",
    description:
      "Executes the native Go high-concurrency token processing benchmark (> 50,000,000 tokens/sec across goroutines) with sub-microsecond telemetry.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_wasm_benchmark",
    description:
      "Executes client/runtime benchmark in WebAssembly or Layer-0 TS measuring tokens/sec and memory allocations (0 B/op).",
    inputSchema: {
      type: "object",
      properties: {
        iterations: { type: "number", description: "Number of benchmark iterations (default: 100000)" },
      },
    },
  },
  {
    name: "eos_wasm_compress",
    description:
      "Dual-mode WebAssembly / Layer-0 TypeScript AST outline compressor pruning bodies and blank lines while preserving signatures.",
    inputSchema: {
      type: "object",
      properties: {
        sourceCode: { type: "string", description: "Source code to compress" },
        targetTokens: { type: "number", description: "Target tokens budget" },
      },
      required: ["sourceCode"],
    },
  },
  {
    name: "eos_topology_blast_radius",
    description:
      "Calculates the deterministic recursive blast radius, impacted node list, and propagation latency for any of the 14 Sovereign Fleet nodes.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: {
          type: "string",
          description: "Target node identifier (e.g. 'eos-core', 'aberamentho', 'disruptor-ring')",
        },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "eos_soul_alignment",
    description:
      "Evaluates an engineering directive against Valentín Flórez Arbeláez's Master Purpose Matrix and Kanban Plan ('SOLO EOS').",
    inputSchema: {
      type: "object",
      properties: {
        directive: { type: "string", description: "Directive or task description to evaluate" },
      },
      required: ["directive"],
    },
  },
  {
    name: "eos_autonomous_introspect",
    description:
      "Executes autonomous codebase self-study, calculating LOC, L0 purity, and synthesizing self-evolution improvement proposals (RFCs).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_military_shield_audit",
    description:
      "Executes top-tier military and air-gapped security audit: formal invariants, Merkle Chain-of-Thought, and EosAin zero-entropy heap wipe.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_query_topology",
    description:
      "Queries the complete 14-node Sovereign Fleet topology, 3 concentric rings, edge links, and global graph metrics.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_model_route",
    description:
      "Routes an engineering directive to the optimal specialized frontier AI model (Gemini, Claude, GPT, DeepSeek, Grok) with cognitive rationale.",
    inputSchema: {
      type: "object",
      properties: {
        directivePrompt: { type: "string", description: "Natural language directive or prompt" },
        sourceContext: { type: "string", description: "Optional code or context snippet" },
      },
      required: ["directivePrompt"],
    },
  },
  {
    name: "eos_datalog_query",
    description:
      "Runs deductive fixpoint evaluation in Datalog (Google Piper/Mangle style) to calculate transitive blast radius and required test suites for a modified module.",
    inputSchema: {
      type: "object",
      properties: {
        targetModule: { type: "string", description: "Path to modified module (e.g., src/core/eosJarvisSoul.ts)" },
      },
      required: ["targetModule"],
    },
  },
  {
    name: "eos_mutation_test",
    description:
      "Executes AST bug mutation testing (Testing the Tests) by altering relational, boolean, and arithmetic operators to measure test suite killing score.",
    inputSchema: {
      type: "object",
      properties: {
        targetSnippet: { type: "string", description: "Source code or file path to mutate and audit" },
      },
      required: ["targetSnippet"],
    },
  },
  {
    name: "eos_time_travel_simulate",
    description:
      "Runs deterministic discrete time-travel simulation hypervisor reproducing concurrency races bit-for-bit with an integer seed.",
    inputSchema: {
      type: "object",
      properties: {
        seed: { type: "number", description: "Deterministic integer PRNG seed (default 948102)" },
        maxEvents: { type: "number", description: "Maximum simulation steps to run (default 50)" },
      },
    },
  },
  {
    name: "eos_wal_status",
    description:
      "Inspects physical bitemporal Write-Ahead Log (WAL) statistics, hardware durability state, and transaction commit counters.",
    inputSchema: {
      type: "object",
      properties: {
        walPath: {
          type: "string",
          description: "Optional path to binary WAL file (defaults to data/eos_bitemporal.wal)",
        },
      },
    },
  },
  {
    name: "eos_prometheus_metrics",
    description: "Generates real-time CNCF / Prometheus format text metrics (v0.0.4) for system observability.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_sandbox_evaluate",
    description:
      "Evaluates prospective code patches within an in-memory hermetic Copy-on-Write sandbox, verifying syntax and secrets with zero physical disk writes.",
    inputSchema: {
      type: "object",
      properties: {
        relPath: { type: "string", description: "Target relative file path (e.g. src/example.ts)" },
        content: { type: "string", description: "Proposed code content to evaluate" },
      },
      required: ["relPath", "content"],
    },
  },
  {
    name: "eos_simulate_bounded_models",
    description:
      "Runs bounded JavaScript simulations and extracts candidate names from TLA+ text files. It does not parse TLA+ syntax or run TLC model checking.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_simulate_jepsen_partition",
    description:
      "Runs Jepsen-style distributed network partition and packet drop simulation on consensus replicas to verify split-brain prevention.",
    inputSchema: {
      type: "object",
      properties: {
        dropRate: { type: "number", description: "Packet drop probability 0.0 - 1.0 (default 0.0)" },
        maxEvents: { type: "number", description: "Simulation event horizon (default 30)" },
      },
    },
  },
  {
    name: "eos_vault_memory_audit",
    description:
      "Audits the hardened non-serializable Uint8Array memory vault and executes zero-entropy cryptographic wiping.",
    inputSchema: {
      type: "object",
      properties: {
        wipeAll: { type: "boolean", description: "Whether to execute in-place zero-entropy wipe on all stored tokens" },
      },
    },
  },
  {
    name: "eos_gnostic_temple_audit",
    description:
      "Audits Three-Brain energy distribution (Intellectual, Emotional, Motor) and verifies circadian nightly screen veto per V.M. Samael Aun Weor.",
    inputSchema: {
      type: "object",
      properties: {
        intellectualHours: { type: "number", description: "Hours dedicated to intellectual coding/study" },
        emotionalHours: { type: "number", description: "Hours dedicated to high-vibration classical music/art" },
        motorHours: { type: "number", description: "Hours dedicated to physical gym/temple hygiene" },
      },
    },
  },
  {
    name: "eos_finops_budget_check",
    description:
      "Audits real-time micro-cent LLM token spend, verifies remaining balance against the $15.00 USD monthly limit, and inspects sacred Cajitas partitions.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_clave_de_sol_evaluate",
    description:
      "Evaluates the Clave de SOL (Subject, Object, Place) and calculates consciousness awake score (0-100) with theurgic advice.",
    inputSchema: {
      type: "object",
      properties: {
        subjectAware: { type: "boolean", description: "Awareness of oneself as the observer" },
        objectFocused: { type: "boolean", description: "Immersed in current action without mental wandering" },
        placePresent: { type: "boolean", description: "Grounded in physical body and physical space" },
      },
      required: ["subjectAware", "objectFocused", "placePresent"],
    },
  },
  {
    name: "eos_nano_benchmark",
    description:
      "Executes nanosecond-resolution statistical micro-benchmarks reporting p50, p90, p99, p99.99 latencies, jitter, and ops/sec.",
    inputSchema: {
      type: "object",
      properties: {
        iterations: { type: "number", description: "Sample iterations (default 5000)" },
      },
    },
  },
  {
    name: "eos_sentinel_tick",
    description:
      "Executes a 24/7 sovereign heartbeat tick evaluating Merkle roots, memory pressure, and fleet FDIR graph topology.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_alchemical_transmute",
    description:
      "Computes Shannon character entropy, cyclomatic density, and certifies Nous purity score (0-100%) mapped to the 7 Cosmic Notes of the Law of Octaves.",
    inputSchema: {
      type: "object",
      properties: {
        relPath: { type: "string", description: "Target source code file path" },
      },
    },
  },
  {
    name: "eos_bitwise_accelerate",
    description: "Executes 4x unrolled IEEE 802.3 CRC32 and 64-bit FNV-1a superscalar hashing benchmarks.",
    inputSchema: {
      type: "object",
      properties: {
        bufferSize: { type: "number", description: "Buffer size in bytes (default 65536)" },
        iterations: { type: "number", description: "Iterations (default 1000)" },
      },
    },
  },
  {
    name: "eos_buffer_pool_stats",
    description: "Inspects zero-allocation slab buffer pool statistics, hit rates, and GC elimination metrics.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_introspect_mind_levels",
    description:
      "Introspects psychological impressions across all 49 subconscious levels of the mind with Devi Kundalini dissolution formula and liberated essence metric (Samael Aun Weor standard).",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Psychological reaction or impression text" },
        category: {
          type: "string",
          enum: ["ANGER", "PRIDE", "LUST", "GREED", "FEAR", "SLOTH", "GLUTTONY", "IMPATIENCE", "DISPERSAL"],
        },
        observedCenter: { type: "string", enum: ["INTELLECTUAL", "EMOTIONAL", "MOTOR", "INSTINCTIVE", "SEXUAL"] },
        consciousSelfObservation: { type: "boolean", description: "Clave de SOL active?" },
        deepMeditationPenetrationLevel: { type: "number", description: "Depth level 1 to 49" },
      },
      required: ["description", "category"],
    },
  },
  {
    name: "eos_three_mountains_status",
    description:
      "Evaluates daily life alignment against the Three Mountains of Gnosis, the Daily Trinity, El Refugio mortgage protection, and the Architect Codex of Valentin Florez Arbelaez.",
    inputSchema: {
      type: "object",
      properties: {
        nutritiousFoodLogged: { type: "boolean" },
        impeccableCleanliness: { type: "boolean" },
        dailyExerciseCompleted: { type: "boolean" },
        layer0SoftwareFocusOnly: { type: "boolean" },
        cajitasBudgetRespected: { type: "boolean" },
        claveDeSolPracticed: { type: "boolean" },
        circadianScreenVetoRespected: { type: "boolean" },
        selflessServiceOrDonation: { type: "boolean" },
      },
    },
  },
  {
    name: "eos_autotuner_tick",
    description:
      "Executes an adaptive Layer-0 autotuning tick: measures event-loop lag, evaluates V8 heap fragmentation, resizes ring buffers dynamically, and produces Prometheus metrics.",
    inputSchema: {
      type: "object",
      properties: {
        queueDepth: { type: "number", description: "Instantaneous incoming queue depth (default: 0)" },
      },
    },
  },
  {
    name: "eos_nsa_encrypt",
    description:
      "Encrypts payload using military-grade CNSA 2.0 AES-256-GCM with AAD binding for classification and compartment.",
    inputSchema: {
      type: "object",
      properties: {
        plaintext: { type: "string", description: "Payload to encrypt" },
        classification: { type: "string", enum: ["UNCLASSIFIED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"] },
        compartment: { type: "string", description: "Security compartment identifier" },
      },
      required: ["plaintext"],
    },
  },
  {
    name: "eos_nsa_zero_trust_check",
    description:
      "Audits Bell-LaPadula Simple Security (No Read-Up) and *-Property (No Write-Down) for a given subject and object.",
    inputSchema: {
      type: "object",
      properties: {
        subjectClearance: { type: "string", enum: ["UNCLASSIFIED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"] },
        subjectCompartments: { type: "array", items: { type: "string" } },
        objectClassification: { type: "string", enum: ["UNCLASSIFIED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"] },
        objectCompartments: { type: "array", items: { type: "string" } },
        action: { type: "string", enum: ["READ", "WRITE"] },
      },
      required: ["subjectClearance", "objectClassification", "action"],
    },
  },
  {
    name: "eos_nsa_audit_logs",
    description: "Inspects the SHA-384 cryptographically sealed Red/Black Mandatory Access Control audit trail.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_consensus_status",
    description: "Inspects planetary Raft/Paxos quorum consensus, active leader, and state hash.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_truetime_now",
    description:
      "Queries Google Spanner TrueTime bounded interval [earliest, latest] with commit-wait linearizability guarantee.",
    inputSchema: {
      type: "object",
      properties: {
        epsilonMs: { type: "number", description: "Clock drift uncertainty parameter in ms (default 2.0)" },
      },
    },
  },
  {
    name: "eos_adaptive_concurrency_stats",
    description: "Inspects Netflix Vegas adaptive concurrency limits, RTT gradient, and load-shedding metrics.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_hash_ring_lookup",
    description:
      "Performs O(log(N*V)) Amazon Dynamo consistent hash ring lookup and multi-DC preference list calculation.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Partition key to route" },
        nodes: { type: "array", items: { type: "string" }, description: "Optional cluster nodes list" },
        replicas: { type: "number", description: "Replication factor R (default: 3)" },
      },
      required: ["key"],
    },
  },
  {
    name: "eos_merkle_sync_diff",
    description: "Compares hierarchical Dynamo Merkle trees to detect out-of-sync key ranges in O(log K).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_token_bucket_check",
    description: "Evaluates Cloudflare-grade nanosecond monotonic token-bucket edge rate limiting.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client/tenant identifier" },
        cost: { type: "number", description: "Tokens requested (default 1)" },
        capacity: { type: "number", description: "Burst capacity (default 10)" },
        refillPerSecond: { type: "number", description: "Refill rate (default 20)" },
      },
    },
  },
  {
    name: "eos_hft_ipc_dispatch",
    description:
      "Dispatches commands via Citadel HFT resident Go daemon IPC or pure L0 fallback with sub-millisecond latency.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "Action: ping, benchmark, route, status" },
        payload: { type: "object", description: "Arbitrary request parameters" },
      },
      required: ["action"],
    },
  },
  {
    name: "eos_zero_copy_scan",
    description: "Performs SpaceX/ASML zero-allocation mechanical sympathy token scanning directly over byte buffers.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Source code or text to scan" },
        filePath: { type: "string", description: "Optional file path to read and scan" },
      },
    },
  },
];
