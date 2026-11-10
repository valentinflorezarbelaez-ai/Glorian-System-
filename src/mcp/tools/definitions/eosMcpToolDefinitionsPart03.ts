/**
 * EOS MCP TOOL DEFINITIONS — PART 03 of 5 (static "tools/list" schemas).
 * Ordered slice eos_chaos_inject_eval .. eos_trace_sampler_status (42 tools). Pure data (no behavior).
 * Aggregated in order by src/mcp/eosMcpToolDefinitions.ts; do not reorder entries.
 */
import type { EosMcpToolDefinitionInput } from "./eosMcpToolDefinitionTypes.ts";

export const EOS_MCP_TOOL_DEFINITIONS_PART_03: ReadonlyArray<EosMcpToolDefinitionInput> = [
  {
    name: "eos_chaos_inject_eval",
    description:
      "Executes Netflix-grade in-process chaos experiments with synthetic latency, Byzantine bit-flips, and circuit breaker resilience scoring.",
    inputSchema: {
      type: "object",
      properties: {
        experimentName: { type: "string", description: "Name of the chaos trial" },
        iterations: { type: "number", description: "Number of fault injection cycles" },
      },
    },
  },
  {
    name: "eos_hnsw_index_add",
    description:
      "Indexes a high-dimensional vector or document in the pure Layer-0 HNSW multi-layer graph with deterministic token projection (Palantir/Apple standard).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Unique identifier for the vector/document" },
        text: { type: "string", description: "Text content to embed and index" },
        vector: {
          type: "array",
          items: { type: "number" },
          description: "Optional raw Float32 vector (if not using text)",
        },
        metadata: { type: "object", description: "Optional metadata payload" },
      },
      required: ["id"],
    },
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
        efSearch: { type: "number", description: "Exploration queue factor (default: 32)" },
      },
    },
  },
  {
    name: "eos_vector_similarity",
    description: "Computes pure Layer-0 Cosine similarity and Euclidean distance between two texts or vectors.",
    inputSchema: {
      type: "object",
      properties: {
        textA: { type: "string", description: "First text string" },
        textB: { type: "string", description: "Second text string" },
        metric: { type: "string", enum: ["cosine", "euclidean"], description: "Distance metric (default: cosine)" },
      },
      required: ["textA", "textB"],
    },
  },
  {
    name: "eos_monte_carlo_sim",
    description:
      "Executes BlackRock Aladdin-grade stochastic risk simulation across tasks using Beta-PERT distributions and Mulberry32 PRNG.",
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
              pessimistic: { type: "number" },
            },
            required: ["id", "optimistic", "nominal", "pessimistic"],
          },
        },
        iterations: { type: "number", description: "Number of Monte Carlo runs (default: 10000)" },
        seed: { type: "number", description: "Deterministic PRNG seed" },
        deadlineHours: { type: "number", description: "Target SLA delivery deadline in hours" },
      },
    },
  },
  {
    name: "eos_hash_chain_verify",
    description:
      "Appends to or validates the SpaceX/NSA monotonic cryptographic SHA-256 hash-chain ledger for tamper-evident audit receipts.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["verify", "append", "status"], description: "Action to perform" },
        recordId: { type: "string", description: "Evidence record ID (for append)" },
        type: { type: "string", description: "Record type (for append)" },
        summary: { type: "string", description: "Summary text (for append)" },
        metadata: { type: "object", description: "Optional metadata" },
      },
    },
  },
  {
    name: "eos_product_foundry_create",
    description:
      "Synthesizes an industrial-grade, zero-defect product blueprint with hexagonal architecture, EARS/BDD contracts, and 7-stage SecDevOps gate.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product name" },
        domain: { type: "string", description: "Domain (e.g. fintech, audio, ai, saas)" },
        tier: {
          type: "string",
          enum: ["MVP", "ENTERPRISE", "MISSION_CRITICAL", "PLANETARY"],
          description: "Complexity tier (default: ENTERPRISE)",
        },
        entities: { type: "array", items: { type: "string" }, description: "Domain entities" },
        commands: { type: "array", items: { type: "string" }, description: "Application commands/use-cases" },
        platforms: { type: "array", items: { type: "string" }, description: "Platform targets" },
        targetDir: {
          type: "string",
          description: "Optional relative subdirectory inside projectRoot to instantiate or preview the scaffold tree",
        },
        dryRun: {
          type: "boolean",
          description:
            "When targetDir is provided, preview scaffold instantiation without writing files (default: true)",
        },
      },
      required: ["name", "domain"],
    },
  },
  {
    name: "eos_product_foundry_validate",
    description:
      "Validates product topology against hexagonal isolation, acyclic dependency rules, and 100% EARS-to-BDD traceability.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain name" },
        tier: { type: "string", description: "Complexity tier" },
      },
    },
  },
  {
    name: "eos_sovereign_loop_run",
    description:
      "Executes the 21-Step Autonomous Sovereign Engineering Loop (IEEE 830, EARS, BDD, ADR, DAG, 7-Stage Gate, Evidence Sealing).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project identifier" },
        title: { type: "string", description: "Feature or system title" },
        userPrompt: { type: "string", description: "User requirement description" },
        authLevel: { type: "number", description: "Authorization Level (default: 3)" },
      },
      required: ["projectId", "title", "userPrompt"],
    },
  },
  {
    name: "eos_sovereign_loop_stages",
    description: "Returns the complete definition of the 21 Master Engineering Pipeline stages and phase groups.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_agent_session_contract",
    description:
      "SPEC-152 Universal Agent Session Contract: open a multi-IDE session (cursor, antigravity, claude-code, vscode), record mandatory MCP DAG progress, and authorize writes fail-closed until the DAG completes.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["open", "ensure", "record_tool", "authorize_write", "status", "evaluate_write", "align_gentleman"],
          description: "Session contract ops; align_gentleman binds Gentleman Programming Gentle-AI Stack (SPEC-154)",
        },
        ideFamily: {
          type: "string",
          enum: ["cursor", "antigravity", "claude-code", "vscode"],
          description: "IDE family for open/ensure/evaluate_write",
        },
        directive: { type: "string", description: "Mission directive for action open" },
        target: { type: "string", description: "Target project id or path (default eos-system)" },
        sessionId: { type: "string", description: "Session id for record_tool, authorize_write, status" },
        sessionReceipt: { type: "string", description: "Optional receipt check for authorize_write" },
        toolName: { type: "string", description: "MCP tool name for record_tool" },
        paths: { type: "array", items: { type: "string" }, description: "Optional write paths for authorize_write" },
      },
      required: ["action"],
    },
  },
  {
    name: "eos_product_deliver_run",
    description:
      "LADDER-15 Golden Path: Foundry blueprint → SDD package → Sovereign Loop → verification gates → Product Quality Scorecard. Defaults to dry-run; set write=true to materialize under docs/products/<id>/ on the control plane only. write=true uses real package.json purity gates (SPEC-152); scorecard < 80 returns BLOCKED.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product name" },
        domain: { type: "string", description: "Domain (e.g. fintech-ledger)" },
        tier: {
          type: "string",
          enum: ["MVP", "ENTERPRISE", "MISSION_CRITICAL", "PLANETARY"],
          description: "Complexity tier (default MVP)",
        },
        write: {
          type: "boolean",
          description: "When true, materialize SDD under docs/products/<id>/ (control plane only)",
        },
        entities: { type: "array", items: { type: "string" }, description: "Domain entities" },
        commands: { type: "array", items: { type: "string" }, description: "Application commands" },
      },
      required: ["name", "domain"],
    },
  },
  {
    name: "eos_product_deliver_status",
    description: "Returns LADDER-15 Product Delivery Orchestrator status, epistemic target, and tool surface.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_platform_ops_ceiling",
    description:
      "LADDER-16 Platform Ops Ceiling: evaluate IDP SLOs, dogfood scorecard, progressive canary (1→5→25→100), and IV&V readiness. Returns SOVEREIGN_CEILING_10_OF_10_WITHIN_TESTED_SCOPE — never NSA_GRADE.",
    inputSchema: {
      type: "object",
      properties: {
        runCanary: { type: "boolean", description: "Run progressive canary mesh (default true)" },
        controlPlanePristine: { type: "boolean", description: "Working tree porcelain signal (default true)" },
      },
    },
  },
  {
    name: "eos_otel_query_traces",
    description:
      "Query recorded OpenTelemetry distributed traces from SQLite WAL. Filter by name, minimum duration, status code, or limit.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Filter by span or trace name" },
        minDurationMs: { type: "number", description: "Filter traces exceeding this duration in milliseconds" },
        statusCode: { type: "string", enum: ["UNSET", "OK", "ERROR"], description: "Filter by status code" },
        limit: { type: "number", description: "Maximum traces to return (default 20, max 100)" },
      },
    },
  },
  {
    name: "eos_otel_trace_waterfall",
    description:
      "Compute hierarchical trace waterfall with parent-child offsets, duration percentages, and automated bottleneck isolation.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "Trace ID (32-character hex)" },
      },
      required: ["traceId"],
    },
  },
  {
    name: "eos_otel_export_otlp",
    description:
      "Export trace data into canonical OpenTelemetry OTLP/JSON schema v1.3.0 for Jaeger, Honeycomb, or Grafana Tempo ingestion.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "Optional specific trace ID to export" },
      },
    },
  },
  {
    name: "eos_autonomous_heal_loop",
    description:
      "Meta SapFix / Google Auto-Remediation autonomous closed-loop self-healing: isolates fault, synthesizes AST candidate patches, evaluates in sandbox, and promotes verified zero-regression fix.",
    inputSchema: {
      type: "object",
      properties: {
        diagnosticReport: { type: "string", description: "Error diagnostic message or test failure log" },
        targetFile: { type: "string", description: "Optional target source file path to repair" },
        archetype: {
          type: "string",
          enum: [
            "NULL_POINTER_GUARD",
            "TIMEOUT_BACKOFF_RETRY",
            "GRID_SPACING_CONFORMANCE",
            "IMPORT_CYCLE_BREAK",
            "FALLBACK_VALUE_INJECT",
          ],
          description: "Specific self-healing archetype to execute",
        },
        dryRun: { type: "boolean", description: "Evaluate in sandbox without modifying disk (default true)" },
      },
    },
  },
  {
    name: "eos_ast_mutation_synthesize",
    description:
      "Synthesizes surgical AST candidate mutation patches matching a target healing archetype (SapFix standard).",
    inputSchema: {
      type: "object",
      properties: {
        targetFile: { type: "string", description: "Target source file path" },
        archetype: {
          type: "string",
          enum: [
            "NULL_POINTER_GUARD",
            "TIMEOUT_BACKOFF_RETRY",
            "GRID_SPACING_CONFORMANCE",
            "IMPORT_CYCLE_BREAK",
            "FALLBACK_VALUE_INJECT",
          ],
          description: "Target healing archetype",
        },
        symbol: { type: "string", description: "Target symbol name or property" },
      },
      required: ["targetFile", "archetype"],
    },
  },
  {
    name: "eos_self_healing_status",
    description:
      "Returns the real-time operational status and historical audit ledger of the Autonomous Closed-Loop Self-Healing Engine.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "eos_ontology_query",
    description:
      "Palantir Bi-Temporal Ontology Cyclotron: sub-microsecond graph reachability, node status, and historical asOf(t) state.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "Query action ('status', 'transitive', 'asOf')" },
        startId: { type: "string", description: "Root entity ID for transitive closure" },
        predicate: { type: "string", description: "Edge predicate filter" },
        timestamp: { type: "number", description: "Target historical timestamp for asOf(t)" },
      },
    },
  },
  {
    name: "eos_quantum_lattice_seal",
    description:
      "Generates NIST FIPS 203 ML-KEM-768 quantum-resistant lattice attestation seal with centered binomial polynomial reduction.",
    inputSchema: {
      type: "object",
      properties: {
        payload: { type: "string", description: "Payload or attestation proof to seal" },
      },
      required: ["payload"],
    },
  },
  {
    name: "eos_refactor_audit",
    description:
      "Audits codebase for technical debt, dead code, code duplication, and loop complexity. Emits SHA-256 cryptographic receipt.",
    inputSchema: {
      type: "object",
      properties: {
        targetDir: { type: "string", description: "Target directory to audit (defaults to 'src/core')" },
      },
    },
  },
  {
    name: "eos_refactor_execute",
    description:
      "Executes continuous refactoring cycle and code diet optimizer across the project root. Returns verified execution summary with zero side effects.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Root directory of the project (defaults to '.')" },
      },
    },
  },
  {
    name: "eos_synapse_arbitrate",
    description:
      "Bayesian multi-agent intent arbitration: normalizes posterior beliefs P(H|E) and resolves priority ranking with zero deadlocks.",
    inputSchema: {
      type: "object",
      properties: {
        candidates: {
          type: "array",
          description: "List of agent intent candidates with priorBelief and evidenceLikelihood",
        },
      },
      required: ["candidates"],
    },
  },
  {
    name: "eos_dst_simulate",
    description:
      "Runs FoundationDB / Antithesis-style Deterministic Simulation Testing (DST) with seed-based fault injection.",
    inputSchema: {
      type: "object",
      properties: {
        seed: { type: "number", description: "Deterministic numeric seed (e.g. 42)" },
        steps: { type: "number", description: "Total simulation discrete steps" },
        faultRate: { type: "number", description: "Fault injection rate (0.0 to 1.0)" },
      },
      required: ["seed"],
    },
  },
  {
    name: "eos_dbc_verify",
    description: "Verifies Design by Contract (DbC) assertions and guarantees deep immutability via deepFreeze.",
    inputSchema: {
      type: "object",
      properties: {
        sampleValue: { type: "number", description: "Sample numeric input to assert against preconditions" },
      },
    },
  },
  {
    name: "eos_fleet_soundcheck",
    description:
      "Audits registered sovereign fleet repositories against Spotify Backstage Soundcheck dimensions (L0 purity, SAST 0 leaks, working tree cleanliness) and outputs a scored report.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Optional project root path" },
      },
    },
  },
  {
    name: "eos_mcts_tune",
    description:
      "Executes Monte Carlo Tree Search (MCTS) with UCT exploration over multidimensional parameter space to converge to optimal system fitness.",
    inputSchema: {
      type: "object",
      properties: {
        iterations: { type: "number", description: "Total MCTS simulation discrete iterations (default: 120)" },
        seed: { type: "number", description: "Deterministic PRNG seed (default: 42)" },
      },
    },
  },
  {
    name: "eos_canary_rollout",
    description:
      "Executes progressive canary rollout (1% -> 5% -> 25% -> 100%) with fail-closed circuit breaker rollback upon error budget breach.",
    inputSchema: {
      type: "object",
      properties: {
        versionTarget: { type: "string", description: "Target deployment version" },
        previousVersion: { type: "string", description: "Previous stable version" },
      },
    },
  },
  {
    name: "eos_canary_telemetry_evaluate",
    description:
      "Evaluates real-time canary telemetry metrics (error rate, P99 latency, sample volume) to calculate Canary Health Index (CHI) and determine automated progressive promotion or instant circuit breaker rollback.",
    inputSchema: {
      type: "object",
      properties: {
        deploymentId: { type: "string", description: "Vercel or fleet deployment identifier" },
        environment: { type: "string", enum: ["production", "preview"], description: "Deployment environment" },
        stage: {
          type: "string",
          enum: ["CANARY_1_PCT", "CANARY_5_PCT", "CANARY_25_PCT", "FULL_PRODUCTION_100_PCT"],
          description: "Progressive canary stage",
        },
        errorRate5xx: { type: "number", description: "Observed 5xx error rate between 0.0 and 1.0" },
        latencyP99Ms: { type: "number", description: "Observed P99 latency in milliseconds" },
        requestCount: { type: "number", description: "Sample request count during evaluation window" },
        criticalErrorThreshold: {
          type: "number",
          description: "Optional critical error threshold ceiling (default: 0.01)",
        },
      },
      required: ["deploymentId", "environment", "stage", "errorRate5xx", "latencyP99Ms", "requestCount"],
    },
  },
  {
    name: "eos_columnar_telemetry_query",
    description:
      "Executes sub-millisecond in-memory columnar slice aggregations (P50, P90, P99, mean, anomaly counts) across fleet telemetry using Meta SCUBA / Google Monarch standard contiguous TypedArrays.",
    inputSchema: {
      type: "object",
      properties: {
        repoId: { type: "string", description: "Optional fleet repository filter" },
        stage: { type: "string", description: "Optional deployment or canary stage filter" },
        minStatusCode: { type: "number", description: "Minimum HTTP status code (e.g. 400 for errors)" },
        maxStatusCode: { type: "number", description: "Maximum HTTP status code" },
        minTimestamp: { type: "number", description: "Minimum epoch timestamp in milliseconds" },
        maxTimestamp: { type: "number", description: "Maximum epoch timestamp in milliseconds" },
        syntheticSamplesCount: {
          type: "number",
          description: "Optional seed sample count for synthetic benchmarks (default: 1000)",
        },
      },
    },
  },
  {
    name: "eos_cell_bulkhead_route",
    description:
      "Evaluates and routes incoming fleet requests into autonomous bulkhead cells (AWS/Meta Cell-Based Architecture standard), guaranteeing bounded blast radius (<= 1/N), poison pill immunity quarantine, and health-aware failover draining.",
    inputSchema: {
      type: "object",
      properties: {
        partitionKey: {
          type: "string",
          description:
            "Partition key (tenantId, repoId, or requestId) for deterministic FNV-1a consistent hash routing",
        },
        payload: {
          type: "string",
          description:
            "Optional request payload serialized as JSON or string to evaluate against the poison pill quarantine ledger",
        },
      },
      required: ["partitionKey"],
    },
  },
  {
    name: "eos_cell_bulkhead_status",
    description:
      "Retrieves complete health metrics, active in-flight counts, blast radius guarantees, and quarantined poison pill signatures across all partitioned bulkhead cells.",
    inputSchema: {
      type: "object",
      properties: {
        cellId: { type: "number", description: "Optional filter or target cell ID (0..N-1)" },
        setStatus: {
          type: "string",
          enum: ["HEALTHY", "DEGRADED", "DRAINING", "QUARANTINED"],
          description: "Optional state change for target cell",
        },
      },
    },
  },
  {
    name: "eos_slo_burn_rate_evaluate",
    description:
      "Evaluates Google SRE multi-window multi-burn-rate alerting and sliding-window error budget consumption for a fleet service, returning burn rates across 5m, 30m, 1h, and 6h windows, remaining error budget, and deployment freeze status.",
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
              latencyMs: { type: "number", description: "Request latency in ms" },
            },
          },
        },
        evaluationTimestamp: {
          type: "number",
          description: "Optional timestamp epoch ms for evaluation (defaults to now)",
        },
      },
      required: ["serviceId"],
    },
  },
  {
    name: "eos_slo_budget_status",
    description:
      "Queries error budget health and deployment freeze state across all fleet services or a specific service, verifying if canaries or production deployments are permitted under Google SRE error budget governance.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "Optional filter for a specific service ID" },
        checkDeploymentAllowed: {
          type: "boolean",
          description: "If true, explicitly returns whether deployment is permitted (fail-closed check)",
        },
      },
    },
  },
  {
    name: "eos_hedge_request_execute",
    description:
      "Executes a fleet RPC request with Google 'The Tail at Scale' adaptive hedged duplicate dispatch, deadline budget propagation, and cooperative cancellation.",
    inputSchema: {
      type: "object",
      properties: {
        endpointId: { type: "string", description: "Target fleet service or endpoint ID" },
        deadlineMs: { type: "number", description: "Optional request deadline budget in ms" },
        hedgingDelayMs: {
          type: "number",
          description: "Optional explicit hedging delay in ms (defaults to endpoint P95)",
        },
        simulatedPrimaryDelayMs: {
          type: "number",
          description: "Optional simulated primary replica latency in ms for synthetic probes",
        },
        simulatedHedgedDelayMs: {
          type: "number",
          description: "Optional simulated hedged replica latency in ms for synthetic probes",
        },
      },
      required: ["endpointId"],
    },
  },
  {
    name: "eos_hedge_metrics_status",
    description:
      "Retrieves running P50, P95, and P99 latency reservoirs, hedging ratios, deadline shed counts, and anti-storm token bucket health across all endpoints.",
    inputSchema: {
      type: "object",
      properties: {
        endpointId: { type: "string", description: "Optional filter for a specific endpoint ID" },
        recordSampleLatencyMs: {
          type: "number",
          description: "Optional raw latency sample in ms to record for the target endpoint",
        },
      },
    },
  },
  {
    name: "eos_concurrency_evaluate",
    description:
      "Evaluates adaptive concurrency admission and priority-tier load shedding under the Netflix Vegas gradient algorithm and CoDel queue delay management.",
    inputSchema: {
      type: "object",
      properties: {
        priority: {
          type: "string",
          enum: ["CRITICAL", "HIGH", "NORMAL", "BEST_EFFORT"],
          description: "Priority tier of the request (default: NORMAL)",
        },
        queueWaitMs: { type: "number", description: "Observed queue waiting residency time in ms (CoDel check)" },
        releaseAfterSimulatedRttMs: {
          type: "number",
          description: "Optional simulated RTT in ms to record on immediate slot release",
        },
      },
    },
  },
  {
    name: "eos_concurrency_status",
    description:
      "Queries current Vegas gradient, active concurrency limits, in-flight slots, baseline vs smoothed RTT, and shedding statistics by priority tier.",
    inputSchema: {
      type: "object",
      properties: {
        recordLatencyMs: {
          type: "number",
          description: "Optional RTT in ms to feed into the Vegas gradient calculator",
        },
        reset: { type: "boolean", description: "Optional flag to reset governor to nominal state" },
      },
    },
  },
  {
    name: "eos_trace_span_record",
    description:
      "Ingests an OpenTelemetry-compatible span into the dynamic tail-based trace buffer ring, with optional immediate evaluation on root span completion.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "Unique distributed trace identifier" },
        spanId: { type: "string", description: "Unique span identifier" },
        name: { type: "string", description: "Span operation name" },
        durationMs: { type: "number", description: "Span execution duration in ms" },
        statusCode: { type: "integer", description: "HTTP or gRPC status code (5xx triggers 100% sampling)" },
        hasError: { type: "boolean", description: "Explicit error flag triggering 100% sampling" },
        isResilienceEvent: {
          type: "boolean",
          description: "Flag indicating hedging, load-shedding, or circuit breaking",
        },
        isEndSpan: {
          type: "boolean",
          description: "Whether this span completes the trace, triggering immediate sampling decision",
        },
      },
      required: ["traceId", "spanId", "name"],
    },
  },
  {
    name: "eos_trace_sampler_status",
    description:
      "Queries tail-based trace sampling telemetry, active buffer counts, retention statistics, and sampled-by-reason metrics.",
    inputSchema: {
      type: "object",
      properties: {
        evictStale: {
          type: "boolean",
          description: "Optional flag to trigger immediate TTL-based sweep of idle traces",
        },
        reset: { type: "boolean", description: "Optional flag to reset sampler counters to zero" },
      },
    },
  },
];
