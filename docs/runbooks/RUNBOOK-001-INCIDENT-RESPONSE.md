# EOS System — Incident Response Runbook (RUNBOOK-001)
<!-- Google SRE standard: every production service must have incident response runbooks -->

## Severity Classification

| SEV | Criteria | Response SLA | Example |
|-----|----------|-------------|---------|
| SEV1 | Complete service outage, data loss, or security breach | 5 min | All API endpoints 500, auth bypass |
| SEV2 | Partial outage, major feature degraded, SLO burn > 14.4x | 30 min | MCP server down, SLO CRITICAL_BURN |
| SEV3 | Degraded performance, minor feature broken | 4 hours | High latency, single endpoint 4xx spike |
| SEV4 | Non-critical issues, cosmetic bugs | Next business day | Stale version in /health response |

---

## SEV2: SLO CRITICAL_BURN Alert

**Symptom:** `/api/health` returns `sliReport.sloGovernorStatus.healthState = "CRITICAL_BURN"`  
or `isDeploymentFrozen = true`

**Diagnosis:**
```bash
# Check burn rate windows
curl -s https://eos-system-ten.vercel.app/api/health | jq .sliReport.sloGovernorStatus

# Check recent errors in Vercel logs
vercel logs --limit 100 | grep -E '"status":[45][0-9]{2}'
```

**Mitigation:**
1. If just deployed: trigger instant rollback via Vercel dashboard → Deployments → previous deployment → "Promote to Production"
2. If persistent: set `EOS_FEATURE_DISABLE=1` env var in Vercel to enable degraded mode
3. Escalate to squad owner (valentin-florez-arbelaez) if burn continues after rollback

**Resolution:** Burn rate must drop below 6x for 30+ minutes before declaring resolved.

---

## SEV2: MCP Server 429 Rate Limit Flood

**Symptom:** High volume of `POST /message` returning 429 from a single IP

**Diagnosis:**
```bash
# Check X-RateLimit headers in access logs
# X-Request-Id will correlate to specific client
grep '"status":429' access.log | head -20
```

**Mitigation:**
1. If legitimate load: increase `EOS_MCP_HTTP_TOKEN` rotation and notify client
2. If attack: add IP to Vercel Firewall block list
3. If cascade from internal agent: check `EOS_FLAG_AGI_PIPELINE` feature flag

---

## SEV3: Adaptive Concurrency Limiter Shedding Load

**Symptom:** `/api/mcp` or MCP stream server returning 503 with `Server overloaded`

**Diagnosis:**
```bash
# Check concurrency metrics in /health response  
curl -H "Authorization: Bearer $TOKEN" https://eos-system-ten.vercel.app/mcp/health | jq .concurrency
```

**Mitigation:**
1. If `totalShed > 0` and `limit < 20`: concurrency was correctly contracted due to high RTT — wait for recovery
2. If `inFlight` is stuck high: check for hanging LLM API calls (EOS_ANTHROPIC_API_KEY, EOS_GOOGLE_API_KEY timeout)
3. Restart: `vercel redeploy --prod` to reset in-memory limiter state

---

## SEV2: Supply Chain — Secret Detected in Git History

**Symptom:** CI git history scan fails with `Potential secret in commit <sha>`

**Mitigation:**
1. **IMMEDIATE**: Rotate the leaked credential with the provider (GitHub Settings → Secrets, AWS IAM, etc.)
2. Remove from git history: `git filter-branch --force --index-filter "git rm --cached --ignore-unmatch <file>" <sha>..HEAD`
3. Force push: `git push origin main --force` (requires explicit authorization)
4. Add file pattern to `.gitignore` and `.githooks/pre-commit` blocklist
5. File a security incident report in `docs/evidence/` with timeline and affected credentials

---

## Postmortem Template

```markdown
## Postmortem: <Title> — <Date>

### Timeline (UTC)
- HH:MM — First alert fired
- HH:MM — Incident declared SEV N
- HH:MM — Mitigation applied
- HH:MM — Incident resolved

### Root Cause (5 Whys)
1. Why did X happen? → Because Y
2. Why did Y happen? → Because Z
...

### Impact
- Duration: N minutes
- Users affected: N
- Requests failed: N (N% of traffic)
- SLO error budget consumed: N%

### Action Items
| Action | Owner | Due |
|--------|-------|-----|

### Lessons Learned
```

---

## Contacts

- **Primary On-Call:** valentin-florez-arbelaez (squad owner)
- **GitHub Repo:** https://github.com/valentinflorezarbelaez-ai/Glorian-System-
- **Production URL:** https://eos-system-ten.vercel.app
- **Vercel Dashboard:** https://vercel.com/valentinflorezarbelaez-ai/eos-system-ten
