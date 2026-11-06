# EOS System — Deployment Runbook (RUNBOOK-002)
<!-- Stripe/Netflix standard: every service must have documented deployment procedures -->

## Standard Deployment (Vercel + GitHub)

EOS System auto-deploys on every push to `main` via Vercel GitHub integration.

```bash
# 1. Verify all CI gates pass locally
npm test

# 2. Bump version and push
# Edit package.json version manually or use:
node -e "const p=require('./package.json'); p.version=p.version.replace(/\d+$/, n => ++n); require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2))"
git add package.json
git commit -m "chore: bump version to X.Y.Z"
git push origin main

# 3. Verify deployment
# Watch Vercel dashboard → deployment completes in ~45s
curl -s https://eos-system-ten.vercel.app/api/health | jq .service.version
```

---

## Rollback Procedure

### Instant Rollback via Vercel (< 10 seconds)
1. Go to https://vercel.com/valentinflorezarbelaez-ai/eos-system-ten
2. Click **Deployments** tab
3. Find the last stable deployment
4. Click **...** → **Promote to Production**

### Git Rollback (when Vercel rollback is insufficient)
```bash
# Revert last commit
git revert HEAD --no-commit
git commit -m "revert: rolling back to v<previous>"
git push origin main
```

---

## Canary Release Checklist

The `EosProgressiveCanaryMesh` is implemented but not yet connected to Vercel traffic.
Until canary routing is wired, use the following manual canary process:

1. Deploy to a preview URL: `vercel --prebuilt` (creates a preview deployment)
2. Test preview URL manually with production traffic patterns
3. Verify `EosProgressiveCanaryMesh.advanceStage()` would approve (error rate < 0.01%)
4. Promote to production via Vercel dashboard

**Future state:** Wire `EosProgressiveCanaryMesh` to Vercel split testing once traffic volumes warrant it.

---

## Environment Variables (Vercel Production)

| Variable | Required | Description |
|----------|----------|-------------|
| `EOS_MCP_HTTP_TOKEN` | NO | Bearer token for MCP HTTP server (auto-generated if absent) |
| `EOS_SECRETS_PROVIDER` | NO | `env` (default), `aws`, `vault`, `doppler` |
| `EOS_LOG_LEVEL` | NO | `INFO` (default in production) |
| `EOS_MCP_ALLOWED_ORIGINS` | NO | Comma-separated allowed CORS origins |
| `EOS_ANTHROPIC_API_KEY` | NO | For EosPipeline model routing via Anthropic |
| `EOS_GOOGLE_API_KEY` | NO | For EosPipeline model routing via Google |
| `NODE_ENV` | Auto | Set to `production` by Vercel automatically |

---

## Health Check Commands

```bash
# Full health check
curl -s https://eos-system-ten.vercel.app/api/health | jq .

# SLO burn rate only
curl -s https://eos-system-ten.vercel.app/api/health | jq .sliReport.sloGovernorStatus

# MCP stream server concurrency
curl -H "Authorization: Bearer $MCP_TOKEN" https://eos-system-ten.vercel.app/mcp/health | jq .concurrency

# Check version
curl -s https://eos-system-ten.vercel.app/api/health | jq .service.version
```
