# SPEC-066 — AUTOMATED STATISTICAL CANARY ANALYSIS (ACA) ENGINE
**Version**: 67.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-059  
**Architecture Decision Record**: ADR-071  
**Domain Layer**: Layer-0 System Core (`src/core/eosStatisticalCanaryAuditor.ts`)

---

## 1. Executive Summary
Inspired by Netflix Kayenta and Google Borg Automated Canary Analysis, SPEC-066 formalizes the EOS Statistical Canary Auditor. Operating under strict Layer-0 purity with zero external npm dependencies, the engine evaluates canary deployments using the nonparametric Mann-Whitney U rank-sum statistical hypothesis test. It compares empirical distributions of latency (p95), error rates, and memory overhead between baseline and canary instances, determining whether degradation is statistically significant ($p < 0.05$). If degradation is verified, it triggers an immediate atomic rollback.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-226: Prueba Estadística No Paramétrica de Mann-Whitney U
**Ubiquitous / Permanent**: EL SISTEMA comparará las distribuciones empíricas de métricas entre la línea base y la instancia canaria mediante el test de Mann-Whitney U con corrección de continuidad y rangos empatados, calculando el estadístico $U$, el valor $Z$ y el valor $p$ bilateral sin dependencias externas.

### FR-227: Aborto Automático ante Regresión Estadísticamente Significativa
**Error / Unwanted Condition**: SI el valor $p$ bilateral es menor a $0.05$ Y la mediana de la métrica en el canario es mayor a la mediana de la línea base (`STATISTICALLY_SIGNIFICANT_REGRESSION`), ENTONCES EL SISTEMA emitirá el veredicto `CANARY_ROLLBACK_REQUIRED` y bloqueará el avance del despliegue.

### FR-228: Promoción Segura a Producción
**State-Driven**: MIENTRAS el valor $p$ sea $\ge 0.05$ O la métrica del canario sea igual o inferior a la línea base, EL SISTEMA certificará el veredicto `CANARY_PASS_OPTIMAL` permitiendo la progresión a la siguiente fase de rollout.

### FR-229: Registro de Recibo Criptográfico en SQLite WAL
**Ubiquitous / Permanent**: EL SISTEMA registrará el informe del análisis canario con su hash SHA-256 en `EosDurableSqliteLedger` bajo la categoría `SECURITY_AUDIT`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-207: Mann-Whitney U Nonparametric Statistical Evaluation
```gherkin
ESCENARIO: Evaluación de Degradación Significativa en Latencia Canaria
  DADO una muestra de latencias de línea base [10, 11, 12, 11, 10, 12, 11, 10, 12, 11]
  Y una muestra degradada de canario [25, 28, 30, 26, 27, 29, 31, 28, 27, 30]
  CUANDO el auditor estadístico ejecuta la prueba de Mann-Whitney U
  ENTONCES el valor p es menor a 0.001
  Y el veredicto emitido es "CANARY_ROLLBACK_REQUIRED"
```

### BDD-208: Canary Health Verification Passing with Identical or Improved Distribution
```gherkin
ESCENARIO: Promoción Conforme de Canario Saludable
  DADO una muestra de línea base [20, 21, 22, 20, 21]
  Y una muestra de canario optimizada [18, 19, 18, 20, 19]
  CUANDO el auditor evalúa las distribuciones
  ENTONCES el veredicto emitido es "CANARY_PASS_OPTIMAL"
  Y el hash SHA-256 del recibo queda registrado en el Ledger
```
