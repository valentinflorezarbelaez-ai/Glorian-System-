# SPEC-081 — MICROVM HARDWARE ENCLAVE LAUNCHER (FIRECRACKER / HYPER-V)
**Version**: 70.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-062  
**Architecture Decision Record**: ADR-086  
**Domain Layer**: Layer-0 System Core (`src/core/eosMicroVmEnclaveLauncher.ts`)

---

## 1. Executive Summary
Inspired by AWS Nitro Enclaves, Firecracker MicroVMs, and Google Cloud gVisor hardware virtualization isolation, SPEC-081 formalizes the EOS MicroVM Hardware Enclave Launcher. Operating under strict Layer-0 purity with zero external npm dependencies, the engine generates and verifies Type-1/Type-2 hardware-assisted virtualization container profiles (Firecracker OCI JSON descriptors and Windows Hyper-V isolation specifications). It enforces dedicated guest kernel memory boundaries, hardware vCPU pinning, and vsock communication channels, shielding the host operating system from rogue agent execution.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-286: Firecracker MicroVM Hardware Descriptor Generation
**Ubiquitous / Permanent**: EL SISTEMA generará especificaciones de configuración de microVM conformes con la API de Firecracker (vCPU count, mem_size_mib, kernel_image_path, rootfs_drive, vsock_device) con firmas SHA-256 de todas las imágenes fijadas.

### FR-287: Windows Hyper-V Isolated Container Specification
**Ubiquitous / Permanent**: EL SISTEMA generará descriptores de aislamiento Hyper-V (`--isolation=hyperv` / Windows Server Containers) cuando se ejecute en el entorno anfitrión Windows, garantizando que el contenedor opere sobre su propio kernel virtualizado.

### FR-288: Diagnóstico de Capacidades de Virtualización de Hardware del Anfitrión
**State-Driven**: MIENTRAS se prepare un entorno de ejecución en enclave, EL SISTEMA inspeccionará las capacidades de virtualización del CPU (Intel VT-x / AMD-V) y la disponibilidad de dispositivos `/dev/kvm` o servicios Hyper-V, emitiendo un diagnóstico verificable.

### FR-289: Emisión de Recibo de Lanzamiento de Enclave Criptográfico
**Ubiquitous / Permanent**: EL SISTEMA emitirá un recibo SHA-256 inmutable registrando los parámetros de la microVM, memoria asignada y firma del kernel en `EosDurableSqliteLedger`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-237: Deterministic Firecracker MicroVM Descriptor Generation
```gherkin
ESCENARIO: Generación de Perfil de Aislamiento Firecracker MicroVM
  DADO un requerimiento de aislamiento de enclave para un subagente
  CUANDO se genera la configuración con 2 vCPUs y 512 MiB de memoria
  ENTONCES el descriptor JSON contiene las secciones 'boot-source', 'drives', 'machine-config' y 'vsock'
  Y el hash SHA-256 del perfil tiene exactamente 64 caracteres hexadecimales
```

### BDD-238: Hardware Virtualization Capability Evaluation and Fail-Closed Guard
```gherkin
ESCENARIO: Diagnóstico de Virtualización de Hardware en el Host
  DADO un entorno de ejecución local
  CUANDO se auditan las capacidades de virtualización del sistema
  ENTONCES el sistema reporta la arquitectura del procesador y la compatibilidad con microVMs
  Y establece el modo de aislamiento (NATIVO o EMULADO_CONFINADO) de forma fail-closed
```
