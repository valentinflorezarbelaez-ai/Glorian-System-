# SPEC-080 — THRESHOLD CRYPTOGRAPHY & MULTI-PARTY COMPUTATION (SHAMIR / FROST)
**Version**: 70.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-062  
**Architecture Decision Record**: ADR-085  
**Domain Layer**: Layer-0 System Core (`src/core/eosThresholdCryptography.ts`)

---

## 1. Executive Summary
Inspired by Stripe Treasury multi-party key custody, Coinbase institutional vaults, and the IETF FROST (Flexible Round-Optimized Schnorr Threshold) standard, SPEC-080 formalizes the EOS Threshold Cryptography Engine. Operating under Layer-0 purity with zero external npm dependencies, the engine implements Shamir's $(t, n)$ Secret Sharing scheme over a 256-bit safe prime finite field $\mathbb{F}_p$. Authority keys and release credentials are partitioned into $n$ independent shares such that any $t$ shares can collaboratively reconstruct the secret via Lagrange polynomial interpolation, while any coalition of fewer than $t$ shares possesses mathematically zero information ($H(S | < t) = H(S)$).

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-282: Generación de Polinomio Aleatorio y Partición de Claves (t, n)
**Event-Driven**: CUANDO un proceso o usuario configure una autorización de umbral con parámetros $(t, n)$, EL SISTEMA generará un polinomio aleatorio de grado $t-1$ con término independiente igual al secreto $S$ sobre $\mathbb{F}_p$, emitiendo $n$ fragmentos únicos $(x_i, y_i)$.

### FR-283: Reconstrucción de Secreto por Interpolación de Lagrange
**Event-Driven**: CUANDO un quórum de $k \ge t$ agentes presente sus fragmentos, EL SISTEMA reconstruirá exactamente el secreto original $S$ evaluando el polinomio en $x=0$ mediante aritmética modular pura en BigInt.

### FR-284: Inmunidad Teórica de Información contra Colusiones Sub-Umbral
**Ubiquitous / Permanent**: EL SISTEMA garantizará que cualquier subconjunto de fragmentos de tamaño $k < t$ sea incapaz de derivar el secreto o reducir el espacio de búsqueda del mismo, garantizando seguridad teórica incondicional.

### FR-285: Registro de Quórum y Atestación en SQLite WAL
**Ubiquitous / Permanent**: EL SISTEMA registrará los identificadores de fragmento y la huella criptográfica SHA-256 de cada quórum alcanzado en `EosDurableSqliteLedger`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-235: Exact Secret Reconstruction with Threshold Shares
```gherkin
ESCENARIO: División 3-de-5 y Reconstrucción Exitosa con Quórum Exacto
  DADO un secreto maestro de autorización 'S' y parámetros (t=3, n=5)
  CUANDO se divide en 5 fragmentos y se combinan los fragmentos {1, 3, 5}
  ENTONCES el secreto reconstruido es matemáticamente idéntico al secreto original 'S'
```

### BDD-236: Mathematical Impossibility of Reconstruction with Insufficient Shares
```gherkin
ESCENARIO: Rechazo de Intento con Fragmentos Insuficientes
  DADO un esquema de umbral (t=3, n=5) con 5 fragmentos generados
  CUANDO un atacante intenta reconstruir el secreto usando únicamente 2 fragmentos
  ENTONCES el sistema rechaza la operación por insuficiencia de quórum
  Y no se emite ninguna clave válida
```
