# SPEC-084: PEER NETWORK TRANSPORT MESH

## 1. Specification Metadata
- **Spec ID**: `SPEC-084`
- **Change**: `CHANGE-063`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148, EOS Formal EARS & BDD Standard
- **Milestone**: Version `71.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)

---

## 2. Functional Requirements (Formal EARS Syntax)

### FR-298: Layer-0 Native Socket Peer Lifecycle
- **Pattern (Event-Driven)**: CUANDO se instancia un nodo `EosPeerNode` con un identificador de nodo y puerto local, EL SISTEMA inicializará un servidor TCP nativo (utilizando exclusivamente `node:net`), enlazará a `127.0.0.1` y administrará el ciclo de vida de conexiones entrantes y salientes sin dependencias npm externas.

### FR-299: Monotonic Sequencing & SHA-256 Frame Framing
- **Pattern (Ubiquitous / Permanent)**: EL SISTEMA enmarcará cada paquete de red en un payload JSON con número de secuencia estrictamente monotónico, marca de tiempo ISO, tipo de mensaje (`HEARTBEAT`, `TRUETIME_SYNC`, `THRESHOLD_SHARE`, `CONSENSUS_VOTE`) y firma criptográfica SHA-256 calculada sobre el contenido.

### FR-300: Anti-Tamper Frame Verification & Replay Protection
- **Pattern (Error / Unwanted Condition)**: SI un frame recibido presenta una firma SHA-256 divergente, un número de secuencia menor o igual al último procesado de ese par, o un payload no deserializable, ENTONCES EL SISTEMA descartará el mensaje de forma fail-closed, emitirá una alerta de anomalía y preservará la integridad del estado local.

### FR-301: Clean Disconnect & Drain
- **Pattern (Event-Driven)**: CUANDO se invoque el método `stop()` en un nodo de red, EL SISTEMA cerrará ordenadamente todos los sockets activos, cancelará temporizadores de latido y liberará el puerto TCP en menos de 100 ms.

---

## 3. Acceptance Criteria (BDD Gherkin Standard)

```gherkin
ESCENARIO: BDD-243: Comunicación bidireccional entre nodos pares locales
  DADO dos nodos EosPeerNode iniciados en puertos locales diferentes
  CUANDO el nodo A se conecta al nodo B y transmite un mensaje "TRUETIME_SYNC"
  ENTONCES el nodo B recibe el mensaje con verificación SHA-256 intacta
  Y el número de secuencia monotónico es validado exitosamente.

ESCENARIO: BDD-244: Rechazo fail-closed de frames manipulados o repetidos
  DADO un nodo EosPeerNode en escucha
  CUANDO se inyecta un frame con hash SHA-256 alterado o secuencia duplicada
  ENTONCES el nodo receptor descarta el payload inmediatamente sin alterar su estado
  Y registra el intento anómalo en la telemetría.
```
