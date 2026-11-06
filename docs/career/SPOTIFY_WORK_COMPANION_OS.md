# Spotify Work Companion OS (via Glorian)
<!-- Owner: Valentín Flórez Arbeláez -->
<!-- Status: ACTIVE PLAYBOOK · WITHIN_TESTED_SCOPE · not proof of current employment -->
<!-- Purpose: Glorian helps with EVERY work surface — communicate, build, present, seal -->

## ALWAYS ON (default)

See `SPOTIFY_ALWAYS_ON_COMPANION.md` + Cursor rule `spotify-always-on-companion.mdc`.

You do **not** need to re-enable the mode. Paste work context and Glorian runs the full pipeline (draft → build if authorized → present pack). Say `solo consejo` to disable execution.

## How to use this (every day)

When you have any Spotify work task, tell Glorian / Cursor (optional structured form):

> **Mode: Spotify Work Companion**  
> Surface: `<standup | slack | pr | design | demo | 1:1 | incident | chapter | email>`  
> Context: `<paste notes, ticket, draft>`  
> Audience: `<Squad | EM | PM | Chapter | Guild | Cross-tribe>`  
> Goal: `<align | decide | ship | teach | unblock>`

Glorian shall then:
1. Apply Clave de Sol (Subject / Object / Place).
2. Draft in **professional English** (Law VII) unless you explicitly ask for Spanish prep notes.
3. Attach evidence hooks (links, metrics, risks, next steps).
4. Run verify mindset (no DONE without proof).
5. Offer a **spoken 60s version** + **written async version** when presenting.

Templates live in `docs/career/spotify-work-templates/`.

## Map: work surface → Glorian help → template

| Surface | What Glorian does | Template |
| --- | --- | --- |
| Daily standup | Crisp yesterday/today/blockers; user·artist·music impact | `01_standup.md` |
| Slack / Teams async | Clear ask, options, deadline, owner | `02_slack_update.md` |
| Pull Request | Why / what / how tested / rollout / risk | `03_pull_request.md` |
| Design / ADR | Trade-offs, blast radius, decision | `04_design_adr.md` |
| Demo / show & tell | Story arc: problem → ship → proof → ask | `05_demo_presentation.md` |
| Sprint review / stakeholder | Outcomes not activity; metrics; next | `06_stakeholder_update.md` |
| 1:1 with EM | Wins, growth, risks, asks | `07_one_on_one.md` |
| Code review reply | Ego-death; evidence; gratitude | `08_code_review_reply.md` |
| Incident / blameless | Timeline, impact, fix, learnings | `09_incident_blameless.md` |
| Chapter / Guild share | Teaching note; reusable pattern | `10_chapter_guild.md` |
| Cross-team ask | Context, contract, SLA, thanks | `11_cross_team_request.md` |
| Interview / promo packet | Impact narrative + receipts | `12_impact_narrative.md` |

## Rituals (Squad octave)

### Morning (DO)
- Read tickets / Slack threads.
- Ask Glorian: “Prioritize my day for user·artist·music + Squad OKRs.”
- Write 3 outcomes (not 10 tasks).

### Build (RE→SOL)
- Spec delta if behavior changes.
- Implement; keep PR small.
- Glorian drafts PR description before push.

### MI→FA conscious shock
- Self-review diff; run tests.
- Invite review; never defend by pride.

### Present (LA→SI)
- Demo template + 60s pitch.
- Seal with links/metrics.
- Share in Slack with async summary for WFA.

### End of day
- Standup draft for tomorrow.
- One gratitude / unblock note to a teammate when earned.

## Communication principles (Spotify WFA)

1. **Async-first** — write so a teammate in another TZ can decide without a meeting.
2. **One ask per message** — bold the decision needed.
3. **Options > complaints** — A / B / recommend.
4. **Evidence > vibes** — link dashboards, PRs, logs, designs.
5. **Blameless** — systems and learning, not people.
6. **Service** — make the next reader smarter; never trash people or the company.
7. **English artifact quality** — PRs, ADRs, demos in impeccable professional English.

## Presentation excellence checklist

Before any demo or review:

- [ ] One sentence: what changed for listener / artist / music
- [ ] 60-second spoken path
- [ ] Visual or live URL
- [ ] Proof (test, metric, screenshot, receipt)
- [ ] Risk + rollback
- [ ] Explicit ask (merge / feedback / decision)
- [ ] Async Slack summary ready

## Glorian perfection loop (unitotal)

```text
Raw work → Companion Mode → Template fill → English polish
  → Evidence attach → Ego-death pass → Present
  → Feedback → Spec/code fix → Verify → Seal → Teach (Chapter)
```

Linked doctrine: Spotify-only North Star · Octaves method · Unitotal vow · Enter/Value/Stay.

## Boundary (honesty)

This OS prepares and amplifies your craft for Spotify Squad work.  
It does not replace your judgment, your EM’s process, or confidential Spotify internal tools/data.  
Never paste secrets, customer PII, or unreleased proprietary code into untrusted channels.
