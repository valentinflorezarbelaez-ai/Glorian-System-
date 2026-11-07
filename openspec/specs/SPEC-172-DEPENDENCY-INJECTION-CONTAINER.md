# SPEC-172: Dependency Injection Container — Lifetimes, Constructor Injection, and Circular Dependency Detection

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Enterprise runtimes (Spring, Google Guice, .NET's `IServiceProvider`) separate object construction from object usage through a dependency injection (DI) container that owns resolution and lifetime policy. The lifetime distinction — singleton (one instance per container), transient (new instance per resolve) and scoped (one instance per request/scope) — is what makes components testable and resource-safe, while pre-instantiation circular-dependency detection prevents construction deadlocks that are otherwise extremely hard to diagnose.

This specification governs `EosDependencyContainer` and `EosScopedContainer` in `src/core/eosDependencyContainer.ts`. The module registers factories under string tokens, resolves them by applying the registered lifetime, injects dependencies through a resolver callback passed to each factory, detects cycles before any factory runs, and exposes a deterministic graph fingerprint.

The design keeps the container dependency-free (Law V): registrations are frozen records in a `Map`, the active resolution path is tracked on an explicit `resolvingStack`, and the graph fingerprint is a pure SHA-256 over token-sorted registrations, making container topology reproducible independent of registration order.

## 2. Functional Requirements (EARS Syntax)

- **FR-811 (Ubiquitous - Lifetime Policy Enforcement)**: `THE SYSTEM shall support the lifetimes SINGLETON, TRANSIENT and SCOPED, returning the same cached instance for SINGLETON, a new instance per resolve for TRANSIENT, and one instance per scope for SCOPED.`
- **FR-812 (Event-Driven - Constructor-Injection Resolution)**: `WHEN resolve(token) is invoked, THE SYSTEM shall invoke the registered factory, passing a resolver callback that delegates child token lookups back to resolve(), and shall cache the result only when the lifetime is SINGLETON.`
- **FR-813 (Unwanted Condition - Circular Dependency)**: `IF resolving a token re-enters a token already present on the active resolving stack, THEN THE SYSTEM shall throw an error whose message contains "Circular dependency detected" and the resolution path, before instantiating any factory in the cycle.`
- **FR-814 (Unwanted Condition - Unregistered Token)**: `IF resolve(token) is invoked for a token with no registration, THEN THE SYSTEM shall fail the precondition with a message containing "no registration for token <token>".`
- **FR-815 (State-Driven - Scope Lifecycle)**: `WHILE a scope is active, SCOPED registrations shall resolve to one cached instance per scope while SINGLETON and TRANSIENT tokens delegate to the root container; once dispose() is called, resolve() shall throw a message containing "disposed" and the scope's cached instances shall be cleared.`
- **FR-816 (Ubiquitous - Deterministic Graph Fingerprint)**: `THE SYSTEM shall compute graphFingerprint() as a SHA-256 over registrations sorted by token, each encoded as "<token>:<lifetime>:[<deps>]", yielding the same fingerprint regardless of registration order.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-811 Singleton and Transient Lifetimes Differ in Instance Reuse
  GIVEN a container with token "logger" registered as SINGLETON and token "id" registered as TRANSIENT
  WHEN each token is resolved twice
  THEN the two SINGLETON resolutions return the same instance
  AND the two TRANSIENT resolutions return different instances
```

```gherkin
SCENARIO: BDD-812 Scoped Lifetime Is Shared Within a Scope but Isolated Across Scopes
  GIVEN a container with token "ctx" registered as SCOPED
  WHEN two distinct scopes are created and "ctx" is resolved twice in each
  THEN both resolutions within the same scope return the same instance
  AND resolutions in different scopes return different instances
```

```gherkin
SCENARIO: BDD-813 Circular Dependency Throws Before Instantiation
  GIVEN token "a" depends on "b" and token "b" depends on "a", both TRANSIENT
  WHEN resolve("a") is invoked
  THEN the container throws an error matching /Circular dependency/
  AND neither factory completes instantiation
```

```gherkin
SCENARIO: BDD-814 Unregistered Token Is Rejected
  GIVEN a container with no registration for the token "ghost"
  WHEN resolve("ghost") is invoked
  THEN the container throws an error matching /no registration/
```

## 4. Architecture Decision Records (ADRs)

- **ADR-172-1: Factory functions with an injected resolver callback, not decorator metadata**

  - _Context_: Reflection/decorator-based injection requires runtime metadata and usually a compiler transformation, conflicting with the zero-dependency constraint.
  - _Decision_: Register an explicit `FactoryFn` per token; resolution passes a `(child) => resolve(child)` resolver so factories declare their dependencies by calling it, and lifetime metadata is data (`Lifetime`) rather than reflected types.
  - _Consequence_: Fully type-checked and dependency-free (Law V), at the cost of more verbose registration code and dependencies declared through the `deps` array for fingerprinting.

- **ADR-172-2: Explicit resolving-stack cycle detection before factory execution**
  - _Context_: Cycles that are only discovered while executing factories cause partial construction, leaked half-built objects and hard-to-trace hangs.
  - _Decision_: Maintain a `resolvingStack` of in-progress tokens and, on re-entry of a token already on the stack, throw a formatted "Circular dependency detected: a -> b -> a" error before invoking the cyclic factory.
  - _Consequence_: Misconfigured graphs fail fast and deterministically; the resolver must always pop the stack in a `finally` block to remain correct under exceptions.

## 5. Atomic Task DAG

1. [x] **TASK-172-1**: Author the SPEC-172 specification defining lifetime semantics and failure conditions.
2. [x] **TASK-172-2**: Implement `EosDependencyContainer` with registration, lifetime-aware resolution and cycle detection in `src/core/eosDependencyContainer.ts`.
3. [x] **TASK-172-3**: Implement `EosScopedContainer` with per-scope instance caching, disposal and the deterministic `graphFingerprint()`.
4. [x] **TASK-172-4**: Add BDD coverage for singleton/transient/scoped lifetimes, cycles and unregistered tokens in `test/eosBigTechDataPlane.test.mjs`.
