# SPEC-076 — 256-BIT SPARSE MERKLE TREE (SMT) & AUDIT EXCLUSION PROOFS
**Version**: 69.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-061  
**Architecture Decision Record**: ADR-081  
**Domain Layer**: Layer-0 System Core (`src/core/eosSparseMerkleTree.ts`)

---

## 1. Executive Summary
Inspired by Stripe Core financial ledger state compaction, Zcash/Ethereum Sparse Merkle Trees, and Certificate Transparency exclusion auditing, SPEC-076 formalizes the EOS Sparse Merkle Tree (SMT). Operating under strict Layer-0 purity with zero external npm dependencies, the engine implements a deterministic 256-bit radix binary Merkle tree with precomputed default empty subtree roots. Crucially, the SMT provides both **Cryptographic Inclusion Proofs** (proving a key-value pair exists in the root) and **Cryptographic Non-Membership Proofs** (proving with mathematical certainty that a specific key has never been set, revoked, or tampered with), in $O(H)$ proof sizes without scanning the historical event log.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-266: Precomputed 256-Level Default Empty Subtree Hashes
**Ubiquitous / Permanent**: EL SISTEMA computará y almacenará de forma inmutable los 256 hashes de subárbol vacío iniciales mediante la recurrencia $E_0 = H(0\text{x}00 \parallel 0)$, $E_{i+1} = H(0\text{x}01 \parallel E_i \parallel E_i)$, permitiendo calcular la raíz vacía global en $O(1)$.

### FR-267: Inserción y Actualización Determinista de Claves en Espacio de 256 Bits
**Event-Driven**: CUANDO se inserte o actualice una clave $K$ con valor $V$, EL SISTEMA computará el camino de bits de $H(K)$ a lo largo de los 256 niveles, actualizando únicamente los nodos a lo largo de dicho camino en $O(\log N)$ nodos reales.

### FR-268: Pruebas de Pertenencia y No Pertenencia (Inclusion & Exclusion)
**Ubiquitous / Permanent**: EL SISTEMA generará pruebas auditables independientes tanto para claves presentes (Membership Proof) como para claves no existentes (Non-Membership Proof), conteniendo los hashes hermanos a lo largo del árbol.

### FR-269: Verificación Criptográfica Desacoplada y Registro en WAL
**Ubiquitous / Permanent**: EL SISTEMA proporcionará una función de verificación pura que valida cualquier prueba SMT contra la raíz global sin requerir acceso al árbol completo, registrando la raíz en `EosDurableSqliteLedger`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-227: Sparse Merkle Tree Deterministic Root and Membership Proof
```gherkin
ESCENARIO: Inserción de Clave y Verificación de Inclusión
  DADO un Sparse Merkle Tree inicializado
  CUANDO se inserta la clave 'account:stripe:001' con valor 'balance:1000'
  ENTONCES la raíz del árbol cambia de la raíz vacía a un hash SHA-256 no vacío
  Y la prueba de inclusión para 'account:stripe:001' es validada con éxito
```

### BDD-228: Cryptographic Non-Membership Proof for Unset Keys
```gherkin
ESCENARIO: Verificación de No Pertenencia de Clave Inexistente
  DADO un Sparse Merkle Tree con claves registradas
  CUANDO se solicita una prueba de no pertenencia para 'account:malicious:999'
  ENTONCES el verificador confirma matemáticamente que la clave tiene valor nulo
  Y rechaza cualquier intento de falsificar pertenencia
```
