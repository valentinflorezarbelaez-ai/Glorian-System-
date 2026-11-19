# SPEC-355: Deterministic Zero-Copy Shared Memory Inter-Process Ring Buffer (IPC) Architecture

## 1. Specification Metadata

- **Spec ID**: `SPEC-355`
- **Change ID**: `CHANGE-217`
- **Ladder Stage**: `LADDER-13`
- **Status**: `SPECIFICATION_APPROVED`
- **Authorized By**: Valentín Flórez Arbeláez (Principal Architect & System Owner)

---

## 2. Functional Requirements (IEEE 830 EARS Standard)

- **FR-355-01 (Power-of-2 Buffer Allocation & 64-Byte Cache Padding)**:
  - _Ubiquitous_: `EL SISTEMA DEBE asignar la memoria compartida SharedArrayBuffer con capacidad N donde N es potencia de 2 (2^k), espaciando los punteros atómicos headSequence y tailSequence en bloques de 64 bytes para evitar false sharing a nivel de línea de caché de la CPU.`

- **FR-355-02 (Zero-Copy Binary Frame Layout & Checksum)**:
  - _Ubiquitous_: `EL SISTEMA DEBE codificar cada mensaje en un marco binario fijo compuesto por Magic Bytes (0x454F), Message Type (uint16), Monotonic Sequence (uint64), Payload Length (uint32), CRC32 Checksum (uint32) y datos contiguos sin serialización JSON.`

- **FR-355-03 (Lock-Free SPSC Enqueue & Bitwise Index Masking)**:
  - _Event-Driven_: `CUANDO un productor inserta un mensaje en modo Single-Producer Single-Consumer (SPSC), EL SISTEMA calculará el slot físico mediante index & (capacity - 1) y publicará la secuencia atómicamente mediante Atomics.store sin adquirir locks.`

- **FR-355-04 (MPSC Multi-Producer Atomic Compare-and-Swap)**:
  - _Event-Driven_: `CUANDO múltiples productores insertan concurrentemente en modo Multi-Producer Single-Consumer (MPSC), EL SISTEMA DEBE reservar el siguiente slot de secuencia utilizando Atomics.compareExchange de forma lock-free.`

- **FR-355-05 (Backpressure Policies & Buffer Overrun Prevention)**:
  - _Error Condition_: `SI el búfer se llena y headSequence - tailSequence >= capacity, ENTONCES EL SISTEMA aplicará la política de contrapresión configurada (BLOCKING_WAIT con Atomics.wait/notify, SPIN_YIELD o DROP_OLDEST_UNACKED) garantizando que no ocurran lecturas corruptas ni escrituras solapadas.`

- **FR-355-06 (Sub-Microsecond Zero-Allocation Ingestion & Drain)**:
  - _State-Driven_: `MIENTRAS existan mensajes no consumidos en el ring buffer, EL SISTEMA permitirá que el consumidor lea marcos binarios directamente de la memoria compartida mediante DataView/Uint8Array con cero asignaciones en el heap de Node.js.`

- **FR-355-07 (Leslie Lamport TLA+ Model 98 Invariant & Formal Audit)**:
  - _Ubiquitous_: `EL SISTEMA DEBE verificar la corrección del protocolo mediante el modelo formal TLA+ Model 98 (ZeroCopyIpcRingBuffer.tla) y emitir un recibo criptográfico SHA-256 en docs/evidence/ZERO_COPY_IPC_RINGBUFFER_RECEIPT.json con epistemicState PRODUCTION_READY_WITHIN_TESTED_SCOPE.`

---

## 3. BDD Acceptance Criteria (Gherkin Standard)

```gherkin
ESCENARIO: BDD-1909: Power-of-2 Ring Buffer Allocation & 64-Byte Cache-Line Alignment
  DADO un ring buffer inicializado con capacidad 1024 slots y slotSize 64 bytes
  CUANDO se inspecciona el layout de memoria en SharedArrayBuffer
  ENTONCES la capacidad efectiva es 1024 y el offset entre punteros atómicos es múltiplo exacto de 64 bytes
  Y la máscara de índice calculada es exactamente 1023

ESCENARIO: BDD-1910: Binary Frame Encoding & CRC32 Integrity Verification
  DADO un mensaje con payload binario de 32 bytes y tipo 0x0102
  CUANDO se codifica mediante EosBinaryFrameCodec
  ENTONCES la cabecera ocupa exactamente 20 bytes con magic 0x454F
  Y el checksum CRC32 verificado coincide bit a bit con los datos

ESCENARIO: BDD-1911: Lock-Free SPSC Push and Drain with Monotonic Sequences
  DADO un ring buffer SPSC vacío
  CUANDO el productor inserta 500 mensajes secuenciales
  ENTONCES el consumidor drena los 500 mensajes en orden monótono estricto
  Y ninguna secuencia se duplica ni se pierde

ESCENARIO: BDD-1912: Multi-Producer MPSC Atomic Slot Reservation
  DADO un ring buffer MPSC compartido entre múltiples productores simulados
  CUANDO se reservan concurrentemente slots de escritura con Atomics.compareExchange
  ENTONCES cada productor recibe un índice de secuencia único y estrictamente monótono
  Y la diferencia entre head y tail preserva la consistencia

ESCENARIO: BDD-1913: Backpressure Policy Enforcement under Buffer Saturation
  DADO un ring buffer con capacidad pequeña (ej. 4 slots)
  CUANDO un productor intenta insertar un 5to mensaje sin que el consumidor haya drenado
  ENTONCES en modo BLOCKING_WAIT la escritura se bloquea hasta que ocurra un drain
  Y en modo FAIL_FAST se emite BUFFER_CAPACITY_EXCEEDED sin corromper el estado

ESCENARIO: BDD-1914: Sub-Microsecond Throughput Benchmark & Formal Audit Receipt
  DADO el motor EosZeroCopyIpcGovernor
  CUANDO se ejecuta la suite de benchmarking y auditoría formal
  ENTONCES el throughput supera 1,000,000 operaciones por segundo con latencia media sub-microsegundo
  Y se emite el recibo criptográfico ZERO_COPY_IPC_RINGBUFFER_RECEIPT.json con veredicto CONFORMANT
```
