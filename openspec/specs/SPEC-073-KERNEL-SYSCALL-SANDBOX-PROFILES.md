# SPEC-073 — KERNEL-GRADE SECCOMP-BPF & SYSCALL SANDBOX PROFILE GENERATOR
**Version**: 68.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-060  
**Architecture Decision Record**: ADR-078  
**Domain Layer**: Layer-0 System Core (`src/core/eosKernelSyscallSandbox.ts`)

---

## 1. Executive Summary
Inspired by AWS Nitro Enclaves, Firecracker MicroVMs, and Linux Seccomp-BPF / Windows AppContainer boundaries, SPEC-073 formalizes the EOS Kernel-Grade Syscall Sandbox Generator. Operating under strict Layer-0 purity with zero external npm dependencies, the engine synthesizes deterministic, OCI-compliant seccomp filter profiles and Windows JobObject containment descriptors. It restricts child processes and subagents to a strictly whitelisted subset of safe POSIX/Win32 syscalls, blocking dangerous kernel calls (`ptrace`, `chroot`, `mount`, `reboot`, unconfined `clone`) with fail-closed default action `SCMP_ACT_ERRNO`.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-254: Generación Determinista de Perfiles Seccomp-BPF
**Ubiquitous / Permanent**: EL SISTEMA generará manifiestos JSON conformes con la especificación OCI Runtime Specification para filtros seccomp, definiendo la acción por defecto `SCMP_ACT_ERRNO` (retorno inmediato de `EPERM` ante cualquier syscall no listada).

### FR-255: Lista Blanca Quirúrgica de Llamadas al Sistema
**State-Driven**: MIENTRAS el agente o subproceso opere dentro del sandbox, EL SISTEMA autorizará únicamente syscalls indispensables para I/O básico (`read`, `write`, `fstat`, `lseek`, `poll`, `mmap`, `close`), bloqueando explícitamente llamadas de escalada de privilegios o escape de red.

### FR-256: Perfil de Contención Windows AppContainer & JobObject
**Ubiquitous / Permanent**: EL SISTEMA generará especificaciones de contención para entornos Windows definiendo límites estrictos de memoria de compromiso (`CommitLimitBytes`), cuotas de CPU, y aislamiento de espacios de nombres de objetos IPC y tuberías.

### FR-257: Atestación Criptográfica en SQLite WAL
**Ubiquitous / Permanent**: EL SISTEMA computará el digest SHA-256 del perfil del sandbox generado y lo persistirá en `EosDurableSqliteLedger` bajo la categoría `SECURITY_AUDIT`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-221: OCI Seccomp Filter Generation with Fail-Closed Default Action
```gherkin
ESCENARIO: Generación de Filtro Seccomp OCI para Agentes Autónomos
  DADO un entorno Linux de ejecución para un subagente
  CUANDO se genera el perfil seccomp
  ENTONCES la acción por defecto es "SCMP_ACT_ERRNO" con errnoRet 1 (EPERM)
  Y las syscalls peligrosas (ptrace, mount, reboot, pivot_root) no figuran en la lista permitida
```

### BDD-222: Windows JobObject Containment Descriptor & SHA-256 Attestation
```gherkin
ESCENARIO: Generación de Descriptor de Límites Windows JobObject
  DADO una directiva de ejecución acotada en Windows
  CUANDO el generador de sandbox emite la configuración
  ENTONCES establece límites máximos de memoria y procesos concurrentes
  Y emite un digest SHA-256 registrado en el Ledger
```
