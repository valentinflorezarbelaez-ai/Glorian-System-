# SPEC-332: Disaggregated Prefill & Decode Serving Engine (PD Separation, Chunked Prefill & Zero-Copy KV Transfer)

**Status**: `APPROVED`  

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Event-Driven)**: CUANDO se recibe una solicitud de inferencia con longitud de prompt $T > B_{\text{chunk}}$, EL SISTEMA divide el procesamiento del prompt en micro-bloques discretos de tamaño máximo $B_{\text{chunk}}$ y programa su ejecución sin bloquear las colas de generación de decodificación activa.
- **FR-2 (State-Driven)**: MIENTRAS un nodo trabaje en rol de `PREFILL_WORKER`, EL SISTEMA asigna su capacidad computacional a la ingestión tensorial masiva de prompts y a la generación de páginas de clave-valor (KV Cache) sin ejecutar pasos autoregresivos de decodificación token por token.
- **FR-3 (State-Driven)**: MIENTRAS un nodo trabaje en rol de `DECODE_WORKER`, EL SISTEMA restringe su cómputo a pasos autoregresivos de decodificación de baja latencia utilizando páginas KV transferidas desde nodos de prefill.
- **FR-4 (Event-Driven)**: CUANDO un nodo de prefill concluye la fase de ingestión de un prompt, EL SISTEMA sintetiza un descriptor de transferencia de páginas KV (`KvMigrationDescriptor`) y transfiere la custodia del estado tensorial al nodo de decodificación asignado con verificación de integridad criptográfica SHA-256.
- **FR-5 (Error / Unwanted Condition)**: SI se detecta que la transferencia de páginas KV contiene un checksum SHA-256 discordante o si el nodo de decodificación no posee capacidad de memoria suficiente, ENTONCES EL SISTEMA rechaza la migración con código `KV_MIGRATION_INTEGRITY_VIOLATION` y reintenta la transferencia en un nodo alternativo.
- **FR-6 (Ubiquitous / Permanent)**: EL SISTEMA mantiene el aislamiento estricto de latencias entre TTFT (Time To First Token) y TPOT (Time Per Output Token), garantizando que las ráfagas de prefill no degraden la variabilidad del tiempo entre tokens de los flujos activos.

---

## 2. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1767 Segmentación y Planificación de Chunked Prefill
  DADO un motor disagregado configurado con presupuesto de chunk B_chunk = 256 tokens
  CUANDO se somete un prompt de 1,024 tokens
  ENTONCES el motor descompone el prompt en exactamente 4 micro-bloques secuenciales de 256 tokens
  Y emite telemetría de ejecución por bloque sin stalls globales en el planificador.

ESCENARIO: BDD-1768 Desacoplamiento Físico de Nodos Prefill y Decode (PD Separation)
  DADO un clúster con 2 nodos de Prefill y 4 nodos de Decode
  CUANDO ingresa un lote concurrente de 10 solicitudes de prefill y 50 solicitudes de decodificación activa
  ENTONCES los nodos de Prefill ejecutan exclusivamente cómputo de atención cuadrática sobre prompts
  Y los nodos de Decode ejecutan exclusivamente pasos de generación autoregresiva token por token con latencia TPOT estable.

ESCENARIO: BDD-1769 Migración de Páginas KV Cache con Handoff Zero-Copy y Checksum SHA-256
  DADO un prompt cuyo procesamiento de prefill ha finalizado exitosamente en un nodo de prefill
  CUANDO se transfiere el tensor de claves y valores (KV pages) hacia el nodo de decodificación destino
  ENTONCES el sistema serializa el descriptor de páginas con su hash SHA-256
  Y el nodo de decodificación valida la integridad criptográfica y monta las páginas en su tabla de páginas local en O(1).

ESCENARIO: BDD-1770 Eliminación de Head-of-Line Blocking y Estabilidad de TPOT
  DADO un flujo de decodificación en curso con TPOT promedio de 12 ms
  CUANDO arriba una ráfaga masiva de prompts largos (32K tokens) en el sistema disagregado
  ENTONCES el TPOT de las sesiones de decodificación activas se desvía en menos de un 15%
  Y el tiempo de espera por bloqueo de línea (Head-of-Line wait) se mantiene estrictamente en 0 ms.

ESCENARIO: BDD-1771 Rechazo y Recuperación ante Corrupción de Páginas KV en Tránsito
  DADO un descriptor de migración de páginas KV transferido entre nodos
  CUANDO el payload del buffer sufre una alteración deliberada de un byte
  ENTONCES el nodo de decodificación detecta la anomalía mediante SHA-256
  Y rechaza la carga con status KV_MIGRATION_INTEGRITY_VIOLATION activando la re-transferencia segura.

ESCENARIO: BDD-1772 Auditoría de Invariantes y Certificación Formal del Clúster Disagregado
  DADO un ciclo de simulación de alta concurrencia con ráfagas asimétricas de prefill y decode
  CUANDO se ejecuta la auditoría del motor disagregado
  ENTONCES se verifica que noHeadOfLineBlocking es true, kvIntegrityVerified es true y slaIsolationVerified es true
  Y se genera el recibo firmado en docs/evidence/DISAGGREGATED_PREFILL_DECODE_RECEIPT.json.
```
