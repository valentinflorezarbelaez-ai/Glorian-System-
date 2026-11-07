# SPEC-169: Service Mesh Traffic Policy Engine with Deterministic Weighted Routing

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arboláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

North-south and east-west traffic in a service mesh must be routed by declarative policy that simultaneously expresses path/method/header matching, transport security, caller authorization, and weighted canary splits. The `EosMeshTrafficPolicyEngine` module evaluates such policy in a single deterministic pass, mirroring the route-and-authz model of Envoy and Istio.

Evaluation proceeds in strict order: a request selects the first registered route whose predicates match, that route's mTLS and principal allow-list gates run before any routing, and only then is a destination cluster chosen. Cluster selection is a deterministic weighted split keyed on the route name and caller principal, so the same caller consistently lands on the same cluster rather than flip-flopping across requests.

The engine is deny-by-default: an unmatched request is rejected, and every route must declare at least one destination whose weights sum exactly to 100. It is Layer-0, relying only on shared kernel primitives and a local deterministic string hash.

## 2. Functional Requirements (EARS Syntax)

- **FR-781 (Ubiquitous - Route Registration Weight Invariant)**: `The system shall accept a route only when it declares at least one destination and its destination weights sum exactly to 100, rejecting registration otherwise.`
- **FR-782 (Event-Driven - First-Match-Wins Evaluation)**: `WHEN route evaluates a request, the system shall select the first registered route whose path prefix, HTTP method, and header-equality predicates all match the request.`
- **FR-783 (Unwanted Condition - mTLS Gate)**: `IF the matched route requires mTLS and the request peer is not verified, THEN the system shall deny the request with reason "MTLS_REQUIRED" and a detail naming the route.`
- **FR-784 (Unwanted Condition - Principal Allow-List Gate)**: `IF the matched route declares a non-empty allowed-principal list and the request principal is absent from it, THEN the system shall deny the request with reason "PRINCIPAL_FORBIDDEN".`
- **FR-785 (Event-Driven - Deterministic Weighted Cluster Selection)**: `WHEN the matched route authorizes the request, the system shall map a hash of the route name and principal into a 0-99 bucket, select the destination whose cumulative weight range contains the bucket, and thereby return a stable cluster for that principal.`
- **FR-786 (Unwanted Condition - Deny By Default)**: `IF no registered route matches the request, THEN the system shall deny it with reason "NO_MATCH" and a detail identifying the method and path.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-781 An authorized request routes to a weighted destination
  GIVEN a "payments" route matched by path prefix "/pay" and method POST, requiring mTLS, allowing "svc-checkout", with destinations v1 (90) and v2 (10)
  WHEN a verified POST request to "/pay/1" arrives from principal "svc-checkout"
  THEN the decision kind is "ROUTE"
  AND the selected cluster is either "v1" or "v2"
```

```gherkin
SCENARIO: BDD-782 Transport and authorization gates deny before routing
  GIVEN the "payments" route described above
  WHEN a POST request to "/pay/x" arrives from "svc-checkout" but the peer is not verified
  THEN the decision is DENY with reason "MTLS_REQUIRED"
  AND when the peer is verified but the principal is "mallory"
  THEN the decision is DENY with reason "PRINCIPAL_FORBIDDEN"
```

```gherkin
SCENARIO: BDD-783 Unmatched requests are denied by default
  GIVEN a mesh containing only "payments" ("/pay", POST) and "public" ("/health") routes
  WHEN a GET request to "/nope" arrives
  THEN the decision is DENY with reason "NO_MATCH"
```

```gherkin
SCENARIO: BDD-784 Weighted split is stable per principal and weights must sum to 100
  GIVEN the "payments" route described above
  WHEN the same request from principal "alice" is routed twice
  THEN both decisions select the same cluster
  AND registering a route whose destination weights sum to 90 throws a "weights must sum to 100" error
```

## 4. Architecture Decision Records (ADRs)

- **ADR-169-1: Deny-by-default with first-match-wins route evaluation**

  - _Context_: Ambiguous routing and implicit allows are a common source of security regressions in a mesh; unmatched or ambiguous traffic must never be silently forwarded.
  - _Decision_: Evaluate routes in registration order and return the first match; if no route matches return a "NO_MATCH" deny, and require weights to sum to exactly 100 at registration.
  - _Consequence_: Routing is predictable and fail-closed, but route registration order becomes semantically significant and must be curated deliberately.

- **ADR-169-2: Deterministic principal-keyed weighted selection**
  - _Context_: Canary weight splits must be reproducible for a given caller, otherwise testing and cache locality become erratic and hard to reason about.
  - _Decision_: Compute a stable 32-bit hash of `routeName:principal` (FNV-1a), reduce it modulo 100, and select the destination by cumulative weight ranges.
  - _Consequence_: A caller consistently reaches the same cluster and splits can be verified deterministically, but distribution across a small caller set may deviate from the nominal weights.

## 5. Atomic Task DAG

1. [x] **TASK-169-1**: Author SPEC-169 defining mesh traffic-policy requirements, BDD scenarios, and ADRs.
2. [x] **TASK-169-2**: Implement `src/core/eosMeshTrafficPolicyEngine.ts` with route matching, mTLS and principal gates, and deterministic weighted routing.
3. [x] **TASK-169-3**: Add the `SPEC-169` suite to `test/eosBigTechTransactions.test.mjs` covering routing, both deny gates, NO_MATCH, deterministic split, and weight validation.
4. [x] **TASK-169-4**: Verify with `npm run typecheck` and the CI pipeline stages (7/7 exit code 0).
