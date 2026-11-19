# SPEC-365: Decentralized Multi-Node Swarm Clustering & P2P Mesh Gossip

**Specification ID**: `SPEC-365`  
**Change Reference**: `CHANGE-227`  
**Lifecycle Tier**: `production`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Formal TLA+ Model**: `docs/formal/MultiNodeSwarmMesh.tla` (Model 108)  
**Status**: `APPROVED`

---

## 1. Scope & Domain Context

This specification formally establishes the requirements, interfaces, state invariants, and verification criteria for `EosMultiNodeSwarmMesh`. The engine delivers a zero-dependency decentralized peer-to-peer (P2P) cluster fabric and epidemic gossip anti-entropy synchronization system. It connects distributed Glorian System autonomous nodes across heterogeneous hosts, facilitating decentralized node discovery, Byzantine fault-tolerant (BFT) consensus, distributed Merkle-DAG state replication, and cross-node task work-stealing with guaranteed cluster convergence.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-365-01 (Ubiquitous Layer-0 P2P Transport & Node Identity)**:
  `EL SISTEMA DEBE inicializar y gestionar nodos P2P discretos con identidades criptográficas únicas (NodeID SHA-256 / ed25519) utilizando exclusivamente transportes nativos de red sin dependencias de terceros.`

- **FR-365-02 (Event-Driven Peer Discovery & Handshake)**:
  `CUANDO un nodo recibe un mensaje de anuncio ('HELLO_PEER') o sondea semillas conocidas, EL SISTEMA DEBE autenticar criptográficamente al par, registrarlo en la tabla de enrutamiento y establecer una sesión de conexión activa.`

- **FR-365-03 (State-Driven Epidemic Anti-Entropy Gossip Dissemination)**:
  `MIENTRAS el clúster se encuentre activo, EL SISTEMA DEBE ejecutar rondas periódicas de chisme epidémico (Scuttlebutt anti-entropy gossip) con vectores de versión, convergiendo el estado topológico de N nodos en O(log N) rondas.`

- **FR-365-04 (Event-Driven Merkle-DAG Distributed Ledger Replication)**:
  `CUANDO un nodo emite una nueva transacción, tarea o prueba formal, EL SISTEMA DEBE difundir el delta criptográfico firmado a través del enjambre P2P y replicarlo en los Merkle-DAGs de todos los pares conectados.`

- **FR-365-05 (Ubiquitous Byzantine Fault-Tolerant (BFT) State Consensus)**:
  `EL SISTEMA DEBE mantener consistencia estricta de estado bajo tolerancia a fallos bizantinos (BFT), tolerando hasta f < N/3 nodos caídos, desconectados o maliciosos sin bifurcación de ledger ni pérdida de invariantes.`

- **FR-365-06 (State-Driven Cross-Node Task Work-Stealing & Balancing)**:
  `MIENTRAS un nodo mantenga capacidad de cómputo ociosa y existan nodos con colas de tareas saturadas, EL SISTEMA DEBE negociar préstamos de trabajo atómicos ('WORK_STEAL') distribuidos a través de la malla P2P.`

- **FR-365-07 (Error / Unwanted Condition Node Eviction & Partition Healing)**:
  `SI un nodo remoto no emite latidos ('HEARTBEAT') dentro de la ventana de expiración (TTL > 3000ms), ENTONCES EL SISTEMA DEBE marcar el nodo como 'SUSPECT' / 'EVICTED', rebalancear sus tareas asignadas y auto-sanar la partición topológica.`

---

## 3. Acceptance Criteria (BDD Syntax)

### BDD-1969: Discrete Node Initialization & Cryptographic Identity

```gherkin
ESCENARIO: Inicialización de nodo P2P con identidad criptográfica
  DADO una instancia de EosMultiNodeSwarmMesh
  CUANDO se inicializa el nodo local con puerto y clave de clúster
  ENTONCES genera un NodeID determinista SHA-256
  Y mantiene el estado del nodo en 'ONLINE' con 0 pares iniciales.
```

### BDD-1970: Dynamic Peer Discovery & Handshake Verification

```gherkin
ESCENARIO: Descubrimiento dinámico y autenticación de pares en la malla
  DADO dos nodos de malla 'Node-Alpha' y 'Node-Beta' en ejecución
  CUANDO 'Node-Alpha' envía un mensaje de saludo 'HELLO_PEER' a 'Node-Beta'
  ENTONCES 'Node-Beta' valida la firma criptográfica y agrega a 'Node-Alpha' como par activo
  Y 'Node-Alpha' confirma la conexión con latencia de saludo inferior a 50 milisegundos.
```

### BDD-1971: Epidemic Anti-Entropy Gossip State Synchronization

```gherkin
ESCENARIO: Difusión epidémica de estado y convergencia anti-entropía
  DADO un clúster P2P de 5 nodos con estados divergentes
  CUANDO se ejecutan 3 rondas de chisme epidémico con vectores de versión
  ENTONCES los 5 nodos convergen al mismo estado unificado con 100% de coherencia
  Y ningún nodo retiene deltas huérfanos o desincronizados.
```

### BDD-1972: Merkle-DAG Distributed Transaction Replication

```gherkin
ESCENARIO: Replicación distribuida de transacciones en Merkle-DAG
  DADO un enjambre de nodos sincronizados
  CUANDO un nodo produce una nueva transacción de ledger verificada
  ENTONCES el delta de transacción se propaga por inundación controlada a todos los nodos
  Y todos los nodos calculan la misma raíz de Merkle ('MERKLE_ROOT_MATCH').
```

### BDD-1973: Distributed Cross-Node Task Work-Stealing

```gherkin
ESCENARIO: Préstamo atómico de tareas entre nodos heterogéneos
  DADO un nodo sobrecargado con 10 tareas y un nodo ocioso con 0 tareas
  CUANDO el nodo ocioso emite una solicitud de 'WORK_STEAL'
  ENTONCES el nodo sobrecargado cede el 50% de sus tareas mediante un contrato atómico
  Y ambas colas se equilibran sin duplicación de tareas.
```

### BDD-1974: Full Diagnostic Audit & Mesh Cluster Receipt

```gherkin
ESCENARIO: Auditoría diagnóstica completa y generación de recibo de clúster P2P
  DADO el clúster multi-nodo en operación nominal
  CUANDO se ejecuta la auditoría formal de EosMultiNodeSwarmMesh
  ENTONCES todas las comprobaciones (Layer-0, P2P handshake, Gossip, Merkle-DAG, Work-Stealing, BFT) resultan 'PASS'
  Y emite un recibo criptográfico SHA-256 referenciando SPEC-365 y CHANGE-227.
```
