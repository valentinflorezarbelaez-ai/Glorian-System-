# SPEC-331: StreamingLLM, Attention Sinks & Infinite-Context Window Memory Compression Engine

**Title**: StreamingLLM, Attention Sinks & Infinite-Context Window Memory Compression Engine  
**Domain**: Neural Inference Optimization, Streaming LLM, Attention Sinks, KV Cache Compression, RoPE Shift  
**Version**: 1.0.0  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Created**: 2026-11-17

---

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Event-Driven)**: CUANDO el motor de inferencia procesa los primeros $K_{\text{sink}}$ tokens de una secuencia continua, EL SISTEMA asignará y fijará dichos estados KV en una región de sumidero de atención (Attention Sink Region) inmune a cualquier ciclo de desalojo.
- **FR-2 (Permanent / Ubiquitous)**: EL SISTEMA mantendrá una ventana local deslizante $W_{\text{local}}$ en memoria activa, garantizando que el número total de bloques KV activos jamás exceda $K_{\text{sink}} + W_{\text{local}}$ para cualquier longitud de secuencia generada $T \to \infty$.
- **FR-3 (Event-Driven)**: CUANDO la longitud total de la secuencia $T$ supera el límite de capacidad $K_{\text{sink}} + W_{\text{local}}$, EL SISTEMA desalojará en tiempo $O(1)$ los tokens más antiguos de la ventana local, preservando intactos los $K_{\text{sink}}$ tokens de sumidero iniciales.
- **FR-4 (State-Driven / Invariant)**: MIENTRAS se produce el desalojo de tokens intermediarios en el intervalo $[K_{\text{sink}}, T - W_{\text{local}}]$, EL SISTEMA reasignará dinámicamente los índices posicionales para Rotary Position Embeddings (RoPE) de forma contigua, evitando saltos discontinuos que degraden la perplejidad.
- **FR-5 (Permanent / Ubiquitous)**: EL SISTEMA mantendrá la norma de atención y la estabilidad de la suma de Softmax acotada dentro de una tolerancia $\Delta \le 10^{-4}$ respecto a la referencia de contexto completo, evitando la explosión de perplejidad observada en ventanas deslizantes ingenuas.
- **FR-6 (Event-Driven)**: CUANDO se solicita una auditoría integral del motor, EL SISTEMA verificará la inmunidad del sumidero, la cota de memoria y la contigüidad de RoPE sobre un flujo de prueba de $\ge 10{,}000$ tokens, emitiendo un recibo criptográfico firmado SHA-256.

---

## 2. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1761 Asignación e Inmunidad Permanente de Sumideros de Atención (Attention Sinks)
  DADO un motor StreamingLLM configurado con K_sink = 4 y W_local = 16
  CUANDO se ingieren los primeros 4 tokens de una secuencia de entrada
  ENTONCES el sistema marca los 4 bloques KV con isSink = true
  Y garantiza que dichos 4 bloques permanezcan residentes en memoria activa independientemente del volumen de generación posterior.

ESCENARIO: BDD-1762 Cota de Memoria Constante O(K_sink + W_local) en Secuencias Infinitas
  DADO un motor StreamingLLM con capacidad máxima K_sink + W_local = 20 tokens
  CUANDO se generan continuamente 10,000 tokens en modo streaming
  ENTONCES la cantidad de bloques KV en memoria activa se mantiene estrictamente en exactamente 20
  Y el consumo de memoria se mantiene plano con cero fugas en el heap.

ESCENARIO: BDD-1763 Desalojo O(1) de Tokens Locales Obsoletos
  DADO un buffer de ventana local saturado en su capacidad W_local
  CUANDO ingresa un nuevo token t_new en la posición T
  ENTONCES el sistema expulsa el token más antiguo de la ventana local en tiempo O(1) mediante punteros circulares
  Y los tokens de sumidero K_sink conservan su posición física y lógica original.

ESCENARIO: BDD-1764 Reasignación Posicional Dinámica para Rotary Embeddings (RoPE Shift)
  DADO un estado de caché donde se han desalojado tokens en el rango intermedio
  CUANDO se calculan los embeddings rotacionales para un nuevo token de consulta (Query)
  ENTONCES los índices de posición asignados son contiguos dentro de la ventana local [K_sink, K_sink + W_local - 1]
  Y la distancia relativa entre claves y consultas recientes se preserva sin discontinuidades.

ESCENARIO: BDD-1765 Estabilidad de Perplejidad y Normalización de Softmax
  DADO un stream de generación prolongado comparado contra una ventana deslizante ingenua sin sumidero
  CUANDO se calculan los pesos de atención acumulados de la capa Softmax
  ENTONCES el motor con Attention Sinks mantiene la suma normalizada dentro de tolerancia estricta (|sum - 1.0| < 1e-6)
  Y la perplejidad no experimenta la divergencia catastrófica observada en la ventana ingenua.

ESCENARIO: BDD-1766 Auditoría de Invariantes y Emisión de Recibo Criptográfico SHA-256
  DADO un ciclo de verificación automatizada del motor StreamingLLM
  CUANDO se ejecuta la auditoría sobre un flujo de simulación de alta intensidad
  ENTONCES se certifica que sinkImmunityVerified es true, memoryCeilingVerified es true y ropeContiguityVerified es true
  Y se emite el recibo formal firmado con SHA-256 en docs/evidence/STREAMING_LLM_ATTENTION_SINKS_RECEIPT.json.
```
