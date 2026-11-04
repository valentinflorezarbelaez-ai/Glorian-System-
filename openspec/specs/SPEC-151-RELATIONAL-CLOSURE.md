# SPEC-151: Relational Closure on the Repository Knowledge Graph

## 1. Specification Metadata
- **Specification ID**: `SPEC-151`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Related Specs**: `SPEC-145`, `SPEC-040`, `SPEC-149`
- **Architectural Decisions**: `ADR-0187`, `ADR-0188`
- **Module Target**: `src/core/eosKnowledgeGraphEngine.ts`, `src/core/eosOntologyCyclotron.ts`, `src/mcp/eosMcpServer.ts`, `test/eosKnowledgeGraphEngine.test.mjs`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-477 (Event-Driven / Tool instrumentation)**: `WHEN syncGraph() reads an OpenSpec, THE SYSTEM SHALL create an INSTRUMENTS edge from that specification to each MCP tool name that the document cites and that is declared as a tool name in src/mcp/eosMcpServer.ts.`

- **FR-478 (Event-Driven / Coverage edges)**: `WHEN syncGraph() reads a test suite, THE SYSTEM SHALL create a COVERED_BY edge from each cited specification, and from each imported src or api module, to that test suite, provided both endpoints exist as nodes.`

- **FR-479 (Event-Driven / Memory projection)**: `WHEN syncGraph() commits, THE SYSTEM SHALL project the committed nodes and edges into an EosOntologyCyclotron adjacency index.`

- **FR-480 (Event-Driven / Measured closure)**: `WHEN computeMemoryClosure is called for a known node, THE SYSTEM SHALL return the transitive successors, the observed depth, and executionUs measured with process.hrtime.bigint().`

- **FR-481 (Unwanted condition / Unknown node)**: `IF computeBlastRadius or computeMemoryClosure is called with an identifier that is not a node, THEN THE SYSTEM SHALL reject the call with an error whose message contains "Unknown knowledge graph node".`

- **FR-482 (Ubiquitous / Budget and scope)**: `THE SYSTEM SHALL visit each blast-radius node at most once, SHALL report memory-closure duration in microseconds, and SHALL treat 1000 microseconds as the budget for a closure of at most 64 nodes after one warmup. THE SYSTEM SHALL NOT treat this specification as multi-host consensus or as hot Rust compilation.`

---

## 3. Acceptance Criteria (BDD)

```gherkin
SCENARIO: BDD-456 Instrumentation and coverage edges
  GIVEN a synchronized knowledge graph of this repository
  WHEN neighbors of SPEC-151 are read
  THEN an outgoing INSTRUMENTS edge points at mcp:eos_query_knowledge_graph
  AND a COVERED_BY edge points at test/eosKnowledgeGraphEngine.test.mjs
  AND src/core/eosKnowledgeGraphEngine.ts has a COVERED_BY edge to that same test

SCENARIO: BDD-457 Measured in-memory closure
  GIVEN the synchronized graph and a warmup closure of SPEC-145
  WHEN computeMemoryClosure is called for SPEC-145 with maxDepth 8
  THEN the result index is memory-adjacency
  AND executionUs is a positive integer
  AND the reachable set includes at least one successor

SCENARIO: BDD-458 Unknown node fails closed
  GIVEN a synchronized knowledge graph
  WHEN computeBlastRadius is called with "NO-SUCH-NODE"
  THEN the call throws an Error
  AND the message contains "Unknown knowledge graph node"

SCENARIO: BDD-459 Small-graph closure budget
  GIVEN an EosOntologyCyclotron chain of 32 edges
  WHEN transitive closure runs once as warmup and once as the measured call
  THEN the measured executionUs is less than 1000

SCENARIO: BDD-460 MCP memory_closure dispatch
  GIVEN an EosMcpServer whose knowledge graph has been synchronized
  WHEN eos_query_knowledge_graph is invoked with action memory_closure and target SPEC-145
  THEN the tool result action is memory_closure
  AND executionUs is a positive number
  WHEN the same tool is invoked with target "NO-SUCH-NODE"
  THEN the JSON-RPC error message contains "Unknown knowledge graph node"
```
