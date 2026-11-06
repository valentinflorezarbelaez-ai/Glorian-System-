# PLAN-CRUD-SLACK-001: HEXAGONAL ARCHITECTURE PLAN & DECISION RECORDS

## 1. Governance & Owner Approval
- **Plan ID**: `PLAN-CRUD-SLACK-001`
- **Spec Reference**: `SPEC-CRUD-SLACK-001`
- **Owner Approval Status**: `OWNER_APPROVAL` GRANTED (Explicit owner mandate by Valentín Flórez Arbeláez on `2026-10-30` to execute end-to-end EOS Big Tech Tier-1 engineering and Vercel production deployment for `Crud-slack`).

---

## 2. Clean / Hexagonal Layer Topology

```text
c:\Users\valen\Crud-slack\
├── src/
│   ├── domain/                  # 100% Pure Layer-0 Core (Zero DOM, HTTP, or framework imports)
│   │   ├── taskEntities.mjs     # Canonical schemas, factories, priority & status invariants, CSV/XSS guards
│   │   ├── deterministicNlp.mjs # Neuro-symbolic ES/EN clause splitter, imperative verb & temporal parser
│   │   ├── groundingVerifier.mjs# Anti-hallucination verifier (quote span check + temporal anchor audit)
│   │   └── taskBoardStore.mjs   # Pure immutable CRUD reducer with idempotency & audit trail
│   ├── application/             # Pure Use-Case Orchestration
│   │   ├── analyzeRequest.mjs   # Coordinates AI Port -> Grounding Verifier -> Fallback Circuit Breaker
│   │   └── exportTasks.mjs      # SharePoint/Planner CSV (RFC 4180 + injection guard), Slack MD, JSON
│   ├── infrastructure/          # Ports & Adapters
│   │   ├── geminiAdapter.mjs    # Gemini 3.8 Flash (/v1beta/interactions) Structured Output REST adapter
│   │   └── storageAdapter.mjs   # Browser localStorage persistence adapter with schema version migration
│   └── ui/                      # Thin Accessible Presentation Layer (WCAG 2.1 AA)
│       ├── presets.mjs          # Canonical challenge case + realistic Slack/Teams/SharePoint scenarios
│       └── main.mjs             # Reactive DOM controller (Table, Kanban, CRUD dialog, Presentation deck)
├── api/                         # Vercel Node.js 24 Fluid Compute Functions (Web Request/Response API)
│   ├── analyze.mjs              # POST /api/analyze (Rate limiter, validation, Gemini + L0 fallback)
│   └── health.mjs               # GET /api/health (CNCF health probe + W3C traceparent telemetry)
├── css/
│   └── styles.css               # High-craft executive design system (Dark/Light, Mobile-first, Print-ready)
├── scripts/
│   └── verify-strict.mjs        # 7-Stage Fail-Closed SecDevOps & SDD Verification Gate + Evidence generator
├── test/
│   └── taskflow.test.mjs        # Native node:test suite covering BDD-CS-001..005, security, and API routes
├── docs/                        # Complete in-repo SDD & Executive Presentation documentation
└── index.html                   # Semantic HTML5 SPA + JSON-LD + Executive Challenge Presentation Deck
```

---

## 3. Architecture Decision Records (ADRs)

### ADR-CS-001: Neuro-Symbolic Dual-Engine Extraction (Gemini 3.8 Flash + Layer-0 Grounding Verifier)
- **Status**: `ACCEPTED`
- **Context**: Pure LLM wrappers suffer from two critical production flaws in task extraction: (1) temporal hallucination (fabricating exact calendar dates when messages only say *"pronto"* or *"antes de la reunión"*), and (2) brittle availability if API keys are missing, rate-limited, or unreachable during live evaluation.
- **Decision**: Pair `gemini-3.8-flash` (`/v1beta/interactions` with strict JSON Schema `response_format`) behind a server-side adapter with a pure Layer-0 `groundingVerifier.mjs` and `deterministicNlp.mjs` fallback engine. Every task emitted by the LLM is audited against the raw input text: any ungrounded date is automatically converted into an explicit `MISSING_INFO` flag, and any upstream API failure triggers sub-2ms deterministic extraction.
- **Rejected Alternatives**:
  1. *Client-side direct LLM call with exposed API key*: Rejected — catastrophic violation of EOS Law VI (Zero Plaintext Secrets).
  2. *Unverified LLM output rendered directly to UI*: Rejected — fails anti-hallucination requirement ("señalando la información faltante en lugar de inventarla") and provides no answer to *"¿Cómo comprobarías que las tareas identificadas por la IA son correctas?"*.
  3. *Heavy third-party NLP/UI frameworks (`langchain`, `moment`, `lodash`, full SPA bundler bloat)*: Rejected — introduces transitive dependency bloat and supply-chain CVE exposure when Node.js 24 + modern ES Modules solve the problem with `0` runtime dependencies.

### ADR-CS-002: SharePoint Lists & Omnichannel Interoperability with Formula-Injection Defense
- **Status**: `ACCEPTED`
- **Context**: Extracted tasks only deliver real workplace value if teams can edit them (full CRUD) and move them directly into operational tools (Microsoft SharePoint Lists, Planner, Excel, Slack, Teams). However, exporting untrusted chat text to CSV introduces OWASP CSV Formula Injection risks (`=CMD|...`).
- **Decision**: Implement full client-side CRUD state management plus RFC 4180 UTF-8 BOM CSV export tailored to SharePoint Lists / Microsoft Planner columns, neutralizing dangerous leading formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`).
- **Rejected Alternatives**:
  - *Read-only static AI text output*: Rejected — prevents users from resolving the very missing deadlines that the AI flagged.
