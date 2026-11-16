# SPEC-308: Decentralized Cross-Fleet Merkle-CRDT State Replication Protocol

## Metadata

- **Specification ID**: `SPEC-308`
- **Change Reference**: `CHANGE-170`
- **Version**: `1.0.0`
- **Status**: `STABLE_AND_ACTIVE`
- **Domain**: Distributed Consensus / Merkle-DAG / CRDT Convergence / WASM Linear Memory / Zero Dependencies
- **Author**: Valentin Florez Arbelaez & Google Antigravity (Glorian Core Architects)
- **Compliance**: IEEE 830 EARS Requirements, BDD Acceptance Criteria, Zero Third-Party Dependencies (Law V)

---

## 1. Executive Summary & Architectural Invariants

`SPEC-308` defines Glorian System's Decentralized Cross-Fleet Merkle-CRDT State Replication Engine (`EosCrdtStateReplicatorCore`). Modeled after the decentralized, conflict-free architectures of Cloudflare Workers and Figma multiplayer synchronization, it enables all 9 registered fleet repositories to synchronize distributed state changes without centralized locks or single points of failure.

By integrating:

1. **Merkle-DAG Content Addressing**: Every mutation is an immutable, cryptographically verifiable node identified by a SHA-256 Content ID (`cid`).
2. **Mathematically Proven Join-Semilattices**: Deterministic state convergence ($\mathcal{S}, \sqcup$) across Last-Write-Wins (LWW) registers, Positive-Negative (PN) counters, and Observed-Remove (OR) sets.
3. **WASM Linear Memory Hardware Acceleration**: High-speed vector merge operations executing in zero-copy memory buffers at near-native CPU speeds (~100 ns).
4. **Logarithmic Anti-Entropy Reconciliation**: $O(\log N)$ Merkle tree comparison and delta synchronization to resolve partition divergences.
5. **Cryptographic Receipts**: Tamper-proof attestation in `docs/evidence/CRDT_REPLICATION_RECEIPT.json`.

---

## 2. IEEE 830 Functional Requirements (EARS Syntax)

### FR-308-01: Inmutabilidad y Direccionamiento por Contenido en Merkle-DAG (Ubiquitous)

EL SISTEMA representará cada mutación de estado de la flota como un nodo inmutable en un Grafo Acíclico Dirigido (Merkle-DAG), calculando su identificador criptográfico (`cid`) mediante SHA-256 sobre sus nodos padre, reloj lógico de Lamport, actor emisor y carga útil tipada.

### FR-308-02: Convergencia Determinista en Semirretículo de Unión (Ubiquitous)

EL SISTEMA garantizará que toda operación de fusión de estados cumpla formalmente las propiedades algebraicas de un semirretículo de unión (Join-Semilattice): Asociatividad $((a \sqcup b) \sqcup c = a \sqcup (b \sqcup c))$, Conmutatividad $(a \sqcup b = b \sqcup a)$ e Idempotencia $(a \sqcup a = a)$, convergiendo al mismo estado independientemente del orden de llegada de los paquetes de red.

### FR-308-03: Soporte Polimórfico de Primitivas CRDT Bounded (Event-Driven)

CUANDO un actor distribuido emite una mutación, EL SISTEMA soportará de manera nativa primitivas de tipo LWW-Register (resolución por timestamp lógico y desempate lexicográfico de actor), PN-Counter (agregación de vectores incrementales y decrementales) y OR-Set (adición con etiquetas únicas y remoción referencial por tag).

### FR-308-04: Aceleración de Fusión Vectorial en Memoria Lineal WASM (Event-Driven)

CUANDO se fusionan vectores de estado o relojes de versión de alta dimensionalidad entre réplicas de la flota, EL SISTEMA ejecutará algoritmos de fusión vectorial optimizados en memoria lineal de WebAssembly (`WebAssembly.Memory`) o buffers de acceso directo Tipados, logrando latencias inferiores a 1 microsegundo por operación de mezcla.

### FR-308-05: Sincronización Anti-Entropía Logarítmica por Árbol Merkle (Event-Driven)

CUANDO dos nodos de la flota inician una sesión de sincronización anti-entropía, EL SISTEMA comparará en primer término sus hashes raíz Merkle; SI los hashes difieren, ENTONCES EL SISTEMA descenderá por las ramas del árbol en tiempo logarítmico $O(\log N)$ para aislar las diferencias exactas y transmitir únicamente el conjunto delta no sincronizado.

### FR-308-06: Emisión de Recibo Criptográfico de Replicación de Flota (Event-Driven)

CUANDO se ejecute la verificación o auditoría integral del subsistema de replicación CRDT, EL SISTEMA emitirá un recibo criptográfico en `docs/evidence/CRDT_REPLICATION_RECEIPT.json` certificando la integridad de los 9 proyectos de la flota, el hash de convergencia y la validez formal del semirretículo.

---

## 3. BDD Acceptance Criteria

### BDD-1623: Merkle-DAG Node Content Addressing and Causal Ordering

```gherkin
ESCENARIO: Creación y direccionamiento por contenido de mutaciones en Merkle-DAG
  DADO el motor de replicación EosCrdtStateReplicatorCore
  CUANDO un actor registra una mutación con clave, valor y padres
  ENTONCES el nodo generado contiene un SHA-256 cid determinista
  Y conserva las referencias a sus nodos padres estableciendo el orden causal
  Y incrementa monótonamente el reloj lógico de Lamport.
```

### BDD-1624: Join-Semilattice LWW-Register Deterministic Convergence

```gherkin
ESCENARIO: Fusión determinista de registros LWW con desempate de actores
  DADO dos réplicas concurrentes con valores divergentes para la misma clave
  CUANDO se fusionan las réplicas en ambos sentidos (A -> B y B -> A)
  ENTONCES ambas réplicas convergen al valor con mayor timestamp lógico
  Y ante marcas de tiempo idénticas, se aplica desempate determinista por actorId
  Y se verifica que merge(A, B) == merge(B, A) (Conmutatividad) y merge(A, A) == A (Idempotencia).
```

### BDD-1625: Distributed PN-Counter and OR-Set Algebraic Correctness

```gherkin
ESCENARIO: Operaciones concurrentes en contadores PN y conjuntos OR-Set
  DADO réplicas independientes incrementando, decrementando y agregando elementos
  CUANDO se produce la sincronización cruzada de deltas
  ENTONCES el PN-Counter refleja la suma algebraica exacta de todos los deltas
  Y el OR-Set preserva adiciones concurrentes evitando anomalías de resurrección post-borrado.
```

### BDD-1626: High-Performance Linear Memory Vector Merge Acceleration

```gherkin
ESCENARIO: Fusión de vectores en memoria lineal con rendimiento sub-microsegundo
  DADO dos vectores de estado de alta dimensionalidad serializados en TypedArray / memoria lineal
  CUANDO se invoca mergeStateVectorsLinearMemory()
  ENTONCES la combinación de vectores elemento a elemento se ejecuta en memoria pura
  Y la latencia por iteración es inferior a 10 microsegundos con 0 dependencias externas.
```

### BDD-1627: Fast Anti-Entropy Divergence Detection and Delta Exchange

```gherkin
ESCENARIO: Sincronización anti-entropía mediante comparación de raíces Merkle
  DADO dos réplicas de flota con subconjuntos compartidos y mutaciones locales
  CUANDO se ejecuta antiEntropySync(replicaA, replicaB)
  ENTONCES el protocolo detecta la divergencia en O(1) vía Merkle root
  Y transfiere únicamente los nodos deltas faltantes
  Y tras la sincronización, ambas réplicas presentan raíces Merkle idénticas (inSync = true).
```

### BDD-1628: Cross-Fleet State Replication & Cryptographic Receipt Emission

```gherkin
ESCENARIO: Auditoría integral de replicación de estado entre los 9 proyectos de la flota
  DADO los 9 proyectos registrados en docs/projects/registry.json
  CUANDO se ejecuta auditCrdtReplicationPipeline() o CLI toolchain:crdt:audit
  ENTONCES se genera el recibo en docs/evidence/CRDT_REPLICATION_RECEIPT.json
  Y el recibo contiene status = 'CRDT_CONVERGENCE_VERIFIED', specRef = 'SPEC-308'
  Y certifica 100% de convergencia en todas las pruebas de semirretículo.
```
