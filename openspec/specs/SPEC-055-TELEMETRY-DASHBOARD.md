# SPEC-055 — REAL-TIME VISUAL TELEMETRY & TOPOLOGICAL CONTROL DASHBOARD
**Version**: 61.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-048  
**Architecture Decision Record**: ADR-061  
**Domain Layer**: Layer-0 System Core (`src/core/eosTelemetryDashboard.ts`)

---

## 1. Executive Summary
Inspired by Google Borgmon, Datadog Platform Observability, and Spotify Backstage UI standards, SPEC-055 formalizes the EOS Real-Time Visual Telemetry & Topological Control Dashboard. Powered by a native Layer-0 HTTP engine (`node:http`) with zero external runtime npm dependencies, the dashboard serves a high-performance, single-file HTML5 interface presenting the compiled agent topology DAG, the zero-copy token-savings odometer (>70%), a live SQLite WAL ledger viewer with FTS5 search, and REST API endpoints (`/api/telemetry`, `/api/ledger`, `/api/topology`).

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-195: Inicialización de Micro-Servidor HTTP Capa 0
**Event-Driven**: CUANDO el usuario o agente inicia el dashboard (`eos dashboard`), EL SISTEMA levantará un servidor HTTP nativo (`node:http`) en el puerto configurado (4321 por defecto) sin dependencias externas de npm.

### FR-196: Endpoint REST de Telemetría Global
**State-Driven**: MIENTRAS el servidor está activo, al recibir una petición `GET /api/telemetry`, EL SISTEMA responderá con un JSON estructurado con el estado de las aduanas SecDevOps, número de specs activas, tiempo de actividad y huella de memoria.

### FR-197: Endpoint REST del Ledger SQLite WAL
**State-Driven**: MIENTRAS el servidor está activo, al recibir una petición `GET /api/ledger`, EL SISTEMA consultará `EosDurableSqliteLedger` y devolverá las entradas más recientes con sus atestaciones SHA-256.

### FR-198: Endpoint REST de Topología de Agentes
**State-Driven**: MIENTRAS el servidor está activo, al recibir una petición `GET /api/topology`, EL SISTEMA consultará `EosAgentTopologyMesh` y devolverá el DAG acíclico compilado y las métricas de ahorro de tokens.

### FR-199: Entrega de Panel de Control Visual HTML5
**State-Driven**: MIENTRAS el servidor está activo, al recibir una petición `GET /`, EL SISTEMA responderá con un documento HTML5 semántico y accesible que renderiza los gráficos SVG del DAG, los velocímetros de tokens y la tabla de telemetría.

### FR-200: Atestación Criptográfica y Registro en Ledger
**Event-Driven**: CUANDO el dashboard genera un informe de estado, EL SISTEMA sellará el hash SHA-256 del estado y lo registrará en `EosDurableSqliteLedger` bajo `MISSION_DIRECTION`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-191: HTTP Micro-Server Startup & Port Binding
```gherkin
ESCENARIO: Inicialización y Cierre Limpio de Servidor HTTP
  DADO un puerto local no ocupado
  CUANDO el motor EosTelemetryDashboard inicia el servidor
  ENTONCES responde en el puerto especificado
  Y se detiene de forma limpia sin fugas de sockets
```

### BDD-192: REST Telemetry Endpoint JSON Response
```gherkin
ESCENARIO: Consulta de Telemetría Global del Sistema
  DADO un servidor de telemetría en ejecución
  CUANDO se emite una petición GET hacia "/api/telemetry"
  ENTONCES retorna HTTP 200 con Content-Type "application/json"
  Y el payload contiene version, activeSpecs y epistemicStatus
```

### BDD-193: REST Ledger Endpoint Query & Pagination
```gherkin
ESCENARIO: Consulta de Entradas Recientes del Ledger SQLite WAL
  DADO un servidor de telemetría activo
  CUANDO se emite una petición GET hacia "/api/ledger"
  ENTONCES retorna HTTP 200 con la lista de bloques del ledger
  Y cada entrada incluye su hash SHA-256 y categoría
```

### BDD-194: REST Agent Topology DAG Endpoint
```gherkin
ESCENARIO: Consulta de Estructura Topológica de Subagentes
  DADO un servidor de telemetría activo
  CUANDO se emite una petición GET hacia "/api/topology"
  ENTONCES retorna HTTP 200 con la lista de nodos y aristas del DAG
  Y reporta la estimación de ahorro de tokens superior al 70%
```

### BDD-195: Single-File HTML5 UI Delivery & Semantic Landmarks
```gherkin
ESCENARIO: Renderizado del Panel Visual de Control
  DADO un cliente HTTP solicitando la raíz "/"
  CUANDO el servidor procesa la petición
  ENTONCES retorna HTML5 con código de estado 200
  Y contiene elementos semánticos principales, diagramas SVG y estilos accesibles
```

### BDD-196: MCP Dispatch of eos_dashboard_status via EosMcpServer
```gherkin
ESCENARIO: Invocación de Herramienta MCP eos_dashboard_status
  DADO un servidor EosMcpServer en perfil "core"
  CUANDO se invoca "eos_dashboard_status"
  ENTONCES retorna el resumen de telemetría, URL del dashboard y recibo sellado
```
