# CONSTITUCIÓN CUANTITATIVA DE TRADING M1 — GLORIAN SYSTEM

**Versión:** 2.1.0 | **Entorno:** Google Antigravity + IQ Option MCP (`iq-binary-options` & `iq-digital-options`)  
**Capital Base de Referencia:** $4,000.00 USD (Cuenta PRACTICE / Demo)  
**Modo Operativo:** Secuencial Estricto (Máximo 1 operación a la vez) | **Expiración:** 1 minuto exacto (60 segundos)  
**Doctrina de Apalancamiento:** CERO MARTINGALA (Importe Plano 1.0 % - 2.0 %)

---

## 1. DECLARACIÓN DE SOBERANÍA Y REALIDAD MATEMÁTICA

1. **La Imposibilidad de la Perfección Absoluta:** Ningún trader humano ni fondo algorítmico en el mundo (incluyendo Medallion de Renaissance Technologies, Citadel, Juan Facundo o Diego Facundo) gana el 100 % de las operaciones. En opciones binarias y digitales, la rentabilidad no nace de adivinar cada segundo, sino de una **esperanza matemática positiva sostenida**:
   $$\mathbb{E} = (P_{\text{win}} \times \text{Payout}) - (P_{\text{loss}} \times \text{Stake})$$
2. **El Umbral de Supervivencia:** Con un _payout_ del 85 %, el punto de equilibrio (_break-even_) exige un **54.05 % de efectividad**. La meta operativa de Glorian System es sostener un **Win Rate del 58.0 % al 62.0 %** sobre escenarios de alta probabilidad (A+ Setups), descartando el 90 % del ruido del mercado.
3. **Cero Martingala:** Queda **terminantemente prohibido** duplicar o incrementar el tamaño de la posición tras una pérdida. La martingala conduce con certeza matemática a la liquidación de la cuenta ante cualquier racha negativa imprevista.

---

## 2. CANDADOS DE SEGURIDAD INQUEBRANTABLES (PROTOCOLO DE ABORTO)

Antes de analizar cualquier activo o emitir una orden, el agente debe auditar estas 9 reglas. Si una sola falla, la operación queda **inmediatamente cancelada**:

1. **Aislamiento de Entorno (`PRACTICE` vs `REAL`):**
   - El sistema opera **estrictamente en cuenta PRACTICE (Demo)** con saldo calibrado a **$4,000.00 USD** hasta completar una auditoría mínima de **100 operaciones registradas** en `data/bitacora_trading.csv` con _Win Rate_ $\ge 58.0 \%$ y _Profit Factor_ $\ge 1.25$.
   - El paso a cuenta real requiere autorización manual explícita y firma de llave criptográfica.
2. **Concurrencia Estricta (1 Operación a la Vez):**
   - Máximo **una (1) operación activa** en toda la cuenta.
   - Antes de escanear, consultar vía MCP las posiciones abiertas. Si existe una posición pendiente de expiración, el escáner se suspende hasta su liquidación total.
3. **Importe Fijo por Operación (Flat Stake 1.0 %):**
   - Importe por orden: exactamente **$40.00 USD** (1.0 % del capital base de $4,000 USD).
   - En cuentas menores o bajo autorización explícita, se tolera máximo el **2.0 %**. Nunca se varía el importe intradía.
4. **Freno de Emergencia Diario (Daily Stop Loss):**
   - Apagado total e inmediato de la sesión si se alcanza una pérdida neta de **-$120.00 USD (-3.0 %)** o **3 pérdidas consecutivas**.
5. **Meta Diaria de Aseguramiento (Daily Take Profit):**
   - Apagado total y cierre de sesión en verde si se alcanza una ganancia neta de **+$135.00 a +$160.00 USD (~+3.4 % a +4.0 %)** o **4 operaciones netas ganadas**.
6. **Escudo de Cierre Verde (_Trailing Profit Lock_):**
   - Si la ganancia acumulada del día alcanza **+$100.00 USD**, el _Stop Loss_ del día sube automáticamente a **+$60.00 USD**. Si la siguiente operación falla, la sesión termina asegurando un cierre positivo.
7. **Límite de Operaciones y Enfriamiento (_Cooldown_):**
   - Máximo **5 operaciones ejecutadas por sesión**.
   - Enfriamiento obligatorio: **60 segundos** tras un `WIN` y **180 segundos (3 velas M1)** tras un `LOSS`.
   - Si una operación en un par con `USD` resulta en pérdida, se bloquean todas las entradas en pares `USD` durante **15 minutos**.
8. **Filtro de Retorno (_Payout_), Strike y Volatilidad:**
   - Exigir un _payout_ $\ge \mathbf{84 \%}$ (comparar automáticamente entre Binarias y Digitales y elegir la opción más rentable).
   - En Digitales, operar exclusivamente el _strike_ **ATM (At The Money)** verificando liquidez disponible $> \$100\text{ USD}$.
   - Abortar si el `ATR(14)` actual supera **2.5x** el promedio de las últimas 24 horas o si la vela señal supera **3x** el promedio de las últimas 10 velas (señal de noticia o manipulación).
9. **Cuarentena Algorítmica (_Alpha Decay_):**
   - Auditar las últimas 20 operaciones por estrategia en `data/bitacora_trading.csv`. Si una estrategia cae por debajo del **52.0 %**, entra en cuarentena automática (solo papel).

---

## 3. VENTANA HORARIA Y SELECCIÓN DE ACTIVOS (GMT-5 COLOMBIA)

- **06:30 – 07:00 (Pre-Mercado):** Conexión al MCP, comprobación de latencia, lectura de balance demo, revisión del calendario económico (Investing.com / ForexFactory). Cero órdenes.
- **07:00 – 10:30 (Ventana Prime Institucional):** Solapamiento Londres / Nueva York. Máxima liquidez y volumen real. Priorizar Setup 2 (Micro-Pullback en Tendencia).
- **10:30 – 11:30 (Ventana de Rango / Cierre Europeo):** Transición a mercado lateral. Activar Setup 1 (Reversión de Agotamiento).
- **11:30 en adelante:** Cierre obligatorio de la sesión y generación de reporte ejecutivo en consola.
- **Pares Autorizados:** `EUR/USD`, `GBP/USD`, `USD/JPY`, `AUD/USD`, `EUR/JPY`.
- **Prohibición Absoluta de Activos `-OTC`:** Prohibido operar mercados sintéticos de fin de semana (`-OTC`).
- **Escudo Macroeconómico:** Suspensión total de operaciones **15 minutos antes y 15 minutos después** de noticias de alto impacto (3 estrellas en USD, EUR, GBP: Tasas de Interés, NFP, IPC/CPI).

---

## 4. ESTRATEGIAS A+ PARA EXPIRACIÓN DE 1 MINUTO (M1)

Todos los cálculos deben ser emitidos deterministamente por `src/trading/indicadores.mjs`:

### Setup 1: Reversión de Agotamiento M1 (Mercado en Rango)

- **Filtro Estructural:** `ADX(14) < 22` en velas de 1 minuto (mercado sin tendencia definida).
- **Gatillo CALL (Compra / 1 Minuto):**
  1. La vela M1 recién cerrada perforó o cerró fuera de la Banda Inferior de Bollinger (`20, 2.2`).
  2. `RSI(14) <= 25` y `Estocástico(14, 3, 3) < 20`.
  3. La vela presenta una **mecha inferior de rechazo $\ge 35 \%$** de su tamaño total (absorción compradora institucional).
  4. **Entrada:** Abrir orden `CALL` a **1 minuto** exactamente en el segundo `:00` de la vela siguiente.
- **Gatillo PUT (Venta / 1 Minuto):**
  1. La vela M1 recién cerrada perforó o cerró fuera de la Banda Superior de Bollinger (`20, 2.2`).
  2. `RSI(14) >= 75` y `Estocástico(14, 3, 3) > 80`.
  3. La vela presenta una **mecha superior de rechazo $\ge 35 \%$** de su tamaño total (rechazo vendedor).
  4. **Entrada:** Abrir orden `PUT` a **1 minuto** en el segundo `:00` de la vela siguiente.

### Setup 2: Micro-Pullback M1 a Favor de Tendencia

- **Filtro Estructural:** `ADX(14) > 25` en M1 y alineación limpia de medias móviles:
  - Alcista: `EMA(9) > EMA(20) > EMA(50)` con pendientes positivas.
  - Bajista: `EMA(9) < EMA(20) < EMA(50)` con pendientes negativas.
- **Gatillo CALL (Compra / 1 Minuto):**
  1. El precio retrocede en 1 a 3 velas bajistas hacia la zona de la `EMA(9)` o `EMA(20)`.
  2. `RSI(14)` se mantiene entre `45` y `65` (fuerza sin sobrecompra).
  3. La vela toca la EMA y cierra con mecha de rechazo inferior $\ge 40 \%$ del rango total.
  4. **Entrada:** Abrir `CALL` a **1 minuto** en la apertura de la siguiente vela.
- **Gatillo PUT (Venta / 1 Minuto):**
  1. El precio retrocede en 1 a 3 velas alcistas hacia la zona de la `EMA(9)` o `EMA(20)`.
  2. `RSI(14)` se mantiene entre `35` y `55` (fuerza bajista sin sobreventa).
  3. La vela toca la EMA y cierra con mecha de rechazo superior $\ge 40 \%$ del rango total.
  4. **Entrada:** Abrir `PUT` a **1 minuto** en la apertura de la siguiente vela.

---

## 5. AUDITORÍA, BITÁCORA Y SEGURIDAD CRIPTOGRÁFICA

1. **Bitácora Inmutable:** Toda operación debe persistirse en `data/bitacora_trading.csv` con:
   `Timestamp, Cuenta, Activo, Estrategia, Direccion, Strike, Monto_USD, Payout_Pct, Resultado, PnL_USD, Saldo_USD, Latencia_ms, Confluencia`
2. **Protección de Secretos (Ley VI):** Los tokens de IQ Option residen exclusivamente en archivos locales no rastreados (`mcp_config.json`, `.env`). Prohibido subirlos a Git o mostrarlos en logs.
3. **Persistencia de Estado:** El archivo `.eos/trading-state.json` rastrea el conteo diario para evitar violaciones de límites en caso de reinicio de la máquina.
