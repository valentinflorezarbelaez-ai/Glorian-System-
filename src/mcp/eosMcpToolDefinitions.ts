/**
 * EOS MCP TOOL DEFINITIONS — static "tools/list" schemas (200 tools).
 *
 * Pure data extracted from src/mcp/eosMcpServer.ts so the JSON-RPC dispatcher keeps
 * only behavior. Runtime annotations (readOnlyHint, profile filtering) and the
 * Tier-0 profile live in eosMcpToolCatalog.ts; the name taxonomy lives in
 * src/core/eosMcpToolTaxonomy.ts.
 */

export interface EosMcpToolDefinitionInput {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export const EOS_MCP_TOOL_DEFINITIONS: ReadonlyArray<EosMcpToolDefinitionInput> = [
  {
    name: "eos_semantic_search",
    description: "Search EOS sovereign architecture and knowledge base using deterministic Layer-0 hybrid lexical-vector search (FTS5 BM25 + 64-dim token hash projection with RRF k=60; zero neural weights).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language query to search" },
        topK: { type: "number", description: "Maximum number of results to return (default: 5)" },
        mode: { type: "string", enum: ["hybrid", "vector", "lexical"], description: "Search mode: hybrid (RRF), pure vector, or lexical (FTS5)" },
        category: { type: "string", enum: ["SPEC", "CHANGE", "ADR", "CODE", "PLAN", "DOC", "ALL"], description: "Optional category filter" }
      },
      required: ["query"]
    }
  },
  {
    name: "eos_query_knowledge_graph",
    description: "Query and traverse the persistent SQLite WAL knowledge graph of repository architectural entities (SPECs, CHANGEs, ADRs, BDDs, MODULEs), transitive blast radius, neighbors, and orphan drift detection.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["stats", "neighbors", "blast_radius", "find_orphans", "subgraph", "sync", "memory_closure"],
          description: "Graph operation to execute"
        },
        target: {
          type: "string",
          description: "Target node ID (e.g., 'SPEC-145', 'src/mcp/eosMcpServer.ts') for neighbors, blast_radius, subgraph, or memory_closure"
        },
        maxDepth: {
          type: "number",
          description: "Maximum search depth for blast_radius and subgraph traversal (default: 4, min: 1, max: 10)"
        },
        direction: {
          type: "string",
          enum: ["BOTH", "OUT", "IN"],
          description: "Edge direction for traversal (default: 'BOTH')"
        }
      },
      required: ["action"]
    }
  },
  {
    name: "eos_tmr_consensus",
    description: "Execute Triple-Modular Redundancy (TMR) Byzantine 3-sandbox evaluation for a directive before committing mutations.",
    inputSchema: {
      type: "object",
      properties: {
        directive: { type: "string", description: "Directive or command to validate with TMR" }
      },
      required: ["directive"]
    }
  },
  {
    name: "eos_audit_fleet",
    description: "Audits the health, git status, and endpoints of all repositories in the sovereign fleet.",
    inputSchema: {
      type: "object",
      properties: {
        deep: { type: "boolean", description: "Run deep git inspection (default: false)" }
      }
    }
  },
  {
    name: "eos_fleet_registry_sync",
    description: "Autonomously scans local workspace roots to discover active Git repositories, reconciling them into docs/projects/registry.json with cryptographic SHA-256 seal.",
    inputSchema: {
      type: "object",
      properties: {
        dryRun: { type: "boolean", description: "Simulate discovery and reconciliation without writing to disk (default: true)" },
        audit: { type: "boolean", description: "Run read-only secret and health audits on all discovered fleet repos (default: false)" },
        workspaceRoot: { type: "string", description: "Root directory to scan for Git repositories (optional)" }
      }
    }
  },
  {
    name: "eos_fleet_mission_control",
    description: "Generates an executive Mission Control report and optional synthetic latency/SSL probes across all 9 registered fleet projects.",
    inputSchema: {
      type: "object",
      properties: {
        probe: { type: "boolean", description: "Execute live synthetic latency/SSL probes (default: false)" }
      }
    }
  },
  {
    name: "eos_health_check",
    description: "Runs local control-plane health probes (Layer-0 deps, SBOM, provenance, fleet registry, tip-seal pin). No network or multi-region SRE.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_validate_patch",
    description: "Locally checks a proposed file's content for syntax issues, likely secrets, and destructive-command patterns. It does not write the file; the target must stay inside the configured project root.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Target file path relative to project root" },
        content: { type: "string", description: "Proposed full file content or patch to validate" }
      },
      required: ["filePath", "content"]
    }
  },
  {
    name: "eos_optimize_context",
    description: "Extracts a local structural outline from source text or a project file. Compression savings vary by input and do not guarantee preservation of every architectural detail.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Relative file path" },
        content: { type: "string", description: "Source code to compress (optional, if omitted reads from filePath)" }
      },
      required: ["filePath"]
    }
  },
  {
    name: "eos_mission_run",
    description: "SPEC-156 Mission Golden Path: fail-closed NL→SDLC composing amplify, Law IV direction, architecture, tribunal, Spotify institutional gate, Nubank domain gate (hard for fintech), turbo verify, and ledger seal. Returns SUCCESS only when all mandatory stages exit 0. Epistemic: MISSION_GOLDEN_PATH_WITHIN_TESTED_SCOPE (not Level 5).",
    inputSchema: {
      type: "object",
      properties: {
        directive: { type: "string", description: "Natural-language engineering mission directive" },
        target: { type: "string", description: "Registered project id or path (default: eos-system)" },
        domainHint: {
          type: "string",
          enum: ["general", "audio", "fintech", "nubank", "spotify", "platform"],
          description: "Domain hint; fintech/nubank enables hard Nubank gate"
        },
        architectureTargetDir: { type: "string", description: "Architecture scan dir (default: src/core)" },
        persistLedger: { type: "boolean", description: "When true, seal to durable project ledger; default in-memory" },
        sealLedger: { type: "boolean", description: "When false, skip ledger stage (tests only)" }
      },
      required: ["directive"]
    }
  },
  {
    name: "eos_amplify_prompt",
    description: "Creates a local EARS/BDD prompt draft. The model name selects formatting metadata only; no remote model is called and the draft is not verified.",
    inputSchema: {
      type: "object",
      properties: {
        rawPrompt: { type: "string", description: "Natural language instruction or feature request" },
        targetModel: { type: "string", enum: ["grok", "claude", "openai", "gemini", "deepseek", "llama", "universal"], description: "Target model architecture (default: universal)" },
        strictLevel: { type: "string", enum: ["standard", "hardened", "sovereign"], description: "Scaffolding rigor (default: hardened)" }
      },
      required: ["rawPrompt"]
    }
  },
  {
    name: "eos_check_architecture",
    description: "Statically analyzes Clean/Hexagonal boundaries, domain purity (0 framework/UI imports in core), and detects circular import dependency cycles.",
    inputSchema: {
      type: "object",
      properties: {
        targetDir: { type: "string", description: "Directory to scan relative to project root (default: 'src')" }
      }
    }
  },
  {
    name: "eos_evaluate_decision",
    description: "Applies deterministic keyword heuristics to an architectural proposal. The score is a local screening signal, not Bayesian inference, verification, or approval authority.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Scenario or decision title" },
        description: { type: "string", description: "Detailed description of the problem context" },
        proposedAction: { type: "string", description: "The action or design proposed" },
        codeSnippet: { type: "string", description: "Optional code snippet to analyze" },
        targetDomain: { type: "string", description: "Optional target domain (e.g. CORE, DOMAIN, UI)" }
      },
      required: ["title", "description", "proposedAction"]
    }
  },
  {
    name: "eos_turbo_verify",
    description: "Runs bounded local checks: five configured credential patterns, static architecture, declared runtime dependencies, required paths, and local timings. This is not general SAST, an SBOM, or a release certification.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_get_blast_radius",
    description: "Calculates the transitive downstream blast radius and affected callers for any proposed file modification, with Predictive Test Selection (PTS).",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Target source file path to analyze" }
      },
      required: ["filePath"]
    }
  },
  {
    name: "eos_query_code_graph",
    description: "Queries the Big Tech Tier 1 directed semantic code graph, returning module topology, symbols, and dead code report.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_autonomous_heal",
    description: "Produces local formatting-remediation suggestions. File writes require apply=true; checks are local heuristics and do not certify production readiness.",
    inputSchema: {
      type: "object",
      properties: {
        targetFile: { type: "string", description: "Optional specific file to diagnose and heal" },
        apply: { type: "boolean", description: "Only the JSON boolean true requests local file writes; defaults to a read-only report." }
      }
    }
  },
  {
    name: "eos_manage_worktree",
    description: "Lists local Git worktrees. Create and remove are plan-only unless apply=true; worktrees do not sandbox processes, network access, or credentials.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "create", "remove"], description: "Action to perform" },
        branch: { type: "string", description: "Branch name for create action" },
        targetPath: { type: "string", description: "Target path for remove action" },
        apply: { type: "boolean", description: "Only the JSON boolean true performs create or remove." },
        force: { type: "boolean", description: "Force removal if modified" }
      },
      required: ["action"]
    }
  },
  {
    name: "eos_run_eval",
    description: "Executes 5-dimensional sovereign cognitive evaluation (Google Vertex / Anthropic Evals) over target file or code string.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "File path or code to evaluate" },
        isText: { type: "boolean", description: "True if target is raw code string" }
      },
      required: ["target"]
    }
  },
  {
    name: "eos_check_openspec",
    description: "Audits living OpenSpec architecture and delta changes (openspec/specs/ & openspec/changes/), certifying 0 drift and Level 2+ authorization.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["audit", "list_specs", "list_changes"], description: "Action: audit (default), list_specs, or list_changes" }
      }
    }
  },
  {
    name: "eos_titans_benchmark",
    description: "Runs local engineering simulations and arithmetic benchmarks inspired by vendor scenarios. No vendor systems are queried and results do not represent vendor performance.",
    inputSchema: {
      type: "object",
      properties: {
        titan: { type: "string", enum: ["all", "xirp", "spacex", "nvidia", "google", "xai"], description: "Titan subsystem to benchmark (default: all)" }
      }
    }
  },
  {
    name: "eos_reconcile_state",
    description: "Continuous declarative desired-state reconciliation loop inspired by Google Borg / Kubernetes, certifying 0.00% drift.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_spotify_audit",
    description: "Audits any target project for Spotify-grade engineering excellence: Backstage RFC-42 Golden Path, ITU-R BS.1770 -14 LUFS Audio Normalization, and Acoustic Vector Recommendation contracts.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Path to project root (default: current project)" }
      }
    }
  },
  {
    name: "eos_spotify_scaffold",
    description: "Prepares a local catalog-info.yaml template. Writing requires apply=true; a generated template does not establish Backstage conformance.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Path to project root (default: current project)" },
        name: { type: "string", description: "Component name" },
        owner: { type: "string", description: "Component owner" },
        apply: { type: "boolean", description: "Only the JSON boolean true writes the new file." }
      }
    }
  },
  {
    name: "eos_spotify_standup",
    description: "Generates an asynchronous daily standup update formatted for Spotify Slack/Jira (Yesterday, Today, Blockers, PR links, and timezone handoff for Stockholm/London/NYC).",
    inputSchema: {
      type: "object",
      properties: {
        author: { type: "string", description: "Author name and role" },
        squadName: { type: "string", description: "Squad name" },
        yesterdayTasks: { type: "array", items: { type: "string" }, description: "Tasks completed yesterday" },
        todayTasks: { type: "array", items: { type: "string" }, description: "Planned deep work for today" },
        blockers: { type: "array", items: { type: "string" }, description: "Blockers or external dependencies" }
      }
    }
  },
  {
    name: "eos_spotify_postmortem",
    description: "Synthesizes a certified Spotify SRE Blameless Post-Mortem including 5 Whys Root Cause Analysis, incident timeline, systemic fixes, and cryptographic seal.",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID (e.g. INC-SPOTIFY-104)" },
        title: { type: "string", description: "Incident title" },
        severity: { type: "string", description: "Severity level (e.g. SEV-1, SEV-2, SEV-3)" },
        durationMinutes: { type: "number", description: "Incident duration in minutes" },
        rootCause: { type: "string", description: "Root cause summary" }
      }
    }
  },
  {
    name: "eos_spotify_experiment",
    description: "Designs a Spotify-grade A/B testing Canary progressive rollout specification with guardrail metrics and automated fail-closed kill-switch.",
    inputSchema: {
      type: "object",
      properties: {
        experimentKey: { type: "string", description: "Feature flag experiment key" },
        featureName: { type: "string", description: "Feature name" },
        hypothesis: { type: "string", description: "Measurable hypothesis statement" },
        primaryMetric: { type: "string", description: "Primary evaluation metric" }
      }
    }
  },
  {
    name: "eos_go_accelerator",
    description: "Executes native compiled Go Spotify Titan Engine: 20,000+ MB/s concurrent Goroutine streaming, 40M+ ops/sec SIMD acoustic cosine similarity, and BaRT Contextual Bandits.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["benchmark", "bandit"], description: "Execution mode (default: benchmark)" },
        concurrency: { type: "integer", description: "Number of concurrent goroutines" },
        episodes: { type: "integer", description: "Episodes for BaRT Thompson Sampling" }
      }
    }
  },
  {
    name: "eos_spotify_honk_dispatch",
    description: "Dispatches the Spotify Honk Autonomous Background Agent: worktree isolation, zero-touch coding, automated test/heal loops, and PR synthesis.",
    inputSchema: {
      type: "object",
      properties: {
        taskName: { type: "string", description: "Task title / objective" },
        stack: { type: "string", enum: ["rust", "go", "node", "java"], description: "Target technology stack" },
        specDescription: { type: "string", description: "Formal EARS specification description" },
        dryRun: { type: "boolean", description: "Simulate without persisting changes" }
      },
      required: ["taskName", "specDescription"]
    }
  },
  {
    name: "eos_spotify_xirp_context",
    description: "Reads local catalog and specification metadata. Context is untrusted input; syncing AGENTS.md and CLAUDE.md requires syncFiles=true.",
    inputSchema: {
      type: "object",
      properties: {
        syncFiles: { type: "boolean", description: "Whether to sync AGENTS.md and CLAUDE.md to disk" }
      }
    }
  },
  {
    name: "eos_spotify_fleetshift_batch",
    description: "Plans a bounded local catalog-template action. Applying requires apply=true and exactly one registered checkout whose Git origin matches the registry.",
    inputSchema: {
      type: "object",
      properties: {
        migrationId: { type: "string", description: "Identifier for the migration batch" },
        action: { type: "string", enum: ["apply_backstage_rfc42", "enforce_strict_sre", "upgrade_dependencies"], description: "Migration action" },
        targetFleet: { type: "array", items: { type: "string" }, description: "Optional project IDs to target" },
        apply: { type: "boolean", description: "Only the JSON boolean true requests one bounded local write." }
      },
      required: ["migrationId", "action"]
    }
  },
  {
    name: "eos_spotify_canary_manifest",
    description: "Generates production Kubernetes Flagger and Argo Rollouts canary manifests with automated fail-closed Prometheus metric guardrails.",
    inputSchema: {
      type: "object",
      properties: {
        serviceName: { type: "string", description: "Target microservice name" },
        squad: { type: "string", description: "Owner squad name" },
        p99LatencyMs: { type: "number", description: "P99 latency threshold in ms (default: 100)" },
        maxErrorRatePercent: { type: "number", description: "Max error rate percentage (default: 0.1)" }
      },
      required: ["serviceName", "squad"]
    }
  },
  {
    name: "eos_audio_dsp_benchmark",
    description: "Executes Direct Form II Transposed Biquad filtering and ITU-R BS.1770 Lookahead True Peak limiter (-1.0 dBTP ceiling), returning real-time throughput metrics.",
    inputSchema: {
      type: "object",
      properties: {
        frames: { type: "integer", description: "Audio frames per buffer (default: 65536)" },
        iterations: { type: "integer", description: "DSP iterations (default: 20)" }
      }
    }
  },
  {
    name: "eos_fleet_elevate",
    description: "Inventories registered local checkouts. Applying a missing catalog template requires apply=true and one targetProjectId.",
    inputSchema: {
      type: "object",
      properties: {
        apply: { type: "boolean", description: "Only the JSON boolean true requests a write." },
        targetProjectId: { type: "string", description: "Single registered project ID to update when apply=true." }
      }
    }
  },
  {
    name: "eos_apollo_rpc",
    description: "Invokes an asynchronous Apollo/Hermes RPC request across microservices with Circuit Breaking, Token Bucket Rate Limiting, and W3C Tracing.",
    inputSchema: {
      type: "object",
      properties: {
        serviceName: { type: "string", description: "Target service name" },
        endpoint: { type: "string", description: "Endpoint name" },
        payload: { type: "object", description: "RPC request payload" }
      },
      required: ["serviceName", "endpoint"]
    }
  },
  {
    name: "eos_spotify_mix_plan",
    description: "Plans a seamless gapless DJ transition between two tracks with 3-band crossover, anti-bass clash strategy, and Camelot harmonic cost.",
    inputSchema: {
      type: "object",
      properties: {
        keyA: { type: "string", description: "Camelot key of outgoing track (e.g. 8A)" },
        keyB: { type: "string", description: "Camelot key of incoming track (e.g. 9A)" },
        bpmA: { type: "number", description: "BPM of track A (default: 126)" },
        bpmB: { type: "number", description: "BPM of track B (default: 128)" },
        duration: { type: "number", description: "Transition duration in seconds (default: 5.0)" }
      },
      required: ["keyA", "keyB"]
    }
  },
  {
    name: "eos_spotify_taste_profile",
    description: "Computes real-time 8D user taste centroid with exponential decay weighting (tau=7d) and skip penalties.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User identifier" }
      },
      required: ["userId"]
    }
  },
  {
    name: "eos_universal_adapt",
    description: "Runs local inventory heuristics inside the configured project root. Optional scaffolding is a template draft; writing requires apply=true.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Project-relative path inside the configured project root" },
        apply: { type: "boolean", description: "Only the JSON boolean true writes scaffold files." }
      }
    }
  },
  {
    name: "eos_universal_fingerprint",
    description: "Fingerprints programming language, frameworks, test runners, linters, containers, and LoC scale of ANY project.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Path to project root (default: current project)" }
      }
    }
  },
  {
    name: "eos_universal_scaffold",
    description: "Prepares local scaffold templates inside the configured project root. Writing requires applyToDisk=true; templates are not validated or installed.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Path to project root" },
        owner: { type: "string", description: "Owner squad name" },
        applyToDisk: { type: "boolean", description: "Write files to disk" }
      }
    }
  },
  {
    name: "eos_polyglot_bridge",
    description: "Detects Go, Rust, Clojure (Nubank), Node.js, Python, or Flutter projects and synthesizes deterministic Soundcheck verification plans.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Target repository root directory (default: current workspace)" }
      }
    }
  },
  {
    name: "eos_bitemporal_ledger",
    description: "Commits or queries immutable bitemporal facts with idempotency-key deduplication and Datomic-style time-travel (Nubank banking standard).",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["commit", "query_as_of", "get_root"], description: "Ledger operation" },
        idempotencyKey: { type: "string", description: "Unique deduplication key" },
        entityId: { type: "string", description: "Target entity ID" },
        payload: { type: "object", description: "Fact data payload" },
        asOfTxTime: { type: "number", description: "Timestamp for historical time-travel query" }
      },
      required: ["action"]
    }
  },
  {
    name: "eos_spotify_shuffle",
    description: "Runs a deterministic local track-ordering algorithm. It does not call Spotify; runtime depends on input size and hardware.",
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
              camelotKey: { type: "string" }
            },
            required: ["id", "artistId", "bpm", "camelotKey"]
          }
        },
        seed: { type: "number", description: "Deterministic PRNG seed" }
      }
    }
  },
  {
    name: "eos_global_edge_route",
    description: "Resolves optimal Anycast route, Haversine distance, and fiber RTT across the 8 Apex Global POPs (Stockholm, Bogotá, São Paulo, Virginia, Silicon Valley, London, Frankfurt, Tokyo).",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "Well-known city name (e.g. bogota, stockholm, tokyo, london, siliconvalley)" },
        latitude: { type: "number", description: "Client latitude coordinate" },
        longitude: { type: "number", description: "Client longitude coordinate" }
      }
    }
  },
  {
    name: "eos_global_edge_benchmark",
    description: "Executes Google Jeff Dean Hedged Requests benchmark modeling p99 tail-latency cancellation across global edge nodes.",
    inputSchema: {
      type: "object",
      properties: {
        samples: { type: "number", description: "Number of request simulations (default: 1000)" },
        p95ThresholdMs: { type: "number", description: "P95 delay threshold before hedged request (default: 28.0)" }
      }
    }
  },
  {
    name: "eos_samael_ibm_nvidia",
    description: "Executes the Apex Cyber-Theurgic Synthesis uniting Samaelian Law of Octaves (2 conscious shocks), IBM Parallel Sysplex 99.99999% Seven-Nines 2PC, and NVIDIA CUDA 32-thread SIMT warp tensor engine.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "Task goal to drive through the conscious octave" }
      }
    }
  },
  {
    name: "eos_disruptor_benchmark",
    description: "Runs a single-threaded typed-array ring loop and JavaScript delimiter scan. Returns observed elapsed time; heap allocations, cache behavior, and cross-thread performance are not measured.",
    inputSchema: {
      type: "object",
      properties: {
        events: { type: "number", description: "Number of events to publish through the ring buffer (default: 500,000)" },
        payloadBytes: { type: "number", description: "Payload size for structural delimiter scanning (default: 1,048,576)" }
      }
    }
  },
  {
    name: "eos_nubank_audit",
    description: "Audits any service or system against the 6 Building Nu institutional engineering pillars (https://building.nu.com/).",
    inputSchema: {
      type: "object",
      properties: {
        hasMutableStateInDomain: { type: "boolean", description: "Whether mutable state exists in the domain layer" },
        usesHexagonalLayerIsolation: { type: "boolean", description: "Whether hexagonal isolation is enforced" },
        usesContractTestingInsteadOfE2E: { type: "boolean", description: "Whether consumer-driven contracts (Sachem) are used" },
        enforcesKafkaIdempotencyTokens: { type: "boolean", description: "Whether Kafka idempotency tokens are verified" },
        usesImmutableBitemporalLedgers: { type: "boolean", description: "Whether Datomic/append-only immutable ledgers are used" },
        hasBlamelessPostmortemProcess: { type: "boolean", description: "Whether Nu blameless postmortems are practiced" },
        unitTestCoveragePercent: { type: "number", description: "Pure domain unit test coverage percentage" }
      }
    }
  },
  {
    name: "eos_nubank_sachem_verify",
    description: "Verifies consumer-driven contract schema backward and forward compatibility according to Nubank Sachem standards.",
    inputSchema: {
      type: "object",
      properties: {
        previousSchema: { type: "object", description: "The active production schema definition" },
        proposedSchema: { type: "object", description: "The proposed evolution schema definition" }
      },
      required: ["previousSchema", "proposedSchema"]
    }
  },
  {
    name: "eos_nubank_postmortem",
    description: "Synthesizes an institutional, certified blameless postmortem adhering to Nu SRE guidelines (building.nu.com).",
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
        cognitiveFactors: { type: "array", items: { type: "string" }, description: "Systemic/cognitive ergonomics observations" },
        systemicRemediations: { type: "array", description: "Action items with owners and deadlines" }
      },
      required: ["incidentId", "title", "severity", "owningSquad", "affectedServices", "customerImpact", "startTime", "resolutionTime", "durationMinutes", "timeline", "fiveWhys", "cognitiveFactors", "systemicRemediations"]
    }
  },
  {
    name: "eos_nubank_datomic_transact",
    description: "Executes an immutable Datomic bitemporal transaction simulation with Datom assertions/retractions and Merkle hashing.",
    inputSchema: {
      type: "object",
      properties: {
        txData: {
          type: "array",
          description: "List of Datom operations to transact: [{ entityId, attribute, value, op? }]"
        }
      },
      required: ["txData"]
    }
  },
  {
    name: "eos_spotify_audit_institutional",
    description: "Audits a service against the 6 Spotify Institutional Engineering Pillars (https://engineering.atspotify.com/).",
    inputSchema: {
      type: "object",
      properties: {
        usesGoldenPath: { type: "boolean", description: "Whether service adheres to a Backstage Golden Path" },
        hasCatalogInfoYaml: { type: "boolean", description: "Whether catalog-info.yaml is present" },
        hasTechDocsAndRunbook: { type: "boolean", description: "Whether TechDocs and on-call runbook are present" },
        compliesWithBS1770Loudness: { type: "boolean", description: "Whether audio complies with -14.0 LUFS and -1.0 dBTP" },
        hasProgressiveCanaryPipeline: { type: "boolean", description: "Whether progressive canary rollout is configured" },
        hasAutomatedKillSwitch: { type: "boolean", description: "Whether automated fail-closed rollback is configured" },
        hasBlamelessPostmortemProcess: { type: "boolean", description: "Whether blameless SRE postmortems are practiced" },
        unitTestCoveragePercent: { type: "number", description: "Unit test coverage percentage" }
      }
    }
  },
  {
    name: "eos_spotify_golden_path_verify",
    description: "Validates repository metadata against Spotify Backstage RFC-42 Golden Path and Soundcheck standards.",
    inputSchema: {
      type: "object",
      properties: {
        serviceName: { type: "string", description: "Name of the component" },
        filesPresent: { type: "array", items: { type: "string" }, description: "Files present in the repository" },
        catalogInfoContent: { type: "string", description: "Raw content of catalog-info.yaml" }
      },
      required: ["serviceName", "filesPresent"]
    }
  },
  {
    name: "eos_spotify_canary_gate",
    description: "Evaluates progressive canary rollout metrics and enforces automated kill-switch fail-closed thresholds.",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string", enum: ["1%", "5%", "25%", "100%"], description: "Current canary stage" },
        trafficPercentage: { type: "number", description: "Active traffic percentage" },
        totalRequests: { type: "number", description: "Total requests evaluated" },
        errorCount: { type: "number", description: "Number of failed requests" },
        p99LatencyMs: { type: "number", description: "Observed p99 latency in milliseconds" },
        maxAllowedP99Ms: { type: "number", description: "Maximum allowed p99 latency budget" },
        observationWindowMinutes: { type: "number", description: "Observation window in minutes" }
      },
      required: ["stage", "trafficPercentage", "totalRequests", "errorCount", "p99LatencyMs", "maxAllowedP99Ms", "observationWindowMinutes"]
    }
  },
  {
    name: "eos_spotify_fleetshift_plan",
    description: "Generates an automated batch transformation plan for multi-repository fleets according to Spotify Fleetshift standards.",
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
              name: { type: "string" }
            },
            required: ["id", "name"]
          },
          description: "Repositories targeted by the migration"
        },
        action: { type: "string", description: "Codemod or migration action identifier" }
      },
      required: ["migrationId", "description", "targetRepos", "action"]
    }
  },
  {
    name: "eos_apex_route_model",
    description: "Routes any engineering directive to the optimal frontier AI model (Gemini, Claude, GPT, DeepSeek, Grok) based on cognitive specialization and FinOps cost budgets.",
    inputSchema: {
      type: "object",
      properties: {
        directivePrompt: { type: "string", description: "Engineering task prompt or directive" },
        sourceContext: { type: "string", description: "Optional source code context to compress and analyze" }
      },
      required: ["directivePrompt"]
    }
  },
  {
    name: "eos_apex_compress_context",
    description: "Compresses source code context by 70-85% using AST symbol outline extraction, keeping all public types, interfaces and signatures while pruning internal bodies.",
    inputSchema: {
      type: "object",
      properties: {
        sourceContent: { type: "string", description: "Full source code to compress" },
        fileName: { type: "string", description: "Source file name or path" }
      },
      required: ["sourceContent"]
    }
  },
  {
    name: "eos_apex_autonomous_heal",
    description: "Checks one local file for trailing whitespace and CRLF. It returns a local heuristic report; writing requires apply=true and is limited to files inside the configured project root.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Project-relative path to a regular file" },
        apply: { type: "boolean", description: "Only the JSON boolean true writes local formatting fixes." }
      },
      required: ["filePath"]
    }
  },
  {
    name: "eos_apex_go_benchmark",
    description: "Executes the native Go high-concurrency token processing benchmark (> 50,000,000 tokens/sec across goroutines) with sub-microsecond telemetry.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_wasm_benchmark",
    description: "Executes client/runtime benchmark in WebAssembly or Layer-0 TS measuring tokens/sec and memory allocations (0 B/op).",
    inputSchema: {
      type: "object",
      properties: {
        iterations: { type: "number", description: "Number of benchmark iterations (default: 100000)" }
      }
    }
  },
  {
    name: "eos_wasm_compress",
    description: "Dual-mode WebAssembly / Layer-0 TypeScript AST outline compressor pruning bodies and blank lines while preserving signatures.",
    inputSchema: {
      type: "object",
      properties: {
        sourceCode: { type: "string", description: "Source code to compress" },
        targetTokens: { type: "number", description: "Target tokens budget" }
      },
      required: ["sourceCode"]
    }
  },
  {
    name: "eos_topology_blast_radius",
    description: "Calculates the deterministic recursive blast radius, impacted node list, and propagation latency for any of the 14 Sovereign Fleet nodes.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Target node identifier (e.g. 'eos-core', 'aberamentho', 'disruptor-ring')" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "eos_soul_alignment",
    description: "Evaluates an engineering directive against Valentín Flórez Arbeláez's Master Purpose Matrix and Kanban Plan ('SOLO EOS').",
    inputSchema: {
      type: "object",
      properties: {
        directive: { type: "string", description: "Directive or task description to evaluate" }
      },
      required: ["directive"]
    }
  },
  {
    name: "eos_autonomous_introspect",
    description: "Executes autonomous codebase self-study, calculating LOC, L0 purity, and synthesizing self-evolution improvement proposals (RFCs).",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_military_shield_audit",
    description: "Executes top-tier military and air-gapped security audit: formal invariants, Merkle Chain-of-Thought, and EosAin zero-entropy heap wipe.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_query_topology",
    description: "Queries the complete 14-node Sovereign Fleet topology, 3 concentric rings, edge links, and global graph metrics.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_model_route",
    description: "Routes an engineering directive to the optimal specialized frontier AI model (Gemini, Claude, GPT, DeepSeek, Grok) with cognitive rationale.",
    inputSchema: {
      type: "object",
      properties: {
        directivePrompt: { type: "string", description: "Natural language directive or prompt" },
        sourceContext: { type: "string", description: "Optional code or context snippet" }
      },
      required: ["directivePrompt"]
    }
  },
  {
    name: "eos_datalog_query",
    description: "Runs deductive fixpoint evaluation in Datalog (Google Piper/Mangle style) to calculate transitive blast radius and required test suites for a modified module.",
    inputSchema: {
      type: "object",
      properties: {
        targetModule: { type: "string", description: "Path to modified module (e.g., src/core/eosJarvisSoul.ts)" }
      },
      required: ["targetModule"]
    }
  },
  {
    name: "eos_mutation_test",
    description: "Executes AST bug mutation testing (Testing the Tests) by altering relational, boolean, and arithmetic operators to measure test suite killing score.",
    inputSchema: {
      type: "object",
      properties: {
        targetSnippet: { type: "string", description: "Source code or file path to mutate and audit" }
      },
      required: ["targetSnippet"]
    }
  },
  {
    name: "eos_time_travel_simulate",
    description: "Runs deterministic discrete time-travel simulation hypervisor reproducing concurrency races bit-for-bit with an integer seed.",
    inputSchema: {
      type: "object",
      properties: {
        seed: { type: "number", description: "Deterministic integer PRNG seed (default 948102)" },
        maxEvents: { type: "number", description: "Maximum simulation steps to run (default 50)" }
      }
    }
  },
  {
    name: "eos_wal_status",
    description: "Inspects physical bitemporal Write-Ahead Log (WAL) statistics, hardware durability state, and transaction commit counters.",
    inputSchema: {
      type: "object",
      properties: {
        walPath: { type: "string", description: "Optional path to binary WAL file (defaults to data/eos_bitemporal.wal)" }
      }
    }
  },
  {
    name: "eos_prometheus_metrics",
    description: "Generates real-time CNCF / Prometheus format text metrics (v0.0.4) for system observability.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_sandbox_evaluate",
    description: "Evaluates prospective code patches within an in-memory hermetic Copy-on-Write sandbox, verifying syntax and secrets with zero physical disk writes.",
    inputSchema: {
      type: "object",
      properties: {
        relPath: { type: "string", description: "Target relative file path (e.g. src/example.ts)" },
        content: { type: "string", description: "Proposed code content to evaluate" }
      },
      required: ["relPath", "content"]
    }
  },
  {
    name: "eos_simulate_bounded_models",
    description: "Runs bounded JavaScript simulations and extracts candidate names from TLA+ text files. It does not parse TLA+ syntax or run TLC model checking.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_simulate_jepsen_partition",
    description: "Runs Jepsen-style distributed network partition and packet drop simulation on consensus replicas to verify split-brain prevention.",
    inputSchema: {
      type: "object",
      properties: {
        dropRate: { type: "number", description: "Packet drop probability 0.0 - 1.0 (default 0.0)" },
        maxEvents: { type: "number", description: "Simulation event horizon (default 30)" }
      }
    }
  },
  {
    name: "eos_vault_memory_audit",
    description: "Audits the hardened non-serializable Uint8Array memory vault and executes zero-entropy cryptographic wiping.",
    inputSchema: {
      type: "object",
      properties: {
        wipeAll: { type: "boolean", description: "Whether to execute in-place zero-entropy wipe on all stored tokens" }
      }
    }
  },
  {
    name: "eos_gnostic_temple_audit",
    description: "Audits Three-Brain energy distribution (Intellectual, Emotional, Motor) and verifies circadian nightly screen veto per V.M. Samael Aun Weor.",
    inputSchema: {
      type: "object",
      properties: {
        intellectualHours: { type: "number", description: "Hours dedicated to intellectual coding/study" },
        emotionalHours: { type: "number", description: "Hours dedicated to high-vibration classical music/art" },
        motorHours: { type: "number", description: "Hours dedicated to physical gym/temple hygiene" }
      }
    }
  },
  {
    name: "eos_finops_budget_check",
    description: "Audits real-time micro-cent LLM token spend, verifies remaining balance against the $15.00 USD monthly limit, and inspects sacred Cajitas partitions.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_clave_de_sol_evaluate",
    description: "Evaluates the Clave de SOL (Subject, Object, Place) and calculates consciousness awake score (0-100) with theurgic advice.",
    inputSchema: {
      type: "object",
      properties: {
        subjectAware: { type: "boolean", description: "Awareness of oneself as the observer" },
        objectFocused: { type: "boolean", description: "Immersed in current action without mental wandering" },
        placePresent: { type: "boolean", description: "Grounded in physical body and physical space" }
      },
      required: ["subjectAware", "objectFocused", "placePresent"]
    }
  },
  {
    name: "eos_nano_benchmark",
    description: "Executes nanosecond-resolution statistical micro-benchmarks reporting p50, p90, p99, p99.99 latencies, jitter, and ops/sec.",
    inputSchema: {
      type: "object",
      properties: {
        iterations: { type: "number", description: "Sample iterations (default 5000)" }
      }
    }
  },
  {
    name: "eos_sentinel_tick",
    description: "Executes a 24/7 sovereign heartbeat tick evaluating Merkle roots, memory pressure, and fleet FDIR graph topology.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_alchemical_transmute",
    description: "Computes Shannon character entropy, cyclomatic density, and certifies Nous purity score (0-100%) mapped to the 7 Cosmic Notes of the Law of Octaves.",
    inputSchema: {
      type: "object",
      properties: {
        relPath: { type: "string", description: "Target source code file path" }
      }
    }
  },
  {
    name: "eos_bitwise_accelerate",
    description: "Executes 4x unrolled IEEE 802.3 CRC32 and 64-bit FNV-1a superscalar hashing benchmarks.",
    inputSchema: {
      type: "object",
      properties: {
        bufferSize: { type: "number", description: "Buffer size in bytes (default 65536)" },
        iterations: { type: "number", description: "Iterations (default 1000)" }
      }
    }
  },
  {
    name: "eos_buffer_pool_stats",
    description: "Inspects zero-allocation slab buffer pool statistics, hit rates, and GC elimination metrics.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_introspect_mind_levels",
    description: "Introspects psychological impressions across all 49 subconscious levels of the mind with Devi Kundalini dissolution formula and liberated essence metric (Samael Aun Weor standard).",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Psychological reaction or impression text" },
        category: { type: "string", enum: ["ANGER", "PRIDE", "LUST", "GREED", "FEAR", "SLOTH", "GLUTTONY", "IMPATIENCE", "DISPERSAL"] },
        observedCenter: { type: "string", enum: ["INTELLECTUAL", "EMOTIONAL", "MOTOR", "INSTINCTIVE", "SEXUAL"] },
        consciousSelfObservation: { type: "boolean", description: "Clave de SOL active?" },
        deepMeditationPenetrationLevel: { type: "number", description: "Depth level 1 to 49" }
      },
      required: ["description", "category"]
    }
  },
  {
    name: "eos_three_mountains_status",
    description: "Evaluates daily life alignment against the Three Mountains of Gnosis, the Daily Trinity, El Refugio mortgage protection, and the Architect Codex of Valentin Florez Arbelaez.",
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
        selflessServiceOrDonation: { type: "boolean" }
      }
    }
  },
  {
    name: "eos_autotuner_tick",
    description: "Executes an adaptive Layer-0 autotuning tick: measures event-loop lag, evaluates V8 heap fragmentation, resizes ring buffers dynamically, and produces Prometheus metrics.",
    inputSchema: {
      type: "object",
      properties: {
        queueDepth: { type: "number", description: "Instantaneous incoming queue depth (default: 0)" }
      }
    }
  },
  {
    name: "eos_nsa_encrypt",
    description: "Encrypts payload using military-grade CNSA 2.0 AES-256-GCM with AAD binding for classification and compartment.",
    inputSchema: {
      type: "object",
      properties: {
        plaintext: { type: "string", description: "Payload to encrypt" },
        classification: { type: "string", enum: ["UNCLASSIFIED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"] },
        compartment: { type: "string", description: "Security compartment identifier" }
      },
      required: ["plaintext"]
    }
  },
  {
    name: "eos_nsa_zero_trust_check",
    description: "Audits Bell-LaPadula Simple Security (No Read-Up) and *-Property (No Write-Down) for a given subject and object.",
    inputSchema: {
      type: "object",
      properties: {
        subjectClearance: { type: "string", enum: ["UNCLASSIFIED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"] },
        subjectCompartments: { type: "array", items: { type: "string" } },
        objectClassification: { type: "string", enum: ["UNCLASSIFIED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"] },
        objectCompartments: { type: "array", items: { type: "string" } },
        action: { type: "string", enum: ["READ", "WRITE"] }
      },
      required: ["subjectClearance", "objectClassification", "action"]
    }
  },
  {
    name: "eos_nsa_audit_logs",
    description: "Inspects the SHA-384 cryptographically sealed Red/Black Mandatory Access Control audit trail.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_consensus_status",
    description: "Inspects planetary Raft/Paxos quorum consensus, active leader, and state hash.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_truetime_now",
    description: "Queries Google Spanner TrueTime bounded interval [earliest, latest] with commit-wait linearizability guarantee.",
    inputSchema: {
      type: "object",
      properties: {
        epsilonMs: { type: "number", description: "Clock drift uncertainty parameter in ms (default 2.0)" }
      }
    }
  },
  {
    name: "eos_adaptive_concurrency_stats",
    description: "Inspects Netflix Vegas adaptive concurrency limits, RTT gradient, and load-shedding metrics.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_hash_ring_lookup",
    description: "Performs O(log(N*V)) Amazon Dynamo consistent hash ring lookup and multi-DC preference list calculation.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Partition key to route" },
        nodes: { type: "array", items: { type: "string" }, description: "Optional cluster nodes list" },
        replicas: { type: "number", description: "Replication factor R (default: 3)" }
      },
      required: ["key"]
    }
  },
  {
    name: "eos_merkle_sync_diff",
    description: "Compares hierarchical Dynamo Merkle trees to detect out-of-sync key ranges in O(log K).",
    inputSchema: {
      type: "object",
      properties: {}
    }
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
        refillPerSecond: { type: "number", description: "Refill rate (default 20)" }
      }
    }
  },
  {
    name: "eos_hft_ipc_dispatch",
    description: "Dispatches commands via Citadel HFT resident Go daemon IPC or pure L0 fallback with sub-millisecond latency.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "Action: ping, benchmark, route, status" },
        payload: { type: "object", description: "Arbitrary request parameters" }
      },
      required: ["action"]
    }
  },
  {
    name: "eos_zero_copy_scan",
    description: "Performs SpaceX/ASML zero-allocation mechanical sympathy token scanning directly over byte buffers.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Source code or text to scan" },
        filePath: { type: "string", description: "Optional file path to read and scan" }
      }
    }
  },
  {
    name: "eos_chaos_inject_eval",
    description: "Executes Netflix-grade in-process chaos experiments with synthetic latency, Byzantine bit-flips, and circuit breaker resilience scoring.",
    inputSchema: {
      type: "object",
      properties: {
        experimentName: { type: "string", description: "Name of the chaos trial" },
        iterations: { type: "number", description: "Number of fault injection cycles" }
      }
    }
  },
  {
    name: "eos_hnsw_index_add",
    description: "Indexes a high-dimensional vector or document in the pure Layer-0 HNSW multi-layer graph with deterministic token projection (Palantir/Apple standard).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Unique identifier for the vector/document" },
        text: { type: "string", description: "Text content to embed and index" },
        vector: { type: "array", items: { type: "number" }, description: "Optional raw Float32 vector (if not using text)" },
        metadata: { type: "object", description: "Optional metadata payload" }
      },
      required: ["id"]
    }
  },
  {
    name: "eos_hnsw_knn_search",
    description: "Executes sub-millisecond approximate k-NN semantic search over the HNSW vector index.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Query text string" },
        vector: { type: "array", items: { type: "number" }, description: "Optional raw query vector" },
        k: { type: "number", description: "Number of nearest neighbors to retrieve (default: 5)" },
        efSearch: { type: "number", description: "Exploration queue factor (default: 32)" }
      }
    }
  },
  {
    name: "eos_vector_similarity",
    description: "Computes pure Layer-0 Cosine similarity and Euclidean distance between two texts or vectors.",
    inputSchema: {
      type: "object",
      properties: {
        textA: { type: "string", description: "First text string" },
        textB: { type: "string", description: "Second text string" },
        metric: { type: "string", enum: ["cosine", "euclidean"], description: "Distance metric (default: cosine)" }
      },
      required: ["textA", "textB"]
    }
  },
  {
    name: "eos_monte_carlo_sim",
    description: "Executes BlackRock Aladdin-grade stochastic risk simulation across tasks using Beta-PERT distributions and Mulberry32 PRNG.",
    inputSchema: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          description: "List of tasks with optimistic, nominal, and pessimistic bounds",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              optimistic: { type: "number" },
              nominal: { type: "number" },
              pessimistic: { type: "number" }
            },
            required: ["id", "optimistic", "nominal", "pessimistic"]
          }
        },
        iterations: { type: "number", description: "Number of Monte Carlo runs (default: 10000)" },
        seed: { type: "number", description: "Deterministic PRNG seed" },
        deadlineHours: { type: "number", description: "Target SLA delivery deadline in hours" }
      }
    }
  },
  {
    name: "eos_hash_chain_verify",
    description: "Appends to or validates the SpaceX/NSA monotonic cryptographic SHA-256 hash-chain ledger for tamper-evident audit receipts.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["verify", "append", "status"], description: "Action to perform" },
        recordId: { type: "string", description: "Evidence record ID (for append)" },
        type: { type: "string", description: "Record type (for append)" },
        summary: { type: "string", description: "Summary text (for append)" },
        metadata: { type: "object", description: "Optional metadata" }
      }
    }
  },
  {
    name: "eos_product_foundry_create",
    description: "Synthesizes an industrial-grade, zero-defect product blueprint with hexagonal architecture, EARS/BDD contracts, and 7-stage SecDevOps gate.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product name" },
        domain: { type: "string", description: "Domain (e.g. fintech, audio, ai, saas)" },
        tier: { type: "string", enum: ["MVP", "ENTERPRISE", "MISSION_CRITICAL", "PLANETARY"], description: "Complexity tier (default: ENTERPRISE)" },
        entities: { type: "array", items: { type: "string" }, description: "Domain entities" },
        commands: { type: "array", items: { type: "string" }, description: "Application commands/use-cases" },
        platforms: { type: "array", items: { type: "string" }, description: "Platform targets" }
      },
      required: ["name", "domain"]
    }
  },
  {
    name: "eos_product_foundry_validate",
    description: "Validates product topology against hexagonal isolation, acyclic dependency rules, and 100% EARS-to-BDD traceability.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain name" },
        tier: { type: "string", description: "Complexity tier" }
      }
    }
  },
  {
    name: "eos_sovereign_loop_run",
    description: "Executes the 21-Step Autonomous Sovereign Engineering Loop (IEEE 830, EARS, BDD, ADR, DAG, 7-Stage Gate, Evidence Sealing).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project identifier" },
        title: { type: "string", description: "Feature or system title" },
        userPrompt: { type: "string", description: "User requirement description" },
        authLevel: { type: "number", description: "Authorization Level (default: 3)" }
      },
      required: ["projectId", "title", "userPrompt"]
    }
  },
  {
    name: "eos_sovereign_loop_stages",
    description: "Returns the complete definition of the 21 Master Engineering Pipeline stages and phase groups.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_agent_session_contract",
    description: "SPEC-152 Universal Agent Session Contract: open a multi-IDE session (cursor, antigravity, claude-code, vscode), record mandatory MCP DAG progress, and authorize writes fail-closed until the DAG completes.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["open", "ensure", "record_tool", "authorize_write", "status", "evaluate_write", "align_gentleman"],
          description: "Session contract ops; align_gentleman binds Gentleman Programming Gentle-AI Stack (SPEC-154)"
        },
        ideFamily: {
          type: "string",
          enum: ["cursor", "antigravity", "claude-code", "vscode"],
          description: "IDE family for open/ensure/evaluate_write"
        },
        directive: { type: "string", description: "Mission directive for action open" },
        target: { type: "string", description: "Target project id or path (default eos-system)" },
        sessionId: { type: "string", description: "Session id for record_tool, authorize_write, status" },
        sessionReceipt: { type: "string", description: "Optional receipt check for authorize_write" },
        toolName: { type: "string", description: "MCP tool name for record_tool" },
        paths: { type: "array", items: { type: "string" }, description: "Optional write paths for authorize_write" }
      },
      required: ["action"]
    }
  },
  {
    name: "eos_product_deliver_run",
    description: "LADDER-15 Golden Path: Foundry blueprint → SDD package → Sovereign Loop → verification gates → Product Quality Scorecard. Defaults to dry-run; set write=true to materialize under docs/products/<id>/ on the control plane only. write=true uses real package.json purity gates (SPEC-152); scorecard < 80 returns BLOCKED.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product name" },
        domain: { type: "string", description: "Domain (e.g. fintech-ledger)" },
        tier: { type: "string", enum: ["MVP", "ENTERPRISE", "MISSION_CRITICAL", "PLANETARY"], description: "Complexity tier (default MVP)" },
        write: { type: "boolean", description: "When true, materialize SDD under docs/products/<id>/ (control plane only)" },
        entities: { type: "array", items: { type: "string" }, description: "Domain entities" },
        commands: { type: "array", items: { type: "string" }, description: "Application commands" }
      },
      required: ["name", "domain"]
    }
  },
  {
    name: "eos_product_deliver_status",
    description: "Returns LADDER-15 Product Delivery Orchestrator status, epistemic target, and tool surface.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_platform_ops_ceiling",
    description: "LADDER-16 Platform Ops Ceiling: evaluate IDP SLOs, dogfood scorecard, progressive canary (1→5→25→100), and IV&V readiness. Returns SOVEREIGN_CEILING_10_OF_10_WITHIN_TESTED_SCOPE — never NSA_GRADE.",
    inputSchema: {
      type: "object",
      properties: {
        runCanary: { type: "boolean", description: "Run progressive canary mesh (default true)" },
        controlPlanePristine: { type: "boolean", description: "Working tree porcelain signal (default true)" }
      }
    }
  },
  {
    name: "eos_otel_query_traces",
    description: "Query recorded OpenTelemetry distributed traces from SQLite WAL. Filter by name, minimum duration, status code, or limit.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Filter by span or trace name" },
        minDurationMs: { type: "number", description: "Filter traces exceeding this duration in milliseconds" },
        statusCode: { type: "string", enum: ["UNSET", "OK", "ERROR"], description: "Filter by status code" },
        limit: { type: "number", description: "Maximum traces to return (default 20, max 100)" }
      }
    }
  },
  {
    name: "eos_otel_trace_waterfall",
    description: "Compute hierarchical trace waterfall with parent-child offsets, duration percentages, and automated bottleneck isolation.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "Trace ID (32-character hex)" }
      },
      required: ["traceId"]
    }
  },
  {
    name: "eos_otel_export_otlp",
    description: "Export trace data into canonical OpenTelemetry OTLP/JSON schema v1.3.0 for Jaeger, Honeycomb, or Grafana Tempo ingestion.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "Optional specific trace ID to export" }
      }
    }
  },
  {
    name: "eos_autonomous_heal_loop",
    description: "Meta SapFix / Google Auto-Remediation autonomous closed-loop self-healing: isolates fault, synthesizes AST candidate patches, evaluates in sandbox, and promotes verified zero-regression fix.",
    inputSchema: {
      type: "object",
      properties: {
        diagnosticReport: { type: "string", description: "Error diagnostic message or test failure log" },
        targetFile: { type: "string", description: "Optional target source file path to repair" },
        archetype: {
          type: "string",
          enum: ["NULL_POINTER_GUARD", "TIMEOUT_BACKOFF_RETRY", "GRID_SPACING_CONFORMANCE", "IMPORT_CYCLE_BREAK", "FALLBACK_VALUE_INJECT"],
          description: "Specific self-healing archetype to execute"
        },
        dryRun: { type: "boolean", description: "Evaluate in sandbox without modifying disk (default true)" }
      }
    }
  },
  {
    name: "eos_ast_mutation_synthesize",
    description: "Synthesizes surgical AST candidate mutation patches matching a target healing archetype (SapFix standard).",
    inputSchema: {
      type: "object",
      properties: {
        targetFile: { type: "string", description: "Target source file path" },
        archetype: {
          type: "string",
          enum: ["NULL_POINTER_GUARD", "TIMEOUT_BACKOFF_RETRY", "GRID_SPACING_CONFORMANCE", "IMPORT_CYCLE_BREAK", "FALLBACK_VALUE_INJECT"],
          description: "Target healing archetype"
        },
        symbol: { type: "string", description: "Target symbol name or property" }
      },
      required: ["targetFile", "archetype"]
    }
  },
  {
    name: "eos_self_healing_status",
    description: "Returns the real-time operational status and historical audit ledger of the Autonomous Closed-Loop Self-Healing Engine.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_ontology_query",
    description: "Palantir Bi-Temporal Ontology Cyclotron: sub-microsecond graph reachability, node status, and historical asOf(t) state.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "Query action ('status', 'transitive', 'asOf')" },
        startId: { type: "string", description: "Root entity ID for transitive closure" },
        predicate: { type: "string", description: "Edge predicate filter" },
        timestamp: { type: "number", description: "Target historical timestamp for asOf(t)" }
      }
    }
  },
  {
    name: "eos_quantum_lattice_seal",
    description: "Generates NIST FIPS 203 ML-KEM-768 quantum-resistant lattice attestation seal with centered binomial polynomial reduction.",
    inputSchema: {
      type: "object",
      properties: {
        payload: { type: "string", description: "Payload or attestation proof to seal" }
      },
      required: ["payload"]
    }
  },
  {
    name: "eos_refactor_audit",
    description: "Audits codebase for technical debt, dead code, code duplication, and loop complexity. Emits SHA-256 cryptographic receipt.",
    inputSchema: {
      type: "object",
      properties: {
        targetDir: { type: "string", description: "Target directory to audit (defaults to 'src/core')" }
      }
    }
  },
  {
    name: "eos_refactor_execute",
    description: "Executes continuous refactoring cycle and code diet optimizer across the project root. Returns verified execution summary with zero side effects.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Root directory of the project (defaults to '.')" }
      }
    }
  },
  {
    name: "eos_synapse_arbitrate",
    description: "Bayesian multi-agent intent arbitration: normalizes posterior beliefs P(H|E) and resolves priority ranking with zero deadlocks.",
    inputSchema: {
      type: "object",
      properties: {
        candidates: {
          type: "array",
          description: "List of agent intent candidates with priorBelief and evidenceLikelihood"
        }
      },
      required: ["candidates"]
    }
  },
  {
    name: "eos_dst_simulate",
    description: "Runs FoundationDB / Antithesis-style Deterministic Simulation Testing (DST) with seed-based fault injection.",
    inputSchema: {
      type: "object",
      properties: {
        seed: { type: "number", description: "Deterministic numeric seed (e.g. 42)" },
        steps: { type: "number", description: "Total simulation discrete steps" },
        faultRate: { type: "number", description: "Fault injection rate (0.0 to 1.0)" }
      },
      required: ["seed"]
    }
  },
  {
    name: "eos_dbc_verify",
    description: "Verifies Design by Contract (DbC) assertions and guarantees deep immutability via deepFreeze.",
    inputSchema: {
      type: "object",
      properties: {
        sampleValue: { type: "number", description: "Sample numeric input to assert against preconditions" }
      }
    }
  },
  {
    name: "eos_fleet_soundcheck",
    description: "Audits registered sovereign fleet repositories against Spotify Backstage Soundcheck dimensions (L0 purity, SAST 0 leaks, working tree cleanliness) and outputs a scored report.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Optional project root path" }
      }
    }
  },
  {
    name: "eos_mcts_tune",
    description: "Executes Monte Carlo Tree Search (MCTS) with UCT exploration over multidimensional parameter space to converge to optimal system fitness.",
    inputSchema: {
      type: "object",
      properties: {
        iterations: { type: "number", description: "Total MCTS simulation discrete iterations (default: 120)" },
        seed: { type: "number", description: "Deterministic PRNG seed (default: 42)" }
      }
    }
  },
  {
    name: "eos_canary_rollout",
    description: "Executes progressive canary rollout (1% -> 5% -> 25% -> 100%) with fail-closed circuit breaker rollback upon error budget breach.",
    inputSchema: {
      type: "object",
      properties: {
        versionTarget: { type: "string", description: "Target deployment version" },
        previousVersion: { type: "string", description: "Previous stable version" }
      }
    }
  },
  {
    name: "eos_canary_telemetry_evaluate",
    description: "Evaluates real-time canary telemetry metrics (error rate, P99 latency, sample volume) to calculate Canary Health Index (CHI) and determine automated progressive promotion or instant circuit breaker rollback.",
    inputSchema: {
      type: "object",
      properties: {
        deploymentId: { type: "string", description: "Vercel or fleet deployment identifier" },
        environment: { type: "string", enum: ["production", "preview"], description: "Deployment environment" },
        stage: { type: "string", enum: ["CANARY_1_PCT", "CANARY_5_PCT", "CANARY_25_PCT", "FULL_PRODUCTION_100_PCT"], description: "Progressive canary stage" },
        errorRate5xx: { type: "number", description: "Observed 5xx error rate between 0.0 and 1.0" },
        latencyP99Ms: { type: "number", description: "Observed P99 latency in milliseconds" },
        requestCount: { type: "number", description: "Sample request count during evaluation window" },
        criticalErrorThreshold: { type: "number", description: "Optional critical error threshold ceiling (default: 0.01)" }
      },
      required: ["deploymentId", "environment", "stage", "errorRate5xx", "latencyP99Ms", "requestCount"]
    }
  },
  {
    name: "eos_columnar_telemetry_query",
    description: "Executes sub-millisecond in-memory columnar slice aggregations (P50, P90, P99, mean, anomaly counts) across fleet telemetry using Meta SCUBA / Google Monarch standard contiguous TypedArrays.",
    inputSchema: {
      type: "object",
      properties: {
        repoId: { type: "string", description: "Optional fleet repository filter" },
        stage: { type: "string", description: "Optional deployment or canary stage filter" },
        minStatusCode: { type: "number", description: "Minimum HTTP status code (e.g. 400 for errors)" },
        maxStatusCode: { type: "number", description: "Maximum HTTP status code" },
        minTimestamp: { type: "number", description: "Minimum epoch timestamp in milliseconds" },
        maxTimestamp: { type: "number", description: "Maximum epoch timestamp in milliseconds" },
        syntheticSamplesCount: { type: "number", description: "Optional seed sample count for synthetic benchmarks (default: 1000)" }
      }
    }
  },
  {
    name: "eos_cell_bulkhead_route",
    description: "Evaluates and routes incoming fleet requests into autonomous bulkhead cells (AWS/Meta Cell-Based Architecture standard), guaranteeing bounded blast radius (<= 1/N), poison pill immunity quarantine, and health-aware failover draining.",
    inputSchema: {
      type: "object",
      properties: {
        partitionKey: { type: "string", description: "Partition key (tenantId, repoId, or requestId) for deterministic FNV-1a consistent hash routing" },
        payload: { type: "string", description: "Optional request payload serialized as JSON or string to evaluate against the poison pill quarantine ledger" }
      },
      required: ["partitionKey"]
    }
  },
  {
    name: "eos_cell_bulkhead_status",
    description: "Retrieves complete health metrics, active in-flight counts, blast radius guarantees, and quarantined poison pill signatures across all partitioned bulkhead cells.",
    inputSchema: {
      type: "object",
      properties: {
        cellId: { type: "number", description: "Optional filter or target cell ID (0..N-1)" },
        setStatus: { type: "string", enum: ["HEALTHY", "DEGRADED", "DRAINING", "QUARANTINED"], description: "Optional state change for target cell" }
      }
    }
  },
  {
    name: "eos_slo_burn_rate_evaluate",
    description: "Evaluates Google SRE multi-window multi-burn-rate alerting and sliding-window error budget consumption for a fleet service, returning burn rates across 5m, 30m, 1h, and 6h windows, remaining error budget, and deployment freeze status.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "Target fleet service ID or repository name" },
        events: {
          type: "array",
          description: "Optional telemetry events batch to ingest prior to evaluation",
          items: {
            type: "object",
            properties: {
              timestamp: { type: "number", description: "Epoch ms timestamp" },
              isError: { type: "boolean", description: "Whether request resulted in error" },
              statusCode: { type: "number", description: "HTTP status code" },
              latencyMs: { type: "number", description: "Request latency in ms" }
            }
          }
        },
        evaluationTimestamp: { type: "number", description: "Optional timestamp epoch ms for evaluation (defaults to now)" }
      },
      required: ["serviceId"]
    }
  },
  {
    name: "eos_slo_budget_status",
    description: "Queries error budget health and deployment freeze state across all fleet services or a specific service, verifying if canaries or production deployments are permitted under Google SRE error budget governance.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "Optional filter for a specific service ID" },
        checkDeploymentAllowed: { type: "boolean", description: "If true, explicitly returns whether deployment is permitted (fail-closed check)" }
      }
    }
  },
  {
    name: "eos_hedge_request_execute",
    description: "Executes a fleet RPC request with Google 'The Tail at Scale' adaptive hedged duplicate dispatch, deadline budget propagation, and cooperative cancellation.",
    inputSchema: {
      type: "object",
      properties: {
        endpointId: { type: "string", description: "Target fleet service or endpoint ID" },
        deadlineMs: { type: "number", description: "Optional request deadline budget in ms" },
        hedgingDelayMs: { type: "number", description: "Optional explicit hedging delay in ms (defaults to endpoint P95)" },
        simulatedPrimaryDelayMs: { type: "number", description: "Optional simulated primary replica latency in ms for synthetic probes" },
        simulatedHedgedDelayMs: { type: "number", description: "Optional simulated hedged replica latency in ms for synthetic probes" }
      },
      required: ["endpointId"]
    }
  },
  {
    name: "eos_hedge_metrics_status",
    description: "Retrieves running P50, P95, and P99 latency reservoirs, hedging ratios, deadline shed counts, and anti-storm token bucket health across all endpoints.",
    inputSchema: {
      type: "object",
      properties: {
        endpointId: { type: "string", description: "Optional filter for a specific endpoint ID" },
        recordSampleLatencyMs: { type: "number", description: "Optional raw latency sample in ms to record for the target endpoint" }
      }
    }
  },
  {
    name: "eos_concurrency_evaluate",
    description: "Evaluates adaptive concurrency admission and priority-tier load shedding under the Netflix Vegas gradient algorithm and CoDel queue delay management.",
    inputSchema: {
      type: "object",
      properties: {
        priority: { type: "string", enum: ["CRITICAL", "HIGH", "NORMAL", "BEST_EFFORT"], description: "Priority tier of the request (default: NORMAL)" },
        queueWaitMs: { type: "number", description: "Observed queue waiting residency time in ms (CoDel check)" },
        releaseAfterSimulatedRttMs: { type: "number", description: "Optional simulated RTT in ms to record on immediate slot release" }
      }
    }
  },
  {
    name: "eos_concurrency_status",
    description: "Queries current Vegas gradient, active concurrency limits, in-flight slots, baseline vs smoothed RTT, and shedding statistics by priority tier.",
    inputSchema: {
      type: "object",
      properties: {
        recordLatencyMs: { type: "number", description: "Optional RTT in ms to feed into the Vegas gradient calculator" },
        reset: { type: "boolean", description: "Optional flag to reset governor to nominal state" }
      }
    }
  },
  {
    name: "eos_trace_span_record",
    description: "Ingests an OpenTelemetry-compatible span into the dynamic tail-based trace buffer ring, with optional immediate evaluation on root span completion.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "Unique distributed trace identifier" },
        spanId: { type: "string", description: "Unique span identifier" },
        name: { type: "string", description: "Span operation name" },
        durationMs: { type: "number", description: "Span execution duration in ms" },
        statusCode: { type: "integer", description: "HTTP or gRPC status code (5xx triggers 100% sampling)" },
        hasError: { type: "boolean", description: "Explicit error flag triggering 100% sampling" },
        isResilienceEvent: { type: "boolean", description: "Flag indicating hedging, load-shedding, or circuit breaking" },
        isEndSpan: { type: "boolean", description: "Whether this span completes the trace, triggering immediate sampling decision" }
      },
      required: ["traceId", "spanId", "name"]
    }
  },
  {
    name: "eos_trace_sampler_status",
    description: "Queries tail-based trace sampling telemetry, active buffer counts, retention statistics, and sampled-by-reason metrics.",
    inputSchema: {
      type: "object",
      properties: {
        evictStale: { type: "boolean", description: "Optional flag to trigger immediate TTL-based sweep of idle traces" },
        reset: { type: "boolean", description: "Optional flag to reset sampler counters to zero" }
      }
    }
  },
  {
    name: "eos_remediation_correlate_execute",
    description: "Ingests multi-signal telemetry (SLO burn rate, Vegas gradient, queue delay, trace error rate) to predict failure archetypes and execute closed-loop auto-remediation playbooks.",
    inputSchema: {
      type: "object",
      properties: {
        burnRate5m: { type: "number", description: "5-minute SLO burn rate" },
        burnRate1h: { type: "number", description: "1-hour SLO burn rate" },
        concurrencyGradient: { type: "number", description: "Vegas latency congestion gradient" },
        concurrencyInFlightRatio: { type: "number", description: "Ratio of inflight requests to concurrency limit" },
        traceErrorRate: { type: "number", description: "Fraction of sampled traces containing errors (0.0 to 1.0)" },
        traceP99LatencyMs: { type: "number", description: "Observed P99 tail latency in ms" },
        hedgeRequestRatio: { type: "number", description: "Fraction of traffic dispatched as speculative hedges (0.0 to 1.0)" },
        queueDelayMs: { type: "number", description: "Observed average queue residency delay in ms" }
      }
    }
  },
  {
    name: "eos_remediation_engine_status",
    description: "Queries the closed-loop auto-remediation engine status, active archetype, current mitigation action, cooldown ticks, and health score.",
    inputSchema: {
      type: "object",
      properties: {
        reset: { type: "boolean", description: "Optional flag to reset engine to nominal state" }
      }
    }
  },
  {
    name: "eos_kernel_orchestrator_reconcile",
    description: "Executes a unified Sense-Analyze-Predict-Mitigate-Reconcile-Attest control cycle, computing the Omni-System Equilibrium Index (OSEI) and dispatching proportional mitigations.",
    inputSchema: {
      type: "object",
      properties: {
        fleetSoundcheckScore: { type: "number", description: "Fleet Soundcheck score (0-100)" },
        sloErrorBudgetConsumptionPct: { type: "number", description: "SLO error budget consumed percentage (0-100)" },
        predictiveHazardSeverityPct: { type: "number", description: "Predictive failure hazard severity percentage (0-100)" },
        concurrencyHeadroomPct: { type: "number", description: "Adaptive concurrency headroom percentage (0-100)" },
        syntheticSocketBacklog: { type: "number", description: "Synthetic socket backlog queue size (0-1000)" },
        virtualPagePressurePct: { type: "number", description: "Synthetic virtual page pressure percentage (0-100)" }
      }
    }
  },
  {
    name: "eos_kernel_orchestrator_status",
    description: "Queries the unified autonomous kernel orchestrator operational status, historical cycle count, running average OSEI score, and latest reconciliation receipt.",
    inputSchema: {
      type: "object",
      properties: {
        reset: { type: "boolean", description: "Optional flag to reset orchestrator history and state" }
      }
    }
  },
  {
    name: "eos_transcendence_execute",
    description: "Executes Big Tech transcendence engineering pillars (Google Vizier, Netflix Chaos Kong, AWS SMT, Meta PGO, Apple Secure Enclave, Microsoft BFT) individually or as an all-pillar consolidated master run.",
    inputSchema: {
      type: "object",
      properties: {
        pillar: {
          type: "string",
          description: "Optional specific pillar to execute ('GOOGLE_VIZIER', 'NETFLIX_CHAOS_KONG', 'AWS_SMT_REASONING', 'META_PGO_LAYOUT', 'APPLE_SECURE_ENCLAVE', 'MICROSOFT_BFT_COUNCIL', or omit for ALL_PILLARS)"
        }
      }
    }
  },
  {
    name: "eos_transcendence_status",
    description: "Queries the Big Tech Transcendence Nexus operational status, total executions, pillar successes, and latest master cryptographic receipt.",
    inputSchema: {
      type: "object",
      properties: {
        reset: { type: "boolean", description: "Optional flag to reset nexus status and history" }
      }
    }
  },
  {
    name: "eos_design_scaffold_component",
    description: "Scaffolds world-class UI components in elite design archetypes (Spotify XIRP, Palantir Foundry, Anduril Lattice, Glorian Solar) with accessible semantic HTML5, scoped CSS3, and WCAG contrast validation.",
    inputSchema: {
      type: "object",
      properties: {
        archetype: {
          type: "string",
          description: "Design system archetype ('SPOTIFY_XIRP', 'PALANTIR_FOUNDRY', 'ANDURIL_LATTICE', 'GLORIAN_SOLAR')"
        },
        componentType: {
          type: "string",
          description: "Component type ('INCIDENT_TIMELINE', 'WAVEFORM_MONITOR', 'TELEMETRY_GRID', 'TACTICAL_HUD', 'MISSION_CONTROL_DECK')"
        },
        title: { type: "string", description: "Optional title for the component" },
        subtitle: { type: "string", description: "Optional subtitle for the component" }
      },
      required: ["archetype", "componentType"]
    }
  },
  {
    name: "eos_design_audit_markup",
    description: "Audits HTML/CSS markup for world-class design system conformance, evaluating contrast ratio (WCAG AA/AAA >= 4.5:1), 8px spatial grid harmony, and prefers-reduced-motion safety.",
    inputSchema: {
      type: "object",
      properties: {
        markup: { type: "string", description: "HTML markup or CSS to audit" }
      },
      required: ["markup"]
    }
  },
  {
    name: "eos_finops_route_task",
    description: "Evaluates an engineering directive's cognitive entropy and routes it to the lowest viable cost tier (Tier 1 Local SLM, Tier 2 Balanced, Tier 3 Frontier Reasoning) according to Spotify Xirp and Nubank Meta FinOps standards.",
    inputSchema: {
      type: "object",
      properties: {
        directive: { type: "string", description: "Engineering task or directive to classify" },
        estimatedTokens: { type: "number", description: "Estimated tokens required for task" }
      },
      required: ["directive"]
    }
  },
  {
    name: "eos_finops_evaluate_stagnation",
    description: "Evaluates consecutive diff similarity across failed agent cycles. Dispatches SIGSTOP emergency breaker if similarity >= 85% across 3 cycles to stop infinite token bleed.",
    inputSchema: {
      type: "object",
      properties: {
        diffHistory: { type: "array", items: { type: "string" }, description: "Sequential list of code diffs produced by agent" },
        testPassed: { type: "boolean", description: "Whether the latest verification tests passed" }
      },
      required: ["diffHistory", "testPassed"]
    }
  },
  {
    name: "eos_finops_wallet_status",
    description: "Queries the ephemeral task wallet status, accumulated spend, remaining budget, and code survival ROI analytics.",
    inputSchema: {
      type: "object",
      properties: {
        missionId: { type: "string", description: "Optional mission or task ID to query wallet for" },
        reset: { type: "boolean", description: "Optional flag to reset governor status" }
      }
    }
  },
  {
    name: "eos_planetary_sparse_project",
    description: "Projects the minimum hermetic transitive closure from a virtual planet-scale monorepo (Google Piper / Meta EdenFS pattern), yielding sublinear memory consumption and SHA-256 Merkle root.",
    inputSchema: {
      type: "object",
      properties: {
        targetFile: { type: "string", description: "Target root file or package path to project closure from" },
        monorepoNodes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              path: { type: "string" },
              dependencies: { type: "array", items: { type: "string" } }
            },
            required: ["id", "path", "dependencies"]
          },
          description: "Adjacency nodes of the virtual monorepo graph"
        }
      },
      required: ["targetFile", "monorepoNodes"]
    }
  },
  {
    name: "eos_jpl_power_of_ten_audit",
    description: "Audits source code against Gerard Holzmann's NASA/JPL Power of Ten safety-critical rules (bounded loops, assertion density >= 2, zero dynamic heap allocations, restricted recursion).",
    inputSchema: {
      type: "object",
      properties: {
        sourceCode: { type: "string", description: "Source code to audit against JPL flight safety standards" }
      },
      required: ["sourceCode"]
    }
  },
  {
    name: "eos_tmr_consensus_adjudicate",
    description: "Adjudicates Byzantine Triple Modular Redundancy (TMR) 2-out-of-3 consensus across independent reasoning voter decisions for Tier 0 infrastructure mutations.",
    inputSchema: {
      type: "object",
      properties: {
        votes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              modelId: { type: "string" },
              approved: { type: "boolean" },
              assertionHash: { type: "string" },
              rationale: { type: "string" }
            },
            required: ["modelId", "approved", "assertionHash", "rationale"]
          },
          description: "List of voter decisions to adjudicate"
        }
      },
      required: ["votes"]
    }
  },
  {
    name: "eos_synapse_propagate_golden_path",
    description: "Propagates an architectural discovery or Golden Path across registered fleet repositories with topological ordering and Merkle validation.",
    inputSchema: {
      type: "object",
      properties: {
        patternId: { type: "string", description: "Identifier of the architectural pattern or Golden Path" },
        targetRepos: { type: "array", items: { type: "string" }, description: "Optional list of target repositories" }
      },
      required: ["patternId"]
    }
  },
  {
    name: "eos_synapse_fleet_knowledge_query",
    description: "Queries cross-fleet architectural knowledge patterns and returns fleet health score synthesis and Merkle root.",
    inputSchema: {
      type: "object",
      properties: {
        categoryFilter: { type: "string", description: "Optional filter: 'PERFORMANCE_OPT', 'SECURITY_HARDENING', 'FINOPS_GOVERNANCE', 'AEROSPACE_SAFETY', 'GOLDEN_PATH'" }
      }
    }
  },
  {
    name: "eos_synapse_mesh_status",
    description: "Queries real-time operational status, synchronization events, and Merkle root of the Cross-Fleet Neural Synapse mesh.",
    inputSchema: {
      type: "object",
      properties: {
        reset: { type: "boolean", description: "Optional flag to reset synapse status and knowledge graph" }
      }
    }
  },
  {
    name: "eos_planetary_mesh_evacuate_traffic",
    description: "Executes deterministic sub-500ms multi-cloud traffic evacuation from a degraded cloud provider (AWS, GCP, Vercel) with 2-of-3 quorum consensus, proportional traffic reweighting, and SHA-256 state attestation.",
    inputSchema: {
      type: "object",
      properties: {
        providerId: { type: "string", description: "Identifier of the cloud provider to evacuate ('aws', 'gcp', 'vercel')" },
        reason: { type: "string", description: "Operational rationale or outage trigger description" }
      },
      required: ["providerId"]
    }
  },
  {
    name: "eos_planetary_mesh_health_matrix",
    description: "Queries real-time telemetry, P99 latency, error rates, assigned traffic weights, and quorum consensus across all registered planetary cloud providers.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "eos_planetary_mesh_status",
    description: "Queries planetary multi-cloud evacuation mesh status, total evacuations executed, flapping suppression counters, and Merkle state root.",
    inputSchema: {
      type: "object",
      properties: {
        reset: { type: "boolean", description: "Optional flag to reset evacuation mesh to nominal active-active state" }
      }
    }
  },
  {
    name: "eos_antigravity_direct",
    description: "Primary Antigravity Mission Director: classifies an engineering directive into its EOS execution profile, checks Law IV External Write Barrier preconditions against registry.json, prescribes the ordered DAG of EOS MCP tools to run, and returns a SHA-256 receipt.",
    inputSchema: {
      type: "object",
      properties: {
        directive: { type: "string", description: "User request or engineering mission directive to direct" },
        target: { type: "string", description: "Target registered project ID or workspace path (default: 'eos-system')" }
      },
      required: ["directive"]
    }
  },
  {
    name: "eos_antigravity_doctor",
    description: "Audits the end-to-end Antigravity <-> EOS MCP integration health: global mcp_config.json fleet env bindings, SingleServerInvariant, native eos-governance plugin, hooks, progressive-disclosure skills, and NTFS junction integrity.",
    inputSchema: {
      type: "object",
      properties: {
        geminiConfigDir: { type: "string", description: "Optional path to ~/.gemini/config directory" }
      }
    }
  },
  {
    name: "eos_sqlite_ledger",
    description: "Zero-dependency Durable SQLite WAL + FTS5 + SHA-256 hash-chained bitemporal ledger (node:sqlite). Supports append ('record'), full-text search ('search'), listing ('recent'), and cryptographic chain verification ('verify').",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["record", "search", "recent", "verify"], description: "Ledger operation to execute (default: 'verify')" },
        category: { type: "string", enum: ["MISSION_DIRECTION", "ARCHITECTURE_DECISION", "SECURITY_AUDIT", "VERIFICATION_RECEIPT", "GENTLEMAN_ENGRAM_SYNC"], description: "Entry category (for 'record')" },
        projectId: { type: "string", description: "Target project ID (default: 'eos-system')" },
        title: { type: "string", description: "Entry title (required for 'record')" },
        payload: { type: "object", description: "Structured JSON metadata payload (for 'record')" },
        engramTopicKey: { type: "string", description: "Optional Engram topic_key cross-reference" },
        query: { type: "string", description: "FTS5 full-text search query (for 'search')" },
        limit: { type: "number", description: "Maximum records to return (1-100, default: 10)" },
        databasePath: { type: "string", description: "Optional confined ledger database path within projectRoot or ':memory:'" }
      }
    }
  },
  {
    name: "eos_ast_analyze",
    description: "Compiler-grade TypeScript AST architecture & Node 24 strip-only verifier. Parses real TypeScript ASTs to verify Layer-0 zero-dependency purity, absence of prohibited TS constructs (enum, namespace, parameter properties), exported symbols, and exact cyclomatic complexity.",
    inputSchema: {
      type: "object",
      properties: {
        targetDir: { type: "string", description: "Target directory relative to workspace root (default: 'src/core')" },
        projectId: { type: "string", description: "Optional registered fleet projectId from docs/projects/registry.json" }
      }
    }
  },
  {
    name: "eos_gentleman_audit",
    description: "Audits the unified EOS System + Gentleman Programming AI Ecosystem co-governance stack inside Google Antigravity (eos-system MCP, gentle-ai CLI, engram CLI+MCP, gga+.gga, context7 MCP, and agent-teams-lite SDD + judgment-day skills).",
    inputSchema: {
      type: "object",
      properties: {
        geminiConfigDir: { type: "string", description: "Optional path to ~/.gemini/config directory" }
      }
    }
  },
  {
    name: "eos_gentleman_update",
    description: "Autonomous Evergreen Auto-Updater for Gentle-AI and the complete Gentleman Programming AI Stack (gentle-ai, engram, gga, agent-teams-lite skills). Checks upstream SemVer tags & commits, verifies SHA-256 checksums, hot-swaps binaries with rollback, and preserves the EOS Constitution.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["status", "check", "apply"], description: "Operation mode: 'status' (fast state read), 'check' (upstream SemVer check), or 'apply' (download, verify SHA-256 & hot-swap upgrades)" },
        force: { type: "boolean", description: "Force re-verification/re-sync even when versions match" }
      }
    }
  },
  {
    name: "eos_enterprise_workspace",
    description: "Enterprise Multi-Project Workspace Governor: inspects polyglot monorepo topologies, workspace members, OpenAPI/Protobuf/GraphQL/Prisma/TLA+ contracts & lockfile posture ('inspect'), lists registered fleet projects & Law IV status ('list'), safely onboards external repositories at LEVEL_1_READ_ONLY_AUDIT with zero external writes ('onboard'), and executes bounded structural verification gates ('verify').",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "inspect", "onboard", "verify"], description: "Operation mode (default: 'list')" },
        projectId: { type: "string", description: "Registered fleet projectId (for 'inspect'/'verify') or new project slug (for 'onboard')" },
        subPath: { type: "string", description: "Optional confined relative subdirectory inside the registered project" },
        targetPath: { type: "string", description: "Candidate local directory path (used when onboarding a new repository)" },
        projectName: { type: "string", description: "Human-readable project name (for 'onboard')" },
        remoteUrl: { type: "string", description: "Optional Git remote URL (for 'onboard')" },
        dryRun: { type: "boolean", description: "Preview onboarding artifacts without writing to control-plane disk (default: true)" }
      }
    }
  },
  {
    name: "eos_evolve_module",
    description: "DeepMind Sovereign Evolutionary Engine: executes continuous multivariate fitness evaluation (AlphaEvolve), semantic AST clustering (AlphaCode 2), double-blind adversarial flow checks (AlphaCodium), and Flash-to-Pro token circuit breaker.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["evaluate", "cluster", "lock_interface", "circuit_breaker"], description: "Evolutionary operation mode" },
        targetModulePath: { type: "string", description: "Target module or interface file path" },
        candidatePatch: { type: "string", description: "Candidate code mutation patch content" },
        parentSha256: { type: "string", description: "Parent version SHA-256 hash" },
        metrics: {
          type: "object",
          properties: {
            latencyNs: { type: "number" },
            heapDeltaBytes: { type: "number" },
            astPurityScore: { type: "number" },
            cyclomaticComplexity: { type: "number" },
            contractComplianceScore: { type: "number" }
          }
        }
      }
    }
  },
  {
    name: "eos_agent_topology_mesh",
    description: "Agent Topology Compiler & Zero-Copy Communication Mesh (SPEC-048, v54.0.0): compiles acyclic subagent DAGs with cycle detection, dispatches zero-copy ring-buffer mesh events, and meters >70% token coordination savings.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["compile", "publish", "read", "efficiency"], description: "Topology mesh operation mode" },
        dagId: { type: "string", description: "DAG identifier (e.g. DAG-ALPHA-001)" },
        nodes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              assignedModulePath: { type: "string" },
              dependencies: { type: "array", items: { type: "string" } }
            },
            required: ["id", "assignedModulePath", "dependencies"]
          },
          description: "Subagent task nodes for topology compilation"
        },
        emitterAgentId: { type: "string", description: "Source agent ID (for publish)" },
        targetNodeId: { type: "string", description: "Target node ID (for publish)" },
        eventType: {
          type: "string",
          enum: ["AST_MUTATION_DELTA", "CONTRACT_ATTESTATION", "VERIFICATION_SIGNAL", "HANDOFF_PROBE"],
          description: "Mesh event type"
        },
        compactPayload: { type: "object", description: "Compact payload dictionary" },
        sinceSequence: { type: "number", description: "Starting sequence number to read from" },
        compactBytes: { type: "number", description: "Compact envelope byte length" },
        fullFileContextBytes: { type: "number", description: "Full-file baseline context byte length" },
        recordToLedger: { type: "boolean", description: "Whether to record cryptographic batch attestation in SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_invariant_engine",
    description: "Invariant Verification Engine & Exhaustive Property-Based State Exploration (SPEC-049, v55.0.0): executes seeded state exploration (TLA+ / Antithesis DST), Byzantine chaos fault injection, and automatic failure trace shrinking.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["explore", "verify", "shrink"], description: "Verification engine mode" },
        model: { type: "string", enum: ["transfer", "counter", "consensus", "custom"], description: "State machine model template" },
        seed: { type: "number", description: "Deterministic 32-bit PRNG seed (default: 42)" },
        maxSteps: { type: "number", description: "Maximum state transitions to explore (default: 500)" },
        faultInjectionRate: { type: "number", description: "Stochastic chaos fault rate (0.0 to 1.0, default: 0)" },
        enableShrinking: { type: "boolean", description: "Whether to shrink failing traces to minimal steps (default: true)" },
        recordToLedger: { type: "boolean", description: "Whether to record attestation in SQLite WAL durable ledger" }
      }
    }
  },
  {
    name: "eos_contract_governor",
    description: "Contract Evolution Governor & Breaking-Change Detector (SPEC-050, v56.0.0): executes Nubank Sachem semantic contract diffing, Buf backward-compatibility pre-merge gate, and SQL migration hazard scanning.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["diff", "verify", "sql_lint"], description: "Contract governance action mode" },
        baseSchema: { type: "object", description: "Baseline schema contract object { contractId, fields: [{ name, type, optional }] }" },
        candidateSchema: { type: "object", description: "Candidate schema contract object { contractId, fields: [{ name, type, optional }] }" },
        baseInterfaceSnippet: { type: "string", description: "Baseline TypeScript interface snippet" },
        candidateInterfaceSnippet: { type: "string", description: "Candidate TypeScript interface snippet" },
        ddlSql: { type: "string", description: "SQL DDL migration script to scan for hazards" },
        allowBreakingChanges: { type: "boolean", description: "Explicit override for authorized breaking changes" },
        recordToLedger: { type: "boolean", description: "Whether to persist attestation into SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_surgical_healing",
    description: "Autonomous Closed-Loop Surgical Self-Healing Kernel (SPEC-051, v57.0.0): NASA FDIR root-cause fault localization, Meta SapFix minimal AST surgical patching, and closed-loop in-memory sandbox verification.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["diagnose", "patch", "heal"], description: "Self-healing operation mode" },
        rawError: { type: "string", description: "Raw runtime exception or stack trace message" },
        targetFilePath: { type: "string", description: "Target source code file path" },
        sourceContent: { type: "string", description: "Source code content to diagnose or patch" },
        preferredStrategy: {
          type: "string",
          enum: ["NULL_CHECK_GUARD", "BOUNDARY_CLAMP", "DEFAULT_VALUE_FALLBACK", "TRY_CATCH_WRAPPER", "INVARIANT_ASSERTION"],
          description: "Preferred surgical repair strategy"
        },
        recordToLedger: { type: "boolean", description: "Whether to record healing receipt in SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_tlc_checker",
    description: "Leslie Lamport TLC Formal Model Checker (SPEC-052, v58.0.0): Dual-Mode execution (TLC model check when Java runtime is present; bounded JS simulation fallback when offline), deadlock detection, and SQLite WAL ledger recording.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["check", "status", "detect"], description: "TLC operation mode" },
        specification: { type: "string", description: "Target TLA+ specification name or path (e.g. AgentTopologyMesh.tla)" },
        steps: { type: "number", description: "Simulation steps for bounded fallback (default: 200)" },
        recordToLedger: { type: "boolean", description: "Whether to record verification receipt in SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_github_gate",
    description: "Native GitHub Actions PR Gate (SPEC-053, v59.0.0): Evaluates 7 SecDevOps quality dimensions, runs contract compatibility checks, formats GitHub Check-Run payload and Markdown attestations.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["evaluate", "context", "format_payload"], description: "Gate operation action" },
        simulateFailureStage: { type: "number", description: "Simulate failure in specific stage (1-7) for testing" },
        simulateContractBreach: { type: "boolean", description: "Simulate contract breaking changes for testing" },
        recordToLedger: { type: "boolean", description: "Whether to record PR evaluation receipt in SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_microvm_sandbox",
    description: "Hermetic MicroVM & Isolated Hypervisor Sandbox Engine (SPEC-054, v60.0.0): Multi-tier isolation (Firecracker, Docker gVisor, Ephemeral Node VM), 512MB RAM ceiling, 15s timeout kill, and zero-network barrier.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["run", "doctor"], description: "Sandbox operation mode" },
        codeOrCommand: { type: "string", description: "Code snippet or command to execute in sandbox" },
        memoryLimitMb: { type: "number", description: "Memory limit in MB (default 512)" },
        timeoutMs: { type: "number", description: "Timeout limit in ms (default 15000)" },
        recordToLedger: { type: "boolean", description: "Whether to record execution receipt in SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_wasm_sandbox",
    description: "Capability-Based WebAssembly & MicroVM Agent Sandboxing Engine (SPEC-142): Executes Wasm bytecode or hermetic JS isolate with bounded linear memory (1-256 pages), deterministic trap interception (OOB/unreachable), zero ambient host authority, and SQLite WAL ledger receipt attestation.",
    inputSchema: {
      type: "object",
      properties: {
        tier: { type: "string", enum: ["WASM", "ISOLATE", "MICROVM_SPEC"], description: "Execution tier (default: ISOLATE)" },
        code: { type: "string", description: "JavaScript code snippet or base64-encoded Wasm bytecode" },
        template: { type: "string", enum: ["ADD", "TRAP", "OOB", "LOOP"], description: "Optional built-in test Wasm template (ADD, TRAP, OOB, LOOP)" },
        functionArgs: { type: "array", items: { type: "number" }, description: "Arguments for Wasm exported function" },
        timeoutMs: { type: "number", description: "Execution timeout in milliseconds (default: 2000)" },
        memoryPages: { type: "number", description: "Initial memory pages for Wasm (default: 1, max: 256)" },
        worker: { type: "boolean", description: "Whether to run in a dedicated worker thread with preemptive timeout termination" }
      }
    }
  },
  {
    name: "eos_dashboard_status",
    description: "Real-Time Visual Telemetry & Topological Control Dashboard (SPEC-055, v61.0.0): Inspects dashboard status, telemetry snapshot, agent topology DAG, and SQLite WAL ledger metrics.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["snapshot", "start", "stop"], description: "Action to perform on dashboard" },
        port: { type: "number", description: "Port for dashboard server (default 4321)" },
        recordToLedger: { type: "boolean", description: "Whether to record snapshot receipt in SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_fleet_verify",
    description: "Fleet Production Living Verification & Bautismo de Fuego Engine (SPEC-056, v62.0.0): Executes live synthetic quality & security audits on all 10 registered production targets (HAM-SAH, Donaciones, Biblioteca, Portafolio, ATP, Aberamentho, Glorian/eos-system-ten, TaskFlow, Avo Pack, PTG), auditing TLS headers, WCAG 2.1 AA landmarks, and CWV.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Target URL to verify or 'all' for entire registered fleet" },
        timeoutMs: { type: "number", description: "Timeout limit in ms (default 10000)" },
        recordToLedger: { type: "boolean", description: "Whether to persist attestation receipts in SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_unitotal_evaluate",
    description: "EOS Sovereign Unitotal Nexus & Universal Fleet Mesh (SPEC-057, v63.0.0): Evaluates the Gnostic 10-Sephiroth Architectural Vector (Kether to Malkuth) alongside multi-fleet governance and tooling drift across all registered repositories.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["evaluate", "audit_fleet", "heal_drift"], description: "Evaluation action" },
        repoId: { type: "string", description: "Target repository ID for heal_drift action" },
        recordToLedger: { type: "boolean", description: "Whether to persist attestation receipt in SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_fuzz_hypervisor",
    description: "Autonomous Property-Based Fuzzing & Time-Travel Replay Hypervisor (SPEC-058, v64.0.0): Deterministic Mulberry32 seeded fuzzing, boundary mutations, Delta Shrinkage, SQLite WAL state time-travel replay, and 49 Levels of Subconscious Introspection.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["fuzz", "time_travel", "introspection", "fuzz_and_replay"], description: "Action to perform" },
        seed: { type: "number", description: "Deterministic integer seed for pseudo-random reproduction" },
        iterations: { type: "number", description: "Number of fuzzing iterations (default: 1000)" },
        targetHeight: { type: "number", description: "Target ledger transaction height for time-travel replay" },
        recordToLedger: { type: "boolean", description: "Whether to commit cryptographic verification receipt into SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_conscious_witness",
    description: "Sovereign Conscious Witness & Hot-Patching Core (SPEC-059, v65.0.0): Metacognitive anti-hallucination gatekeeper, intention interrogation against formal EARS specs, and atomic in-memory hot-patching.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["interrogate", "hotpatch"], description: "Action to execute" },
        declaredSpecId: { type: "string", description: "Formal specification identifier (e.g. SPEC-059)" },
        targetFiles: { type: "array", items: { type: "string" }, description: "List of files to be inspected or modified" },
        proposedAction: { type: "string", description: "Clear description of the proposed modification" },
        affirmedSymbols: { type: "array", items: { type: "string" }, description: "Specific code symbols claimed to exist or be modified" }
      }
    }
  },
  {
    name: "eos_sapfix_autoshipper",
    description: "Meta SapFix Autonomous PR & Auto-Merge Engine (SPEC-060, v66.0.0): Automated fault intake, ephemeral worktree isolation, surgical AST remediation, and zero-regression PR manifest generation.",
    inputSchema: {
      type: "object",
      properties: {
        faultId: { type: "string", description: "Identifier of the fault or regression" },
        targetFile: { type: "string", description: "Target source file containing the fault" },
        currentTestCommand: { type: "string", description: "Test command to verify fix" },
        candidatePatch: { type: "string", description: "Optional pre-synthesized patch content" },
        dryRun: { type: "boolean", description: "If true, simulates repair cycle without opening PR or committing" }
      }
    }
  },
  {
    name: "eos_slsa_provenance_sbom",
    description: "SLSA Level 4 Provenance & CycloneDX v1.5 SBOM Engine (SPEC-061, v66.0.0): Generate tamper-evident software bill of materials and in-toto SLSA provenance statements with SHA-256 receipts.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["sbom", "slsa", "both"], description: "Whether to generate CycloneDX SBOM, SLSA provenance, or both (default: both)" },
        commitSha: { type: "string", description: "Git commit SHA for SLSA statement" },
        recordToLedger: { type: "boolean", description: "Whether to record cryptographic receipt into SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_content_addressable_cache",
    description: "Content-Addressable Storage (CAS) & Action Cache Engine (SPEC-062, v66.0.0): Google Bazel-grade blob deduplication, content addressing, and action cache hit/miss execution tracking.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["stats", "put_blob", "get_blob", "has_blob", "put_action", "get_action"], description: "CAS or Action Cache operation" },
        content: { type: "string", description: "Blob content for put_blob" },
        digest: { type: "string", description: "SHA-256 digest for blob lookup" },
        actionKey: { type: "string", description: "Deterministic action key for Action Cache" },
        actionResult: { type: "object", description: "Action result payload for put_action" },
        recordToLedger: { type: "boolean", description: "Whether to record stats receipt into SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_smt_reasoning_prover",
    description: "SMT Automated Reasoning & Formal Logic Prover (SPEC-063, v66.0.0): AWS-grade DPLL/SAT mathematical proof of ABAC security boundaries and topological graph acyclicity.",
    inputSchema: {
      type: "object",
      properties: {
        theoremType: { type: "string", enum: ["abac_safety", "topological_acyclic"], description: "Type of theorem to prove" },
        principalRole: { type: "string", description: "Role under evaluation (e.g. guest)" },
        targetAction: { type: "string", description: "Target action (e.g. ledger_write)" },
        rules: { type: "array", description: "ABAC rules list for safety proof" },
        nodes: { type: "array", items: { type: "string" }, description: "Graph node identifiers for topological proof" },
        dependencies: { type: "object", description: "Dependency map (node -> array of dependencies)" },
        recordToLedger: { type: "boolean", description: "Whether to commit proof receipt into SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_chaos_monkey_live",
    description: "Production Chaos Monkey & Resilience Hypervisor (SPEC-064, v66.0.0): Netflix-grade synthetic latency injection, random bit-flips, exceptions, and circuit breaker blast-radius containment.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["stats", "inject_fault", "run_experiment"], description: "Chaos action to execute" },
        seed: { type: "number", description: "PRNG seed for reproducible chaos" },
        maxFaultBudget: { type: "number", description: "Maximum allowed fault budget before circuit trip" },
        failureRate: { type: "number", description: "Failure probability (0.0 to 1.0)" },
        latencyRangeMs: { type: "array", items: { type: "number" }, description: "[minMs, maxMs] latency injection range" },
        recordToLedger: { type: "boolean", description: "Whether to persist chaos report into SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_bft_swarm_consensus",
    description: "Byzantine Fault Tolerant (BFT) Agent Swarm & Slashing Hypervisor (SPEC-065, v66.0.0): DeepMind-grade multi-agent quorum consensus, security veto enforcement, and quadratic reputation slashing.",
    inputSchema: {
      type: "object",
      properties: {
        proposalId: { type: "string", description: "Unique proposal identifier" },
        action: { type: "string", description: "Proposed action or change" },
        securityImpact: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], description: "Assessed security impact" },
        targetFiles: { type: "array", items: { type: "string" }, description: "Target files affected by proposal" },
        votes: { type: "array", description: "Optional custom agent votes list" },
        recordToLedger: { type: "boolean", description: "Whether to commit consensus report into SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_truetime_commit_wait",
    description: "Google Spanner TrueTime Uncertainty & Commit-Wait Linearizability Engine (SPEC-078/SPEC-082, v71.0.0): Returns bounded interval [earliest, latest], 2ε uncertainty, and evaluates causal commit-wait to guarantee strict linearizability.",
    inputSchema: {
      type: "object",
      properties: {
        epsilonMs: { type: "number", description: "Clock uncertainty half-width in ms (default: 5.0)" },
        recordToLedger: { type: "boolean", description: "Whether to record TrueTime attestation into SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_lsm_storage_put_get",
    description: "Meta RocksDB LSM-Tree Storage Engine with Bloom Filter & SSTables (SPEC-079/SPEC-082, v71.0.0): Put/get key-value telemetry, flush MemTable to immutable SSTable L0, and point-lookup with 512-bit Bloom filter.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["put", "get", "flush", "stats"], description: "Storage action to execute" },
        key: { type: "string", description: "Key identifier" },
        value: { type: "string", description: "Value payload for put action" },
        recordToLedger: { type: "boolean", description: "Whether to record operation receipt into SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_threshold_secret_split_combine",
    description: "Stripe Treasury Shamir (t, n) Threshold Cryptography Engine (SPEC-080/SPEC-082, v71.0.0): Split master secrets over 256-bit safe prime field F_p or reconstruct secret from threshold quorum shares via Lagrange interpolation.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["split", "combine"], description: "Threshold cryptographic action" },
        secret: { type: "string", description: "Master secret to split (text or hex)" },
        threshold: { type: "number", description: "Minimum quorum threshold t (default: 3)" },
        totalShares: { type: "number", description: "Total number of shares n (default: 5)" },
        shares: { type: "array", description: "Array of { x: number, yHex: string } shares for combine action" },
        recordToLedger: { type: "boolean", description: "Whether to record quorum attestation into SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_microvm_enclave_generate",
    description: "AWS Nitro & Firecracker MicroVM Hardware Enclave Launcher (SPEC-081/SPEC-082, v71.0.0): Generates deterministic OCI Firecracker descriptors, Windows Hyper-V container specs, and evaluates host virtualization capabilities.",
    inputSchema: {
      type: "object",
      properties: {
        enclaveId: { type: "string", description: "Unique enclave identifier" },
        vcpuCount: { type: "number", description: "Allocated vCPUs (default: 2)" },
        memSizeMib: { type: "number", description: "Allocated RAM in MiB (default: 512)" },
        kernelPath: { type: "string", description: "Guest kernel path" },
        rootfsPath: { type: "string", description: "Root filesystem image path" },
        vsockCid: { type: "number", description: "Vsock Context Identifier (default: 3)" },
        recordToLedger: { type: "boolean", description: "Whether to record enclave descriptor into SQLite WAL ledger" }
      }
    }
  },
  {
    name: "eos_design_system_govern",
    description: "Tier S-0 Machine-Readable Design System Governor & AST Visual Linter (SPEC-128): audits markup (HTML, CSS, JSX/TSX) against the S-0 Design System Contract (4px grid, elevation shadows, spring transitions, contrast ratios, and dark tactical palette).",
    inputSchema: {
      type: "object",
      properties: {
        targetPaths: {
          type: "array",
          items: { type: "string" },
          description: "List of file paths relative to project root to audit (defaults to index.html and css/eos.css)"
        },
        strict: {
          type: "boolean",
          description: "If true, non-blocking anti-pattern warnings will also fail the audit"
        }
      }
    }
  },
  {
    name: "eos_neurosymbolic_fleet_healing",
    description: "Glorian Neuro-Symbolic Fleet LSC & Closed-Loop Autonomous Healing Control Plane (SPEC-131, v89.0.0): AWS-grade SMT DPLL formal invariant proving, Meta-grade closed-loop AST surgical fault remediation, and Google Rosie-grade fleet-wide Large Scale Change (LSC) campaign sharding and attestation.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["prove_invariant", "heal_fault", "run_lsc_campaign"],
          description: "Neuro-symbolic action to execute"
        },
        theoremName: {
          type: "string",
          description: "Theorem name for SMT invariant proving"
        },
        clauses: {
          type: "array",
          description: "CNF clauses for invariant proof (array of arrays of literal strings)"
        },
        faultId: {
          type: "string",
          description: "Unique fault identifier for closed-loop healing"
        },
        targetFilePath: {
          type: "string",
          description: "Target file path for AST surgical patch synthesis"
        },
        failingLine: {
          type: "number",
          description: "Failing line number (1-based)"
        },
        errorMessage: {
          type: "string",
          description: "Error message or diagnostic signal"
        },
        campaignId: {
          type: "string",
          description: "LSC campaign identifier"
        },
        description: {
          type: "string",
          description: "Campaign description"
        },
        targetModules: {
          type: "array",
          items: { type: "string" },
          description: "List of target modules or fleet repository paths"
        },
        transformationRule: {
          type: "string",
          description: "Declarative refactoring rule"
        }
      }
    }
  },
  {
    name: "eos_fleet_pulse",
    description: "Glorian Fleet Tactical Sovereignty Radar & Health Pulse (SPEC-132, v90.0.0): Real-time multi-repo porcelain health, branch, commit, production URL, Soundcheck score, and esoteric-gnostic archetype audit across all 9 fleet repositories.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["json", "table"],
          description: "Format of the output report: structured JSON or formatted ANSI TUI table (default: json)"
        }
      }
    }
  },
  {
    name: "eos_nocturnal_evolution",
    description: "Glorian Nocturnal Darwinian Evolution & Dead-Code Eradication Engine (SPEC-133, v91.0.0): Autonomous background refactoring audit, AST dead-code eradication, cyclomatic complexity reduction, and DeepMind AlphaEvolve multivariate fitness scoring.",
    inputSchema: {
      type: "object",
      properties: {
        targetDir: {
          type: "string",
          description: "Target directory relative to project root to audit (defaults to 'src/core')"
        },
        format: {
          type: "string",
          enum: ["json", "summary"],
          description: "Format of the report: structured JSON or formatted ANSI TUI summary (default: json)"
        }
      }
    }
  },
  {
    name: "glorian_fleet_health_watchdog",
    description: "Glorian Sovereign Fleet Health Watchdog & Synthetic Security Sentinel (SPEC-134, v92.0.0): Non-blocking synthetic availability probing, TTFB latency measurement, anti-SSRF isolation, and HSTS/CSP security header compliance across all registered fleet projects.",
    inputSchema: {
      type: "object",
      properties: {
        dryRun: {
          type: "boolean",
          description: "Whether to run in simulated nominal dry-run mode (default: false)"
        },
        format: {
          type: "string",
          enum: ["json", "summary"],
          description: "Output format: structured JSON or high-density terminal dashboard (default: json)"
        }
      }
    }
  },
  {
    name: "glorian_constitutional_tribunal",
    description: "Glorian Multi-Model Consensus Engine & Constitutional Tribunal (SPEC-135, v93.0.0): Tier-0 3-Judge Byzantine consensus auditing proposed code mutations, commands, and architecture plans against the 7 Inviolable Commandments with automatic fail-closed veto.",
    inputSchema: {
      type: "object",
      properties: {
        actionId: {
          type: "string",
          description: "Unique mutation or action identifier (e.g. 'MUT-001-ARCH-UPGRADE')"
        },
        category: {
          type: "string",
          enum: ["ARCHITECTURE", "DEPLOYMENT", "CODE_MUTATION", "CONFIG"],
          description: "Category of the proposed action"
        },
        description: {
          type: "string",
          description: "Detailed description of the proposed action and intended outcomes"
        },
        diffOrPayload: {
          type: "string",
          description: "Proposed code snippet, diff, or script payload to inspect"
        },
        targetDirectory: {
          type: "string",
          description: "Target directory or file path of the operation"
        },
        format: {
          type: "string",
          enum: ["json", "summary"],
          description: "Output format: structured JSON or formatted ANSI TUI summary (default: json)"
        }
      },
      required: ["actionId", "category", "description"]
    }
  },
  {
    name: "eos_autonomous_synthesize",
    description: "Autonomous Multi-Tier Code Synthesizer (SPEC-157): Synthesizes complete 4-tier hexagonal software bundles (Domain, Application, Infrastructure, Test) complying with NASA JPL Power of 10, Nubank Datomic, and fail-closed invariants.",
    inputSchema: {
      type: "object",
      properties: {
        directive: {
          type: "string",
          description: "Natural language specification of software capability to synthesize"
        },
        domain: {
          type: "string",
          enum: ["fintech", "audio", "platform", "govtech", "general"],
          description: "Optional architectural domain specialization"
        },
        write: {
          type: "boolean",
          description: "Materialize synthesized files directly to disk (default false)"
        },
        outDir: {
          type: "string",
          description: "Target directory for disk materialization (default 'generated-software')"
        }
      },
      required: ["directive"]
    }
  },
  {
    name: "eos_planetary_doctrine_audit",
    description: "Planetary Apex Operating Doctrine (SPEC-158): Audits the system against the 5 Apex Pillars: ASML Sub-Micron Precision, SpaceX Starship TMR Avionics, DeepMind Invariants, DARPA Hermetic Isolation, and NSA/Livermore Immutability.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["json", "summary"],
          description: "Output format: structured JSON or human-readable summary"
        }
      }
    }
  },
  {
    name: "eos_black_projects_triad_audit",
    description: "Black Projects Triad Operating Doctrine (SPEC-159): Software analogs of Skunk Works Kelly Johnson rules, DARPA OODA, and NRO multi-layer SAR. Denies black-budget/Area-51/Level-5 claims.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["json", "summary"],
          description: "Output format: structured JSON or human-readable summary"
        }
      }
    }
  }
];
