# SPEC-134: Glorian Sovereign Fleet Health Watchdog & Synthetic Security Sentinel

**Version**: 1.0.0  
**Milestone**: v92.0.0  
**Status**: APPROVED  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  
**Governing Documents**: `INTAKE-072`, `PLAN-072`, `GLORIAN_20_FRONTIERS_CODEX.md`  

---

## 1. Executive Summary & Intent
SPEC-134 establishes the **Glorian Fleet Health Watchdog & Synthetic Security Sentinel** (`GlorianFleetHealthWatchdog`). It provides a high-throughput, non-blocking, zero-external-dependency synthetic probe engine designed to audit the operational availability, HTTP status, Time to First Byte (TTFB) latency percentiles, and security header conformance across all 9 production fleet endpoints registered in `docs/projects/registry.json`.

---

## 2. Formal Requirements (EARS Syntax)

### FR-001 (Event-Driven: Fleet Health Audit Execution)
CUANDO el operador, tarea programada o agente invoque `glorian fleet:health` o la herramienta MCP `glorian_fleet_health_watchdog`, EL SISTEMA ejecutará el sondeo sintético sobre todos los proyectos registrados en el catálogo de flota activo.

### FR-002 (Error / Unwanted Condition: SSRF Defense & IP Quarantine)
SI una URL objetivo apunta a direcciones de loopback (`127.0.0.1`, `localhost`), rangos privados RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) o metadatos de computación en la nube (`169.254.169.254`), ENTONCES EL SISTEMA abortará la solicitud inmediatamente marcando el estado como `SSRF_QUARANTINE_BLOCKED`.

### FR-003 (State-Driven: Security Header & TTFB Evaluation)
MIENTRAS el centinela evalúa la respuesta HTTP de un endpoint de producción, EL SISTEMA verificará la presencia de cabeceras de protección soberana (`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`) y medirá la latencia TTFB en milisegundos.

### FR-004 (Ubiquitous: Cryptographic Attestation & Ledger Commitment)
EL SISTEMA generará un recibo criptográfico SHA-256 por cada ciclo de inspección completado y registrará la atestación inmutable en el ledger SQLite WAL.

---

## 3. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
FEATURE: Glorian Fleet Health Watchdog & Synthetic Security Sentinel

  SCENARIO: BDD-353: Anti-SSRF Protection & Target URL Validation
    GIVEN an instance of GlorianFleetHealthWatchdog
    WHEN auditing an invalid target URL pointing to "http://127.0.0.1:8080" or "http://169.254.169.254"
    THEN the probe MUST block execution immediately
    AND the result status MUST be "SSRF_QUARANTINE_BLOCKED".

  SCENARIO: BDD-354: Synthetic Probing & Security Header Conformance
    GIVEN an instance of GlorianFleetHealthWatchdog
    WHEN probing mock production endpoints with headers and valid payloads
    THEN the report MUST capture HTTP status, TTFB latency in milliseconds
    AND MUST calculate a Security Conformance Score (0 to 100) based on HSTS and nosniff.

  SCENARIO: BDD-355: MCP Tool Dispatch & Cryptographic Attestation
    GIVEN the EosMcpServer initialized
    WHEN invoking tools/call for "glorian_fleet_health_watchdog"
    THEN the server MUST return a valid JSON payload with "auditStatus": "FLEET_HEALTH_CERTIFIED"
    AND the report MUST include a reproducible 64-character SHA-256 attestation digest.
```

---

## 4. Architectural Boundaries (Law V)
- **Zero Runtime Dependencies**: Strict Layer-0 Node.js native standard libraries (`node:https`, `node:http`, `node:crypto`, `node:url`, `node:fs`, `node:path`).
- **Node 24 Compatibility**: Strip-only TypeScript with standard professional English.
- **Durable Ledger Integration**: Cryptographic write to `docs/evidence/` via `EosDurableSqliteLedger`.
