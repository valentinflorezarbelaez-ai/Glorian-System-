# SPEC-092: WAN DISTRIBUTED GOSSIP & KADEMLIA XOR PEER DISCOVERY ROUTING

## 1. Specification Metadata
- **Spec ID**: `SPEC-092`
- **Change**: `CHANGE-065`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148, EOS Formal EARS & BDD Standard
- **Milestone**: Version `73.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)

---

## 2. Functional Requirements (Formal EARS Syntax)

### FR-330: 160-Bit Node Identity & XOR Distance Metric
- **Pattern (Ubiquitous / Permanent)**: EL SISTEMA asignará a cada nodo en la red WAN un identificador criptográfico de 160 bits (derivado mediante SHA-1/SHA-256) y calculará la distancia topológica entre dos nodos cualesquiera mediante la métrica matemática XOR $d(x, y) = x \oplus y$.

### FR-331: K-Bucket Dynamic Routing Table
- **Pattern (Event-Driven)**: CUANDO un nuevo par contacte al nodo local, EL SISTEMA evaluará el prefijo de coincidencia de bits e insertará el par en el $k$-bucket correspondiente ($k=20$), aplicando desalojo basado en el par visto menos recientemente (LRU) solo si este no responde a pings.

### FR-332: Recursive Target Lookup with Alpha Concurrency
- **Pattern (State-Driven)**: MIENTRAS se ejecute una búsqueda de clave o nodo (`findNode`), EL SISTEMA despachará consultas en paralelo a $\alpha=3$ nodos más cercanos, convergiendo monótonamente hacia los $k$ pares más próximos en $O(\log n)$ saltos.

### FR-333: Resilient Failure Detection & Table Pruning
- **Pattern (Error / Unwanted Condition)**: SI un nodo registrado en un bucket falla en responder a 3 mensajes consecutivos de latido (`PING`), ENTONCES EL SISTEMA marcará el nodo como inalcanzable, lo purgará de la tabla de enrutamiento y promoverá al candidato en cola.

---

## 3. Acceptance Criteria (BDD Gherkin Standard)

```gherkin
ESCENARIO: BDD-259: Cálculo determinista de distancia métrica XOR e inserción en K-buckets
  DADO un nodo EosWanKademliaMesh con identificador local de 160 bits
  CUANDO se calculan distancias hacia pares con identificadores conocidos
  ENTONCES la distancia d(x, y) es simétrica y respeta la desigualdad triangular
  Y los pares son clasificados en los buckets de orden logarítmico correspondientes.

ESCENARIO: BDD-260: Búsqueda convergente de los k nodos más cercanos a un identificador objetivo
  DADO una tabla de enrutamiento poblada con 50 nodos simulados
  CUANDO se ejecuta findClosestNodes(targetId, 20)
  ENTONCES la función retorna exactamente los 20 nodos con menor distancia XOR hacia el objetivo
  Y la lista está ordenada ascendentemente por cercanía métrica.
```
