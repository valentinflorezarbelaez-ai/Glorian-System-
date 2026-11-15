# SPEC-284: Multi-Region Quorum Lease & Distributed Lock Governor

- **Status**: APPROVED
- **Change Reference**: `CHANGE-146`
- **Intake Reference**: `INTAKE-146`
- **Domain**: Distributed Consensus, Quorum Leases, Monotonic Fencing & Mutual Exclusion
- **Date**: 2026-11-15

---

## 1. Functional Requirements (IEEE 830 / EARS)

### FR-284-01: Quorum Lease Consensus Acquisition

- **Event-Driven**: CUANDO un nodo o worker solicita un bloqueo distribuido sobre un recurso con un TTL especificado, EL SISTEMA consultará los nodos del clúster y concederá el bloqueo únicamente si una mayoría estricta ($Q \ge \lfloor N/2 \rfloor + 1$) vota afirmativamente.

### FR-284-02: Strictly Monotonic Fencing Token Generation

- **Ubiquitous / Permanent**: EL SISTEMA asignará a cada bloqueo concedido exitosamente un token de barrera (_fencing token_) entero estrictamente incremental ($f_{token} \in \mathbb{N}$), garantizando que todo bloqueo posterior reciba un token mayor ($f_{token+1} > f_{token}$).

### FR-284-03: Mutual Exclusion Conflict Denial

- **State-Driven**: MIENTRAS un bloqueo se encuentre activo y no haya expirado su TTL, SI otro solicitante intenta adquirir el mismo recurso, ENTONCES EL SISTEMA rechazará la adquisición con estado `DENIED` y código `RESOURCE_LOCKED`.

### FR-284-04: Monotonic TTL Expiration and Automatic Failover

- **State-Driven**: MIENTRAS el tiempo transcurrido desde la concesión o renovación de un bloqueo exceda el TTL configurado sin latidos de renovación, EL SISTEMA considerará el bloqueo como `EXPIRED`, permitiendo que nuevos solicitantes adquieran el recurso de forma segura.

### FR-284-05: Authenticated Renewal and Safe Explicit Release

- **Event-Driven**: CUANDO el propietario legítimo de un bloqueo emite una solicitud de renovación (_renew_) o liberación (_release_) presentando el identificador de recurso, owner y fencing token correctos, EL SISTEMA actualizará el TTL o liberará el recurso respectivamente; de lo contrario rechazará la operación.

### FR-284-06: Verifiable Lock Audit Manifest & Cryptographic Receipt

- **Ubiquitous / Permanent**: EL SISTEMA emitirá un registro de auditoría verificable en `docs/evidence/DISTRIBUTED_LOCK_RECEIPT.json` conteniendo el recurso, owner, fencing token, estado de quórum y firma SHA-256.

---

## 2. BDD Acceptance Criteria

```gherkin
ESCENARIO: BDD-1479 Quorum Consensus Lock Acquisition and Monotonic Fencing Token
  DADO un clúster de 3 nodos configurado con quórum mayoritario Q = 2
  CUANDO un worker "worker-alpha" solicita el bloqueo sobre "db-migration-lock" con TTL = 1000ms
  ENTONCES el bloqueo es concedido con estado ACQUIRED
  Y emite un fencingToken entero estrictamente positivo y monotonicidad garantizada.

ESCENARIO: BDD-1480 Strict Mutual Exclusion and Conflict Rejection
  DADO un recurso bloqueado activamente por "worker-alpha"
  CUANDO un segundo worker "worker-beta" intenta adquirir el mismo recurso antes de que expire el TTL
  ENTONCES la solicitud es rechazada con estado DENIED
  Y el propietario original y el fencingToken permanecen inalterados.

ESCENARIO: BDD-1481 Monotonic Clock TTL Expiration and Preemption
  DADO un recurso con un bloqueo activo cuyo TTL ha transcurrido en el tiempo
  CUANDO un nuevo solicitante "worker-gamma" intenta adquirir el recurso
  ENTONCES el sistema detecta la expiración del lease anterior
  Y concede el bloqueo a "worker-gamma" con un fencingToken estrictamente superior.

ESCENARIO: BDD-1482 Authenticated Heartbeat Renewal
  DADO un bloqueo activo en posesión de "worker-alpha" con fencingToken T
  CUANDO "worker-alpha" emite una renovación válida antes de la expiración del TTL
  ENTONCES el TTL del lease es extendido manteniendo el fencingToken T
  Y solicitudes con owner o fencingToken incorrectos son rechazadas.

ESCENARIO: BDD-1483 Explicit Authenticated Lock Release
  DADO un bloqueo activo en posesión de "worker-alpha"
  CUANDO "worker-alpha" emite un release con sus credenciales válidas
  ENTONCES el estado del recurso cambia a RELEASED
  Y queda inmediatamente disponible para adquisición por cualquier otro worker.

ESCENARIO: BDD-1484 Cryptographic Evidence Receipt Emission
  DADO un bloqueo distribuido concedido o liberado
  CUANDO generateReceipt es invocado
  ENTONCES genera docs/evidence/DISTRIBUTED_LOCK_RECEIPT.json con firma digital SHA-256 verificable.
```
