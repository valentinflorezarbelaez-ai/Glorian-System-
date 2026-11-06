# PLAN-049: Architecture Plan & Decision Record for Fleet Production Verification Engine

**Specification**: SPEC-056  
**Change Reference**: CHANGE-049  
**Target Version**: 62.0.0  
**Architectural Decision Record**: ADR-062  

---

## Architecture Decision Record: ADR-062
**Title**: Pure Layer-0 Production Verification Engine with SSRF Shielding and SQLite Attestation  
**Status**: APPROVED  
**Context**:  
Production validation of live web systems historically depended on heavyweight headless browser dependencies (Puppeteer, Playwright) or generic HTTP libraries (Axios, Got) which add tens of megabytes of external runtime dependencies, violating EOS Law V (Clean/Hexagonal Layer-0 Purity) and Law VI (Zero Secrets & Attack Surface Containment).

**Decision**:  
Implement `EosFleetProductionVerifier` using native `node:https` and regex-based AST/DOM landmark parsing. The engine includes:
1. Strict SSRF filter banning local loops, IPv4 RFC 1918 private subnets, IPv6 link-local, and cloud metadata IPs (`169.254.169.254`).
2. High-speed synthetic probes with a 10s socket timeout and 1MB body streaming ceiling.
3. Automated verification of 4 security dimensions:
   - HTTP Status & Transport Integrity (HSTS, TLS 1.3).
   - Security Headers (nosniff, X-Frame-Options / frame-ancestors, referrer policy).
   - Semantic HTML Landmarks (WCAG 2.1 AA landmark compliance).
   - Core Web Vitals & SEO metadata (TTFB, payload size, viewport, OpenGraph).
4. Direct attestation into `EosDurableSqliteLedger` with SHA-256 monotonic block hashing.

**Rejected Alternatives**:
1. *External Headless Browser (Puppeteer/Playwright)*: Rejected due to 300MB node_modules footprint, non-deterministic CI launch latency, and violation of Layer-0 0-dependency mandate.
2. *Third-Party Cloud API (PageSpeed Insights API)*: Rejected due to mandatory external API keys and cloud dependency.
3. *Manual Developer Testing*: Rejected due to violation of Law III (Evidence Over Claims).
