# SPEC-086: AWS NITRO / FIRECRACKER MICROVM DAEMON SUPERVISOR & UNIX SOCKET IPC

## 1. Specification Metadata
- **Spec ID**: `SPEC-086`
- **Change**: `CHANGE-064`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148, EOS Formal EARS & BDD Standard
- **Milestone**: Version `72.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)

---

## 2. Functional Requirements (Formal EARS Syntax)

### FR-306: Unix Domain Socket Lifecycle & IPC Controller
- **Pattern (Event-Driven)**: CUANDO se inicialice una instancia de `EosFirecrackerDaemonSupervisor` con un identificador de enclave y ruta de socket Unix (`/tmp/firecracker-<id>.socket`), EL SISTEMA creará o verificará el socket local con permisos restringidos `0600` y establecerá un canal IPC bidireccional puro sin dependencias externas.

### FR-307: Declarative Action & Machine Config Handshake
- **Pattern (Ubiquitous / Permanent)**: EL SISTEMA enviará peticiones HTTP/1.1 sobre el socket Unix con payloads JSON para configurar la máquina (`machine-config`), cargar el kernel (`boot-source`), adjuntar la imagen raíz (`drives`) e iniciar la microVM (`InstanceStart`).

### FR-308: Multi-Platform Fallback & Hermetic Isolation
- **Pattern (State-Driven)**: MIENTRAS el entorno anfitrión no sea Linux con acceso a `/dev/kvm` (e.g. Windows o contenedor no privilegiado), EL SISTEMA ejecutará el supervisor en modo de simulación determinista hermética con contratos de respuesta idénticos a los del binario Firecracker real.

### FR-309: Graceful Process Teardown & Socket Cleanup
- **Pattern (Event-Driven)**: CUANDO se invoque `terminate()` o se reciba una señal de interrupción, EL SISTEMA enviará `SendCtrlAltDel` a la microVM, esperará el drenado de I/O por un máximo de 500 ms, forzará la terminación del proceso si persiste y eliminará el archivo de socket Unix.

---

## 3. Acceptance Criteria (BDD Gherkin Standard)

```gherkin
ESCENARIO: BDD-247: Configuración declarativa e inicialización de microVM vía Socket IPC
  DADO un supervisor EosFirecrackerDaemonSupervisor instanciado para un enclave
  CUANDO se ejecuta el ciclo de configuración declarativa (machine-config, boot-source, drives)
  ENTONCES la secuencia de comandos retorna estado 204/200 con código de salida limpio
  Y el estado del enclave pasa a "RUNNING".

ESCENARIO: BDD-248: Terminación ordenada y eliminación de sockets Unix
  DADO un supervisor con una microVM activa
  CUANDO se invoca terminate()
  ENTONCES todos los procesos asociados se detienen en menos de 500 ms
  Y el archivo de socket Unix es purgado del sistema de archivos.
```
