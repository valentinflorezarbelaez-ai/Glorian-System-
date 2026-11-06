# PROJECT CONTEXT & INTAKE — CRUD-SLACK (TASKFLOW AI WORKSPACE)

## 1. Executive Metadata
- **Project ID**: `crud-slack`
- **Repository URL**: `https://github.com/valentinflorezarbelaez-ai/Crud-slack.git`
- **Local Target Workspace**: `c:\Users\valen\Crud-slack`
- **Intake Status**: `INTAKE_COMPLETE`
- **Owner & Principal Architect**: Valentín Flórez Arbeláez
- **External Stakeholder / Evaluator**: Luis Soto (SharePoint Platform Software Developer)
- **Date**: `2026-10-30`
- **Governance Standard**: EOS Constitution 7 Inviolable Commandments, Clean/Hexagonal Layer-0 Purity, OWASP ASVS Level 2, WCAG 2.1 AA.

---

## 2. Business Problem & Challenge Context
Teams receive operational requests across fragmented communication channels (Slack, Microsoft Teams, corporate Email/Outlook, and instant messaging). In daily execution:
1. Actionable tasks buried inside unstructured prose are overlooked or forgotten.
2. Implicit dependencies and execution priorities remain unclear.
3. Temporal constraints are partially stated (e.g., *"for Friday"*, *"before the meeting"*), tempting naive AI wrappers to hallucinate exact dates instead of flagging missing information.

### Canonical Benchmark Input
> *"Hola, necesitamos preparar la reunión del equipo para el viernes. Hay que revisar los resultados del mes, actualizar la presentación y enviar la agenda a los participantes antes de la reunión."*

---

## 3. Core Functional Mission
1. **Activity Extraction**: Parse unstructured email or chat messages and extract atomic, actionable tasks.
2. **Structured Organization & Full CRUD**: Organize extracted tasks into an interactive workspace supporting Create, Read (Table, Kanban, Dependency Matrix), Update (inline status, priority, assignee, and missing-deadline resolution), and Delete operations.
3. **Priority Suggestion**: Compute and justify priority tiers (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) considering temporal urgency and prerequisite dependencies.
4. **Anti-Hallucination Temporal Grounding**: Resolve explicit or anchored relative dates against a deterministic reference date while explicitly flagging missing temporal, ownership, or logistical details (`MISSING_INFO`) rather than fabricating values.
5. **Visual Clarity & Enterprise Interoperability**: Present outputs cleanly with visual indicators, source-quote grounding spans, automated clarification-reply drafting, and 1-click export to **SharePoint Lists / Microsoft Planner CSV**, **Slack Markdown**, and **JSON**.
6. **Built-In Executive Defense Suite**: Provide an integrated interactive presentation view and documentation answering all 5 mandatory deliverables and all 5 technical interview questions required by the evaluator.

---

## 4. Constraints & Architectural Directives
- **Layer-0 Dependency Purity**: `dependencies: {}` (zero external runtime npm packages; zero supply-chain CVE surface).
- **Dual-Engine Neuro-Symbolic Resilience**:
  - **Primary Cloud AI Adapter**: Server-side Vercel Node.js 24 Function (`/api/analyze`) invoking Google Gemini (`gemini-3.8-flash`) via `/v1beta/interactions` Structured Outputs (`response_format` JSON Schema).
  - **Deterministic Verification & Failover Core**: Pure Layer-0 neuro-symbolic clause & temporal parser + anti-hallucination grounding verifier ensuring 100% source-quote verification, 0 fabricated dates, and sub-2ms zero-downtime circuit-breaker execution when offline or unauthenticated.
- **Zero Plaintext Secrets**: Server-only `GEMINI_API_KEY` consumption via environment variables; strict SAST gate.
