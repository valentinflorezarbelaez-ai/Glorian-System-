# AI Engineer 2026 Roadmap → Glorian Map

Source: [Fazt — Cómo ser AI Engineer en 2026](https://www.youtube.com/watch?v=g2r1VFIMBGA) / companion article on fazt.dev  
Epistemic state: `WITHIN_TESTED_SCOPE` · Explicitly **not** Level-5 / not ML Researcher track

## 1. Roadmap summary (Fazt)

AI Engineer ≠ ML Engineer ≠ AI Researcher. This path is **software that ships LLM features**, not training from scratch.

| Step | Learn | Point |
|---|---|---|
| 0 | Dev bases already assumed | DB, API/backend, UI, Git, HTTP, Docker |
| 0b | System Design | IA is just new boxes on diagrams you already design |
| 1 | Model basics | tokens, context, temperature, system/user/assistant |
| 2 | Provider APIs + cost | Anthropic/OpenAI; **subscription ≠ production API** |
| 3 | Beyond chat | smart UI fills, backend classify/summarize, heal loops |
| 4 | Prompting (no hype) | short system briefs; models need less prompt theater |
| 5 | Function calling / tools | model executes code, does not only suggest |
| 6 | RAG · MCP · CLI · Skills | start with RAG; MCP as chat connector; skills as reusable prompts |
| 7 | LLMOps | self-host or cloud, rate limit, routing, cache, scale, privacy |

## 2. Glorian already covers (keep)

| Fazt step | Glorian / EOS evidence |
|---|---|
| System Design + gates | Law I–VII, OpenSpec EARS/BDD, tip-seal, 7-stage CI |
| Tools / function calling | MCP registry Phase-1..7 (`eosMcpServer` + handlers) |
| MCP product surface | `eos-system` MCP, SPEC-140 streamable HTTP, SPEC-153 session DAG |
| Skills / CLIs | `.agents/skills/*`, `bin/eos.mjs`, Gentle-AI co-governance |
| RAG / vectors | hybrid knowledge, HNSW, semantic search tools |
| Routing / FinOps | apex model router, FinOps wallet/budget tools |
| Heal / closed loop | autonomous heal, surgical healing, mission golden path |
| Ops honesty | Soundcheck, turbo, tip-seal, Sovereign 5/5 WITHIN_TESTED_SCOPE |
| Spotify Platform bar | Authorization / permissions / creator multi-principal systems (`SPOTIFY_AUTHORIZATION_PLATFORM_LENS.md`) — not Soundcheck theater alone |
| Spotify Music Expression bar | Full-stack Java + React/TypeScript; artist→fan (Canvas/video/countdown/listening parties) (`SPOTIFY_MUSIC_EXPRESSION_FULLSTACK_LENS.md`) |
| Spotify dual-track hire prep | Index: `SPOTIFY_CAREERS_DUAL_TRACK.md` — product excellence + their stack + evidence |
| Glorian soul | Spotify-only North Star (`GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md`) — user·artist·music · Samaelian rigor · fleet Spotify-quality |

## 3. Gaps vs Fazt roadmap (build next)

Ordered by product value, not ceremony:

1. **Cost / token truth UX** — **DONE**: mission `FINOPS_COST_RECEIPT` + Studio `/api/finops` cockpit panel (2026-11-05 w1/w2).
2. **RAG golden path demo** — **DONE hermetic + Biblioteca UI** (wave-2/3): `eosFleetRagGoldenPath` + `SacredRagPanel` on `/biblioteca` (retrieval only, no LLM invention).
3. **Tool-calling evals** — **DONE hermetic**: `test/eosToolCallingFinOpsEval.test.mjs`. Wrong-tool MCP arg fuzz still open.
4. **Model routing policy card** — FinOps receipt on mission + API; dedicated policy card UI still open.
5. **LLMOps privacy lane** — optional local/open-weight path documented; no plaintext secrets (Law VI).
6. **Portfolio evidence** — regenerate via `generate-career-evidence-pack` + `sync-career-evidence-to-portafolio` (wave-2).

## 4. 30-day action DAG (Glorian)

```text
Week 1  Cost receipts on eos_mission_run + FinOps wallet status in UI
Week 2  Biblioteca/Donaciones RAG golden path + BDD
Week 3  Tool-calling eval harness (wrong-tool / wrong-args / budget abort)
Week 4  Portfolio sync + tip-seal; residual: Crud-slack IA-5 rotation
```

## 5. Non-goals

- Not claiming AI Researcher / PhD track
- Not claiming Level-5 / NSA_GRADE
- Not replacing Layer-0 with LangChain dependency theater (`dependencies: {}` remains law)

## Evidence

- Video: `https://www.youtube.com/watch?v=g2r1VFIMBGA`
- Article: `https://fazt.dev/contenido/software-engineer-a-ai-engineer-roadmap`
- Fleet Soundcheck / Sovereign 5/5 / Phase-7 T7c −25% as of 2026-11-04 tip-seal
