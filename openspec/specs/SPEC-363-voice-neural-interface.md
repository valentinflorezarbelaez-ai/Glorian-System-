# SPEC-363: Voice Neural Interface with Gemini Live API

**Specification ID**: `SPEC-363`  
**Change Reference**: `CHANGE-225`  
**Lifecycle Tier**: `production`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Formal TLA+ Model**: `docs/formal/VoiceNeuralInterface.tla` (Model 106)  
**Status**: `APPROVED`

---

## 1. Scope & Domain Context

This specification formally establishes the requirements, interfaces, state invariants, and verification criteria for `EosVoiceNeuralInterface`. The engine provides a pure Layer-0, zero-dependency, bidirectional voice streaming interface between operators and Glorian System. It implements mathematical Voice Activity Detection (VAD), linear PCM framing, ephemeral session negotiation, and direct visual HUD integration in `EosGlorianLiveStudio`.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-363-01 (Ubiquitous PCM Audio Frame Ingestion)**:
  `EL SISTEMA DEBE ingerir secuencias de audio lineal PCM a 16kHz o 24kHz (16-bit mono) en bloques discretos de 20ms a 100ms utilizando estructuras de memoria contigua (Int16Array / Buffer nativo) sin dependencias nativas externas de C++.`

- **FR-363-02 (State-Driven Mathematical Voice Activity Detection)**:
  `MIENTRAS se reciban bloques de audio PCM en una sesión de voz activa, EL SISTEMA DEBE calcular la energía de señal RMS (Root-Mean-Square) y la tasa de cruce por cero (ZCR) de cada bloque para clasificar el estado entre 'SILENCE', 'SPEECH_START', 'SPEECH_CONTINUOUS' y 'SPEECH_END' mediante histéresis matemática.`

- **FR-363-03 (Event-Driven Framing & Gemini Live Protocol Serialization)**:
  `CUANDO se detecta un bloque de habla activa ('SPEECH_START' o 'SPEECH_CONTINUOUS'), EL SISTEMA DEBE empaquetar los datos binarios en marcos de mensaje conformes al protocolo Gemini 3.8 / 2.0 Live API con cabeceras de sincronización y número de secuencia monótono.`

- **FR-363-04 (Event-Driven Audio Backpressure & Buffer Bounds)**:
  `CUANDO la tasa de llegada de bloques de audio excede la capacidad de transmisión de la red, EL SISTEMA DEBE almacenar los marcos en un búfer circular acotado y descartar los marcos más antiguos de silencio ('DROP_OLDEST_SILENCE') para garantizar una latencia de voz interactiva inferior a 250 milisegundos.`

- **FR-363-05 (Ubiquitous Live HUD Audio Bridge & Visualizer)**:
  `EL SISTEMA DEBE proporcionar una pasarela de audio en EosGlorianLiveStudio que expone controles de micrófono (Web Audio API), indicador visual de nivel de decibelios RMS en tiempo real, y alternancia entre Push-to-Talk y detección continua de voz.`

- **FR-363-06 (State-Driven Ephemeral Token Negotiation & Session Isolation)**:
  `MIENTRAS una sesión de voz esté abierta, EL SISTEMA DEBE aislar el contexto conversacional en una sesión efímera firmada criptográficamente con tiempo de vida finito (TTL <= 10 minutos), invalidando automáticamente cualquier token expirado.`

- **FR-363-07 (Error / Unwanted Condition Graceful Audio Channel Recovery)**:
  `SI ocurre una desconexión abrupta del canal de voz o saturación del búfer de audio, ENTONCES EL SISTEMA DEBE purgar los búferes de audio en vuelo, restablecer el detector VAD a 'SILENCE' y emitir un evento de alerta SSE sin colapsar el plano de control ni fugar memoria.`

---

## 3. Acceptance Criteria (BDD Syntax)

### BDD-1957: Linear PCM Audio Framing & Normalization

```gherkin
ESCENARIO: Ingesta y normalización de marcos de audio PCM
  DADO una instancia de EosVoiceNeuralInterface configurada a 16kHz mono 16-bit
  CUANDO se ingiere un búfer de muestras PCM válidas
  ENTONCES normaliza los valores a amplitudes en rango [-1.0, 1.0]
  Y verifica que la duración del bloque coincide con el cálculo de muestras por canal.
```

### BDD-1958: Mathematical Voice Activity Detection (VAD) Hysteresis

```gherkin
ESCENARIO: Detección matemática de voz mediante RMS y tasa de cruce por cero
  DADO un flujo de bloques de audio conteniendo silencio alternado con tonos senoidales de voz
  CUANDO el motor VAD procesa los bloques consecutivamente
  ENTONCES transiciona correctamente de 'SILENCE' a 'SPEECH_START' y luego a 'SPEECH_CONTINUOUS'
  Y al cesar la señal de voz transiciona a 'SPEECH_END' y regresa a 'SILENCE'.
```

### BDD-1959: Gemini Live API Binary Message Serialization

```gherkin
ESCENARIO: Serialización de tramas de voz para el protocolo Gemini Live
  DADO un marco de audio clasificado como habla activa
  CUANDO se serializa para transmisión de red
  ENTONCES genera una estructura de marco binario con cabecera de tipo 'audio/pcm', longitud y payload
  Y asigna un ID de secuencia incremental monótono.
```

### BDD-1960: Circular Audio Buffer Bounded Backpressure

```gherkin
ESCENARIO: Gestión de contrapresión con búfer circular acotado
  DADO un búfer de audio configurado con capacidad máxima de 10 marcos
  CUANDO se inyectan 15 marcos de audio sin drenar
  ENTONCES el búfer mantiene estrictamente <= 10 marcos sin desbordamiento de memoria
  Y descarta los marcos de menor energía preservando los marcos de habla.
```

### BDD-1961: Live HUD Audio Gateway & Webhook Bridge

```gherkin
ESCENARIO: Integración de pasarela de voz con Glorian Live Studio
  DADO un servidor EosGlorianLiveStudio en ejecución con soporte de voz
  CUANDO se consulta /api/voice/session
  ENTONCES retorna un token de sesión efímero con identificador único y configuración de audio
  Y transmite eventos de nivel de decibelios a través del flujo SSE.
```

### BDD-1962: Full Diagnostic Audit & Receipt Generation

```gherkin
ESCENARIO: Auditoría formal de la interfaz neural de voz y emisión de recibo
  DADO una instancia de EosVoiceNeuralInterface
  CUANDO se ejecuta audit()
  ENTONCES genera un recibo EosVoiceNeuralInterfaceReceipt con todas las verificaciones en PASS
  Y calcula un hash criptográfico SHA-256 inmutable sobre el resultado.
```
