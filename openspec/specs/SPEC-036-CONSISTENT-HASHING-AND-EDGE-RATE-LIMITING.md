# SPEC-036: AMAZON DYNAMO CONSISTENT HASHING, ANTI-ENTROPY MERKLE SYNC & CLOUDFLARE MICROSECOND TOKEN-BUCKET

## 1. Specification Metadata

- **Spec ID**: `SPEC-036`
- **Title**: Amazon Dynamo Consistent Hashing, Anti-Entropy Merkle Sync & Cloudflare Token-Bucket
- **Status**: `APPROVED`
- **Tier**: `BIG_TECH_APEX`
- **Applicable Standards**: Amazon Dynamo Paper (SOSP 2007), Apache Cassandra Consistent Hashing, Cloudflare DDoS Protection Standard
- **Traceability**: `CHANGE-029`, `INTAKE-029`, `ADR-042`

---

## 2. Functional Requirements (EARS Patterns)

### FR-103: Consistent Hash Ring with Virtual Nodes (Amazon Dynamo Pattern)

- **EARS Pattern (Event-Driven)**: CUANDO un cliente consulta o muta una clave en el cluster, EL SISTEMA mapeará la clave a un punto en el anillo de hash $0 \dots 2^{32}-1$ y devolverá el nodo físico responsable mediante búsqueda binaria $O(\log(N \times V))$ sobre los $V$ nodos virtuales por nodo físico.
- **Invariante**: La adición o remoción de un nodo físico causará la migración de únicamente $1/N$ de las claves totales en promedio, garantizando inmunidad a tormentas de rehasheo.

### FR-104: Preference List & Multi-Replica Routing

- **EARS Pattern (State-Driven)**: MIENTRAS se soliciten múltiples réplicas para una clave ($R > 1$), EL SISTEMA recorrerá el anillo en sentido horario hasta acumular $R$ nodos físicos distintos, omitiendo colisiones de vnodes pertenecientes al mismo nodo físico.

### FR-105: Anti-Entropy Merkle Tree Background Synchronization

- **EARS Pattern (Event-Driven)**: CUANDO dos réplicas ejecutan una sesión de sincronización anti-entropía, EL SISTEMA comparará las raíces Merkle jerárquicas; SI las raíces coinciden, ENTONCES EL SISTEMA terminará en $O(1)$; SI difieren, descenderá por los subárboles para identificar los rangos de claves divergentes en $O(\log K)$ sin transmitir datos intactos.

### FR-106: Cloudflare-Grade Microsecond Token-Bucket Edge Rate Limiting

- **EARS Pattern (State-Driven)**: MIENTRAS ingresen peticiones en el borde del sistema, EL SISTEMA calculará la reposición de tokens basada en el delta de nanosegundos monotónicos (`process.hrtime.bigint()`), permitiendo ráfagas hasta la capacidad del bucket ($B$) y limitando la tasa sostenida a $R$ peticiones por segundo con descarte inmediato (`429 Too Many Requests`).

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
ESCENARIO: BDD-094: Mapeo uniforme en el Anillo de Hash Consistente con Vnodes
  DADO un cluster Dynamo de 3 nodos físicos con 64 vnodes cada uno
  CUANDO se hashean 1,000 claves arbitrarias en el anillo
  ENTONCES cada nodo físico recibe al menos el 20% y a lo sumo el 45% de la carga
  Y la desviación estándar de la distribución de carga es inferior al 15%

ESCENARIO: BDD-095: Preference List con Nodos Físicos Distintos
  DADO un anillo con nodos ["node-A", "node-B", "node-C"] y 32 vnodes cada uno
  CUANDO se solicita una lista de preferencia con factor de replicación R = 3 para cualquier clave
  ENTONCES la lista contiene exactamente 3 nodos físicos distintos sin duplicados

ESCENARIO: BDD-096: Detección Rápida de Desincronización con Merkle Trees
  DADO dos réplicas con 100 claves idénticas
  CUANDO una clave es mutada en una réplica
  ENTONCES la raíz del árbol Merkle difiere
  Y la función diffRanges() aísla únicamente el bucket divergente en tiempo sub-milisegundo

ESCENARIO: BDD-097: Rate Limiting por Token-Bucket con Ráfaga y Monotonía
  DADO un limitador configurado con capacidad de ráfaga de 10 tokens y tasa de 50 tokens/segundo
  CUANDO se consumen 10 tokens consecutivamente en 0ms
  ENTONCES los 10 intentos son concedidos (granted = true)
  Y el 11º intento inmediato es rechazado (granted = false)
```
