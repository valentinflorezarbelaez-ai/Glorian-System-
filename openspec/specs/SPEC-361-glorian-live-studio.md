# SPEC-361: Glorian Live Studio & Interactive Visual HUD

**Specification ID**: `SPEC-361`  
**Change Reference**: `CHANGE-223`  
**Lifecycle Tier**: `production`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Formal TLA+ Model**: `docs/formal/GlorianLiveStudio.tla` (Model 104)  
**Status**: `APPROVED`

---

## 1. Scope & Domain Context

This specification formally establishes the requirements, interfaces, state invariants, and verification criteria for `EosGlorianLiveStudio`. The engine provides an embedded, zero-dependency, local HTTP/SSE control server serving a real-time reactive HUD for visual topology navigation, bitemporal state scrubbing, live blast-radius calculation, and swarm telemetry monitoring.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-361-01 (Ubiquitous Server Initialization)**:
  `EL SISTEMA DEBE inicializar un servidor HTTP nativo sin dependencias de terceros en el puerto configurado (o un puerto efímero disponible si el puerto objetivo está ocupado), exponiendo rutas REST y un endpoint de Server-Sent Events (SSE).`

- **FR-361-02 (Event-Driven Telemetry Streaming)**:
  `CUANDO se conecta un cliente al endpoint SSE (/api/stream o /events), EL SISTEMA DEBE registrar la conexión activa, transmitir inmediatamente una instantánea del estado actual del sistema, y subsecuentemente transmitir cada evento de telemetría emitido con un identificador de secuencia monótono ascendente.`

- **FR-361-03 (State-Driven Reactive HUD Delivery)**:
  `MIENTRAS el servidor de estudio esté en estado de ejecución, EL SISTEMA DEBE servir en la ruta raíz (/) un documento HTML5/CSS3/JavaScript autónomo (self-contained single-file HUD) que renderiza el grafo topológico SVG interactivo, métricas de rendimiento y controles de navegación sin requerir ningún recurso de red externo.`

- **FR-361-04 (Event-Driven 2D Bitemporal Time-Travel Projection)**:
  `CUANDO se recibe una petición de consulta temporal con parámetros de asOfTx y/o asOfValid en /api/temporal/projection, EL SISTEMA DEBE calcular la proyección de hechos arquitectónicos válidos en dichas coordenadas temporales y responder en tiempo sub-milisegundo (< 10ms).`

- **FR-361-05 (Event-Driven Transitive Blast-Radius Calculation)**:
  `CUANDO se recibe una solicitud de inspección de nodo en /api/blast-radius?node=<ID>, EL SISTEMA DEBE computar el grafo de impacto transitivo (ancestros aguas arriba y dependientes aguas abajo) retornando la lista ordenada de nodos afectados y la métrica de criticidad de impacto.`

- **FR-361-06 (Ubiquitous Headless Snapshot & Health Verification)**:
  `EL SISTEMA DEBE proveer endpoints /api/snapshot y /api/health que serializan el estado completo del sistema (módulos, tests, especificaciones, swarm, métricas de hardware) en formato JSON determinista con firma de integridad SHA-256.`

- **FR-361-07 (Error / Unwanted Condition Graceful Shutdown)**:
  `SI el servidor recibe una señal de detención (stop()) o desconexión abrupta de clientes SSE, ENTONCES EL SISTEMA DEBE cerrar ordenadamente todas las conexiones de transmisión activas, liberar el socket de escucha y confirmar la terminación sin fugas de descriptores de archivo ni excepciones no controladas.`

---

## 3. Acceptance Criteria (BDD Syntax)

### BDD-1945: Native HTTP Server Lifecycle & Routing

```gherkin
ESCENARIO: Inicialización y ciclo de vida del servidor HTTP embebido
  DADO una instancia de EosGlorianLiveStudio configurada con puerto efímero (0)
  CUANDO se invoca start()
  ENTONCES el servidor pasa a estado 'RUNNING' con una dirección de red y puerto válidos
  Y una petición GET a /api/health retorna código 200 con status 'OK'
  Y al invocar stop() el servidor pasa a estado 'STOPPED' y el puerto es liberado.
```

### BDD-1946: Real-Time SSE Telemetry Stream Monotonicity

```gherkin
ESCENARIO: Transmisión de telemetría en tiempo real por Server-Sent Events
  DADO un servidor EosGlorianLiveStudio en ejecución
  CUANDO un cliente realiza una conexión HTTP GET a /api/stream
  ENTONCES el servidor responde con cabeceras 'text/event-stream' y 'Cache-Control: no-cache'
  Y envía un evento inicial de sincronización de estado 'init'
  Y al invocar broadcastEvent() el cliente recibe el evento con un ID de secuencia monótonamente creciente.
```

### BDD-1947: Single-File Reactive HUD Rendering

```gherkin
ESCENARIO: Entrega de interfaz visual interactiva sin dependencias externas
  DADO un servidor EosGlorianLiveStudio en ejecución
  CUANDO un cliente realiza una petición GET a la ruta raíz '/'
  ENTONCES el servidor retorna código 200 con 'Content-Type: text/html; charset=utf-8'
  Y el contenido HTML contiene el SVG topológico embebido, los estilos Tier S-0 y los controladores de interacción
  Y no contiene ninguna URL de recursos externos (CDN o dependencias remotas).
```

### BDD-1948: Interactive 2D Bitemporal Projection Endpoint

```gherkin
ESCENARIO: Consulta de proyección topológica bitemporal
  DADO un servidor EosGlorianLiveStudio con hechos registrados en el ledger
  CUANDO se consulta /api/temporal/projection con asOfTx y asOfValid
  ENTONCES el servidor retorna los nodos y aristas activos en esas coordenadas temporales
  Y el tiempo de procesamiento de la proyección es inferior a 10 milisegundos.
```

### BDD-1949: Interactive Transitive Blast-Radius Endpoint

```gherkin
ESCENARIO: Inspección interactiva de radio de impacto transitivo
  DADO un servidor EosGlorianLiveStudio con el grafo de dependencias del sistema
  CUANDO se consulta /api/blast-radius especificando un nodo objetivo
  ENTONCES el servidor retorna la lista de nodos en el radio de impacto directo y transitivo
  Y calcula la severidad de impacto categorizada correctamente.
```

### BDD-1950: Full Diagnostic Audit & Receipt Generation

```gherkin
ESCENARIO: Auditoría formal del motor de estudio y emisión de recibo
  DADO una instancia de EosGlorianLiveStudio
  CUANDO se ejecuta audit()
  ENTONCES genera un recibo EosGlorianLiveStudioReceipt con todas las verificaciones en PASS
  Y calcula un hash criptográfico SHA-256 inmutable sobre el resultado de la auditoría.
```
