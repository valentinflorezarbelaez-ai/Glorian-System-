# Spotify Authorization Platform Lens
<!-- Source: Senior Software Engineer — Authorization (Platform), Toronto / Hybrid Remote -->
<!-- Status: WITHIN_TESTED_SCOPE evaluation doctrine — not a hiring claim, not Level-5 -->
<!-- Trace: PLAN-017 · SPEC-024 · EosSpotifyInstitutionalCodex · BIG_TECH Spotify track -->

## Purpose

When Glorian System audits, scaffolds, or evolves Spotify-aligned work, treat this Authorization Platform job description as the **product-and-platform bar**, not only the six Soundcheck pillars.

The Platform org exists so Spotify can learn fast and scale: infrastructure, tools, frameworks, and capabilities for ~1B customers. Authorization started for Spotify for Artists and is now foundational across Music, Podcasts, and Audiobooks.

## Domain Focus (non-negotiable)

| Signal from JD | Glorian implication |
| --- | --- |
| Authorization & permissions systems | AuthZ is a first-class platform capability — not a feature bolt-on |
| Creators + teams + agents + licensees + partners | Multi-principal access; team/org models; partner boundaries |
| Secure access to content, profiles, teams | Least privilege, auditability, fail-closed denial paths |
| Backend services at scale | Reliability, performance, and security co-equal with features |
| Relational DBs at large scale | Schema design, query/perf tuning, operational DB discipline |
| Product-oriented platform | Technical choices must map to creator UX and business outcomes |
| Pragmatic engineering | Prefer simpler durable solutions over unnecessary complexity |
| Cross-stack when needed | Backend-led; contribute to UX/data surfaces when it unblocks |

## What “working with Spotify” means here

1. **Own critical path systems** — authorization, permissions, team management that let creators and partners manage presence safely.
2. **Evolve architecture under growth** — more users, use cases, and products without sacrificing reliability/performance/security.
3. **Think platform-wide** — APIs, dependencies, data flows, and blast radius beyond a single service.
4. **Collaborate across product / frontend / data** — reusable platform capabilities, not one-off service silos.
5. **Raise engineering quality** — design debates, operational excellence, knowledge sharing.

## Stack & skill priors (evaluation, not mandate)

- Deep backend service design/build/operate experience.
- Java or comparable JVM/backend ecosystems as the Spotify baseline; Glorian Layer-0 remains pure Node/TypeScript for the control plane — map concepts, do not invent fake Java parity claims.
- Distributed, large-scale, or business-critical systems.
- Large-scale relational databases (optimization and tuning).
- Product sense: link tech decisions to user and business results.
- Comfortable full-stack contribution; primary strength remains backend.

## Location / operating context

- Role home base: Toronto; hybrid flexibility with some in-person meetings.
- Glorian fleet Spotify track remains remote-first governance; when simulating Spotify Platform work, prefer **authorization + creator ecosystem** scenarios over generic music-player demos.

## Mapping to existing Glorian artifacts

| Glorian artifact | How this lens applies |
| --- | --- |
| `EosSpotifyInstitutionalCodex` / 6 pillars | Keep Soundcheck/Golden Path/Canary/Fleetshift; **add AuthZ/permissions as product domain check** when scoring “Spotify-ready” |
| PLAN-017 / SPEC-024 | Institutional codex stays; this lens adds **Authorization Platform product truth** |
| XIRP / Backstage catalog | Declared components should expose ownership for access-control surfaces where claimed |
| Canary / SRE | AuthZ changes are high blast-radius — progressive delivery + kill-switches mandatory |
| AI Engineer 2026 map | Backend + distributed systems + security sit above demo-only agent wrappers |

## Evaluation checklist (agents)

Before claiming Spotify-aligned AuthZ/platform work is solid WITHIN_TESTED_SCOPE:

- [ ] Multi-principal model stated (creator, team member, agent, licensee, partner)
- [ ] Permission checks are explicit, fail-closed, and auditable
- [ ] Scale/reliability/security trade-offs written (not only feature happy-path)
- [ ] Data model / relational concerns addressed if persistence is in scope
- [ ] Platform reuse vs one-off called out
- [ ] No Level-5 or “we are Spotify AuthZ” claims without external IV&V

## Epistemic status

`AUDIT_EXECUTED` for JD capture · `WITHIN_TESTED_SCOPE` for Glorian doctrine use.
Not a statement that Glorian implements Spotify production Authorization.
Not a career or hiring guarantee.

## Source note

Derived from Spotify Careers posting: Senior Software Engineer, Authorization (Platform), Toronto — Platform / Permanent / Remote-flexible. AI may assist hiring review at Spotify; final decisions remain human. See https://lifeatspotify.com/ai-notice.
