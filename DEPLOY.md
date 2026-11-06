# EOS System — Deployment Guide

## Prerequisites
- Node.js 22+
- Git

## 1. Vercel (recommended — zero config)
```bash
# Deploy to Vercel automatically on push to main
# Or manually:
npx vercel --prod
```

## 2. npm package publish
```bash
cd packages/core
npm publish --access public
# Requires: npm login && NPM_TOKEN secret in GitHub
```

## 3. VS Code Extension
```bash
cd packages/vscode-extension
node build.mjs
npx @vscode/vsce package --no-yarn
# → eos-system-vscode-58.0.0.vsix
code --install-extension eos-system-vscode-58.0.0.vsix
```

## 4. GitHub App Bot
```bash
# Deploy to Railway:
cd packages/github-app
# Set env vars: GITHUB_TOKEN, GITHUB_WEBHOOK_SECRET, EOS_PROJECT_ROOT
# Railway auto-detects Node.js and runs: node src/bot.mjs
```
Required env vars:
| Variable | Description |
|---|---|
| `GITHUB_TOKEN` | PAT with `repo:write` |
| `GITHUB_WEBHOOK_SECRET` | Webhook HMAC secret |
| `EOS_PROJECT_ROOT` | Path to EOS clone |
| `PORT` | HTTP port (default: 3000) |

## 5. Running CI locally
```bash
npm test                    # Full 7-stage gate
npm run typecheck           # TypeScript strict check
npm run design:lint         # Design system linter  
npm run a11y                # Accessibility scan
npm run test:pbt            # Property-based tests
npm run test:agi            # AGI harness tests
npm run mutate:ci           # Mutation testing
npm run dora                # DORA metrics
npm run changelog           # Regenerate CHANGELOG.md
```

## 6. Feature flags
```bash
# Enable chaos engineering in CI:
export EOS_FLAG_CHAOS_IN_CI=1

# Enable performance regression testing:
export EOS_FLAG_PERF_REGRESSION=1

# Or create flags.json:
echo '{"chaos_in_ci": true}' > flags.json
```
