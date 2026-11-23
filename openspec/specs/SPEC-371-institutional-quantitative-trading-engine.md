# SPEC-371: Sovereign Institutional Quantitative Trading Engine & Byzantine Consensus Crucible

**Component:** `eos-system-control-plane` (Glorian System)  
**Lifecycle Tier:** Production Ready  
**Status**: `APPROVED`
**Related Specs:** `SPEC-123`, `SPEC-124`, `SPEC-250`, `SPEC-270`

---

## 1. Functional Requirements (IEEE 830 EARS Syntax)

- **FR-371-01 (Deterministic Price Action & Indicator Convergence):**
  EL SISTEMA DEBE calcular deterministamente series de indicadores técnicos (EMA 9/20/50/200, RSI 14, Bandas de Bollinger 20/2.2, ATR/ADX 14, Oscilador Estocástico 14/3/3 y Z-Score) a partir de velas OHLC sin recurrir a cálculos aritméticos por parte de modelos de lenguaje.

- **FR-371-02 (Multi-Strategy Confluence Evaluation):**
  CUANDO se evalúa un activo financiero con un mínimo de 50 velas históricas, EL SISTEMA evaluará concurrentemente 4 estrategias institucionales: (1) Liquidity Sweep & Order Flow Reversal, (2) Trend Pullback de Precisión, (3) TTM Volatility Squeeze, y (4) Mean-Reversion Quant Oscillator.

- **FR-371-03 (Byzantine Multi-Agent Consensus Council):**
  EL SISTEMA DEBE someter cada oportunidad de trading a un concilio de 4 jueces algorítmicos (`TrendJudge`, `LiquidityJudge`, `MomentumJudge`, `RiskGovernor`), exigiendo al menos 3 votos favorables de los jueces de estrategia y voto unánime afirmativo del `RiskGovernor` para emitir una señal ejecutable.

- **FR-371-04 (Inviolable Risk & Anti-Martingale Barrier):**
  SI la cuenta activa no es de tipo `training` (demo) sin autorización Level 3 previa, o si el drawdown diario alcanza el -3.0% (o 3 pérdidas consecutivas), o si el tamaño de posición difiere del 1.0%-2.0% fijo, ENTONCES EL SISTEMA abortará inmediatamente toda intención de entrada y bloqueará la emisión de órdenes.

- **FR-371-05 (Strict Concurrency Lock & Cooldown Timer):**
  MIENTRAS exista al menos una posición abierta o pendiente de liquidación en la cuenta, EL SISTEMA bloqueará la apertura de nuevas posiciones y exigirá un enfriamiento mínimo de 60 segundos tras un acierto (`WIN`) y 180 segundos tras un fallo (`LOSS`).

- **FR-371-06 (Trailing Profit Lock & Early Preservation):**
  CUANDO el rendimiento acumulado de la sesión alcance un beneficio neto de $+100.00\text{ USD}$ (o $+2.5\%$), EL SISTEMA elevará automáticamente el Stop Loss del día a $+60.00\text{ USD}$ para garantizar un cierre en verde.

- **FR-371-07 (Cryptographic Execution Telemetry & Privacy Barrier):**
  EL SISTEMA DEBE registrar cada análisis y operación cerrada en `data/bitacora_trading.csv` y `.eos/trading-state.json` manteniendo exclusión estricta en el control de versiones (.gitignore) bajo la Ley VI de Velo de Isis.

---

## 2. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-2005 - Cálculo Determinista de Indicadores Cuantitativos
  DADO un arreglo de 60 velas OHLC válidas
  CUANDO el motor procesa la serie de datos temporales
  ENTONCES genera valores numéricos finitos para RSI, EMAs, Bandas de Bollinger, ADX y Estocástico
  Y preserva la cota temporal con latencia de cálculo inferior a 10 milisegundos.

ESCENARIO: BDD-2006 - Veto Unánime del RiskGovernor ante Violación de Candados
  DADO un mercado con señal técnica A+ válida
  CUANDO el saldo de la cuenta presenta un drawdown del -3.1% o existen 3 pérdidas consecutivas
  ENTONCES el RiskGovernor emite un voto REJECTED
  Y el Concilio Bizantino aborta la señal con estado RISK_BLOCKED.

ESCENARIO: BDD-2007 - Aprobación por Mayoría Bizantina Calificada (3/4)
  DADO un setup con confluencia técnica en tendencia alcista
  CUANDO TrendJudge, LiquidityJudge y MomentumJudge votan APPROVED y RiskGovernor valida los 9 candados
  ENTONCES el concilio emite veredicto EXECUTE_CALL
  Y genera un recibo criptográfico con hash de confluencia.

ESCENARIO: BDD-2008 - Bloqueo de Concurrencia Estricta
  DADO que existe 1 operación abierta en el servidor
  CUANDO el escáner detecta una nueva señal en otro activo
  ENTONCES el sistema rechaza la emisión con código CONCURRENCY_LOCKED
  Y no despacha ninguna orden adicional.

ESCENARIO: BDD-2009 - Activación del Trailing Profit Lock
  DADO que la sesión acumula ganancias netas por +$100.00 USD
  CUANDO se actualiza el estado de la sesión
  ENTONCES el piso mínimo de parada se eleva a +$60.00 USD
  Y la siguiente pérdida liquida la sesión en positivo.

ESCENARIO: BDD-2010 - Bloqueo de Operativa Fuera de Horario o en Mercados OTC
  DADO un activo marcado con sufijo (OTC) o una hora fuera de 07:00 - 11:30 Colombia
  CUANDO se ejecuta la evaluación de mercado
  ENTONCES el sistema marca la condición como OFF_HOURS_OTC_BLOCKED
  Y suspende el despacho de órdenes al broker.
```
