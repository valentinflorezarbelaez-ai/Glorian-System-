# CLAUDE.md — SPOTIFY & NUBANK DUAL-ENGINE AGENT DIRECTIVES
<!-- Governed by OpenSpec SPEC-012, SPEC-014 & Spotify/Nubank Agentic SDLC -->

## Build, Test & FinOps Commands
- Full Strict SecDevOps Gate: `npm run verify:strict`
- Unit & Chaos Tests: `node --test test/*.test.mjs`
- Go Canonical Format: `gofmt -s -w .`
- Go Unit Tests: `go test -v ./...`
- Go Race Condition Detector: `go test -race ./...`
- Go Memory Allocation Benchmark: `go test -bench=. -benchmem ./...`
- Go Titan Native Benchmark: `node bin/eos.mjs go benchmark`
- Honk Background Dispatch: `node bin/eos.mjs honk dispatch --directive "<directive>"`
- Xirp Context Sync: `node bin/eos.mjs xirp sync`
- AGI Harness — Axioms: `eos agi axioms`
- AGI Consult: `eos consult "<problem>"`  
- AGI Forge List: `eos forge list`
- AGI Test Suite: `node --test test/eosAgiHarness.test.mjs`

## Code & Architecture Standards
- **90/10 Rule**: 90% Go for cloud microservices/APIs, 10% Rust for low-level audio DSP.
- **FinOps Standard**: Static stripped binaries (`-ldflags="-s -w"`) in Distroless containers (< 12MB).
- **Idempotency**: All billing, subscription, and playback events must support idempotent deduplication tokens.
- **Zero Allocations**: Critical paths must minimize memory allocations (`0 allocs/op`).
- Domain logic must remain completely pure with zero framework imports.
