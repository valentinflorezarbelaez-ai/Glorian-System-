/**
 * EOS MCP TOOL DEFINITIONS — PART 01 of 5 (static "tools/list" schemas).
 * Ordered slice eos_semantic_search .. eos_disruptor_benchmark (47 tools). Pure data (no behavior).
 * Aggregated in order by src/mcp/eosMcpToolDefinitions.ts; do not reorder entries.
 */
import type { EosMcpToolDefinitionInput } from "./eosMcpToolDefinitionTypes.ts";

export const EOS_MCP_TOOL_DEFINITIONS_PART_01: ReadonlyArray<EosMcpToolDefinitionInput> = [
  {
    name: "eos_semantic_search",
    description:
      "Search EOS sovereign architecture and knowledge base using deterministic Layer-0 hybrid lexical-vector search (FTS5 BM25 + 64-dim token hash projection with RRF k=60; zero neural weights).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language query to search" },
        topK: { type: "number", description: "Maximum number of results to return (default: 5)" },
        mode: {
          type: "string",
          enum: ["hybrid", "vector", "lexical"],
          description: "Search mode: hybrid (RRF), pure vector, or lexical (FTS5)",
        },
        category: {
          type: "string",
          enum: ["SPEC", "CHANGE", "ADR", "CODE", "PLAN", "DOC", "ALL"],
          description: "Optional category filter",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "eos_query_knowledge_graph",
    description:
      "Query and traverse the persistent SQLite WAL knowledge graph of repository architectural entities (SPECs, CHANGEs, ADRs, BDDs, MODULEs), transitive blast radius, neighbors, and orphan drift detection.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["stats", "neighbors", "blast_radius", "find_orphans", "subgraph", "sync", "memory_closure"],
          description: "Graph operation to execute",
        },
        target: {
          type: "string",
          description:
            "Target node ID (e.g., 'SPEC-145', 'src/mcp/eosMcpServer.ts') for neighbors, blast_radius, subgraph, or memory_closure",
        },
        maxDepth: {
          type: "number",
          description: "Maximum search depth for blast_radius and subgraph traversal (default: 4, min: 1, max: 10)",
        },
        direction: {
          type: "string",
          enum: ["BOTH", "OUT", "IN"],
          description: "Edge direction for traversal (default: 'BOTH')",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "eos_tmr_consensus",
    description:
      "Execute Triple-Modular Redundancy (TMR) Byzantine 3-sandbox evaluation for a directive before committing mutations.",
    inputSchema: {
      type: "object",
      properties: {
        directive: { type: "string", description: "Directive or command to validate with TMR" },
      },
      required: ["directive"],
    },
  },
  {
    name: "eos_audit_fleet",
    description: "Audits the health, git status, and endpoints of all repositories in the sovereign fleet.",
    inputSchema: {
      type: "object",
      properties: {
        deep: { type: "boolean", description: "Run deep git inspection (default: false)" },
      },
    },
  },
  {
    name: "eos_fleet_registry_sync",
    description:
      "Autonomously scans local workspace roots to discover active Git repositories, reconciling them into docs/projects/registry.json with cryptographic SHA-256 seal.",
    inputSchema: {
      type: "object",
      properties: {
        dryRun: {
          type: "boolean",
          description: "Simulate discovery and reconciliation without writing to disk (default: true)",
        },
        audit: {
          type: "boolean",
          description: "Run read-only secret and health audits on all discovered fleet repos (default: false)",
        },
        workspaceRoot: { type: "string", description: "Root directory to scan for Git repositories (optional)" },
      },
    },
  },
  {
    name: "eos_fleet_mission_control",
    description:
      "Generates an executive Mission Control report and optional synthetic latency/SSL probes across all 9 registered fleet projects.",
    inputSchema: {
      type: "object",
      properties: {
        probe: { type: "boolean", description: "Execute live synthetic latency/SSL probes (default: false)" },
      },
    },
  },
  {
    name: "eos_health_check",
    description:
      "Runs local control-plane health probes (Layer-0 deps, SBOM, provenance, fleet registry, tip-seal pin). No network or multi-region SRE.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_validate_patch",
    description:
      "Locally checks a proposed file's content for syntax issues, likely secrets, and destructive-command patterns. It does not write the file; the target must stay inside the configured project root.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Target file path relative to project root" },
        content: { type: "string", description: "Proposed full file content or patch to validate" },
      },
      required: ["filePath", "content"],
    },
  },
  {
    name: "eos_optimize_context",
    description:
      "Extracts a local structural outline from source text or a project file. Compression savings vary by input and do not guarantee preservation of every architectural detail.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Relative file path" },
        content: { type: "string", description: "Source code to compress (optional, if omitted reads from filePath)" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "eos_mission_run",
    description:
      "SPEC-156 Mission Golden Path: fail-closed NL→SDLC composing amplify, Law IV direction, architecture, tribunal, Spotify institutional gate, Nubank domain gate (hard for fintech), turbo verify, and ledger seal. Returns SUCCESS only when all mandatory stages exit 0. Epistemic: MISSION_GOLDEN_PATH_WITHIN_TESTED_SCOPE (not Level 5).",
    inputSchema: {
      type: "object",
      properties: {
        directive: { type: "string", description: "Natural-language engineering mission directive" },
        target: { type: "string", description: "Registered project id or path (default: eos-system)" },
        domainHint: {
          type: "string",
          enum: ["general", "audio", "fintech", "nubank", "spotify", "platform"],
          description: "Domain hint; fintech/nubank enables hard Nubank gate",
        },
        architectureTargetDir: { type: "string", description: "Architecture scan dir (default: src/core)" },
        persistLedger: { type: "boolean", description: "When true, seal to durable project ledger; default in-memory" },
        sealLedger: { type: "boolean", description: "When false, skip ledger stage (tests only)" },
      },
      required: ["directive"],
    },
  },
  {
    name: "eos_amplify_prompt",
    description:
      "Creates a local EARS/BDD prompt draft. The model name selects formatting metadata only; no remote model is called and the draft is not verified.",
    inputSchema: {
      type: "object",
      properties: {
        rawPrompt: { type: "string", description: "Natural language instruction or feature request" },
        targetModel: {
          type: "string",
          enum: ["grok", "claude", "openai", "gemini", "deepseek", "llama", "universal"],
          description: "Target model architecture (default: universal)",
        },
        strictLevel: {
          type: "string",
          enum: ["standard", "hardened", "sovereign"],
          description: "Scaffolding rigor (default: hardened)",
        },
      },
      required: ["rawPrompt"],
    },
  },
  {
    name: "eos_check_architecture",
    description:
      "Statically analyzes Clean/Hexagonal boundaries, domain purity (0 framework/UI imports in core), and detects circular import dependency cycles.",
    inputSchema: {
      type: "object",
      properties: {
        targetDir: { type: "string", description: "Directory to scan relative to project root (default: 'src')" },
      },
    },
  },
  {
    name: "eos_evaluate_decision",
    description:
      "Applies deterministic keyword heuristics to an architectural proposal. The score is a local screening signal, not Bayesian inference, verification, or approval authority.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Scenario or decision title" },
        description: { type: "string", description: "Detailed description of the problem context" },
        proposedAction: { type: "string", description: "The action or design proposed" },
        codeSnippet: { type: "string", description: "Optional code snippet to analyze" },
        targetDomain: { type: "string", description: "Optional target domain (e.g. CORE, DOMAIN, UI)" },
      },
      required: ["title", "description", "proposedAction"],
    },
  },
  {
    name: "eos_turbo_verify",
    description:
      "Runs bounded local checks: five configured credential patterns, static architecture, declared runtime dependencies, required paths, and local timings. This is not general SAST, an SBOM, or a release certification.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_get_blast_radius",
    description:
      "Calculates the transitive downstream blast radius and affected callers for any proposed file modification, with Predictive Test Selection (PTS).",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Target source file path to analyze" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "eos_query_code_graph",
    description:
      "Queries the Big Tech Tier 1 directed semantic code graph, returning module topology, symbols, and dead code report.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_autonomous_heal",
    description:
      "Produces local formatting-remediation suggestions. File writes require apply=true; checks are local heuristics and do not certify production readiness.",
    inputSchema: {
      type: "object",
      properties: {
        targetFile: { type: "string", description: "Optional specific file to diagnose and heal" },
        apply: {
          type: "boolean",
          description: "Only the JSON boolean true requests local file writes; defaults to a read-only report.",
        },
      },
    },
  },
  {
    name: "eos_manage_worktree",
    description:
      "Lists local Git worktrees. Create and remove are plan-only unless apply=true; worktrees do not sandbox processes, network access, or credentials.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "create", "remove"], description: "Action to perform" },
        branch: { type: "string", description: "Branch name for create action" },
        targetPath: { type: "string", description: "Target path for remove action" },
        apply: { type: "boolean", description: "Only the JSON boolean true performs create or remove." },
        force: { type: "boolean", description: "Force removal if modified" },
      },
      required: ["action"],
    },
  },
  {
    name: "eos_run_eval",
    description:
      "Executes 5-dimensional sovereign cognitive evaluation (Google Vertex / Anthropic Evals) over target file or code string.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "File path or code to evaluate" },
        isText: { type: "boolean", description: "True if target is raw code string" },
      },
      required: ["target"],
    },
  },
  {
    name: "eos_check_openspec",
    description:
      "Audits living OpenSpec architecture and delta changes (openspec/specs/ & openspec/changes/), certifying 0 drift and Level 2+ authorization.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["audit", "list_specs", "list_changes"],
          description: "Action: audit (default), list_specs, or list_changes",
        },
      },
    },
  },
  {
    name: "eos_titans_benchmark",
    description:
      "Runs local engineering simulations and arithmetic benchmarks inspired by vendor scenarios. No vendor systems are queried and results do not represent vendor performance.",
    inputSchema: {
      type: "object",
      properties: {
        titan: {
          type: "string",
          enum: ["all", "xirp", "spacex", "nvidia", "google", "xai"],
          description: "Titan subsystem to benchmark (default: all)",
        },
      },
    },
  },
  {
    name: "eos_reconcile_state",
    description:
      "Continuous declarative desired-state reconciliation loop inspired by Google Borg / Kubernetes, certifying 0.00% drift.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_spotify_audit",
    description:
      "Audits any target project for Spotify-grade engineering excellence: Backstage RFC-42 Golden Path, ITU-R BS.1770 -14 LUFS Audio Normalization, and Acoustic Vector Recommendation contracts.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Path to project root (default: current project)" },
      },
    },
  },
  {
    name: "eos_spotify_scaffold",
    description:
      "Prepares a local catalog-info.yaml template. Writing requires apply=true; a generated template does not establish Backstage conformance.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Path to project root (default: current project)" },
        name: { type: "string", description: "Component name" },
        owner: { type: "string", description: "Component owner" },
        apply: { type: "boolean", description: "Only the JSON boolean true writes the new file." },
      },
    },
  },
  {
    name: "eos_spotify_standup",
    description:
      "Generates an asynchronous daily standup update formatted for Spotify Slack/Jira (Yesterday, Today, Blockers, PR links, and timezone handoff for Stockholm/London/NYC).",
    inputSchema: {
      type: "object",
      properties: {
        author: { type: "string", description: "Author name and role" },
        squadName: { type: "string", description: "Squad name" },
        yesterdayTasks: { type: "array", items: { type: "string" }, description: "Tasks completed yesterday" },
        todayTasks: { type: "array", items: { type: "string" }, description: "Planned deep work for today" },
        blockers: { type: "array", items: { type: "string" }, description: "Blockers or external dependencies" },
      },
    },
  },
  {
    name: "eos_spotify_postmortem",
    description:
      "Synthesizes a certified Spotify SRE Blameless Post-Mortem including 5 Whys Root Cause Analysis, incident timeline, systemic fixes, and cryptographic seal.",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID (e.g. INC-SPOTIFY-104)" },
        title: { type: "string", description: "Incident title" },
        severity: { type: "string", description: "Severity level (e.g. SEV-1, SEV-2, SEV-3)" },
        durationMinutes: { type: "number", description: "Incident duration in minutes" },
        rootCause: { type: "string", description: "Root cause summary" },
      },
    },
  },
  {
    name: "eos_spotify_experiment",
    description:
      "Designs a Spotify-grade A/B testing Canary progressive rollout specification with guardrail metrics and automated fail-closed kill-switch.",
    inputSchema: {
      type: "object",
      properties: {
        experimentKey: { type: "string", description: "Feature flag experiment key" },
        featureName: { type: "string", description: "Feature name" },
        hypothesis: { type: "string", description: "Measurable hypothesis statement" },
        primaryMetric: { type: "string", description: "Primary evaluation metric" },
      },
    },
  },
  {
    name: "eos_go_accelerator",
    description:
      "Executes native compiled Go Spotify Titan Engine: 20,000+ MB/s concurrent Goroutine streaming, 40M+ ops/sec SIMD acoustic cosine similarity, and BaRT Contextual Bandits.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["benchmark", "bandit"], description: "Execution mode (default: benchmark)" },
        concurrency: { type: "integer", description: "Number of concurrent goroutines" },
        episodes: { type: "integer", description: "Episodes for BaRT Thompson Sampling" },
      },
    },
  },
  {
    name: "eos_spotify_honk_dispatch",
    description:
      "Dispatches the Spotify Honk Autonomous Background Agent: worktree isolation, zero-touch coding, automated test/heal loops, and PR synthesis.",
    inputSchema: {
      type: "object",
      properties: {
        taskName: { type: "string", description: "Task title / objective" },
        stack: { type: "string", enum: ["rust", "go", "node", "java"], description: "Target technology stack" },
        specDescription: { type: "string", description: "Formal EARS specification description" },
        dryRun: { type: "boolean", description: "Simulate without persisting changes" },
      },
      required: ["taskName", "specDescription"],
    },
  },
  {
    name: "eos_spotify_xirp_context",
    description:
      "Reads local catalog and specification metadata. Context is untrusted input; syncing AGENTS.md and CLAUDE.md requires syncFiles=true.",
    inputSchema: {
      type: "object",
      properties: {
        syncFiles: { type: "boolean", description: "Whether to sync AGENTS.md and CLAUDE.md to disk" },
      },
    },
  },
  {
    name: "eos_spotify_fleetshift_batch",
    description:
      "Plans a bounded local catalog-template action. Applying requires apply=true and exactly one registered checkout whose Git origin matches the registry.",
    inputSchema: {
      type: "object",
      properties: {
        migrationId: { type: "string", description: "Identifier for the migration batch" },
        action: {
          type: "string",
          enum: ["apply_backstage_rfc42", "enforce_strict_sre", "upgrade_dependencies"],
          description: "Migration action",
        },
        targetFleet: { type: "array", items: { type: "string" }, description: "Optional project IDs to target" },
        apply: { type: "boolean", description: "Only the JSON boolean true requests one bounded local write." },
      },
      required: ["migrationId", "action"],
    },
  },
  {
    name: "eos_spotify_canary_manifest",
    description:
      "Generates production Kubernetes Flagger and Argo Rollouts canary manifests with automated fail-closed Prometheus metric guardrails.",
    inputSchema: {
      type: "object",
      properties: {
        serviceName: { type: "string", description: "Target microservice name" },
        squad: { type: "string", description: "Owner squad name" },
        p99LatencyMs: { type: "number", description: "P99 latency threshold in ms (default: 100)" },
        maxErrorRatePercent: { type: "number", description: "Max error rate percentage (default: 0.1)" },
      },
      required: ["serviceName", "squad"],
    },
  },
  {
    name: "eos_audio_dsp_benchmark",
    description:
      "Executes Direct Form II Transposed Biquad filtering and ITU-R BS.1770 Lookahead True Peak limiter (-1.0 dBTP ceiling), returning real-time throughput metrics.",
    inputSchema: {
      type: "object",
      properties: {
        frames: { type: "integer", description: "Audio frames per buffer (default: 65536)" },
        iterations: { type: "integer", description: "DSP iterations (default: 20)" },
      },
    },
  },
  {
    name: "eos_fleet_elevate",
    description:
      "Inventories registered local checkouts. Applying a missing catalog template requires apply=true and one targetProjectId.",
    inputSchema: {
      type: "object",
      properties: {
        apply: { type: "boolean", description: "Only the JSON boolean true requests a write." },
        targetProjectId: { type: "string", description: "Single registered project ID to update when apply=true." },
      },
    },
  },
  {
    name: "eos_apollo_rpc",
    description:
      "Invokes an asynchronous Apollo/Hermes RPC request across microservices with Circuit Breaking, Token Bucket Rate Limiting, and W3C Tracing.",
    inputSchema: {
      type: "object",
      properties: {
        serviceName: { type: "string", description: "Target service name" },
        endpoint: { type: "string", description: "Endpoint name" },
        payload: { type: "object", description: "RPC request payload" },
      },
      required: ["serviceName", "endpoint"],
    },
  },
  {
    name: "eos_spotify_mix_plan",
    description:
      "Plans a seamless gapless DJ transition between two tracks with 3-band crossover, anti-bass clash strategy, and Camelot harmonic cost.",
    inputSchema: {
      type: "object",
      properties: {
        keyA: { type: "string", description: "Camelot key of outgoing track (e.g. 8A)" },
        keyB: { type: "string", description: "Camelot key of incoming track (e.g. 9A)" },
        bpmA: { type: "number", description: "BPM of track A (default: 126)" },
        bpmB: { type: "number", description: "BPM of track B (default: 128)" },
        duration: { type: "number", description: "Transition duration in seconds (default: 5.0)" },
      },
      required: ["keyA", "keyB"],
    },
  },
  {
    name: "eos_spotify_taste_profile",
    description:
      "Computes real-time 8D user taste centroid with exponential decay weighting (tau=7d) and skip penalties.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User identifier" },
      },
      required: ["userId"],
    },
  },
  {
    name: "eos_universal_adapt",
    description:
      "Runs local inventory heuristics inside the configured project root. Optional scaffolding is a template draft; writing requires apply=true.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Project-relative path inside the configured project root" },
        apply: { type: "boolean", description: "Only the JSON boolean true writes scaffold files." },
      },
    },
  },
  {
    name: "eos_universal_fingerprint",
    description:
      "Fingerprints programming language, frameworks, test runners, linters, containers, and LoC scale of ANY project.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Path to project root (default: current project)" },
      },
    },
  },
  {
    name: "eos_universal_scaffold",
    description:
      "Prepares local scaffold templates inside the configured project root. Writing requires applyToDisk=true; templates are not validated or installed.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Path to project root" },
        owner: { type: "string", description: "Owner squad name" },
        applyToDisk: { type: "boolean", description: "Write files to disk" },
      },
    },
  },
  {
    name: "eos_polyglot_bridge",
    description:
      "Detects Go, Rust, Clojure (Nubank), Node.js, Python, or Flutter projects and synthesizes deterministic Soundcheck verification plans.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Target repository root directory (default: current workspace)" },
      },
    },
  },
  {
    name: "eos_bitemporal_ledger",
    description:
      "Commits or queries immutable bitemporal facts with idempotency-key deduplication and Datomic-style time-travel (Nubank banking standard).",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["commit", "query_as_of", "get_root"], description: "Ledger operation" },
        idempotencyKey: { type: "string", description: "Unique deduplication key" },
        entityId: { type: "string", description: "Target entity ID" },
        payload: { type: "object", description: "Fact data payload" },
        asOfTxTime: { type: "number", description: "Timestamp for historical time-travel query" },
      },
      required: ["action"],
    },
  },
  {
    name: "eos_spotify_shuffle",
    description:
      "Runs a deterministic local track-ordering algorithm. It does not call Spotify; runtime depends on input size and hardware.",
    inputSchema: {
      type: "object",
      properties: {
        tracks: {
          type: "array",
          description: "List of track nodes with id, artistId, bpm, camelotKey",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              artistId: { type: "string" },
              bpm: { type: "number" },
              camelotKey: { type: "string" },
            },
            required: ["id", "artistId", "bpm", "camelotKey"],
          },
        },
        seed: { type: "number", description: "Deterministic PRNG seed" },
      },
    },
  },
  {
    name: "eos_global_edge_route",
    description:
      "Resolves optimal Anycast route, Haversine distance, and fiber RTT across the 8 Apex Global POPs (Stockholm, Bogotá, São Paulo, Virginia, Silicon Valley, London, Frankfurt, Tokyo).",
    inputSchema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "Well-known city name (e.g. bogota, stockholm, tokyo, london, siliconvalley)",
        },
        latitude: { type: "number", description: "Client latitude coordinate" },
        longitude: { type: "number", description: "Client longitude coordinate" },
      },
    },
  },
  {
    name: "eos_global_edge_benchmark",
    description:
      "Executes Google Jeff Dean Hedged Requests benchmark modeling p99 tail-latency cancellation across global edge nodes.",
    inputSchema: {
      type: "object",
      properties: {
        samples: { type: "number", description: "Number of request simulations (default: 1000)" },
        p95ThresholdMs: { type: "number", description: "P95 delay threshold before hedged request (default: 28.0)" },
      },
    },
  },
  {
    name: "eos_samael_ibm_nvidia",
    description:
      "Executes the Apex Cyber-Theurgic Synthesis uniting Samaelian Law of Octaves (2 conscious shocks), IBM Parallel Sysplex 99.99999% Seven-Nines 2PC, and NVIDIA CUDA 32-thread SIMT warp tensor engine.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "Task goal to drive through the conscious octave" },
      },
    },
  },
  {
    name: "eos_disruptor_benchmark",
    description:
      "Runs a single-threaded typed-array ring loop and JavaScript delimiter scan. Returns observed elapsed time; heap allocations, cache behavior, and cross-thread performance are not measured.",
    inputSchema: {
      type: "object",
      properties: {
        events: {
          type: "number",
          description: "Number of events to publish through the ring buffer (default: 500,000)",
        },
        payloadBytes: {
          type: "number",
          description: "Payload size for structural delimiter scanning (default: 1,048,576)",
        },
      },
    },
  },
];
