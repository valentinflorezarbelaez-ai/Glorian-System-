# SPEC-282: Zero-Knowledge State Attestation & Merkle Tree Snapshot Governor

- **Status**: APPROVED
- **Change Reference**: `CHANGE-144`
- **Intake Reference**: `INTAKE-144`
- **Domain**: Cryptographic State Attestation, Merkle Inclusion Proofs & Anti-Entropy Sync
- **Date**: 2026-11-15

---

## 1. Functional Requirements (IEEE 830 / EARS)

### FR-282-01: Canonical Domain-Separated Merkle Tree Construction

- **Event-Driven**: CUANDO un arreglo de registros de estado es recibido, EL SISTEMA construirá un árbol binario de Merkle determinista aplicando prefijos de separación de dominio (`0x00` para hojas y `0x01` para nodos interiores) para computar el hash raíz SHA-256 inmutable.

### FR-282-02: Cryptographic Inclusion Proof Generation ($O(\log N)$)

- **Event-Driven**: CUANDO se solicita la prueba de inclusión para una hoja en un índice dado, EL SISTEMA generará una ruta de auditoría compacta conteniendo la secuencia ordenada de hashes de nodos hermanos y sus direcciones posicionales (`LEFT` o `RIGHT`).

### FR-282-03: Zero-Knowledge Leaf Verification

- **State-Driven**: MIENTRAS se evalúa una prueba de inclusión con una hoja y un hash raíz conocido, EL SISTEMA recalculará recursivamente la ruta de hashes sin requerir el resto de los elementos del árbol, validando o rechazando la pertenencia en tiempo logarítmico.

### FR-282-04: Merkle Root Anti-Entropy Delta Detection

- **Event-Driven**: CUANDO se comparan dos árboles de Merkle generados sobre diferentes versiones del estado, EL SISTEMA recorrerá las ramas divergentes en tiempo $O(D \log N)$ para identificar exactamente los índices de las hojas que sufrieron mutaciones.

### FR-282-05: Tamper Detection and Invalid Proof Rejection

- **Error / Unwanted Condition**: SI cualquier hash hermano, dirección posicional o contenido de la hoja dentro de la prueba es alterado, ENTONCES EL SISTEMA rechazará la verificación retornando `false` y emitiendo un código de violación de integridad.

### FR-282-06: Verifiable Snapshot Manifest & Cryptographic Receipt

- **Ubiquitous / Permanent**: EL SISTEMA emitirá un manifiesto criptográfico formal del snapshot en `docs/evidence/MERKLE_SNAPSHOT_RECEIPT.json` con raíz de Merkle, conteo de hojas, profundidad del árbol y firma SHA-256.

---

## 2. BDD Acceptance Criteria

```gherkin
ESCENARIO: BDD-1467 Canonical Merkle Tree Construction and Deterministic Root Hash
  DADO un arreglo no vacío de registros de estado del sistema
  CUANDO EosMerkleSnapshotGovernor.buildTree es invocado
  ENTONCES genera una estructura de árbol binario con un rootHash SHA-256 determinista
  Y aplica el prefijo 0x00 para hojas y 0x01 para nodos interiores previniendo ataques de segunda preimagen.

ESCENARIO: BDD-1468 Logarithmic Inclusion Proof Generation
  DADO un árbol de Merkle construido con N hojas
  CUANDO EosMerkleSnapshotGovernor.generateProof es invocado para un índice válido i
  ENTONCES produce una prueba con longitud exactamente igual a la profundidad del árbol
  Y cada paso de la prueba especifica el siblingHash y la posición relativa.

ESCENARIO: BDD-1469 Zero-Knowledge Verification Against Root Hash
  DADO un hash raíz conocido y una prueba de inclusión válida para una hoja
  CUANDO EosMerkleSnapshotGovernor.verifyProof es ejecutado
  ENTONCES retorna valid: true sin requerir acceso a las demás hojas del árbol.

ESCENARIO: BDD-1470 Anti-Entropy Divergence Detection Between Snapshots
  DADO un árbol de Merkle base y un árbol modificado con mutaciones en hojas específicas
  CUANDO EosMerkleSnapshotGovernor.detectDelta es invocado entre ambos árboles
  ENTONCES identifica con exactitud los índices de las hojas que han cambiado
  Y reporta los hashes previos y posteriores.

ESCENARIO: BDD-1471 Tamper Rejection and Forged Proof Invalidation
  DADO una prueba de inclusión válida
  CUANDO un byte del siblingHash o el contenido de la hoja es adulterado
  ENTONCES verifyProof retorna valid: false de forma determinista y segura.

ESCENARIO: BDD-1472 Snapshot Manifest and Cryptographic Evidence Receipt
  DADO un snapshot completado
  CUANDO el manifiesto es sellado
  ENTONCES genera docs/evidence/MERKLE_SNAPSHOT_RECEIPT.json con firma SHA-256 verificable.
```
