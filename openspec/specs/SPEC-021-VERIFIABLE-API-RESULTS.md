# BASE SPECIFICATION: VERIFIABLE API RESULTS (SPEC-021)

## 1. Scope
Governs client-controlled input and reported evaluation, simulation, registry, and health state at the public serverless API boundary and in browser panels.

## 2. Requirements (EARS)
- **UBIQUITOUS**: THE SYSTEM SHALL confine file evaluation to regular files whose resolved real paths remain inside the project root, including after symbolic-link resolution.
- **ERROR-DRIVEN**: IF submitted source code exceeds 100 KiB, THEN THE SYSTEM SHALL reject it before evaluation with HTTP 413.
- **ERROR-DRIVEN**: IF the cognitive evaluator cannot be loaded or run, THEN THE SYSTEM SHALL return a non-success response without synthesizing a passing score or readiness verdict.
- **UBIQUITOUS**: THE SYSTEM SHALL prevent shared caches from storing user-supplied evaluation input or its response.
- **UBIQUITOUS**: THE CI/CD demonstration API SHALL label results as simulated and SHALL NOT claim that repository checks or deployment ran.
- **EVENT-DRIVEN**: WHEN the simulated SAST stage blocks a payload, THE SYSTEM SHALL mark stage 1 `BLOCKED`, mark later stages `NOT_RUN`, and deny deployment eligibility.
- **UBIQUITOUS**: THE public fleet registry SHALL expose project identifiers and configured URLs without revealing local machine paths, and SHALL label health, CI, and local hook states as unprobed unless those checks actually ran.
- **UBIQUITOUS**: THE browser control plane SHALL label command output as illustrative and SHALL NOT imply that browser buttons changed local repositories, pushed commits, or deployed projects.
- **UBIQUITOUS**: THE health endpoint SHALL distinguish handler liveness from subsystem probes and SHALL identify SLO values as targets unless backed by measured time-window data.
- **UBIQUITOUS**: THE JARVIS endpoint SHALL identify keyword classification as heuristic, SHALL fingerprint only the submitted directive, and SHALL explicitly report that it did not call a model, read repositories, run commands, run tests, reach consensus, or deploy.
- **UBIQUITOUS**: THE Big Tech endpoint SHALL serve only bounded, read-only static scenario fixtures and SHALL state that model checking, fault injection, and remediation did not run.
- **UBIQUITOUS**: THE kernel and Omega endpoints SHALL identify kernel-themed data as fixtures and SHALL distinguish a SHA-256 text fingerprint from a cryptographic signature or proof.
- **UBIQUITOUS**: THE browser command console SHALL show supported local commands without claiming to execute them; unsupported command labels SHALL state that no CLI handler exists.
- **UBIQUITOUS**: WHEN the browser scaffold generator creates text, THE SYSTEM SHALL label it as an unverified draft held in browser memory and SHALL NOT claim that files were written, tests passed, or deployment occurred.
- **UBIQUITOUS**: THE HTTP MCP adapter SHALL expose only bounded read-only tools, SHALL reject filesystem reads and mutations, and SHALL limit request and response bodies to 1 MiB.
- **UBIQUITOUS**: THE HTTP MCP adapter SHALL identify local execution scope and SHALL NOT claim external service calls, deployment, or certification that did not occur.
- **EVENT-DRIVEN**: WHEN a client requests an unsupported server-sent event stream, THE HTTP MCP adapter SHALL return HTTP 405 and document stateless JSON-RPC POST as its supported transport.

## 3. Invariants
- API input is untrusted, including file paths and code payloads.
- A failure to evaluate is not evidence of readiness.
- Demonstration telemetry is distinct from execution receipts and deployment state.
- Fleet registration is not evidence of production health, CI success, or local hook installation.
- A successful health-handler response is only process liveness; it is not a subsystem probe or availability SLI.
- A digest of user input is not an execution receipt, signature, or proof of provenance.
- A generated draft or scenario fixture is not evidence that a command ran or that a repository changed.
