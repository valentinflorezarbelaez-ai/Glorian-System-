# SPEC-316: Vector LSM-Tree Segment Storage Engine, Sparse Block Index & Background Compaction

**Status**: `APPROVED`

## 1. Requirements (IEEE 830 / ISO 29148 EARS)

- **FR-1 (Event-Driven)**: CUANDO el cliente inserta o actualiza un vector cuantizado con clave $K$, EL SISTEMA DEBE registrar la entrada en la `MemTable` en memoria ordenada lexicográficamente y retornar confirmación con latencia sub-milisegundo.
- **FR-2 (Event-Driven)**: CUANDO el cliente invoca la eliminación de un vector con clave $K$, EL SISTEMA DEBE insertar una entrada de lápida mortuoria (`TOMBSTONE`) en la `MemTable` enmascarando cualquier ocurrencia histórica en los segmentos SSTable inferiores.
- **FR-3 (State-Driven)**: MIENTRAS la `MemTable` exceda el umbral de capacidad configurado ($N_{\text{max}}$ vectores o límite en bytes), EL SISTEMA DEBE congelar la `MemTable` activa, convertirla en inmutable y vaciarla de forma síncrona a un nuevo segmento SSTable Nivel 0 (`L0`) provisto de filtro de Bloom y un índice de bloques disperso.
- **FR-4 (Event-Driven)**: CUANDO el cliente solicita la recuperación o verificación de un vector con clave $K$, EL SISTEMA DEBE consultar primero la `MemTable` activa, luego las `MemTables` congeladas y posteriormente los segmentos SSTable en orden descendente de nivel y tiempo, retornando `null` inmediatamente si se detecta un `TOMBSTONE` o si el filtro de Bloom descarta la presencia de $K$.
- **FR-5 (Event-Driven)**: CUANDO se desencadena una compactación k-vías de fondo, EL SISTEMA DEBE fusionar concurrentemente múltiples segmentos SSTable superpuestos, retener la versión con marca temporal más reciente para cada clave, purgar las lápidas mortuorias irrelevantes y emitir un nuevo segmento consolidado atómicamente en el Nivel 1 (`L1`).
- **FR-6 (Ubiquitous)**: EL SISTEMA DEBE auditar de forma determinista la integridad de los segmentos, la monotonía estricta de las claves en cada SSTable y la ausencia de fuga de datos, emitiendo un recibo criptográfico firmado con SHA-256 en `docs/evidence/VECTOR_LSM_STORAGE_RECEIPT.json`.

---

## 2. Acceptance Criteria (BDD / Gherkin)

```gherkin
ESCENARIO: BDD-1671 MemTable In-Memory Ingestion, Ordering and Capacity Bounds
  DADO un motor LSM vectorial inicializado con capacidad de MemTable = 50 vectores
  CUANDO se insertan 40 vectores cuantizados de dimensión 32 en orden aleatorio
  ENTONCES la MemTable almacena exactamente 40 entradas ordenadas alfabéticamente por clave
  Y el tamaño en memoria se actualiza proporcionalmente sin exceder la capacidad

ESCENARIO: BDD-1672 Tombstone Deletion Masking and Point-Lookup Precedence
  DADO un motor LSM con vectores existentes en segmentos SSTable
  CUANDO se registra la eliminación de una clave existente mediante un TOMBSTONE en la MemTable
  ENTONCES la búsqueda puntual getVector(key) retorna null inmediatamente
  Y la lectura histórica en los segmentos SSTable queda formalmente enmascarada

ESCENARIO: BDD-1673 MemTable Flush to Immutable L0 SSTable with Bloom Filter and Sparse Index
  DADO una MemTable que supera el umbral de 50 vectores
  CUANDO se ejecuta el flush hacia el almacenamiento secundario
  ENTONCES se genera un segmento SSTable L0 inmutable con filtro de Bloom determinista
  Y un índice de bloques disperso que registra los límites de clave para cada bloque de datos
  Y la MemTable activa se restablece limpia para nuevas escrituras

ESCENARIO: BDD-1674 Bloom Filter Negative Lookup Short-Circuit and Block Skip Scan
  DADO un segmento SSTable L0 con 100 vectores indexados
  CUANDO se busca una clave inexistente "ghost-vector-key"
  ENTONCES el filtro de Bloom retorna falso positivamente evitando la descompresión de bloques de datos
  Y las claves existentes localizan su bloque exacto mediante búsqueda binaria en el índice disperso

ESCENARIO: BDD-1675 Background K-Way Compaction and Tombstone Purging
  DADO tres segmentos SSTable L0 con claves repetidas, actualizaciones y vectores eliminados con tombstones
  CUANDO se ejecuta una compactación k-vías hacia el Nivel 1
  ENTONCES los segmentos se fusionan en un único segmento L1 canónico
  Y se purgan definitivamente las claves con lápidas mortuorias
  Y se deduplican las claves conservando la versión con marca temporal más reciente
  Y los segmentos originales L0 son eliminados atómicamente

ESCENARIO: BDD-1676 Segment Structural Audit and Cryptographic SHA-256 Receipt
  DADO un almacenamiento LSM con segmentos L0 y L1 activos
  CUANDO se ejecuta el comando de auditoría integral
  ENTONCES se valida la continuidad de bloques, la monotonía de claves y la consistencia del manifest
  Y se persiste el recibo criptográfico en docs/evidence/VECTOR_LSM_STORAGE_RECEIPT.json con firma SHA-256
```
