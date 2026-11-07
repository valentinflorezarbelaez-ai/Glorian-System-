# SPEC-029: BI-DIRECTIONAL MCP LIVE STREAM SERVER (SSE & STDIO) FOR CURSOR & ANTIGRAVITY

- **Spec ID**: `SPEC-029`
- **Related Plan**: `PLAN-022`
- **Author**: Valentín Flórez Arbeláez
- **Status**: `APPROVED`
- **Revision**: `v1.0.0`
- **Date**: 2026-10-25

---

## 1. Functional Requirements (EARS Standard)

- **FR-076 (Ubiquitous - JSON-RPC 2.0 Protocol Conformance)**:
  `EL SISTEMA implementará la especificación oficial de Model Context Protocol (MCP v2024-11-05) basada en JSON-RPC 2.0 sobre transportes stdio y SSE con cero dependencias externas de runtime.`

- **FR-077 (Event-Driven - SSE Stream Initialization & Endpoint Event)**:
  `CUANDO un cliente MCP (Cursor, Antigravity o Claude Code) realice una solicitud GET a /sse, EL SISTEMA establecerá un flujo Server-Sent Events con encabezados text/event-stream, generará un identificador criptográfico de sesión (sessionId) y emitirá un evento inicial de tipo endpoint con la URI relativa /message?sessionId=<sessionId>.`

- **FR-078 (Event-Driven - Bi-Directional Message Dispatching over SSE)**:
  `CUANDO el cliente envíe una petición JSON-RPC 2.0 mediante POST a /message?sessionId=<sessionId>, EL SISTEMA despachará la solicitud hacia el motor de herramientas y transmitirá la respuesta y eventos de progreso (notifications/progress) a través de la conexión SSE activa del suscriptor.`

- **FR-079 (State-Driven - Heartbeat & Session Lifecycle Management)**:
  `MIENTRAS una sesión SSE permanezca abierta, EL SISTEMA emitirá pulsos periódicos de keep-alive cada 15 segundos para evitar la desconexión del proxy o cliente, y liberará automáticamente los descriptores y temporizadores asociados inmediatamente tras la desconexión del cliente.`

- **FR-080 (Error / Unwanted Condition - Resilient Stdio Isolation)**:
  `SI un mensaje recibido por stdin es sintácticamente inválido o incompleto, ENTONCES EL SISTEMA retornará un objeto de error JSON-RPC con código -32700 (Parse error) a través de stdout preservando stderr exclusivamente para diagnósticos del sistema.`

---

## 2. BDD Acceptance Criteria (Gherkin Standard)

```gherkin
ESCENARIO: [BDD-067] Apertura de Canal SSE y Negociación de Endpoint
  DADO un servidor EosMcpStreamServer en ejecución
  CUANDO un cliente realiza una solicitud HTTP GET a /sse
  ENTONCES el servidor responde con código HTTP 200 y Content-Type text/event-stream
  Y emite inmediatamente el evento "endpoint" conteniendo "/message?sessionId=" con un UUID válido
  Y mantiene la conexión abierta emitiendo comentarios de keep-alive periódicos.

ESCENARIO: [BDD-068] Despacho Bi-Direccional de Herramientas y Notificaciones de Progreso
  DADO una sesión SSE activa con un sessionId válido
  CUANDO el cliente envía un POST a /message con la herramienta "eos_query_topology" o "eos_wasm_compress"
  ENTONCES el servidor procesa la llamada y emite la respuesta JSON-RPC 2.0 sobre el canal SSE
  Y el resultado contiene la estructura esperada según el esquema de la herramienta.

ESCENARIO: [BDD-069] Manejo de Desconexión de Cliente y Liberación de Memoria
  DADO un cliente conectado recibiendo eventos en /sse
  CUANDO el cliente interrumpe o cierra la conexión HTTP abruptamente
  ENTONCES el servidor detecta el evento "close" del socket
  Y purga la sesión del gestor de sesiones en memoria sin fugas de memoria (0 dangling listeners).
```

---

_Signed by Principal Architect: Valentín Flórez Arbeláez_
