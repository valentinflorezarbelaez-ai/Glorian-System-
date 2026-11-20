# SPEC-375: Universal Multi-Asset Universe, Dynamic Payout Optimizer & 1-Minute Precision Engine

**Status:** APPROVED  
**Version:** 1.0.0  
**Phase:** 8 (Layer-0 Pure Financial Core)  
**TLA+ Model:** Model 118 (`docs/formal/UniversalAssetPayoutOptimizer.tla`)  
**Merge Gate:** `npm run verify:strict`

---

## 1. Scope & Functional Requirements (EARS)

### FR-375-01: Multi-Class Asset Universe Ingestion (Forex, Crypto, Equities, Commodities)

- **EL SISTEMA** categorizará e ingerirá activos financieros a través de 4 clases maestras: `FOREX` (incluyendo pares mayores, cruces y OTC), `COMMODITIES` (Oro XAU/USD, Plata XAG/USD), `CRYPTO` (BTC, ETH, DASH, SOL, XRP, PEPE), y `EQUITIES` (AAPL, MSFT, TSLA, NVDA, AMZN, META, GOOGL).

### FR-375-02: Dynamic Payout Optimizer & Mode Selection

- **CUANDO** se evalúa la rentabilidad de un activo para opciones a 1 minuto, **EL SISTEMA** comparará los rendimientos de opciones Digitales y Binarias, seleccionando la modalidad con mayor payout:
  $$\text{SelectedMode} = \begin{cases} \text{DIGITAL} & \text{si } \text{Payout}_{\text{Digital}} \ge \text{Payout}_{\text{Binary}} \\ \text{BINARY} & \text{en caso contrario} \end{cases}$$

### FR-375-03: Minimum Profitability Threshold Enforcement ($\ge 80\%$)

- **SI** el payout máximo disponible para un activo es estrictamente menor al 80.0%, **ENTONCES EL SISTEMA** descalificará inmediatamente el activo con estado `REJECTED_LOW_PAYOUT`, impidiendo cualquier orden con esperanza matemática desfavorable.

### FR-375-04: Institutional Round-Number & Psychological Key-Level Detector

- **CUANDO** el precio spot de un activo se encuentre a una distancia $\le 0.03\%$ (3 pips en Forex o equivalente porcentual) de un número redondo (`.000` o `.500`), **EL SISTEMA** clasificará el nivel como `KEY_LEVEL_ACTIVE` y otorgará un bono de confluencia institucional al patrón de rechazo en M1.

### FR-375-05: Strict 60-Second (1-Minute) Expiry Invariant

- **EL SISTEMA** forzará que todas las órdenes evaluadas y generadas posean un horizonte de expiración estricto de 60 segundos ($T_{\text{expiry}} \equiv 60\text{s}$), optimizado para el gatillo de micro-rechazo de BinaryTeach.

### FR-375-06: Universal Confluence Ranking & Top-1 Execution Election

- **CUANDO** se ejecuta el escaneo concurrente del universo de activos, **EL SISTEMA** calculará un índice de calidad compuesto:
  $$\text{QualityIndex} = \text{ConfluenceScore} \times \left(\frac{\text{PayoutPercent}}{100}\right) \times (1 + \text{KeyLevelBonus})$$
  y elegirá exclusivamente el activo con el mayor índice (`Top-1 Setup`), descartando los demás para preservar el candado de concurrencia unitaria ($N_{\text{active}} \le 1$).

### FR-375-07: Dual-Vault Segregation & Practice Isolation Invariant

- **MIENTRAS** el motor esté en ejecución, **EL SISTEMA** garantizará que la Bóveda Alfa ($3,000 USD / capital fiduciario familiar) permanezca en almacenamiento en frío intocable ($P_{\text{ruina}} \equiv 0.00\%$), y todas las operaciones se realicen en saldo Demo ($14,100.35 USD).

### FR-375-08: Invariant Auditing & Cryptographic Receipt Generation

- **CUANDO** se invoque el método de auditoría estricta, **EL SISTEMA** verificará los 5 invariantes formales y emitirá un recibo criptográfico SHA-256 en `docs/evidence/UNIVERSAL_ASSET_PAYOUT_RECEIPT.json`.

---

## 2. BDD Acceptance Criteria (BDD-2033..BDD-2040)

### BDD-2033: Multi-Class Universe Ingestion Encompasses All Required Assets

- **GIVEN** el catálogo universal de activos de Glorian,
- **WHEN** se inicializa el motor,
- **THEN** incluye Forex (`EUR/USD`, `GBP/JPY`), Commodities (`XAU/USD`), Cripto (`BTC/USD`, `DASH/USD`, `PEPE/USD`) y Acciones (`AAPL`, `MSFT`), verificando al menos 20 activos registrados.

### BDD-2034: Dynamic Payout Optimizer Selects Higher Yield Option Mode

- **GIVEN** `EUR/USD` con payout Digital al 92% y Binarias al 82%,
- **WHEN** se evalúa la modalidad óptima,
- **THEN** selecciona `DIGITAL` con payout asignado de 92%.

### BDD-2035: Low Payout Assets (< 80%) Are Disqualified Fail-Closed

- **GIVEN** un activo `MSFT` con payout máximo de 74%,
- **WHEN** el filtro de rentabilidad es evaluado,
- **THEN** lo descarta con estado `REJECTED_LOW_PAYOUT` y no permite trade.

### BDD-2036: Round Number Psychological Level Detects `.000` and `.500`

- **GIVEN** el precio de `EUR/USD` en `1.09002` (distancia de 0.2 pips del número redondo `1.09000`),
- **WHEN** se ejecuta el detector de niveles clave,
- **THEN** retorna `isNearKeyLevel: true`, `keyLevel: 1.09000` y `levelType: "TRIPLE_ZERO"`.

### BDD-2037: Strict 60-Second Expiry Enforced

- **GIVEN** cualquier orden candidata generada por el motor,
- **WHEN** se inspecciona el parámetro de expiración,
- **THEN** es exactamente igual a 60 segundos ($T_{\text{expiry}} = 60$).

### BDD-2038: Top-1 Setup Election Preserves Single Concurrency Lock

- **GIVEN** 5 activos simultáneamente calificados con confluencia positiva,
- **WHEN** se procesa la elección final,
- **THEN** se elige únicamente el activo con el mayor índice de calidad compuesto y se rechazan los 4 restantes por concurrencia.

### BDD-2039: Practice Mode and Fiduciary Zero-Ruin Protection

- **GIVEN** el estado de cuenta y riesgo del sistema,
- **WHEN** se audita el modo de cuenta,
- **THEN** confirma `accountType: "training"`, saldo demo $\ge \$14,000$ USD y capital real de \$3,000 USD completamente aislado.

### BDD-2040: Invariant Audit and Cryptographic SHA-256 Receipt

- **GIVEN** una instancia de `EosUniversalAssetPayoutOptimizerEngine`,
- **WHEN** se ejecuta el método `audit()`,
- **THEN** retorna estado `VERIFIED` con un hash SHA-256 de 64 caracteres y genera `UNIVERSAL_ASSET_PAYOUT_RECEIPT.json`.
