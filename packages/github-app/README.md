# EOS System GitHub App

Automatically comments consulting deliverables on every PR using EOS System.

## What it does

When a PR is opened or updated, the bot:
1. Runs `eos consult` with the PR title and description
2. Generates a full consulting deliverable (5-Whys root cause, ADR, code, risk matrix)
3. Posts it as a collapsible PR comment

## Setup

### 1. Deploy the bot

```bash
# Railway, Fly.io, or any Node.js host
cd packages/github-app
PORT=3000 GITHUB_TOKEN=ghp_... GITHUB_WEBHOOK_SECRET=... EOS_PROJECT_ROOT=/app node src/bot.mjs
```

### 2. Configure GitHub Webhook

In your GitHub repository → Settings → Webhooks:
- Payload URL: `https://your-deployment.railway.app/webhook`
- Content type: `application/json`
- Secret: same as `GITHUB_WEBHOOK_SECRET`
- Events: `Pull requests`

### 3. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | ✅ | PAT with `repo:write` scope |
| `GITHUB_WEBHOOK_SECRET` | ✅ | Webhook HMAC secret |
| `EOS_PROJECT_ROOT` | ✅ | Path to EOS System clone |
| `PORT` | Optional | HTTP port (default: 3000) |
